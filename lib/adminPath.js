// ลิงก์เข้าหลังบ้าน — ไม่ใช้ /admin ตรงๆ เพื่อไม่ให้เดาได้
// ตั้งเองได้ที่ Environment Variable ชื่อ ADMIN_PATH (a-z 0-9 - _ ยาว 6–40 ตัว) เช่น ADMIN_PATH=my-secret-panel-93x
// ไฟล์นี้ไม่ import อะไร ใช้ได้ทั้ง middleware (Edge) และฝั่งเซิร์ฟเวอร์
const DEFAULT = 'fx-panel-k7q2m9x4';
const raw = String(process.env.ADMIN_PATH || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
export const ADMIN_PATH = /^[a-z0-9_-]{6,40}$/.test(raw) && raw !== 'admin' ? raw : DEFAULT;
