import crypto from 'crypto';
import { q, one, tx, HttpError } from './db';
import { resolveRoblox, robloxProfileUrl } from './roblox';
import { getPolicy } from './settings';

// ตัดตัวที่สับสนง่าย (0/O, 1/I) ออก เหลือ 32 ตัว → คีย์ 12 ตัวสุ่ม = 60 บิต เดาไม่ได้
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randGroup = (n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

export const cleanPrefix = (p, fallback = 'NEXUSHUBX') => {
  const v = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return v.length >= 2 ? v : fallback;
};
export const KEY_RE = /^[A-Z0-9]{2,12}(-[A-Z0-9]{4}){3}$/;
const newKey = (prefix) => `${prefix}-${randGroup(4)}-${randGroup(4)}-${randGroup(4)}`;
export const normKey = (k) => String(k || '').trim().toUpperCase();

/** บันทึกประวัติ (c = client หรือ pool) */
export async function logEvent(c, keyId, keyText, action, actor = 'system', detail = '', ip = '') {
  await c.query('INSERT INTO kx_logs(key_id,key_text,action,actor,detail,ip) VALUES($1,$2,$3,$4,$5,$6)', [keyId, keyText, action, actor, String(detail).slice(0, 300), String(ip).slice(0, 64)]);
}

/**
 * ออกคีย์ใหม่ (เรียกภายใน transaction)
 *  startMode: 'activate' = เริ่มนับเวลาเมื่อใช้ครั้งแรก | 'issue' = เริ่มนับตั้งแต่ออกคีย์
 */
export async function issueKeys(c, { qty = 1, seconds = 86400, prefix = 'NEXUSHUBX', startMode = 'activate', hwidLock = true, label = '', note = '', discordId = null, actor = 'system' }) {
  const secs = Math.max(0, Math.floor(Number(seconds) || 0));
  const pre = cleanPrefix(prefix);
  const now = startMode === 'issue';
  const out = [];
  for (let i = 0; i < qty; i++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const r = await c.query(
        `INSERT INTO kx_keys(key,discord_id,label,seconds,start_mode,hwid_lock,note,created_by,activated_at,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $9::boolean THEN now() END,
                CASE WHEN $9::boolean AND $4::bigint > 0 THEN now() + make_interval(secs => $4::double precision) END)
         ON CONFLICT (key) DO NOTHING RETURNING id,key`,
        [newKey(pre), discordId, label, secs, now ? 'issue' : 'activate', !!hwidLock, note, actor, now]
      );
      if (r.rows[0]) { out.push(r.rows[0]); break; }
      if (attempt === 7) throw new HttpError(500, 'สร้างคีย์ไม่สำเร็จ');
    }
  }
  if (out.length) {
    await c.query(
      `INSERT INTO kx_logs(key_id,key_text,action,actor,detail) SELECT x.id,x.key,'created',$3,$4 FROM unnest($1::int[],$2::text[]) AS x(id,key)`,
      [out.map((r) => r.id), out.map((r) => r.key), actor, `${label || 'คีย์'} · ${secs ? (secs >= 86400 ? Math.round((secs / 86400) * 10) / 10 + ' วัน' : secs >= 3600 ? Math.round((secs / 3600) * 10) / 10 + ' ชม.' : Math.max(1, Math.round(secs / 60)) + ' นาที') : 'ตลอดชีพ'}${discordId ? ' · ให้ ' + discordId : ''}`]
    );
  }
  return out.map((r) => r.key);
}

// ---------- สถานะ & รูปแบบข้อมูลที่ส่งออก ----------
export function statusOf(row) {
  if (row.revoked) return 'revoked';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  if (!row.activated_at) return 'unused';
  return Number(row.seconds) === 0 ? 'lifetime' : 'active';
}

const iso = (d) => (d ? new Date(d).toISOString() : null);
export const maskHwid = (h) => (!h ? null : h.length <= 10 ? h.slice(0, 3) + '…' : `${h.slice(0, 6)}…${h.slice(-4)}`);

