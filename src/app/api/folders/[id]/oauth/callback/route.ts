import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db, getFolder } from '@/lib/store';
import { unseal, seal } from '@/lib/crypto';
import { google } from 'googleapis';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const err = url.searchParams.get('error');
  if (err) return NextResponse.redirect(new URL(`/folders/${id}?oauth=denied`, req.url));
  if (!code) return NextResponse.redirect(new URL(`/folders/${id}?oauth=no-code`, req.url));

  const folder = getFolder(id);
  if (!folder || !folder.client_id) return NextResponse.redirect(new URL(`/folders/${id}?oauth=no-client`, req.url));
  const row = db().prepare('SELECT client_secret_enc FROM folders WHERE id=?').get(id) as { client_secret_enc: string | null };
  if (!row?.client_secret_enc) return NextResponse.redirect(new URL(`/folders/${id}?oauth=no-secret`, req.url));
  const secret = unseal(row.client_secret_enc);

  const redirectUri = new URL(`/api/folders/${id}/oauth/callback`, req.url).toString();
  const client = new google.auth.OAuth2(folder.client_id, secret, redirectUri);
  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    let email = '';
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const me = await oauth2.userinfo.get();
      email = String(me.data?.email || '').trim().toLowerCase();
    } catch { /* fall through */ }
    if (!email) return NextResponse.redirect(new URL(`/folders/${id}?oauth=no-email`, req.url));
    if (!tokens.refresh_token) {
      // Google only returns refresh_token on first consent for a client. If this
      // mailbox is already connected, keep its token; otherwise ask to reauth.
      const existing = db().prepare('SELECT refresh_token_enc FROM gmails WHERE email=? AND folder_id=?').get(email, id) as { refresh_token_enc: string | null } | undefined;
      if (!existing?.refresh_token_enc) {
        return NextResponse.redirect(new URL(`/folders/${id}?oauth=no-refresh`, req.url));
      }
    }
    const refresh = tokens.refresh_token ? seal(tokens.refresh_token) : null;
    db().prepare(`
      INSERT INTO gmails (email, folder_id, refresh_token_enc, status, connected_at)
      VALUES (?, ?, ?, 'connected', ?)
      ON CONFLICT(email, folder_id) DO UPDATE SET
        refresh_token_enc = COALESCE(excluded.refresh_token_enc, gmails.refresh_token_enc),
        status = 'connected'
    `).run(email, id, refresh, Date.now());
    return NextResponse.redirect(new URL(`/folders/${id}?oauth=ok&email=${encodeURIComponent(email)}`, req.url));
  } catch (error) {
    return NextResponse.redirect(new URL(`/folders/${id}?oauth=exchange-fail`, req.url));
  }
}
