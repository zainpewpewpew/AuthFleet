import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { db, listFolders } from '@/lib/store';
import { seal } from '@/lib/crypto';
import { ensureStartupSweep } from '@/lib/autoProxy';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) return false;
  return true;
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Startup backfill: operator buka dashboard sekali → semua gmail/folder
  // lama yang belum punya proxy diisi dari template. Idempotent + jalan
  // sekali per proses Node (sweepDone flag).
  ensureStartupSweep();
  return NextResponse.json({ folders: listFolders() });
}

export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { label?: string; tone?: string; clientId?: string; clientSecret?: string } = {};
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 }); }

  const label = String(body.label || '').trim();
  const tone = String(body.tone || '#00C9D4').trim();
  const clientId = String(body.clientId || '').trim();
  const clientSecret = String(body.clientSecret || '').trim();

  if (label.length < 2 || label.length > 80) {
    return NextResponse.json({ error: 'Nama folder 2–80 karakter.' }, { status: 400 });
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(tone)) {
    return NextResponse.json({ error: 'Warna tidak valid.' }, { status: 400 });
  }
  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return NextResponse.json({ error: 'Client ID harus Google OAuth client.' }, { status: 400 });
  }
  if (clientSecret.length < 8) {
    return NextResponse.json({ error: 'Client secret terlalu pendek.' }, { status: 400 });
  }

  const id = randomUUID();
  const now = Date.now();
  db().prepare(`
    INSERT INTO folders (id, label, tone, client_id, client_secret_enc, created_at, seed)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(id, label, tone, clientId, seal(clientSecret), now);

  return NextResponse.json({ id, label, tone });
}