/** สิทธิ์รีเซ็ต/รีคีย์ของเจ้าของคีย์ตามนโยบาย */
export function ownerLimits(row, pol) {
  const cd = pol.cooldown_hours * 3600 * 1000;
  const wait = (last) => (last && cd ? new Date(last).getTime() + cd : 0);
  const mk = (enabled, used, max, last, extra) => {
    let reason = null;
    const nextAt = wait(last);
    if (!enabled) reason = 'ผู้ดูแลปิดฟีเจอร์นี้ไว้';
    else if (row.revoked) reason = 'คีย์ถูกระงับ';
    else if (extra) reason = extra;
    else if (max > 0 && used >= max) reason = `ใช้สิทธิ์ครบ ${max} ครั้งแล้ว`;
    else if (nextAt > Date.now()) reason = 'cooldown';
    return { allowed: !reason, reason, next_at: reason === 'cooldown' ? new Date(nextAt).toISOString() : null, used, max, left: max > 0 ? Math.max(0, max - used) : null };
  };
  return {
    reset: mk(pol.reset_enabled, row.hwid_resets, pol.reset_max, row.last_reset_at, !row.hwid ? 'ยังไม่มีเครื่องที่ผูกไว้' : null),
    rekey: mk(pol.rekey_enabled, row.rekeys, pol.rekey_max, row.last_rekey_at, null),
  };
}

/**
 * รูปแบบข้อมูลคีย์
 *  mode: 'public' (สคริปต์/ตรวจคีย์) | 'owner' (เจ้าของคีย์) | 'admin' (แอดมิน/บอท — เห็นทุกอย่าง)
 */
export function keyView(row, mode = 'public', pol = null) {
  if (!row) return null;
  const secs = Number(row.seconds);
  const exp = row.expires_at ? new Date(row.expires_at) : null;
  const out = {
    key: row.key,
    label: row.label,
    product: row.label, // ชื่อเดิม (เข้ากันได้กับสคริปต์รุ่นก่อน)
    status: statusOf(row),
    lifetime: secs === 0,
    duration_seconds: secs,
    start_mode: row.start_mode,
    activated_at: iso(row.activated_at),
    expires_at: iso(exp),
    remaining_seconds: exp ? Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000)) : row.activated_at ? null : secs || null,
    hwid_locked: !!row.hwid_lock,
    hwid_bound: !!row.hwid,
    roblox: row.roblox_id
      ? { id: String(row.roblox_id), name: row.roblox_name, display_name: row.roblox_display || row.roblox_name, avatar: row.roblox_avatar || null, profile_url: robloxProfileUrl(row.roblox_id), seen_at: iso(row.roblox_seen_at) }
      : null,
  };
  if (mode === 'public') return out;
  out.id = row.id;
  out.created_at = iso(row.created_at);
  out.last_check_at = iso(row.last_check_at);
  out.discord_id = row.discord_id || null;
  out.hwid_bound_at = iso(row.hwid_bound_at);
  out.hwid_resets = row.hwid_resets;
  out.rekeys = row.rekeys;
  if (mode === 'owner') {
    out.hwid = maskHwid(row.hwid);
    if (pol) out.limits = ownerLimits(row, pol);
    return out;
  }
  out.hwid = row.hwid || null;
  out.note = row.note;
  out.uses = Number(row.uses);
  out.last_ip = row.last_ip || null;
  out.created_by = row.created_by;
  return out;
}

// ---------- ตรวจคีย์ (API สาธารณะ) ----------
const MSG = {
  OK: 'คีย์ใช้งานได้',
  UNUSED: 'คีย์ยังไม่ถูกใช้งาน (ยังไม่เริ่มนับเวลา)',
  NOT_FOUND: 'ไม่พบคีย์นี้',
  BAD_FORMAT: 'รูปแบบคีย์ไม่ถูกต้อง',
  EXPIRED: 'คีย์หมดอายุแล้ว',
  REVOKED: 'คีย์ถูกระงับ',
  DISCORD_REQUIRED: 'ต้องล็อกอินด้วย Discord ที่เว็บแล้วผูกคีย์นี้กับบัญชีของคุณก่อน',
  BANNED: 'บัญชี Discord เจ้าของคีย์ถูกระงับ',
  HWID_REQUIRED: 'คีย์นี้ต้องส่งรหัสเครื่อง (hwid) มาด้วย',
  HWID_MISMATCH: 'คีย์นี้ถูกผูกกับเครื่องอื่นแล้ว',
};
const reply = (row, code) => ({ valid: code === 'OK' || code === 'UNUSED', code, message: MSG[code], ...keyView(row, 'public'), server_time: Date.now() });

