import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db, getFolder, listApiKeys } from '@/lib/store';
import { generateApiKey, hashApiKey } from '@/lib/apikey';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!getFolder(id)) return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 });
  let body: { label?: string } = {};
  try { body = await req.json(); } catch {}
  const label = String(body.label || '').trim().slice(0, 60);
  if (label.length < 2) return NextResponse.json({ error: 'Label minimal 2 karakter' }, { status: 400 });

  const { raw, prefix } = generateApiKey();
  const hash = await hashApiKey(raw);
  const keyId = randomUUID();
  db().prepare(`
    INSERT INTO api_keys (id, folder_id, label, hash, prefix, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(keyId, id, label, hash, prefix, Date.now());

  return NextResponse.json({ id: keyId, label, prefix, rawKey: raw });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ keys: listApiKeys(id) });
}
