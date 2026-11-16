import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db, getFolder } from '@/lib/store';
import { seal } from '@/lib/crypto';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  // Form posts with _method override dispatch to PATCH/DELETE.
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    const method = String(form.get('_method') || '').toUpperCase();
    if (method === 'DELETE') return deleteFolder(req, id);
    if (method === 'PATCH') return editFolder(req, id, Object.fromEntries(form.entries()) as any);
  }
  return NextResponse.json({ error: 'Method not supported' }, { status: 405 });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: any = {};
  try { body = await req.json(); } catch {}
  return editFolder(req, id, body);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return deleteFolder(req, id);
}

function editFolder(req: NextRequest, id: string, body: { label?: string; tone?: string; clientId?: string; clientSecret?: string }) {
  const folder = getFolder(id);
  if (!folder) return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 });
  const label = body.label ? String(body.label).trim() : folder.label;
  const tone = body.tone ? String(body.tone).trim() : folder.tone;
  const clientId = body.clientId !== undefined ? String(body.clientId).trim() : folder.client_id || '';
  const encrypted = body.clientSecret ? seal(String(body.clientSecret)) : null;
  db().prepare(`
    UPDATE folders SET label=?, tone=?, client_id=?${encrypted ? ', client_secret_enc=?' : ''} WHERE id=?
  `).run(
    ...(encrypted ? [label, tone, clientId, encrypted, id] : [label, tone, clientId, id]) as string[],
  );
  return NextResponse.redirect(new URL(`/folders/${id}`, req.url), 303);
}

function deleteFolder(req: NextRequest, id: string) {
  db().prepare('DELETE FROM folders WHERE id=?').run(id);
  return NextResponse.redirect(new URL('/folders', req.url), 303);
}