/**
 *  - ปกติ: ตรวจ + เริ่มนับเวลาครั้งแรก + ผูกเครื่อง (hwid) ครั้งแรกที่ส่งมา + บันทึกโปรไฟล์ Roblox
 *  - ไม่ต้องล็อกอิน Discord (ผูกบัญชีเป็นทางเลือก ไว้จัดการคีย์/รีเซ็ต HWID เองที่เว็บ)
 *  - check=true: ดูสถานะเฉยๆ ไม่เริ่มนับเวลา ไม่ผูกเครื่อง
 */
export async function verifyKey(rawKey, { hwid = '', check = false, roblox = null, ip = '' } = {}) {
  const key = normKey(rawKey);
  if (!KEY_RE.test(key)) return { valid: false, code: 'BAD_FORMAT', message: MSG.BAD_FORMAT, server_time: Date.now() };
  const hw = String(hwid || '').trim().slice(0, 128);
  const rb = !check && roblox ? await resolveRoblox(roblox) : null; // เรียกเครือข่ายภายนอกก่อนเข้า transaction

  return tx(async (c) => {
    const row = (await c.query('SELECT * FROM kx_keys WHERE key=$1 FOR UPDATE', [key])).rows[0];
    if (!row) return { valid: false, code: 'NOT_FOUND', message: MSG.NOT_FOUND, server_time: Date.now() };
    if (row.revoked) return reply(row, 'REVOKED');
    if (row.expires_at && new Date(row.expires_at) <= new Date()) return reply(row, 'EXPIRED');
    // ไม่บังคับล็อกอิน Discord — ใส่คีย์แล้วใช้ได้เลย (ถ้าคีย์ถูกผูกกับบัญชีที่โดนแบน ถึงจะไม่ผ่าน)
    if (row.discord_id) {
      const owner = (await c.query('SELECT banned FROM kx_users WHERE discord_id=$1', [row.discord_id])).rows[0];
      if (owner?.banned) return reply(row, 'BANNED');
    }
    if (check) return reply(row, row.activated_at ? 'OK' : 'UNUSED');

    if (row.hwid_lock) {
      if (!hw) return reply(row, 'HWID_REQUIRED');
      if (row.hwid && row.hwid !== hw) {
        await c.query( // บันทึกความพยายามใช้ผิดเครื่อง (ไม่ซ้ำเกิน 1 ครั้ง/10 นาที)
          `INSERT INTO kx_logs(key_id,key_text,action,actor,detail,ip)
           SELECT $1,$2,'hwid_mismatch','system','ส่ง HWID ไม่ตรงกับที่ผูกไว้',$3
            WHERE NOT EXISTS (SELECT 1 FROM kx_logs WHERE key_id=$1 AND action='hwid_mismatch' AND at > now() - interval '10 minutes')`,
          [row.id, row.key, ip]
        );
        return reply(row, 'HWID_MISMATCH');
      }
    }
    const sets = ['last_check_at=now()', 'uses=uses+1', 'last_ip=$2', 'hwid=COALESCE(hwid,$3)', 'hwid_bound_at=CASE WHEN hwid IS NULL AND $3::text IS NOT NULL THEN now() ELSE hwid_bound_at END'];
    const args = [row.id, ip || null, hw || null];
    if (!row.activated_at) {
      sets.push('activated_at=now()', "expires_at = CASE WHEN seconds>0 THEN now() + (seconds || ' seconds')::interval END");
    }
    if (rb?.id) {
      args.push(rb.id, rb.name, rb.display, rb.avatar);
      sets.push(`roblox_id=$${args.length - 3}`, `roblox_name=$${args.length - 2}`, `roblox_display=$${args.length - 1}`, `roblox_avatar=$${args.length}`, 'roblox_seen_at=now()');
    }
    const r = (await c.query(`UPDATE kx_keys SET ${sets.join(',')} WHERE id=$1 RETURNING *`, args)).rows[0];
    if (!row.activated_at) await logEvent(c, row.id, row.key, 'activate', 'system', 'เริ่มนับเวลาใช้งาน', ip);
    if (!row.hwid && hw) await logEvent(c, row.id, row.key, 'hwid_bind', 'system', 'ผูกเครื่อง ' + maskHwid(hw), ip);
    return reply(r, 'OK');
  });
}

