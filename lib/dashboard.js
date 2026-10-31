import { q } from './db';
import { getPolicy } from './settings';
import { keyView, summarize } from './keys';
import { publicProfile } from './discord';

/** ข้อมูลหน้าแดชบอร์ดของผู้ใช้ (ใช้ทั้งตอน render ฝั่งเซิร์ฟเวอร์ และ /api/me) */
export async function loadDashboard(user) {
  const [pol, { rows }] = await Promise.all([
    getPolicy(),
    q('SELECT * FROM kx_keys WHERE discord_id=$1 ORDER BY id DESC LIMIT 200', [user.discord_id]),
  ]);
  return {
    user: { ...publicProfile(user), role: user.role },
    keys: rows.map((r) => keyView(r, 'owner', pol)),
    stats: summarize(rows),
    policy: pol,
    server_time: Date.now(),
  };
}
