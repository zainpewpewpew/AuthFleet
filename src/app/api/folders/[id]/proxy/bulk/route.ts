/**
 * Bulk apply proxy ke seluruh gmail di folder dengan sid rotated per-gmail.
 * Satu request dari operator → semua gmail dapat exit IP unique. Desain
 * 1 IP = 1 gmail (lihat komentar di proxy routes sisters).
 *
 * Body: { url: string, applyFolderDefault?: boolean }
 *   url  : template proxy. Multilogin format `host:port:user:pass`
 *          atau URL lengkap `socks5://user:pass@host:port`. Kalau user
 *          mengandung segment `-sid-<nilai>-`, nilai akan di-rotate per
 *          gmail. Kalau tidak ada segment sid, tambahkan `-sid-<nilai>-`
 *          di akhir user segment supaya tetap unique per gmail.
 *   applyFolderDefault: default true. Set folder-level proxy pakai sid
 *          khusus (sid=`folder-default-<folderId-snippet>`) sebagai
 *          fallback saat per-gmail belum di-set / di-clear.
 *
 * Response: { ok, folderId, folderDefault: {masked|null}, gmails: [{email, masked}] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { getFolder, listGmails, setFolderProxyEnc, setGmailProxyEnc } from '@/lib/store';
import { seal } from '@/lib/crypto';
import { isSupportedProxyUrl, maskProxyUrl, normalizeProxyInput } from '@/lib/proxy';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

type Ctx = { params: Promise<{ id: string }> };

// Sid 10-char alphanumeric mimic format Multilogin (contoh user: 3c36lTQ0).
function nextSid(): string {
  return randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 10);
}

// Terapkan sid baru pada URL yang sudah ternormalisasi (socks5://user:pass@host:port).
// Encoding user section tetap valid setelah replacement.
function rewriteSid(normalized: string, newSid: string): string {
  const u = new URL(normalized);
  const rawUser = decodeURIComponent(u.username);
  let newUser: string;
  if (/-sid-[^-]+-/i.test(rawUser)) {
    newUser = rawUser.replace(/-sid-[^-]+-/i, `-sid-${newSid}-`);
  } else if (/-sid-[^-]+$/i.test(rawUser)) {
    newUser = rawUser.replace(/-sid-[^-]+$/i, `-sid-${newSid}`);
  } else {
    // Segment sid belum ada → tambahkan di akhir sebelum filter (kalau ada)
    // atau di paling belakang. Multilogin menerima urutan segment bebas.
    newUser = /-filter-/i.test(rawUser)
      ? rawUser.replace(/-filter-/i, `-sid-${newSid}-filter-`)
      : `${rawUser}-sid-${newSid}`;
  }
  u.username = encodeURIComponent(newUser);
  return u.toString();
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!getFolder(id)) return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 });
  let body: { url?: string; applyFolderDefault?: boolean } = {};
  try { body = await req.json(); } catch {}
  const raw = String(body.url || '').trim();
  if (!raw) return NextResponse.json({ error: 'URL proxy wajib' }, { status: 400 });
  if (!isSupportedProxyUrl(raw)) return NextResponse.json({
    error: 'Format URL tidak dikenal. Multilogin host:port:user:pass atau socks5://user:pass@host:port',
  }, { status: 400 });
  const normalized = normalizeProxyInput(raw);
  if (!normalized) return NextResponse.json({ error: 'Gagal normalisasi URL proxy' }, { status: 400 });

  const applyFolderDefault = body.applyFolderDefault !== false;
  const gmails = listGmails(id);

  // Folder default — sid khusus supaya tidak collide dengan per-gmail.
  let folderDefaultMasked: string | null = null;
  if (applyFolderDefault) {
    const folderUrl = rewriteSid(normalized, `fd${id.slice(0, 6)}`.slice(0, 10));
    setFolderProxyEnc(id, seal(folderUrl));
    folderDefaultMasked = maskProxyUrl(folderUrl);
  }

  // Per-gmail — sid random unique per iterasi.
  const applied: Array<{ email: string; masked: string }> = [];
  for (const row of gmails) {
    const perUrl = rewriteSid(normalized, nextSid());
    setGmailProxyEnc(id, row.email, seal(perUrl));
    applied.push({ email: row.email, masked: maskProxyUrl(perUrl) });
  }

  return NextResponse.json({
    ok: true,
    folderId: id,
    folderDefault: folderDefaultMasked,
    gmails: applied,
    count: applied.length,
  });
}

export const runtime = 'nodejs';
