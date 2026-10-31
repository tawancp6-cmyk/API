import { HttpError } from './db';

export function str(v, { min = 0, max = 500, name = 'ข้อมูล' } = {}) {
  if (typeof v !== 'string') v = v == null ? '' : String(v);
  v = v.trim();
  if (v.length < min) throw new HttpError(400, `${name}สั้นเกินไป`);
  if (v.length > max) throw new HttpError(400, `${name}ยาวเกินไป`);
  return v;
}

export function int(v, { min = -Infinity, max = Infinity, name = 'ตัวเลข' } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${name}ไม่ถูกต้อง`);
  return n;
}

export const DISCORD_ID_RE = /^\d{15,25}$/;
export function discordId(v, { optional = true } = {}) {
  const s = String(v ?? '').trim();
  if (!s) { if (optional) return null; throw new HttpError(400, 'กรุณาระบุ Discord ID'); }
  if (!DISCORD_ID_RE.test(s)) throw new HttpError(400, 'Discord ID ต้องเป็นตัวเลข 15–25 หลัก');
  return s;
}

export const TEN_YEARS = 10 * 365 * 86400;
