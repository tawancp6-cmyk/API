import { notFound } from 'next/navigation';
import { getUser, clientIp } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { ADMIN_PATH } from '@/lib/adminPath';
import { publicProfile } from '@/lib/discord';
import { banUntil, strike, subjectsOf } from '@/lib/guard';
import Nav from '@/components/Nav';
import Admin from '@/components/Admin';
import Denied from '@/components/Denied';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'หลังบ้าน', robots: { index: false, follow: false } };

export default async function AdminPage({ params }) {
  const { slug } = await params;
  if (slug !== ADMIN_PATH) notFound(); // ลิงก์อื่นทั้งหมด = 404 ปกติ (พิมพ์ผิดไม่โดนแบน)

  const [u, ip] = await Promise.all([getUser(), clientIp()]);
  if (!u || u.role !== 'admin') {
    // ไม่ใช่แอดมิน → ปฏิเสธ + แบนชั่วคราว (ถ้าแบนอยู่แล้วไม่ต้องบวกโทษซ้ำจากการรีเฟรช)
    const subjects = subjectsOf(ip, u);
    let until = await banUntil(subjects);
    if (!until) until = await strike(subjects, u ? 'ผู้ใช้ทั่วไปพยายามเข้าหลังบ้าน' : 'ผู้ไม่ได้ล็อกอินพยายามเข้าหลังบ้าน');
    return <Denied until={until.toISOString()} />;
  }
  const s = await getSettings();
  return (
    <>
      <Nav user={{ ...publicProfile(u), role: u.role }} siteName={s.site_name} adminPath={ADMIN_PATH} active="admin" />
      <main className="wrap wrap-wide"><Admin serverTime={Date.now()} /></main>
    </>
  );
}
