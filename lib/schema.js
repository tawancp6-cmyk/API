// โครงสร้างฐานข้อมูลของระบบคีย์ — ใช้ตารางชื่อ kx_* ทั้งหมด จึงอยู่ร่วมกับฐานข้อมูลเดิมของร้านได้โดยไม่ชนกัน
const DDL = `
CREATE TABLE IF NOT EXISTS kx_users (
  id SERIAL PRIMARY KEY,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  avatar TEXT,
  decoration TEXT,
  banner TEXT,
  accent TEXT,
  banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kx_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES kx_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kx_sessions_user_idx ON kx_sessions (user_id);

CREATE TABLE IF NOT EXISTS kx_keys (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  discord_id TEXT,
  label TEXT NOT NULL DEFAULT '',
  seconds BIGINT NOT NULL DEFAULT 0,
  start_mode TEXT NOT NULL DEFAULT 'activate',
  hwid_lock BOOLEAN NOT NULL DEFAULT TRUE,
  hwid TEXT,
  hwid_bound_at TIMESTAMPTZ,
  hwid_resets INT NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ,
  rekeys INT NOT NULL DEFAULT 0,
  last_rekey_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT NOT NULL DEFAULT '',
  roblox_id BIGINT,
  roblox_name TEXT,
  roblox_display TEXT,
  roblox_avatar TEXT,
  roblox_seen_at TIMESTAMPTZ,
  last_check_at TIMESTAMPTZ,
  last_ip TEXT,
  uses BIGINT NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kx_keys_owner_idx ON kx_keys (discord_id);
CREATE INDEX IF NOT EXISTS kx_keys_created_idx ON kx_keys (created_at DESC);

CREATE TABLE IF NOT EXISTS kx_logs (
  id BIGSERIAL PRIMARY KEY,
  key_id INT REFERENCES kx_keys(id) ON DELETE CASCADE,
  key_text TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  detail TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kx_logs_key_idx ON kx_logs (key_id, id DESC);
CREATE INDEX IF NOT EXISTS kx_logs_at_idx ON kx_logs (id DESC);

CREATE TABLE IF NOT EXISTS kx_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kx_attempts (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kx_attempts_key_idx ON kx_attempts (key, at);

CREATE TABLE IF NOT EXISTS kx_bans (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL UNIQUE,
  strikes INT NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  until TIMESTAMPTZ NOT NULL,
  last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kx_bans_until_idx ON kx_bans (until);
`;

export const DEFAULT_SETTINGS = {
  site_name: 'Nexus Hub X',
  default_prefix: 'NEXUSHUBX',
  user_reset_enabled: '1', // ให้ผู้ใช้รีเซ็ต HWID เองได้
  user_rekey_enabled: '1', // ให้ผู้ใช้รีคีย์ (ออกรหัสคีย์ใหม่แทนอันเดิม) เองได้
  reset_cooldown_hours: '24', // ห่างกันอย่างน้อยกี่ชั่วโมงต่อการรีเซ็ต 1 ครั้ง
  reset_max: '5', // รีเซ็ต HWID ได้สูงสุดกี่ครั้งต่อ 1 คีย์ (0 = ไม่จำกัด)
  rekey_max: '3', // รีคีย์ได้สูงสุดกี่ครั้งต่อ 1 คีย์ (0 = ไม่จำกัด)
};

// เพิ่มตาราง/คอลัมน์ใหม่เมื่อไหร่ ให้เปลี่ยนเลขเวอร์ชันนี้ 1 ครั้ง (รัน DDL แค่ครั้งเดียวต่อเวอร์ชัน)
const SCHEMA_VERSION = '2026-10-31-nexus2';

export async function ensureSchema(pool) {
  try {
    const r = await pool.query("SELECT value FROM kx_settings WHERE key='schema_version'");
    if (r.rows[0] && r.rows[0].value === SCHEMA_VERSION) return;
  } catch (e) {
    if (e.code !== '42P01') throw e; // ยังไม่มีตาราง → ไปสร้างต่อ
  }
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7272002)'); // กัน cold start หลายตัวสร้างตารางพร้อมกัน
    try {
      try {
        const r = await client.query("SELECT value FROM kx_settings WHERE key='schema_version'");
        if (r.rows[0] && r.rows[0].value === SCHEMA_VERSION) return;
      } catch (e) {
        if (e.code !== '42P01') throw e;
      }
      await client.query(DDL);
      const entries = Object.entries(DEFAULT_SETTINGS);
      await client.query(
        `INSERT INTO kx_settings(key,value) SELECT * FROM unnest($1::text[],$2::text[]) ON CONFLICT DO NOTHING`,
        [entries.map((e) => e[0]), entries.map((e) => e[1])]
      );
      // ย้ายค่าเดิม (FLEXOZY) มาเป็น NEXUSHUBX อัตโนมัติ — คีย์เก่ายังใช้ได้ตามปกติ
      await client.query("UPDATE kx_settings SET value='NEXUSHUBX' WHERE key='default_prefix' AND value='FLEXOZY'");
      await client.query("UPDATE kx_settings SET value='Nexus Hub X' WHERE key='site_name' AND value IN ('Flexozy Keys','Flexozy')");
      await client.query(
        `INSERT INTO kx_settings(key,value) VALUES('schema_version',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
        [SCHEMA_VERSION]
      );
    } finally {
      await client.query('SELECT pg_advisory_unlock(7272002)');
    }
  } finally {
    client.release();
  }
}
