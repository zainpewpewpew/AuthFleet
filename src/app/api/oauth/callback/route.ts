import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db, getFolder, getFolderProxyEnc } from '@/lib/store';
import { unseal, seal } from '@/lib/crypto';
import { buildProxyAgent, maskProxyUrl } from '@/lib/proxy';
import { absoluteUrl } from '@/lib/url';
import { google } from 'googleapis';

/**
 * Unified Google OAuth callback.
 *
 * Google Cloud Console only needs ONE redirect URI registered, built from
 * the public hostname (dev: http://localhost:3000/api/oauth/callback,
 * prod: https://<your-host>/api/oauth/callback).
 *
 * The folder the operator was connecting a Gmail to arrives on the `state`
 * query parameter (signed by Google in the round-trip). This replaces the
 * old per-folder `/api/folders/[id]/oauth/callback` route, which required
 * registering a new redirect URI every time a folder was created.
 *
 * The old route still exists for backward compatibility with folders whose
 * OAuth clients were registered against the per-folder URL.
 */

/**
 * Parse email dari id_token JWT yang Google kembalikan di response token
 * exchange. Alternatif ke panggilan `oauth2.userinfo.get()` yang menjadi hit
 * API ekstra dari datacenter tepat setelah consent — pola yang dibaca Google
 * sebagai "token baru langsung dipakai dari server asing" dan memicu
 * perlindungan "Suspicious third-party access" yang sign-out semua sesi user
 * di perangkat mereka. id_token sudah di-sign oleh Google via TLS token
 * endpoint (yang sudah kita percayai untuk access_token), jadi cukup parse
 * payload JWT tanpa verify signature ulang.
 */
