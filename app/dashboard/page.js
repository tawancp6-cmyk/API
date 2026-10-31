import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { loadDashboard } from '@/lib/dashboard';
import { ADMIN_PATH } from '@/lib/adminPath';
import Nav from '@/components/Nav';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'คีย์ของฉัน', robots: { index: false } };

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect('/');
  const [s, initial] = await Promise.all([getSettings(), loadDashboard(user)]);
  return (
    <>
      <Nav user={initial.user} siteName={s.site_name} adminPath={ADMIN_PATH} active="dashboard" />
      <main className="wrap"><Dashboard initial={initial} adminPath={user.role === 'admin' ? ADMIN_PATH : null} /></main>
    </>
  );
}
