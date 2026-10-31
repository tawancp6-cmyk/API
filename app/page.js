import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { discordConfigured } from '@/lib/discord';
import Icon from '@/components/Icons';

export const dynamic = 'force-dynamic';

// หน้าแรก = ล็อกอินอย่างเดียว (ล็อกอินแล้วเด้งไปหน้าคีย์ของฉัน)
export default async function Home({ searchParams }) {
  const [user, s, sp] = await Promise.all([getUser(), getSettings(), searchParams]);
  if (user) redirect('/dashboard');
  const authError = typeof sp?.auth_error === 'string' ? sp.auth_error.slice(0, 200) : '';
  return (
    <main className="login">
      <section className="login-card">
        <img className="login-logo" src="/uploads/logo/logo-640.webp" alt="" width="64" height="64" />
        <h1>{s.site_name}</h1>
        <p>เข้าสู่ระบบด้วย Discord เพื่อจัดการคีย์ของคุณ</p>
        {authError && <div className="chk-err" role="alert"><Icon n="alert" size={16} />{authError}</div>}
        {discordConfigured() ? (
          <a className="btn btn-discord btn-lg login-btn" href="/api/auth/discord"><Icon n="discord" size={20} />เข้าสู่ระบบด้วย Discord</a>
        ) : (
          <span className="chk-err"><Icon n="alert" size={16} />ยังไม่ได้ตั้งค่า Discord Login (ดู .env.example)</span>
        )}
      </section>
    </main>
  );
}
