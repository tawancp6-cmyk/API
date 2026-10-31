import { NextResponse } from 'next/server';
import { clientIp, rateLimit, recordAttempt } from '@/lib/auth';
import { HttpError } from '@/lib/db';
import { verifyKey } from '@/lib/keys';

export const dynamic = 'force-dynamic';

/**
 * API ตรวจคีย์ (สาธารณะ — ให้สคริปต์/บอท/โปรแกรม/เว็บอื่นเรียกได้ จึงเปิด CORS)
 *   GET  /api/keys/verify?key=NEXUSHUBX-XXXX-XXXX-XXXX&hwid=รหัสเครื่อง&roblox_id=123&roblox_name=ชื่อในเกม
 *   POST /api/keys/verify   {"key":"...","hwid":"..."}
 *   check=1 ดูสถานะเฉยๆ (ไม่เริ่มนับเวลา ไม่ผูกเครื่อง)   format=text ผลแบบข้อความสั้น
 * ไม่ต้องล็อกอิน Discord — ใส่คีย์แล้วใช้ได้เลย (ผูกเครื่องอัตโนมัติครั้งแรก)
 * ป้องกันเดาคีย์: นับเฉพาะครั้งที่ตรวจไม่ผ่าน (ไม่พบคีย์/รูปแบบผิด) ต่อ IP
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};

async function handle(p) {
  const wantText = p.format === 'text';
  const send = (obj, status = 200) => {
    if (wantText) {
      const t = obj.valid ? `VALID|${obj.lifetime ? 'LIFETIME' : obj.expires_at || 'UNUSED'}` : `INVALID|${obj.code}`;
      return new NextResponse(t, { status, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return NextResponse.json(obj, { status, headers: CORS });
  };
  try {
    const ip = await clientIp();
    const fk = `keyfail:${ip}`;
    await rateLimit(fk, 30, 10);
    const out = await verifyKey(p.key, {
      hwid: p.hwid,
      check: p.check === '1' || p.check === 'true',
      roblox: { id: p.roblox_id, name: p.roblox_name },
      ip,
    });
    if (!out.valid && ['NOT_FOUND', 'BAD_FORMAT'].includes(out.code)) await recordAttempt(fk);
    return send(out);
  } catch (e) {
    if (e instanceof HttpError) return send({ valid: false, code: 'RATE_LIMITED', message: e.message }, e.status);
    console.error(e);
    return send({ valid: false, code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดของระบบ' }, 500);
  }
}

export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS });

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  return handle({ key: sp.get('key'), hwid: sp.get('hwid'), check: sp.get('check'), format: sp.get('format'), roblox_id: sp.get('roblox_id'), roblox_name: sp.get('roblox_name') });
}

export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  const sp = new URL(req.url).searchParams;
  return handle({
    key: b?.key ?? sp.get('key'),
    hwid: b?.hwid ?? sp.get('hwid'),
    roblox_id: b?.roblox_id ?? sp.get('roblox_id'),
    roblox_name: b?.roblox_name ?? sp.get('roblox_name'),
    check: String(b?.check ?? sp.get('check') ?? ''),
    format: sp.get('format') || b?.format,
  });
}