/**
 * เช็กว่าคีย์ "ยังมีสิทธิ์อยู่ในเกม" ไหม (อ่านอย่างเดียว ไม่เริ่มนับเวลา ไม่ผูกเครื่อง)
 * kick=true เมื่อสิทธิ์หมดแน่ๆ: ลบ(NOT_FOUND) / ระงับ(REVOKED) / หมดอายุ(EXPIRED) / เจ้าของโดนแบน(BANNED) / ผิดเครื่อง(HWID_MISMATCH)
 */
export async function heartbeat(rawKey, hwid = '') {
  const key = normKey(rawKey);
  const dead = (code) => ({ alive: false, kick: true, code, message: MSG[code] });
  if (!KEY_RE.test(key)) return dead('BAD_FORMAT');
  const row = await one('SELECT revoked, expires_at, activated_at, hwid, hwid_lock, discord_id FROM kx_keys WHERE key=$1', [key]);
  if (!row) return dead('NOT_FOUND');
  if (row.revoked) return dead('REVOKED');
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return dead('EXPIRED');
  const hw = String(hwid || '').trim().slice(0, 128);
  if (row.hwid_lock && row.hwid && hw && row.hwid !== hw) return dead('HWID_MISMATCH');
  if (row.discord_id) {
    const owner = await one('SELECT banned FROM kx_users WHERE discord_id=$1', [row.discord_id]);
    if (owner?.banned) return dead('BANNED');
  }
  return { alive: true, kick: false, code: 'OK', message: MSG.OK };
}

// ---------- จัดการคีย์ (ใช้ร่วมกันระหว่างผู้ใช้ / แอดมิน / บอท) ----------
const lockKey = async (c, where, args) => {
  const row = (await c.query(`SELECT * FROM kx_keys WHERE ${where} FOR UPDATE`, args)).rows[0];
  if (!row) throw new HttpError(404, 'ไม่พบคีย์');
  return row;
};

/**
 * รีเซ็ต HWID (ล้างเครื่องที่ผูกไว้ → ผูกใหม่ตอนใช้ครั้งถัดไป)
 *  owner = discord id ของผู้ใช้ที่กดเอง (บังคับตามนโยบาย) | force = แอดมิน/บอท ข้ามนโยบาย
 */
export async function resetHwid({ id, key, owner = null, force = false, restoreQuota = false, actor = 'system', ip = '' }) {
  const pol = await getPolicy();
  return tx(async (c) => {
    const row = await (id ? lockKey(c, 'id=$1', [id]) : lockKey(c, 'key=$1', [key]));
    if (owner && row.discord_id !== owner) throw new HttpError(404, 'ไม่พบคีย์ในบัญชีของคุณ');
    if (!force) {
      const lim = ownerLimits(row, pol).reset;
      if (!lim.allowed) throw new HttpError(429, lim.reason === 'cooldown' ? 'รีเซ็ตบ่อยเกินไป กรุณารอจนกว่าจะครบเวลาที่กำหนด' : lim.reason);
    } else if (row.revoked) throw new HttpError(400, 'คีย์ถูกระงับ');
    const r = (await c.query(
      `UPDATE kx_keys SET hwid=NULL, hwid_bound_at=NULL,
              hwid_resets = CASE WHEN $2 THEN hwid_resets+1 WHEN $3 THEN 0 ELSE hwid_resets END,
              last_reset_at = CASE WHEN $2 THEN now() ELSE last_reset_at END
        WHERE id=$1 RETURNING *`, [row.id, !force, restoreQuota])).rows[0];
    await logEvent(c, row.id, row.key, 'hwid_reset', actor, force ? 'รีเซ็ต HWID' + (restoreQuota ? ' + คืนโควต้า' : '') : 'ผู้ใช้รีเซ็ต HWID เอง', ip);
    return r;
  });
}

