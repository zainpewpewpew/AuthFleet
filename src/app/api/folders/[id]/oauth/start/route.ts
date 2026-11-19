import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { getFolder } from '@/lib/store';
import { gmailCanonical } from '@/lib/otp';
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

  // Google abuse signal reduction: tiap OAuth `prompt=consent` dengan sensitive
  // scope (gmail.readonly) pada app Testing Mode jadi "security event" di Gmail
  // target. Kalau operator buka-tutup koneksi berulang, Gmail baru dengan
  // multiple consent events + grant ke datacenter app = pola bot-farm yang
  // bisa trigger suspend oleh Google. Logic berikut memaksa consent hanya saat
  // benar-benar perlu refresh_token baru (first bind atau row tanpa token).
  //
  // - First connect gmail baru (tidak ada hintEmail, tidak ada row dengan refresh_token):
  //   pakai `select_account` saja. Google skip consent kalau user sudah pernah
  //   consent scope sama di masa lalu → tidak ada event consent baru → skor
  //   abuse tidak naik. Trade-off: kadang kembali no-refresh → banner
  //   "Google tidak mengembalikan refresh token" minta operator revoke di
  //   myaccount.google.com + retry; retry mengirim `?email=` → path consent.
  //
  // - Re-connect by hintEmail dengan row sudah punya refresh_token: `consent`
  //   (tanpa select_account) supaya Google reissue refresh_token untuk account
  //   yang sama, tidak memicu pilih account.
  //
  // - Row ada tapi refresh_token null (hasil first-connect yang no-refresh):
  //   `consent select_account` agar operator bisa pilih ulang + reissue token.
  //
  // `include_granted_scopes=true` memberi sinyal incremental auth: kalau scope
  // readonly sudah pernah di-grant ke app lain milik user, Google tidak hitung
  // sebagai scope baru.
  const hintEmail = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase();
  const canonicalHint = hintEmail ? gmailCanonical(hintEmail) : '';
  const existing = canonicalHint
    ? (db().prepare('SELECT refresh_token_enc FROM gmails WHERE email=? AND folder_id=?')
        .get(canonicalHint, id) as { refresh_token_enc: string | null } | undefined)
    : undefined;

  let prompt: string;
  if (hintEmail && existing?.refresh_token_enc) {
    prompt = 'consent';
  } else if (hintEmail && existing && !existing.refresh_token_enc) {
    prompt = 'consent select_account';
  } else {
    prompt = 'select_account';
  }

  const authOptions: Parameters<typeof client.generateAuthUrl>[0] = {
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'openid', 'email'],
    state: id,
    prompt,
    include_granted_scopes: true,
  };
  if (hintEmail) authOptions.login_hint = hintEmail;
  const url = client.generateAuthUrl(authOptions);
  return NextResponse.redirect(url);
}
