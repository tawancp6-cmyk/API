import { route, json, body } from '@/lib/api';
import { requireUser, clientIp, rateLimit, recordAttempt } from '@/lib/auth';
import { HttpError } from '@/lib/db';
import { claimKey } from '@/lib/keys';

export const dynamic = 'force-dynamic';

/** กรอกคีย์เพื่อผูกเข้าบัญชี Discord ของตัวเอง */
export const POST = route(async (req) => {
  const user = await requireUser();
  const b = await body(req);
  const ip = await clientIp();
  const fk = `claim:${user.discord_id}`;
  await rateLimit(fk, 10, 10); // กรอกผิดเกิน 10 ครั้ง/10 นาที → ชะลอ (กันเดาคีย์)
  try {
    await claimKey({ key: b.key, discordId: user.discord_id, ip });
  } catch (e) {
    if (e instanceof HttpError && [400, 404].includes(e.status)) await recordAttempt(fk);
    throw e;
  }
  return json({ ok: true });
});
