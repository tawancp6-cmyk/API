import { headers } from 'next/headers';

export const discordConfigured = () => !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);

/** โดเมนของเว็บ (ใช้สร้าง redirect URI) — ตั้ง SITE_URL ได้ ถ้าไม่ตั้งจะอ่านจาก header */
export async function siteOrigin() {
  const env = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (host && host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function redirectUri() {
  return (process.env.DISCORD_REDIRECT_URI || '').trim() || `${await siteOrigin()}/api/auth/discord/callback`;
}

export function avatarUrl(id, hash, size = 256) {
  if (!id) return null;
  if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=${size}`;
  const idx = Number((BigInt(id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

/** วันที่สร้างบัญชี Discord (คำนวณจาก snowflake) */
export function discordCreatedAt(id) {
  try { return new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString(); } catch { return null; }
}

/** โปรไฟล์ที่ปลอดภัยส่งให้เบราว์เซอร์/บอท (รวมรูป กรอบโปรไฟล์ แบนเนอร์ สีโปรไฟล์) */
export function publicProfile(u) {
  if (!u) return null;
  const id = u.discord_id;
  return {
    id,
    name: u.name || u.username || id,
    username: u.username || '',
    avatar: avatarUrl(id, u.avatar),
    banner: u.banner ? `https://cdn.discordapp.com/banners/${id}/${u.banner}.${u.banner.startsWith('a_') ? 'gif' : 'png'}?size=600` : null,
    accent: u.accent || null,
    decoration: u.decoration ? `https://cdn.discordapp.com/avatar-decoration-presets/${u.decoration}.png?size=240&passthrough=true` : null,
    profile_url: `https://discord.com/users/${id}`,
    discord_created_at: discordCreatedAt(id),
    joined_at: u.created_at ? new Date(u.created_at).toISOString() : null,
    last_login_at: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
    banned: !!u.banned,
  };
}

/** โปรไฟล์ขั้นต่ำสำหรับ Discord ID ที่ยังไม่เคยล็อกอินเว็บ */
export const anonProfile = (id) => publicProfile({ discord_id: id });
