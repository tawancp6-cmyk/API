'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from './api';
import Icon from './Icons';
import { Avatar } from './ProfileCard';

export default function Nav({ user, siteName, adminPath, active }) {
  const router = useRouter();
  const logout = async () => {
    try { await api('/api/auth/logout', 'POST'); } catch {}
    router.push('/');
    router.refresh();
  };
  return (
    <header className="nav">
      <div className="nav-in">
        <Link href={user ? '/dashboard' : '/'} className="brand" aria-label={siteName}>
          <img src="/uploads/logo/logo-640.webp" alt="" width="32" height="32" />
          <span>{siteName}</span>
        </Link>
        <nav className="nav-links" aria-label="เมนูหลัก">
          {user && <Link href="/dashboard" className={active === 'dashboard' ? 'on' : ''}><Icon n="key" size={15} /><span>คีย์ของฉัน</span></Link>}
          {user?.role === 'admin' && adminPath && <Link href={`/${adminPath}`} className={`nav-admin ${active === 'admin' ? 'on' : ''}`}><Icon n="crown" size={15} /><span>หลังบ้าน</span></Link>}
        </nav>
        <div className="nav-r">
          {user ? (
            <>
              <Link href="/dashboard" className="nav-me" title={user.name}>
                <Avatar p={user} size={30} />
                <span>{user.name}</span>
              </Link>
              <button className="icon-btn" onClick={logout} aria-label="ออกจากระบบ" title="ออกจากระบบ"><Icon n="logout" size={16} /></button>
            </>
          ) : (
            <a className="btn btn-discord btn-sm" href="/api/auth/discord"><Icon n="discord" size={16} />เข้าสู่ระบบ</a>
          )}
        </div>
      </div>
    </header>
  );
}
