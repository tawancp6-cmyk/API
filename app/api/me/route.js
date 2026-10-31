import { route, json } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { loadDashboard } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export const GET = route(async () => json(await loadDashboard(await requireUser())));
