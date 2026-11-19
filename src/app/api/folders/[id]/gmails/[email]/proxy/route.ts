/**
 * Per-gmail proxy binding — desain 1 IP = 1 gmail yang dipilih operator
 * supaya tiap canonical gmail (bisa menampung 5 akun IG via dot/plus alias)
 * punya exit IP mobile unik; jadi di mata Google tiap gmail terlihat sebagai
 * pengguna yang berbeda. Override folder default saat ada; kosong = fallback
 * ke folder default via effectiveProxyEnc di store.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db, setGmailProxyEnc, getGmailProxyEnc } from '@/lib/store';
import { gmailCanonical } from '@/lib/otp';
import { seal, unseal } from '@/lib/crypto';
import { isSupportedProxyUrl, maskProxyUrl } from '@/lib/proxy';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

type Ctx = { params: Promise<{ id: string; email: string }> };

function resolveGmail(folderId: string, rawEmail: string): string | null {
  const canonical = gmailCanonical(decodeURIComponent(rawEmail).trim().toLowerCase());
  const exists = db().prepare('SELECT 1 AS ok FROM gmails WHERE folder_id=? AND email=?')
    .get(folderId, canonical) as { ok: number } | undefined;
  return exists ? canonical : null;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id, email } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const canonical = resolveGmail(id, email);
  if (!canonical) return NextResponse.json({ error: 'Gmail tidak ditemukan di folder' }, { status: 404 });
  const enc = getGmailProxyEnc(id, canonical);
  const url = enc ? unseal(enc) : null;
  return NextResponse.json({ masked: url ? maskProxyUrl(url) : null, hasProxy: Boolean(url) });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id, email } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const canonical = resolveGmail(id, email);
  if (!canonical) return NextResponse.json({ error: 'Gmail tidak ditemukan di folder' }, { status: 404 });
  let body: { url?: string } = {};
  try { body = await req.json(); } catch {}
  const raw = String(body.url || '').trim();
  if (!raw) return NextResponse.json({ error: 'URL proxy wajib' }, { status: 400 });
  if (!isSupportedProxyUrl(raw)) return NextResponse.json({
    error: 'Format URL tidak dikenal. Gunakan http(s)://user:pass@host:port atau socks5://user:pass@host:port',
  }, { status: 400 });
  setGmailProxyEnc(id, canonical, seal(raw));
  return NextResponse.json({ ok: true, masked: maskProxyUrl(raw) });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id, email } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const canonical = resolveGmail(id, email);
  if (!canonical) return NextResponse.json({ error: 'Gmail tidak ditemukan di folder' }, { status: 404 });
  setGmailProxyEnc(id, canonical, null);
  return NextResponse.json({ ok: true });
}

export const runtime = 'nodejs';
