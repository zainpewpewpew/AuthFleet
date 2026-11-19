/**
 * OTP server-side: resolve an API-key header to a folder, fetch recent
 * matching codes from that folder's Gmails via the Gmail API, parse 6/8-digit
 * codes, return the latest.
 *
 * The v1 wait endpoint polls every 1.5s up to the caller's timeout. Phase 2
 * will switch to Gmail history push notifications.
 */
import { db, gmailLifecycle, effectiveProxyEnc } from './store';
import { verifyApiKey } from './apikey';
import { unseal } from './crypto';
import { buildProxyAgent } from './proxy';
import { google } from 'googleapis';
import type { GaxiosOptions } from 'gaxios';

export class ExpiredGmailError extends Error {
  code = 'GMAIL_EXPIRED' as const;
  constructor(email: string) {
    super(`Grant Gmail ${email} sudah kadaluarsa — perlu izin ulang dari dashboard AuthFleet.`);
  }
}

/**
 * Dipakai saat route wait diminta email yang TIDAK pernah disambungkan ke
 * folder yang API key-nya dipakai. Sebelumnya kasus ini dibiarkan menjadi
 * "null → terus polling sampai 408 timeout", padahal mustahil ada OTP: tanpa
 * refresh token kita tidak bisa buka inbox Gmail-nya. Membalas 404 cepat
 * supaya caller (Sociofy Agent) bisa swap ke Gmail lain tanpa tunggu.
 */
export class GmailNotConfiguredError extends Error {
  code = 'GMAIL_NOT_CONFIGURED' as const;
  constructor(email: string) {
    super(`Gmail ${email} belum disambungkan ke folder AuthFleet yang dipakai API key ini.`);
  }
}

/**
 * Hanya error yang jelas-jelas menandakan refresh token mati di sisi Google:
 * invalid_grant (user mencabut, password berubah, Testing-mode auto-revoke),
 * atau 401 Unauthorized dengan reason authError/invalidCredentials. Error 5xx,
 * timeout, atau 403 rate-limit TIDAK dihitung sebagai grant mati — mereka
 * transient dan grant sebenarnya masih hidup; menandainya needs_relogin akan
 * salah lempar operator ke halaman re-OAuth untuk Gmail yang baik-baik saja.
 */
