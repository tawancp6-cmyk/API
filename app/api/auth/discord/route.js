import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { discordConfigured, redirectUri, siteOrigin } from '@/lib/discord';

export const dynamic = 'force-dynamic';

/** เริ่มล็อกอินด้วย Discord → ส่งไปหน้าอนุญาตของ Discord */
export async function GET() {
  const origin = await siteOrigin();
  if (!discordConfigured()) return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent('ยังไม่ได้ตั้งค่า DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET')}`);
  const state = crypto.randomBytes(24).toString('hex');
  const jar = await cookies();
  jar.set('kx_oauth', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  const u = new URL('https://discord.com/api/oauth2/authorize');
  u.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID);
  u.searchParams.set('redirect_uri', await redirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'identify');
  u.searchParams.set('state', state);
  u.searchParams.set('prompt', 'none');
  return NextResponse.redirect(u.toString());
}
