import { route, json, body } from '@/lib/api';
import { q, one, tx, HttpError } from '@/lib/db';
import { str, int, discordId, TEN_YEARS } from '@/lib/util';
import { requireAdmin, clientIp, getUser } from '@/lib/auth';
import { banUntil, strike, subjectsOf, listBans, removeBan } from '@/lib/guard';
import { getSettings, clearSettingsCache } from '@/lib/settings';
import { DEFAULT_SETTINGS } from '@/lib/schema';
import { issueKeys, cleanPrefix, searchKeys, keyView, resetHwid, rekey, adminAction, summarize, logEvent } from '@/lib/keys';
import { adminKeyViews } from '@/lib/owners';
import { publicProfile, anonProfile } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const ACTIONS = ['revoke', 'unrevoke', 'extend', 'assign', 'note'];

async function handle(req, { params }) {
  const ip = await clientIp();
  // คนที่ไม่ใช่แอดมินยิง API หลังบ้าน → ปฏิเสธ + แบนชั่วคราว
  const me = await getUser();
  if (!me || me.role !== 'admin') {
    const subjects = subjectsOf(ip, me);
    if (!(await banUntil(subjects))) await strike(subjects, 'พยายามเรียก API หลังบ้านโดยไม่มีสิทธิ์');
    throw new HttpError(403, 'ปฏิเสธการเข้าถึง');
  }
  const admin = await requireAdmin();
  const actor = 'admin:' + admin.discord_id;
  const [res, id, act] = (await params).path;
  const m = req.method;
  const sp = new URL(req.url).searchParams;
  const nid = () => int(id, { min: 1, name: 'รหัส' });

  // ---------- ภาพรวม ----------
  if (res === 'stats' && m === 'GET') {
    const [s, daily, soon] = await Promise.all([
      one(`SELECT (SELECT count(*)::int FROM kx_keys) total,
                  (SELECT count(*)::int FROM kx_keys WHERE NOT revoked AND activated_at IS NOT NULL AND (expires_at IS NULL OR expires_at > now())) active,
                  (SELECT count(*)::int FROM kx_keys WHERE NOT revoked AND activated_at IS NULL) unused,
                  (SELECT count(*)::int FROM kx_keys WHERE NOT revoked AND expires_at IS NOT NULL AND expires_at <= now()) expired,
                  (SELECT count(*)::int FROM kx_keys WHERE revoked) revoked,
                  (SELECT count(*)::int FROM kx_keys WHERE hwid IS NOT NULL) bound,
                  (SELECT count(*)::int FROM kx_keys WHERE last_check_at > now() - interval '24 hours') seen_24h,
                  (SELECT count(*)::int FROM kx_users) users,
                  (SELECT count(*)::int FROM kx_logs WHERE action='hwid_mismatch' AND at > now() - interval '24 hours') mismatches_24h`),
      q(`SELECT to_char(d::date,'YYYY-MM-DD') AS day, coalesce(c.n,0)::int AS n
           FROM generate_series((now() AT TIME ZONE 'Asia/Bangkok')::date - 13, (now() AT TIME ZONE 'Asia/Bangkok')::date, interval '1 day') d
           LEFT JOIN (SELECT (created_at AT TIME ZONE 'Asia/Bangkok')::date AS day, count(*) n FROM kx_keys GROUP BY 1) c ON c.day = d::date
          ORDER BY d`),
      q(`SELECT * FROM kx_keys WHERE NOT revoked AND expires_at > now() AND expires_at < now() + interval '7 days' ORDER BY expires_at LIMIT 8`),
    ]);
    return json({ ...s, daily: daily.rows, expiring: await adminKeyViews(soon.rows), server_time: Date.now() });
  }

  // ---------- คีย์ ----------
  if (res === 'keys') {
    if (m === 'GET' && !id) {
      const { rows, total } = await searchKeys({ term: sp.get('q'), status: sp.get('status'), discordId: sp.get('owner') || '', limit: sp.get('limit'), offset: sp.get('offset') });
      return json({ rows: await adminKeyViews(rows), total, server_time: Date.now() });
    }
    if (m === 'GET') { // รายละเอียด 1 คีย์ + ประวัติ
      const row = await one('SELECT * FROM kx_keys WHERE id=$1', [nid()]);
      if (!row) throw new HttpError(404, 'ไม่พบคีย์');
      const [view] = await adminKeyViews([row]);
      const logs = (await q('SELECT id,action,actor,detail,ip,at FROM kx_logs WHERE key_id=$1 ORDER BY id DESC LIMIT 60', [row.id])).rows;
      return json({ key: view, logs, server_time: Date.now() });
    }
    if (m === 'POST' && id === 'bulk') { // จัดการหลายคีย์พร้อมกัน
      const b = await body(req);
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
      if (!ids.length) throw new HttpError(400, 'ยังไม่ได้เลือกคีย์');
      // ลบ/ระงับ → สคริปต์ในเกมจะเช็ก /api/keys/heartbeat ทุก ~10 วิ แล้วเตะผู้เล่นออกทันที
      if (b.action === 'delete') await q('DELETE FROM kx_keys WHERE id = ANY($1)', [ids]);
      else if (b.action === 'revoke' || b.action === 'unrevoke') {
        await tx(async (c) => {
          const r = await c.query('UPDATE kx_keys SET revoked=$2 WHERE id = ANY($1) RETURNING id,key', [ids, b.action === 'revoke']);
          for (const k of r.rows) await logEvent(c, k.id, k.key, b.action, actor, 'ทำหลายรายการ', ip);
        });
      } else throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
      return json({ ok: true, count: ids.length });
    }
    if (m === 'POST') { // ออกคีย์
      const b = await body(req);
      const qty = int(b.qty ?? 1, { min: 1, max: 500, name: 'จำนวน' });
      const seconds = int(b.seconds ?? 0, { min: 0, max: TEN_YEARS, name: 'อายุคีย์' });
      const settings = await getSettings();
      const keys = await tx((c) => issueKeys(c, {
        qty, seconds,
        prefix: cleanPrefix(b.prefix, cleanPrefix(settings.default_prefix)),
        startMode: b.startMode === 'issue' ? 'issue' : 'activate',
        hwidLock: b.hwidLock !== false,
        label: str(b.label, { max: 60 }),
        note: str(b.note, { max: 120 }),
        discordId: discordId(b.discordId),
        actor,
      }));
      return json({ keys });
    }
    if (m === 'PUT') {
      const kid = nid();
      if (act === 'reset-hwid') await resetHwid({ id: kid, force: true, actor, ip });
      else if (act === 'reset-hwid-quota') await resetHwid({ id: kid, force: true, restoreQuota: true, actor, ip });
      else if (act === 'rekey') return json({ ok: true, key: (await rekey({ id: kid, force: true, actor, ip })).key });
      else if (ACTIONS.includes(act)) {
        const b = ['extend', 'assign', 'note'].includes(act) ? await body(req) : {};
        await adminAction({ id: kid, act, days: b.days, discordId: act === 'assign' ? discordId(b.discordId) : null, note: b.note, actor, ip });
      } else throw new HttpError(404, 'ไม่พบคำสั่ง');
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      await q('DELETE FROM kx_keys WHERE id=$1', [nid()]);
      return json({ ok: true });
    }
  }

  // ---------- ผู้ใช้ / โปรไฟล์ ----------
  if (res === 'users') {
    if (m === 'GET' && !id) {
      const term = (sp.get('q') || '').trim().slice(0, 60);
      const like = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
      const { rows } = await q(
        `SELECT u.*, (SELECT count(*)::int FROM kx_keys k WHERE k.discord_id=u.discord_id) AS key_count
           FROM kx_users u WHERE ($1='' OR u.discord_id ILIKE $2 OR u.username ILIKE $2 OR u.name ILIKE $2)
          ORDER BY u.last_login_at DESC LIMIT 100`, [term, like]);
      return json({ rows: rows.map((u) => ({ ...publicProfile(u), key_count: u.key_count })) });
    }
    const did = discordId(id, { optional: false });
    if (m === 'GET') {
      const u = await one('SELECT * FROM kx_users WHERE discord_id=$1', [did]);
      const keys = (await q('SELECT * FROM kx_keys WHERE discord_id=$1 ORDER BY id DESC LIMIT 200', [did])).rows;
      return json({ profile: u ? publicProfile(u) : anonProfile(did), registered: !!u, keys: await adminKeyViews(keys), stats: summarize(keys), server_time: Date.now() });
    }
    if (m === 'PUT' && (act === 'ban' || act === 'unban')) {
      if (did === admin.discord_id) throw new HttpError(400, 'ระงับตัวเองไม่ได้');
      const r = await q('UPDATE kx_users SET banned=$2 WHERE discord_id=$1 RETURNING id', [did, act === 'ban']);
      if (!r.rows[0]) throw new HttpError(404, 'ผู้ใช้นี้ยังไม่เคยล็อกอินเว็บ');
      if (act === 'ban') await q('DELETE FROM kx_sessions WHERE user_id=$1', [r.rows[0].id]);
      return json({ ok: true });
    }
  }

  // ---------- รายการที่ถูกแบนชั่วคราว ----------
  if (res === 'bans') {
    if (m === 'GET') return json({ rows: await listBans(), server_time: Date.now() });
    if (m === 'DELETE') { await removeBan(nid()); return json({ ok: true }); }
  }

  // ---------- ตั้งค่า ----------
  if (res === 'settings') {
    if (m === 'GET') return json({ settings: await getSettings() });
    if (m === 'PUT') {
      const b = await body(req);
      const out = {};
      const text = (k, max, min = 0) => { if (b[k] !== undefined) out[k] = str(b[k], { min, max, name: k }); };
      text('site_name', 40, 1);
      if (b.default_prefix !== undefined) out.default_prefix = cleanPrefix(b.default_prefix);
      for (const k of ['user_reset_enabled', 'user_rekey_enabled']) if (b[k] !== undefined) out[k] = b[k] === true || b[k] === '1' ? '1' : '0';
      const num = (k, max) => { if (b[k] !== undefined) out[k] = String(int(b[k], { min: 0, max, name: k })); };
      num('reset_cooldown_hours', 24 * 90); num('reset_max', 1000); num('rekey_max', 1000);
      const entries = Object.entries(out).filter(([k]) => k in DEFAULT_SETTINGS);
      for (const [k, v] of entries) await q('INSERT INTO kx_settings(key,value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [k, v]);
      clearSettingsCache();
      return json({ settings: await getSettings() });
    }
  }

  throw new HttpError(404, 'ไม่พบเส้นทางนี้');
}

export const GET = route(handle);
export const POST = route(handle);
export const PUT = route(handle);
export const DELETE = route(handle);