function isInvalidGrant(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as {
    response?: { data?: { error?: string; error_description?: string }; status?: number };
    status?: number;
    code?: string | number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
  const dataError = String(anyErr.response?.data?.error || '').toLowerCase();
  if (dataError === 'invalid_grant' || dataError === 'unauthorized_client') return true;
  const message = String(anyErr.message || '').toLowerCase();
  if (/invalid[_ ]grant|token has been expired or revoked|invalid credentials|unauthorized_client/.test(message)) return true;
  if (Array.isArray(anyErr.errors)) {
    for (const entry of anyErr.errors) {
      const reason = String(entry?.reason || '').toLowerCase();
      if (reason === 'autherror' || reason === 'authenticated' || reason === 'invalidcredentials') return true;
    }
  }
  // googleapis OAuth2.refreshTokenNoCache melempar HTTP 400 dengan data.error=invalid_grant;
  // Gmail API call berikutnya tanpa token baru bisa muncul sebagai 401 tanpa body
  // yang dikenali. Treat 401 dari sumber auth sebagai jelas-jelas mati — grant lain
  // (403 scope, 5xx server) tidak pernah lewat sini.
  const status = anyErr.response?.status ?? (typeof anyErr.status === 'number' ? anyErr.status : null);
  if (status === 401) return true;
  return false;
}

// Gmail treats `foo.bar@gmail.com`, `foobar@gmail.com`, and `foo+tag@gmail.com`
// as the same inbox. Sociofy's aliasPool spends those variants per account,
// but the `gmails` table stores only the canonical (dot-stripped, plus-stripped)
// form, so lookups by the raw alias miss the row and the wait loop returns null
// until timeout. Canonicalize at the lib boundary so every caller is covered.
export function gmailCanonical(e: string): string {
  if (!e) return e;
  const at = e.indexOf('@');
  if (at < 0) return e;
  const domain = e.slice(at + 1).toLowerCase();
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return e.toLowerCase();
  const local = e.slice(0, at).toLowerCase().replace(/\./g, '').split('+')[0];
  return `${local}@gmail.com`;
}

export type KeyLookup = {
  keyId: string;
  folderId: string;
  prefix: string;
};

export async function resolveApiKey(header: string | null): Promise<KeyLookup | null> {
  if (!header) return null;
  const raw = header.replace(/^Bearer\s+/i, '').trim();
  if (!raw.startsWith('afk_live_')) return null;
  const prefix = raw.slice(0, 13);
  const candidates = db().prepare(
    'SELECT id, folder_id, label, prefix, hash FROM api_keys WHERE prefix=? AND revoked_at IS NULL'
  ).all(prefix) as Array<{ id: string; folder_id: string; label: string; prefix: string; hash: string }>;
  for (const c of candidates) {
    if (c.hash.startsWith('seed:')) continue; // seed keys are display-only
    if (await verifyApiKey(raw, c.hash)) {
      db().prepare('UPDATE api_keys SET last_used_at=? WHERE id=?').run(Date.now(), c.id);
      return { keyId: c.id, folderId: c.folder_id, prefix: c.prefix };
    }
  }
  return null;
}

export function recordOtpEvent(folderId: string, email: string, code: string, sender: string, subject: string, apiKeyId: string | null) {
  const canonical = gmailCanonical(email);
  db().prepare(`
    INSERT INTO otp_events (folder_id, email, code, sender, subject, received_at, api_key_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(folderId, canonical, code, sender, subject, Date.now(), apiKeyId);
  db().prepare('UPDATE gmails SET last_otp_at=? WHERE email=? AND folder_id=?')
    .run(Date.now(), canonical, folderId);
}

export function extractCode(text: string, digits: 6 | 8): string | null {
  const raw = String(text || '');
  if (digits === 6) {
    const spaced = raw.match(/\b(\d{3})\s(\d{3})\b/);
    if (spaced) return spaced[1] + spaced[2];
    const flat = raw.match(/\b(\d{6})\b/);
    if (flat) return flat[1];
  } else {
    const flat = raw.match(/\b(\d{8})\b/);
    if (flat) return flat[1];
  }
  return null;
}

export type GmailHit = { code: string; from: string; subject: string; receivedAt: number };

export async function fetchLatestOtpFromGmail(
  folderId: string,
  email: string,
  digits: 6 | 8,
  filter: string | null,
  sinceTs: number | null,
): Promise<GmailHit | null> {
  const canonical = gmailCanonical(email);
  const folder = db().prepare('SELECT client_id FROM folders WHERE id=?').get(folderId) as { client_id: string | null } | undefined;
  const credRow = db().prepare('SELECT client_secret_enc FROM folders WHERE id=?').get(folderId) as { client_secret_enc: string | null } | undefined;
  const gmailRow = db().prepare('SELECT refresh_token_enc, connected_at, status FROM gmails WHERE email=? AND folder_id=?').get(canonical, folderId) as { refresh_token_enc: string | null; connected_at: number; status: string } | undefined;
  // Folder tanpa client_id/secret adalah bug konfigurasi admin AuthFleet,
  // bukan sesuatu yang bisa diselesaikan dengan swap: tetap balas null supaya
  // route polling sampai timeout (operator wajib betulkan folder di dashboard).
  if (!folder?.client_id || !credRow?.client_secret_enc) return null;
  // Gmail tidak ada di folder yang API key-nya dipakai → tidak akan pernah
  // ada OTP masuk. Lempar cepat supaya caller bisa swap ke Gmail lain alih-alih
  // menunggu seluruh timeout wait loop.
  if (!gmailRow?.refresh_token_enc) throw new GmailNotConfiguredError(canonical);
  // Refuse expired grants early with a specific error — Google would
  // reject the request anyway, but surfacing it here keeps the OTP wait
  // loop from spinning for a minute before failing.
  if (gmailLifecycle(gmailRow.connected_at) === 'expired') {
    // Keep the row's displayed status honest for the dashboard.
    if (gmailRow.status === 'connected') {
      db().prepare('UPDATE gmails SET status=? WHERE email=? AND folder_id=?')
        .run('needs_relogin', canonical, folderId);
    }
    throw new ExpiredGmailError(canonical);
  }

  const clientSecret = unseal(credRow.client_secret_enc);
  const refreshToken = unseal(gmailRow.refresh_token_enc);
  const oauth = new google.auth.OAuth2(folder.client_id, clientSecret);
  oauth.setCredentials({ refresh_token: refreshToken });

  // Proxy mobile sticky (biasanya Multilogin) dipakai per-gmail; folder level
  // default kalau per-gmail kosong. Agent dipasang di dua titik: transporter
  // OAuth2 agar auto-refresh access_token keluar lewat proxy, dan per-call
  // options di `messages.list` + `messages.get` agar panggilan Gmail API
  // juga ikut keluar lewat IP mobile. Tanpa proxy, request keluar dari IP
  // VPS datacenter dan memicu Google protection sign-out semua sesi user.
  const proxyEnc = effectiveProxyEnc(folderId, canonical);
  const proxyUrl = proxyEnc ? unseal(proxyEnc) : null;
  const proxyAgent = buildProxyAgent(proxyUrl);
  if (proxyAgent) {
    const transporter = (oauth as unknown as { transporter: { defaults: { agent?: unknown } } }).transporter;
    if (transporter?.defaults) transporter.defaults.agent = proxyAgent;
  }
  const callOpts: GaxiosOptions | undefined = proxyAgent
    ? ({ agent: proxyAgent } as unknown as GaxiosOptions)
    : undefined;

  const gmail = google.gmail({ version: 'v1', auth: oauth });

  const since = Math.max(1, Math.floor((sinceTs || Date.now() - 10 * 60_000) / 1000));
  const q = [`after:${since}`];
  // Every known provider filter resolves to the same sender union so OTP
  // and 2FA mails from any Meta or TikTok subdomain are picked up without
  // the caller having to switch filter keys as new platforms come online.
  if (filter === 'instagram' || filter === 'meta' || filter === 'tiktok')
    q.push('from:(instagram.com OR facebookmail.com OR mail.instagram.com OR meta.com OR facebook.com OR fb.com OR tiktok.com OR tiktokmail.com OR accounts.tiktok.com)');
  // Google kadang mencabut refresh token sebelum 7-hari (Testing-mode auto-revoke,
  // user mengubah password, aktivitas security). Tanpa catch khusus, error
  // invalid_grant hanya dilempar sebagai HTTP 500 oleh route sehingga baris
  // gmails tetap bertuliskan 'connected' sampai jendela 7-hari real-time
  // habis — operator melihat OTP tak kunjung masuk tapi dashboard masih
  // menampilkan Gmail "siap pakai". Catch di dua pemanggilan Gmail API,
  // flip status + lempar ExpiredGmailError supaya route membalas 410 dan
  // caller (Sociofy Agent) bisa swap ke Gmail cadangan.
  const markDead = (): never => {
    if (gmailRow.status === 'connected') {
      db().prepare('UPDATE gmails SET status=? WHERE email=? AND folder_id=?')
        .run('needs_relogin', canonical, folderId);
    }
    throw new ExpiredGmailError(canonical);
  };
  let list;
  try {
    list = await gmail.users.messages.list({ userId: 'me', q: q.join(' '), maxResults: 10 }, callOpts);
  } catch (err) {
    if (isInvalidGrant(err)) markDead();
    throw err;
  }
  const items = list.data.messages || [];
  for (const item of items) {
    if (!item.id) continue;
    let msg;
    try {
      msg = await gmail.users.messages.get({ userId: 'me', id: item.id, format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'] }, callOpts);
    } catch (err) {
      // Mid-iterasi messages.get juga bisa kena invalid_grant (refresh token
      // mati di antara dua call). Perlakuan sama supaya Agent dapat 410 cepat.
      if (isInvalidGrant(err)) markDead();
      throw err;
    }
    const headers = Object.fromEntries((msg.data.payload?.headers || []).map(h => [String(h.name), String(h.value)]));
    const subject = headers['Subject'] || '';
    const from = headers['From'] || '';
    const snippet = msg.data.snippet || '';
    const code = extractCode(subject + ' ' + snippet, digits);
    if (code) {
      const receivedAt = msg.data.internalDate ? Number(msg.data.internalDate) : Date.now();
      return { code, from, subject, receivedAt };
    }
  }
  return null;
}
