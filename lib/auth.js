import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import { q, one, HttpError } from './db';

const COOKIE = 'kx_session';
const DAYS = 14;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** แอดมิน = Discord ID ที่ตั้งไว้ใน ADMIN_DISCORD_IDS (คั่นด้วยคอมมา) */
export const adminIds = () => String(process.env.ADMIN_DISCORD_IDS || '').split(/[\s,]+/).filter(Boolean);
export const isAdminId = (id) => adminIds().includes(String(id));

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await q("INSERT INTO kx_sessions(token_hash,user_id,expires_at) VALUES($1,$2, now() + ($3 || ' days')::interval)", [sha(token), userId, String(DAYS)]);
  if (Math.random() < 0.05) await q('DELETE FROM kx_sessions WHERE expires_at < now()');
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DAYS * 86400 });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await q('DELETE FROM kx_sessions WHERE token_hash=$1', [sha(t)]);
  jar.set(COOKIE, '', { path: '/', maxAge: 0 });
}

export async function getUser() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (!t || t.length !== 64) return null;
  const u = await one(
    `SELECT u.* FROM kx_sessions s JOIN kx_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()`,
    [sha(t)]
  );
  if (!u || u.banned) return null;
  return { ...u, role: isAdminId(u.discord_id) ? 'admin' : 'user' };
}

export async function requireUser() {
  const u = await getUser();
  if (!u) throw new HttpError(401, 'กรุณาเข้าสู่ระบบด้วย Discord ก่อน');
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== 'admin') throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึง');
  return u;
}

// ---------- ป้องกันการโจมตี ----------
export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

/** นับจำนวนครั้งในช่วงเวลา เกินแล้วตอบ 429 */
export async function rateLimit(key, max, minutes) {
  const r = await one(`SELECT count(*)::int AS n FROM kx_attempts WHERE key=$1 AND at > now() - ($2 || ' minutes')::interval`, [key, String(minutes)]);
  if (r.n >= max) throw new HttpError(429, 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
}
export async function recordAttempt(key) {
  await q('INSERT INTO kx_attempts(key) VALUES($1)', [key]);
  if (Math.random() < 0.05) await q("DELETE FROM kx_attempts WHERE at < now() - interval '1 day'");
}

/** ป้องกัน CSRF: คำขอที่แก้ไขข้อมูลจากเบราว์เซอร์ต้องมาจากโดเมนเดียวกัน */
export async function checkOrigin(req) {
  const origin = req.headers.get('origin');
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!origin) throw new HttpError(403, 'คำขอไม่ถูกต้อง');
  let oh;
  try { oh = new URL(origin).host; } catch { throw new HttpError(403, 'คำขอไม่ถูกต้อง'); }
  if (oh !== host) throw new HttpError(403, 'คำขอไม่ถูกต้อง (origin)');
}
