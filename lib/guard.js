import { q, one } from './db';

/**
 * ระบบแบนชั่วคราว (เฉพาะทางเข้าหลังบ้าน)
 *  - คนที่ไม่ใช่แอดมินเข้าลิงก์หลังบ้าน หรือยิง /api/admin → ถูกปฏิเสธ + แบนชั่วคราวตาม IP (และบัญชี Discord ถ้าล็อกอินอยู่)
 *  - ผิดซ้ำภายใน 24 ชม. โทษจะเพิ่มเป็น 2 เท่า: 15 นาที → 30 → 1 ชม. → 2 ชม. … สูงสุด 24 ชม.
 *  - แอดมินไม่โดนแบน และปลดแบนได้ที่แท็บ "ตั้งค่า"
 */
const BASE_MIN = 15;
const MAX_MIN = 24 * 60;

export const subjectsOf = (ip, user) => [`ip:${ip}`, ...(user?.discord_id ? [`u:${user.discord_id}`] : [])];

/** คืนเวลาที่โดนแบนถึง (Date) หรือ null ถ้าไม่โดนแบน */
export async function banUntil(subjects) {
  const r = await one('SELECT max(until) AS until FROM kx_bans WHERE subject = ANY($1) AND until > now()', [subjects]);
  return r?.until ? new Date(r.until) : null;
}

/** บันทึกความผิด 1 ครั้ง แล้วคืนเวลาที่ถูกแบนถึง */
export async function strike(subjects, reason = 'พยายามเข้าหลังบ้าน') {
  let until = null;
  for (const subject of subjects) {
    const r = await one(
      `INSERT INTO kx_bans(subject,strikes,reason,until)
       VALUES($1,1,$2, now() + make_interval(mins => $3))
       ON CONFLICT (subject) DO UPDATE SET
         strikes = CASE WHEN kx_bans.last_at > now() - interval '24 hours' THEN kx_bans.strikes + 1 ELSE 1 END,
         reason = EXCLUDED.reason,
         last_at = now(),
         until = now() + make_interval(mins => LEAST($4::int, $3::int * (2 ^ LEAST(CASE WHEN kx_bans.last_at > now() - interval '24 hours' THEN kx_bans.strikes ELSE 0 END, 10))::int))
       RETURNING until`,
      [subject, String(reason).slice(0, 120), BASE_MIN, MAX_MIN]
    );
    const u = new Date(r.until);
    if (!until || u > until) until = u;
  }
  if (Math.random() < 0.05) await q("DELETE FROM kx_bans WHERE until < now() - interval '7 days'");
  return until;
}

export const listBans = async () => (await q('SELECT id,subject,strikes,reason,until,last_at FROM kx_bans WHERE until > now() ORDER BY until DESC LIMIT 100')).rows;
export const removeBan = (id) => q('DELETE FROM kx_bans WHERE id=$1', [id]);
