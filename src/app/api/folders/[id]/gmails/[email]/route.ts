import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db } from '@/lib/store';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

type Ctx = { params: Promise<{ id: string; email: string }> };

/**
 * Disconnect a Gmail from a folder: deletes the row (refresh token + all).
 * Form-posted _method=DELETE is accepted for progressive-enhancement so the
 * folder detail page can use a plain <form> without client JS when needed.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id, email } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    if (form.get('_method') === 'DELETE') return doDisconnect(req, id, email);
  }
  return NextResponse.json({ error: 'Method not supported' }, { status: 405 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id, email } = await ctx.params;
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return doDisconnect(req, id, email);
}

function doDisconnect(req: NextRequest, folderId: string, rawEmail: string) {
  const email = decodeURIComponent(rawEmail).trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 });
  }
  const info = db().prepare('DELETE FROM gmails WHERE email=? AND folder_id=?').run(email, folderId);
  if (info.changes === 0) {
    return NextResponse.json({ error: 'Gmail tidak ditemukan di folder ini' }, { status: 404 });
  }
  // Accept both JSON (fetch) and form (no-JS) clients. Redirect responses
  // keep the folder detail fresh without a second round-trip for forms.
  const accept = req.headers.get('accept') || '';
  if (accept.includes('application/json')) {
    return NextResponse.json({ ok: true, email });
  }
  return NextResponse.redirect(new URL(`/folders/${folderId}?gmail=disconnected`, req.url), 303);
}