function emailFromIdToken(idToken: string): string {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return '';
    const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as {
      email?: string;
      email_verified?: boolean;
      iss?: string;
      aud?: string;
    };
    const iss = String(payload.iss || '');
    if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') return '';
    return String(payload.email || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Hard timeout untuk token exchange. Default googleapis/gaxios tidak set
 * timeout di socket, jadi kalau proxy agent yang di-inject ke transporter
 * stuck (proxy mati / credential salah / port tidak dengar), request
 * menunggu tanpa batas dan Cloudflare di depan reply 504 Gateway Timeout
 * setelah ~100s. Batas 25s di bawah Cloudflare → callback selalu kembali
 * ke operator dengan error banner, bukan halaman putih 504.
 */
const TOKEN_EXCHANGE_TIMEOUT_MS = 25_000;

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.redirect(absoluteUrl(req, '/login'));
  }
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');
  const folderId = String(state || '').trim();
  const backTo = (reason: string) =>
    NextResponse.redirect(absoluteUrl(req, `/folders${folderId ? '/' + folderId : ''}?oauth=${reason}`));
  if (!folderId) return NextResponse.redirect(absoluteUrl(req, '/folders?oauth=no-state'));
  if (err) return backTo('denied');
  if (!code) return backTo('no-code');

  const folder = getFolder(folderId);
  if (!folder || !folder.client_id) return backTo('no-client');
  const row = db().prepare('SELECT client_secret_enc FROM folders WHERE id=?').get(folderId) as { client_secret_enc: string | null } | undefined;
  if (!row?.client_secret_enc) return backTo('no-secret');
  let secret: string;
  try { secret = unseal(row.client_secret_enc); }
  catch { return backTo('decrypt-fail'); }

  const redirectUri = absoluteUrl(req, '/api/oauth/callback').toString();
  const client = new google.auth.OAuth2(folder.client_id, secret, redirectUri);

  // Callback jalan sebelum tahu email yang di-connect (identitas diparse dari
  // id_token setelah getToken). Jadi proxy yang dipakai di titik ini hanya
  // level folder (default). Per-gmail override berlaku dari OTP wait pertama
  // ke depan, bukan di saat connect pertama. Tetap efektif karena yang paling
  // kritis ditandai Google adalah seluruh rantai request pasca-consent: kalau
  // getToken sudah keluar lewat mobile IP, impossible-travel signal hilang.
  //
  // Decrypt proxy di-guard — AUTHFLEET_ENCRYPT_KEY berubah / payload rusak
  // tidak boleh bikin seluruh callback crash. Fallback: jalan tanpa proxy
  // (direct dari VPS) dengan log warning supaya operator bisa fix di UI.
  const folderProxyEnc = getFolderProxyEnc(folderId);
  let folderProxyUrl: string | null = null;
  if (folderProxyEnc) {
    try { folderProxyUrl = unseal(folderProxyEnc); }
    catch { console.warn(`[oauth/callback] folder proxy decrypt failed folder=${folderId}`); }
  }
  const folderProxyAgent = buildProxyAgent(folderProxyUrl);
  if (folderProxyAgent) {
    const transporter = (client as unknown as { transporter: { defaults: { agent?: unknown; timeout?: number } } }).transporter;
    if (transporter?.defaults) {
      transporter.defaults.agent = folderProxyAgent;
      transporter.defaults.timeout = TOKEN_EXCHANGE_TIMEOUT_MS;
    }
  }
  const proxyTag = folderProxyUrl ? maskProxyUrl(folderProxyUrl) : 'direct';
  console.warn(`[oauth/callback] folder=${folderId} proxy=${proxyTag} begin getToken`);

  try {
    // Promise.race sebagai safety net kedua di atas gaxios timeout: sebagian
    // path network (DNS resolve, TLS handshake di proxy agent) bisa lolos
    // dari socket timeout. 25s hard wall → selalu kembali ke redirect.
    const getTokenPromise = client.getToken(code);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('OAUTH_CALLBACK_TIMEOUT')), TOKEN_EXCHANGE_TIMEOUT_MS),
    );
    const { tokens } = await Promise.race([getTokenPromise, timeoutPromise]);
    // Scope start/route meminta 'openid email' sehingga Google selalu
    // mengembalikan id_token dengan claim email. Parse langsung — zero
    // API call ekstra setelah consent, selain token exchange yang wajib.
    const email = tokens.id_token ? emailFromIdToken(tokens.id_token) : '';
    if (!email) {
      console.warn(`[oauth/callback] no email in id_token folder=${folderId} hasIdToken=${Boolean(tokens.id_token)}`);
      return backTo('no-email');
    }
    if (!tokens.refresh_token) {
      const existing = db().prepare('SELECT refresh_token_enc FROM gmails WHERE email=? AND folder_id=?').get(email, folderId) as { refresh_token_enc: string | null } | undefined;
      if (!existing?.refresh_token_enc) {
        console.warn(`[oauth/callback] no refresh_token folder=${folderId} email=${email}`);
        return backTo('no-refresh');
      }
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
    console.warn(`[oauth/callback] ok folder=${folderId} email=${email} proxy=${proxyTag}`);
    return NextResponse.redirect(absoluteUrl(req, `/folders/${folderId}?oauth=ok&email=${encodeURIComponent(email)}`));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('OAUTH_CALLBACK_TIMEOUT')) {
      console.warn(`[oauth/callback] TIMEOUT folder=${folderId} proxy=${proxyTag}`);
      return backTo('proxy-timeout');
    }
    // Error gaxios biasanya memuat "ETIMEDOUT" / "ECONNREFUSED" / "407 Proxy
    // Authentication Required" / "tunneling socket could not be established".
    // Semua indikasi proxy — redirect proxy-fail agar banner beda dari
    // Google-side exchange error (CID/secret salah).
    if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|tunneling socket|Proxy Authentication|socks/i.test(msg)) {
      console.warn(`[oauth/callback] proxy-fail folder=${folderId} proxy=${proxyTag} err=${msg.slice(0, 200)}`);
      return backTo('proxy-fail');
    }
    console.warn(`[oauth/callback] exchange-fail folder=${folderId} proxy=${proxyTag} err=${msg.slice(0, 200)}`);
    return backTo('exchange-fail');
  }
}
