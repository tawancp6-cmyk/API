import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { one, HttpError } from '@/lib/db';
import { createSession, clientIp, rateLimit, recordAttempt } from '@/lib/auth';
import { discordConfigured, redirectUri, siteOrigin } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const okAsset = (v) => (typeof v === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(v) ? v : null);

async function handle(req) {
  if (!discordConfigured()) throw new HttpError(500, 'ยังไม่ได้ตั้งค่าล็อกอินด้วย Discord');
  const url = new URL(req.url);
  if (url.searchParams.get('error')) throw new HttpError(400, 'คุณยกเลิกการเข้าสู่ระบบด้วย Discord');
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';

  const jar = await cookies();
  const saved = jar.get('kx_oauth')?.value || '';
  jar.set('kx_oauth', '', { path: '/', maxAge: 0 });
  if (!saved || !code || !state || state.length !== saved.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(saved))) {
    throw new HttpError(400, 'เซสชันล็อกอินหมดอายุ กรุณาลองใหม่อีกครั้ง');
  }
  const ip = await clientIp();
  await rateLimit(`dc:${ip}`, 20, 15);
  await recordAttempt(`dc:${ip}`);

  const tr = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: await redirectUri(),
    }),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  if (!tr.ok) throw new HttpError(400, 'ยืนยันตัวตนกับ Discord ไม่สำเร็จ กรุณาลองใหม่');
  const tok = await tr.json();
  const mr = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${tok.access_token}` },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  if (!mr.ok) throw new HttpError(400, 'ดึงข้อมูลโปรไฟล์ Discord ไม่สำเร็จ');
  const d = await mr.json();
  if (!d?.id || !/^\d{5,25}$/.test(String(d.id))) throw new HttpError(400, 'ข้อมูล Discord ไม่ถูกต้อง');

  const accent = Number.isInteger(d.accent_color) ? '#' + d.accent_color.toString(16).padStart(6, '0') : null;
  const row = await one(
    `INSERT INTO kx_users(discord_id,username,name,avatar,decoration,banner,accent)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (discord_id) DO UPDATE SET username=EXCLUDED.username,name=EXCLUDED.name,avatar=EXCLUDED.avatar,
       decoration=EXCLUDED.decoration,banner=EXCLUDED.banner,accent=EXCLUDED.accent,last_login_at=now()
     RETURNING id,banned`,
    [String(d.id), String(d.username || '').slice(0, 64), String(d.global_name || '').slice(0, 64), okAsset(d.avatar), okAsset(d.avatar_decoration_data?.asset), okAsset(d.banner), accent]
  );
  if (row.banned) throw new HttpError(403, 'บัญชีนี้ถูกระงับ');
  await createSession(row.id);
}

export async function GET(req) {
  const origin = await siteOrigin();
  try {
    await handle(req);
    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    const msg = e instanceof HttpError ? e.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(msg)}`);
  }
}
