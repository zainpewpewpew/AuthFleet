import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  operatorPassword,
} from '@/lib/session';

/** POST: login (JSON body {password} OR form with _method override).  */
export async function POST(req: NextRequest) {
  // Form posted from the sidebar logout button uses _method=DELETE.
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    if (form.get('_method') === 'DELETE') return clearSession(req);
  }

  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
  }
  const given = String(body.password || '');
  if (!given) return NextResponse.json({ error: 'Password wajib diisi' }, { status: 400 });

  let expected: string;
  try { expected = operatorPassword(); }
  catch (err) { return NextResponse.json({ error: String((err as Error).message) }, { status: 500 }); }

  const ok = timingSafeEqual(given, expected);
  if (!ok) return NextResponse.json({ error: 'Password salah' }, { status: 401 });

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

export async function DELETE(req: NextRequest) { return clearSession(req); }

function clearSession(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303);
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
