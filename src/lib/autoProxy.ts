/**
 * Helper auto-apply proxy ke gmail/folder dari env MULTILOGIN_PROXY_TEMPLATE.
 * Dipanggil otomatis oleh OAuth callback (saat gmail baru connect) dan
 * startup hook (scan semua gmail tanpa proxy). Operator tidak perlu klik.
 *
 * Desain 1 IP = 1 gmail: tiap gmail dapat sid unique 10-char base64url.
 * Folder default dapat sid khusus `fd<folderIdSnippet>` sebagai fallback
 * saat per-gmail belum ada.
 */
import { randomBytes } from 'node:crypto';
import { db, setFolderProxyEnc, setGmailProxyEnc, getFolderProxyEnc, getGmailProxyEnc, listFolders, listGmails } from './store';
import { seal } from './crypto';
import { isSupportedProxyUrl, normalizeProxyInput } from './proxy';

function getTemplate(): string | null {
  const raw = String(process.env.MULTILOGIN_PROXY_TEMPLATE || '').trim();
  if (!raw || !isSupportedProxyUrl(raw)) return null;
  return normalizeProxyInput(raw);
}

function nextSid(): string {
  return randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 10);
}

function rewriteSid(normalized: string, newSid: string): string {
  const u = new URL(normalized);
  const rawUser = decodeURIComponent(u.username);
  let newUser: string;
  if (/-sid-[^-]+-/i.test(rawUser)) newUser = rawUser.replace(/-sid-[^-]+-/i, `-sid-${newSid}-`);
  else if (/-sid-[^-]+$/i.test(rawUser)) newUser = rawUser.replace(/-sid-[^-]+$/i, `-sid-${newSid}`);
  else if (/-filter-/i.test(rawUser)) newUser = rawUser.replace(/-filter-/i, `-sid-${newSid}-filter-`);
  else newUser = `${rawUser}-sid-${newSid}`;
  u.username = encodeURIComponent(newUser);
  return u.toString();
}

/**
 * Auto-set proxy untuk satu gmail. Kalau gmail sudah punya proxy per-gmail
 * (override), biarkan (operator mungkin set manual). Kalau belum, apply sid
 * baru dari template. Return true kalau berhasil apply, false kalau skip.
 */
export function applyAutoProxyForGmail(folderId: string, email: string, options: { force?: boolean } = {}): boolean {
  const template = getTemplate();
  if (!template) return false;
  if (!options.force && getGmailProxyEnc(folderId, email)) return false; // already set
  const url = rewriteSid(template, nextSid());
  setGmailProxyEnc(folderId, email, seal(url));
  return true;
}

/**
 * Auto-set folder default kalau belum ada. Dipanggil saat startup + saat
 * folder baru dibuat (future hook).
 */
export function applyAutoProxyForFolderDefault(folderId: string, options: { force?: boolean } = {}): boolean {
  const template = getTemplate();
  if (!template) return false;
  if (!options.force && getFolderProxyEnc(folderId)) return false;
  const url = rewriteSid(template, `fd${folderId.slice(0, 6)}`.slice(0, 10));
  setFolderProxyEnc(folderId, seal(url));
  return true;
}

/**
 * Startup sweep: iterate semua folder + gmail, apply auto-proxy untuk yang
 * belum punya. Dipanggil sekali saat server boot via instrumentation.ts.
 * Idempotent: gmail/folder yang sudah punya proxy di-skip (tidak override).
 */
export function applyAutoProxyAllGaps(): { folders: number; gmails: number; skipped: boolean } {
  const template = getTemplate();
  if (!template) return { folders: 0, gmails: 0, skipped: true };
  let folderCount = 0;
  let gmailCount = 0;
  for (const folder of listFolders()) {
    if (applyAutoProxyForFolderDefault(folder.id)) folderCount++;
    for (const g of listGmails(folder.id)) {
      if (applyAutoProxyForGmail(folder.id, g.email)) gmailCount++;
    }
  }
  return { folders: folderCount, gmails: gmailCount, skipped: false };
}

/**
 * Apakah template ter-set + valid? Dipakai UI untuk tahu kalau auto-mode aktif.
 */
export function isAutoProxyConfigured(): boolean {
  return getTemplate() !== null;
}

/**
 * Idempotent startup sweep — jalan sekali per proses Node. Panggil dari
 * entry page/API apapun; iterasi berikutnya langsung return (pakai flag
 * modul-level). Diperlukan agar restart server langsung memback-fill
 * gmail/folder lama yang belum pernah di-OAuth ulang sejak template di-set.
 */
let sweepDone = false;
export function ensureStartupSweep(): void {
  if (sweepDone) return;
  sweepDone = true;
  try {
    const result = applyAutoProxyAllGaps();
    if (!result.skipped) {
      console.warn(`[autoProxy] startup sweep: ${result.folders} folder + ${result.gmails} gmail backfilled`);
    }
  } catch (err) {
    console.warn(`[autoProxy] startup sweep gagal: ${(err as Error).message}`);
    sweepDone = false; // retry on next call
  }
}
