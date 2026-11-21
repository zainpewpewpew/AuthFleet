/**
 * Auto apply proxy ke semua gmail di folder tanpa input URL dari operator.
 * Template URL diambil dari env MULTILOGIN_PROXY_TEMPLATE di server. Operator
 * cukup klik tombol di dashboard → semua gmail dapat sid unique.
 *
 * Body optional:
 *   applyFolderDefault?: boolean (default true)
 *
 * Response (sukses): { ok, folderId, folderDefault, gmails: [{email,masked}], count }
 * Response (template kosong): 500 TEMPLATE_MISSING dengan hint setup env.
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

function nextSid(): string {
  return randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 10);
}

function rewriteSid(normalized: string, newSid: string): string {
  const u = new URL(normalized);
  const rawUser = decodeURIComponent(u.username);
  let newUser: string;
  if (/-sid-[^-]+-/i.test(rawUser)) {
    newUser = rawUser.replace(/-sid-[^-]+-/i, `-sid-${newSid}-`);
  } else if (/-sid-[^-]+$/i.test(rawUser)) {
    newUser = rawUser.replace(/-sid-[^-]+$/i, `-sid-${newSid}`);
  } else {
    newUser = /-filter-/i.test(rawUser)
      ? rawUser.replace(/-filter-/i, `-sid-${newSid}-filter-`)
      : `${rawUser}-sid-${newSid}`;
  }
  u.username = encodeURIComponent(newUser);
  return u.toString();
}

function resolveTemplate(): { url: string } | { error: string; hint: string } {
  const raw = String(process.env.MULTILOGIN_PROXY_TEMPLATE || '').trim();
  if (!raw) {
    return {
      error: 'TEMPLATE_MISSING',
      hint: 'Admin VPS: set env MULTILOGIN_PROXY_TEMPLATE di systemd drop-in (/etc/systemd/system/authfleet.service.d/*.conf) dengan URL proxy Multilogin host:port:user:pass atau socks5://.',
    };
  }
  if (!isSupportedProxyUrl(raw)) {
    return {
      error: 'TEMPLATE_INVALID',
      hint: 'Env MULTILOGIN_PROXY_TEMPLATE tidak dikenal. Format Multilogin host:port:user:pass atau socks5://user:pass@host:port.',
    };
  }
  const normalized = normalizeProxyInput(raw);
  if (!normalized) return { error: 'TEMPLATE_INVALID', hint: 'Normalisasi gagal.' };
  return { url: normalized };
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!getFolder(id)) return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 });

  const tpl = resolveTemplate();
  if ('error' in tpl) {
    return NextResponse.json({ error: tpl.error, hint: tpl.hint }, { status: 500 });
  }

  let body: { applyFolderDefault?: boolean } = {};
  try { body = await req.json(); } catch {}
  const applyFolderDefault = body.applyFolderDefault !== false;

  const gmails = listGmails(id);
  let folderDefaultMasked: string | null = null;
  if (applyFolderDefault) {
    const folderUrl = rewriteSid(tpl.url, `fd${id.slice(0, 6)}`.slice(0, 10));
    setFolderProxyEnc(id, seal(folderUrl));
    folderDefaultMasked = maskProxyUrl(folderUrl);
  }
  const applied: Array<{ email: string; masked: string }> = [];
  for (const row of gmails) {
    const perUrl = rewriteSid(tpl.url, nextSid());
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
