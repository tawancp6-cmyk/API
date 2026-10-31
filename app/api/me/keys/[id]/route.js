import { route, json, body } from '@/lib/api';
import { requireUser, clientIp } from '@/lib/auth';
import { HttpError } from '@/lib/db';
import { int } from '@/lib/util';
import { resetHwid, rekey } from '@/lib/keys';

export const dynamic = 'force-dynamic';

/** เจ้าของคีย์: { action: "reset-hwid" | "rekey" } ตามนโยบายที่แอดมินตั้งไว้ */
export const PUT = route(async (req, { params }) => {
  const user = await requireUser();
  const id = int((await params).id, { min: 1, name: 'รหัสคีย์' });
  const b = await body(req);
  const ip = await clientIp();
  const base = { id, owner: user.discord_id, actor: 'user:' + user.discord_id, ip };
  if (b.action === 'reset-hwid') {
    await resetHwid(base);
    return json({ ok: true });
  }
  if (b.action === 'rekey') {
    const r = await rekey(base);
    return json({ ok: true, key: r.key });
  }
  throw new HttpError(400, 'คำสั่งไม่ถูกต้อง');
});
