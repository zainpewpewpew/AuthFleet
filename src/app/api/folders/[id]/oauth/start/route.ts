import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { getFolder } from '@/lib/store';
import { unseal } from '@/lib/crypto';
import { absoluteUrl } from '@/lib/url';
import { google } from 'googleapis';
import { db } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.redirect(absoluteUrl(req, '/login'));
  }
  const folder = getFolder(id);
  if (!folder || !folder.client_id) {
    return NextResponse.redirect(absoluteUrl(req, `/folders/${id}?oauth=no-client`));
  }
  const row = db().prepare('SELECT client_secret_enc FROM folders WHERE id=?').get(id) as { client_secret_enc: string | null };
  if (!row?.client_secret_enc) {
    return NextResponse.redirect(absoluteUrl(req, `/folders/${id}?oauth=no-secret`));
  }
  let secret: string;
  try { secret = unseal(row.client_secret_enc); }
  catch { return NextResponse.redirect(absoluteUrl(req, `/folders/${id}?oauth=decrypt-fail`)); }

  // Single redirect URI across all folders — operator registers one URL in
  // Google Cloud Console and every folder's OAuth client points at it.
  const redirectUri = absoluteUrl(req, '/api/oauth/callback').toString();
  const client = new google.auth.OAuth2(folder.client_id, secret, redirectUri);
  // Always force consent + account picker: Google only issues a refresh
  // token when it shows the consent dialog, so skipping consent on a
  // "just pick an account" flow would silently fail here with no-refresh
  // whenever the operator had previously consented with the same account.
  const hintEmail = new URL(req.url).searchParams.get('email');
  const authOptions: Parameters<typeof client.generateAuthUrl>[0] = {
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'openid', 'email'],
    state: id,
    prompt: 'consent select_account',
  };
  if (hintEmail) authOptions.login_hint = hintEmail;
  const url = client.generateAuthUrl(authOptions);
  return NextResponse.redirect(url);
}
