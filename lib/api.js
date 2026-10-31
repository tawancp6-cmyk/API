import { NextResponse } from 'next/server';
import { HttpError } from './db';
import { checkOrigin } from './auth';

export const json = (data, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

/** ห่อ handler: ตรวจ origin (เฉพาะ method ที่แก้ข้อมูล) + จัดการ error ให้เป็น JSON */
export function route(fn) {
  return async (req, ctx) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) await checkOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่' }, 500);
    }
  };
}

export async function body(req) {
  try {
    const b = await req.json();
    if (!b || typeof b !== 'object') throw 0;
    return b;
  } catch {
    throw new HttpError(400, 'รูปแบบข้อมูลไม่ถูกต้อง');
  }
}