/** รีคีย์: ออกรหัสคีย์ใหม่แทนอันเดิม (เวลาที่เหลือ/เจ้าของคงเดิม ล้าง HWID) คีย์เก่าใช้ไม่ได้ทันที */
export async function rekey({ id, key, owner = null, force = false, actor = 'system', ip = '' }) {
  const pol = await getPolicy();
  return tx(async (c) => {
    const row = await (id ? lockKey(c, 'id=$1', [id]) : lockKey(c, 'key=$1', [key]));
    if (owner && row.discord_id !== owner) throw new HttpError(404, 'ไม่พบคีย์ในบัญชีของคุณ');
    if (row.revoked) throw new HttpError(400, 'คีย์ถูกระงับ');
    if (!force) {
      const lim = ownerLimits(row, pol).rekey;
      if (!lim.allowed) throw new HttpError(429, lim.reason === 'cooldown' ? 'รีคีย์บ่อยเกินไป กรุณารอจนกว่าจะครบเวลาที่กำหนด' : lim.reason);
    }
    const prefix = row.key.split('-')[0];
    for (let i = 0; i < 8; i++) {
      const nk = newKey(prefix);
      const r = await c.query(
        `UPDATE kx_keys SET key=$2, hwid=NULL, hwid_bound_at=NULL,
                rekeys = CASE WHEN $3 THEN rekeys+1 ELSE rekeys END,
                last_rekey_at = CASE WHEN $3 THEN now() ELSE last_rekey_at END
          WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM kx_keys WHERE key=$2) RETURNING *`, [row.id, nk, !force]);
      if (r.rows[0]) {
        await logEvent(c, row.id, nk, 'rekey', actor, `${row.key} → ${nk}`, ip);
        return r.rows[0];
      }
    }
    throw new HttpError(500, 'สร้างคีย์ใหม่ไม่สำเร็จ');
  });
}

/** เจ้าของกรอกคีย์เพื่อผูกเข้าบัญชี Discord ของตัวเอง */
export async function claimKey({ key, discordId, ip = '' }) {
  const k = normKey(key);
  if (!KEY_RE.test(k)) throw new HttpError(400, 'รูปแบบคีย์ไม่ถูกต้อง');
  return tx(async (c) => {
    const row = (await c.query('SELECT * FROM kx_keys WHERE key=$1 FOR UPDATE', [k])).rows[0];
    if (!row) throw new HttpError(404, 'ไม่พบคีย์นี้');
    if (row.revoked) throw new HttpError(400, 'คีย์นี้ถูกระงับ');
    if (row.discord_id && row.discord_id !== discordId) throw new HttpError(409, 'คีย์นี้ถูกผูกกับบัญชีอื่นแล้ว');
    if (row.discord_id === discordId) return row;
    const r = (await c.query('UPDATE kx_keys SET discord_id=$2 WHERE id=$1 RETURNING *', [row.id, discordId])).rows[0];
    await logEvent(c, row.id, row.key, 'claim', 'user:' + discordId, 'ผูกคีย์กับบัญชี Discord', ip);
    return r;
  });
}

