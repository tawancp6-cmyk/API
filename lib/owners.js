import { q } from './db';
import { publicProfile, anonProfile } from './discord';
import { keyView } from './keys';

/** แปลงแถวคีย์เป็นข้อมูลที่ส่งออก (มุมมองแอดมิน/บอท) พร้อมโปรไฟล์เจ้าของ Discord */
export async function adminKeyViews(rows) {
  const ids = [...new Set(rows.map((r) => r.discord_id).filter(Boolean))];
  const users = ids.length ? (await q('SELECT * FROM kx_users WHERE discord_id = ANY($1)', [ids])).rows : [];
  const map = new Map(users.map((u) => [u.discord_id, publicProfile(u)]));
  return rows.map((r) => ({ ...keyView(r, 'admin'), owner: r.discord_id ? map.get(r.discord_id) || anonProfile(r.discord_id) : null }));
}
