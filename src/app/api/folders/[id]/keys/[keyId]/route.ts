import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db } from '@/lib/store';
import { absoluteUrl } from '@/lib/url';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

type Ctx = { params: Promise<{ id: string; keyId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id, keyId } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    if (form.get('_method') === 'DELETE') return doRevoke(req, id, keyId);
  }
  return NextResponse.json({ error: 'Method not supported' }, { status: 405 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id, keyId } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return doRevoke(req, id, keyId);
}

function doRevoke(req: NextRequest, folderId: string, keyId: string) {
  db().prepare('UPDATE api_keys SET revoked_at=? WHERE id=? AND folder_id=?').run(Date.now(), keyId, folderId);
  return NextResponse.redirect(absoluteUrl(req, `/folders/${folderId}`), 303);
}
