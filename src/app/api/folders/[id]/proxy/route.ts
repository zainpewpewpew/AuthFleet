/**
 * Folder-level default proxy endpoint. Operator paste 1 URL yang dipakai
 * sebagai fallback untuk semua gmail di folder ini saat per-gmail proxy
 * belum di-set. Di masa aktif per-gmail override menang (lihat
 * effectiveProxyEnc di store.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { getFolder, setFolderProxyEnc, getFolderProxyEnc } from '@/lib/store';
import { seal, unseal } from '@/lib/crypto';
import { isSupportedProxyUrl, maskProxyUrl } from '@/lib/proxy';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!getFolder(id)) return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 });
  const enc = getFolderProxyEnc(id);
  const url = enc ? unseal(enc) : null;
  return NextResponse.json({ masked: url ? maskProxyUrl(url) : null, hasProxy: Boolean(url) });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!getFolder(id)) return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 });
  let body: { url?: string } = {};
  try { body = await req.json(); } catch {}
  const raw = String(body.url || '').trim();
  if (!raw) return NextResponse.json({ error: 'URL proxy wajib' }, { status: 400 });
  if (!isSupportedProxyUrl(raw)) return NextResponse.json({
    error: 'Format URL tidak dikenal. Gunakan http(s)://user:pass@host:port atau socks5://user:pass@host:port',
  }, { status: 400 });
  setFolderProxyEnc(id, seal(raw));
  return NextResponse.json({ ok: true, masked: maskProxyUrl(raw) });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!getFolder(id)) return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 });
  setFolderProxyEnc(id, null);
  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
