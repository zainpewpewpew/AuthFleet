import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db, getFolder } from '@/lib/store';
import { unseal, seal } from '@/lib/crypto';
import { google } from 'googleapis';

/**
 * Unified Google OAuth callback.
 *
 * Google Cloud Console only needs ONE redirect URI registered:
 *   http://localhost:3000/api/oauth/callback
 *
 * The folder the operator was connecting a Gmail to arrives on the `state`
 * query parameter (signed by Google in the round-trip). This replaces the
 * old per-folder `/api/folders/[id]/oauth/callback` route, which required
 * registering a new redirect URI every time a folder was created.
 *
 * The old route still exists for backward compatibility with folders whose
 * OAuth clients were registered against the per-folder URL.
 */
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  const folderId = String(state || '').trim();
  const backTo = (reason: string) =>
    NextResponse.redirect(new URL(`/folders${folderId ? '/' + folderId : ''}?oauth=${reason}`, req.url));
  if (!folderId) return NextResponse.redirect(new URL('/folders?oauth=no-state', req.url));
  if (err) return backTo('denied');
  if (!code) return backTo('no-code');

  const folder = getFolder(folderId);
  if (!folder || !folder.client_id) return backTo('no-client');
  const row = db().prepare('SELECT client_secret_enc FROM folders WHERE id=?').get(folderId) as { client_secret_enc: string | null } | undefined;
  if (!row?.client_secret_enc) return backTo('no-secret');
  const secret = unseal(row.client_secret_enc);

  const redirectUri = new URL('/api/oauth/callback', req.url).toString();
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
    if (!email) return backTo('no-email');
    if (!tokens.refresh_token) {
      const existing = db().prepare('SELECT refresh_token_enc FROM gmails WHERE email=? AND folder_id=?').get(email, folderId) as { refresh_token_enc: string | null } | undefined;
      if (!existing?.refresh_token_enc) return backTo('no-refresh');
    }
    const refresh = tokens.refresh_token ? seal(tokens.refresh_token) : null;
    db().prepare(`
      INSERT INTO gmails (email, folder_id, refresh_token_enc, status, connected_at)
      VALUES (?, ?, ?, 'connected', ?)
      ON CONFLICT(email, folder_id) DO UPDATE SET
        refresh_token_enc = COALESCE(excluded.refresh_token_enc, gmails.refresh_token_enc),
        status = 'connected',
        connected_at = excluded.connected_at
    `).run(email, folderId, refresh, Date.now());
    return NextResponse.redirect(new URL(`/folders/${folderId}?oauth=ok&email=${encodeURIComponent(email)}`, req.url));
  } catch {
    return backTo('exchange-fail');
  }
}