/** ปรับเวลา (วัน — ติดลบได้) / เปลี่ยนเจ้าของ / ระงับ / ลบ ฯลฯ สำหรับแอดมินและบอท */
export async function adminAction({ id, key, act, days, discordId, note, actor = 'admin', ip = '' }) {
  return tx(async (c) => {
    const row = await (id ? lockKey(c, 'id=$1', [id]) : lockKey(c, 'key=$1', [key]));
    let r = row, detail = '';
    if (act === 'revoke' || act === 'unrevoke') {
      r = (await c.query('UPDATE kx_keys SET revoked=$2 WHERE id=$1 RETURNING *', [row.id, act === 'revoke'])).rows[0];
    } else if (act === 'extend') {
      const secs = Math.round(Number(days) * 86400);
      if (!Number.isFinite(secs) || secs === 0 || Math.abs(secs) > 10 * 365 * 86400) throw new HttpError(400, 'จำนวนวันไม่ถูกต้อง');
      if (Number(row.seconds) === 0) throw new HttpError(400, 'คีย์ตลอดชีพไม่ต้องต่อเวลา');
      r = row.expires_at
        ? (await c.query(`UPDATE kx_keys SET expires_at = expires_at + ($2 || ' seconds')::interval WHERE id=$1 RETURNING *`, [row.id, String(secs)])).rows[0]
        : (await c.query('UPDATE kx_keys SET seconds = GREATEST(60, seconds + $2) WHERE id=$1 RETURNING *', [row.id, secs])).rows[0];
      detail = `${Number(days) > 0 ? '+' : ''}${days} วัน`;
    } else if (act === 'assign') {
      r = (await c.query('UPDATE kx_keys SET discord_id=$2 WHERE id=$1 RETURNING *', [row.id, discordId || null])).rows[0];
      detail = discordId ? 'ให้ ' + discordId : 'ปลดเจ้าของ';
    } else if (act === 'note') {
      r = (await c.query('UPDATE kx_keys SET note=$2 WHERE id=$1 RETURNING *', [row.id, String(note || '').slice(0, 200)])).rows[0];
    } else throw new HttpError(404, 'ไม่พบคำสั่ง');
    await logEvent(c, row.id, row.key, act, actor, detail, ip);
    return r;
  });
}

// ---------- ค้นหา (หลังบ้าน / บอท) ----------
const STATUS_SQL = {
  active: 'NOT revoked AND activated_at IS NOT NULL AND (expires_at IS NULL OR expires_at > now())',
  unused: 'NOT revoked AND activated_at IS NULL',
  expired: 'NOT revoked AND expires_at IS NOT NULL AND expires_at <= now()',
  revoked: 'revoked',
  bound: 'hwid IS NOT NULL',
};

export async function searchKeys({ term = '', status = '', discordId = '', limit = 50, offset = 0 } = {}) {
  const args = [];
  const where = [];
  term = String(term || '').trim().slice(0, 60);
  if (term) {
    args.push(`%${term.replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(key ILIKE $${args.length} OR label ILIKE $${args.length} OR note ILIKE $${args.length} OR discord_id ILIKE $${args.length} OR roblox_name ILIKE $${args.length} OR hwid ILIKE $${args.length})`);
  }
  if (discordId) { args.push(discordId); where.push(`discord_id=$${args.length}`); }
  if (STATUS_SQL[status]) where.push(STATUS_SQL[status]);
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const [rows, total] = await Promise.all([
    q(`SELECT * FROM kx_keys ${w} ORDER BY id DESC LIMIT ${lim} OFFSET ${off}`, args),
    one(`SELECT count(*)::int AS n FROM kx_keys ${w}`, args),
  ]);
  return { rows: rows.rows, total: total.n };
}

/** สรุปคีย์ของผู้ใช้ 1 คน */
export function summarize(rows) {
  const s = { total: rows.length, active: 0, unused: 0, expired: 0, revoked: 0, lifetime: 0, next_expiry: null };
  for (const r of rows) {
    const st = statusOf(r);
    if (st === 'active' || st === 'lifetime') s.active++;
    else s[st]++;
    if (st === 'lifetime') s.lifetime++;
    if (st === 'active' && r.expires_at && (!s.next_expiry || new Date(r.expires_at) < new Date(s.next_expiry))) s.next_expiry = new Date(r.expires_at).toISOString();
  }
  return s;
}
