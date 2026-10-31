import { q } from './db';
import { DEFAULT_SETTINGS } from './schema';

// แคชในหน่วยความจำ 20 วินาที (แก้ที่หลังบ้านแล้วล้างแคชทันที)
const TTL = 20000;
export const clearSettingsCache = () => { globalThis.__kxSettings = null; };

export async function getSettings() {
  const c = globalThis.__kxSettings;
  if (c && Date.now() - c.at < TTL) return c.value;
  const { rows } = await q('SELECT key,value FROM kx_settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  delete s.schema_version;
  globalThis.__kxSettings = { at: Date.now(), value: s };
  return s;
}

/** นโยบายรีเซ็ต HWID / รีคีย์ ที่ผู้ใช้ทำเองได้ */
export async function getPolicy() {
  const s = await getSettings();
  const n = (v, d) => { const x = parseInt(v, 10); return Number.isFinite(x) && x >= 0 ? x : d; };
  return {
    reset_enabled: s.user_reset_enabled !== '0',
    rekey_enabled: s.user_rekey_enabled !== '0',
    cooldown_hours: n(s.reset_cooldown_hours, 24),
    reset_max: n(s.reset_max, 5),
    rekey_max: n(s.rekey_max, 3),
  };
}
