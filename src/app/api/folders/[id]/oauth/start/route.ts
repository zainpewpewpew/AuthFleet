import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { getFolder } from '@/lib/store';
import { unseal } from '@/lib/crypto';
import { google } from 'googleapis';
import { db } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const folder = getFolder(id);
  if (!folder || !folder.client_id) {
    return NextResponse.redirect(new URL(`/folders/${id}?oauth=no-client`, req.url));
  }
  const row = db().prepare('SELECT client_secret_enc FROM folders WHERE id=?').get(id) as { client_secret_enc: string | null };
  if (!row?.client_secret_enc) {
    return NextResponse.redirect(new URL(`/folders/${id}?oauth=no-secret`, req.url));
  }
  let secret: string;
  try { secret = unseal(row.client_secret_enc); }
  catch { return NextResponse.redirect(new URL(`/folders/${id}?oauth=decrypt-fail`, req.url)); }

  const redirectUri = new URL(`/api/folders/${id}/oauth/callback`, req.url).toString();
  const client = new google.auth.OAuth2(folder.client_id, secret, redirectUri);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'openid', 'email'],
    state: id,
  });
  return NextResponse.redirect(url);
}
