import { NextResponse } from 'next/server';
import { clientIp, rateLimit, recordAttempt } from '@/lib/auth';
import { HttpError } from '@/lib/db';
import { heartbeat } from '@/lib/keys';

export const dynamic = 'force-dynamic';

/**
 * Heartbeat — ให้สคริปต์ในเกมเรียกซ้ำทุก ~10 วินาทีเพื่อเช็กว่าคีย์ยังใช้ได้อยู่ไหม
 *   GET/POST /api/keys/heartbeat?key=NEXUSHUBX-XXXX-XXXX-XXXX&hwid=รหัสเครื่อง
 *   ตอบ { alive: true|false, code, kick, message, interval }
 *   alive=false + kick=true  → สคริปต์ต้องเตะผู้เล่นออกจากเกมทันที (คีย์ถูกลบ / ระงับ / หมดอายุ / ใช้ผิดเครื่อง / เจ้าของถูกแบน)
 *   kick=false (SERVER_ERROR, RATE_LIMITED) → ปัญหาชั่วคราวของเซิร์ฟเวอร์ ห้ามเตะ ให้ลองใหม่รอบถัดไป
 * เบามาก: อ่านอย่างเดียว ไม่เขียนฐานข้อมูล
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};
const INTERVAL = 10;

async function handle(p) {
  const send = (o, status = 200) => NextResponse.json({ interval: INTERVAL, server_time: Date.now(), ...o }, { status, headers: CORS });
  try {
    const ip = await clientIp();
    const fk = `keyfail:${ip}`;
    await rateLimit(fk, 30, 10);
    const out = await heartbeat(p.key, p.hwid);
    if (out.code === 'NOT_FOUND' || out.code === 'BAD_FORMAT') await recordAttempt(fk);
    return send(out);
  } catch (e) {
    if (e instanceof HttpError) return send({ alive: false, kick: false, code: 'RATE_LIMITED', message: e.message }, e.status);
    console.error(e);
    return send({ alive: false, kick: false, code: 'SERVER_ERROR', message: 'เกิดข้อผิดพลาดของระบบ' }, 500);
  }
}

export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS });
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  return handle({ key: sp.get('key'), hwid: sp.get('hwid') });
}
export async function POST(req) {
  let b = {};
  try { b = await req.json(); } catch {}
  const sp = new URL(req.url).searchParams;
  return handle({ key: b?.key ?? sp.get('key'), hwid: b?.hwid ?? sp.get('hwid') });
}
