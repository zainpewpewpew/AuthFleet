import { NextRequest, NextResponse } from 'next/server';
import { resolveApiKey, fetchLatestOtpFromGmail, recordOtpEvent } from '@/lib/otp';

const POLL_INTERVAL_MS = 1500;
const MAX_TIMEOUT_MS = 240_000;

export async function POST(req: NextRequest) {
  const lookup = await resolveApiKey(req.headers.get('authorization'));
  if (!lookup) return NextResponse.json({ error: 'API key tidak valid' }, { status: 401 });
  let body: { email?: string; digits?: number; filter?: string; sinceTs?: number; timeoutMs?: number } = {};
  try { body = await req.json(); } catch {}
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email wajib' }, { status: 400 });
  const digits = (body.digits === 8 ? 8 : 6) as 6 | 8;
  const filter = body.filter || null;
  const sinceTs = Number(body.sinceTs) || Date.now() - 2 * 60_000;
  const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 180_000, 2000), MAX_TIMEOUT_MS);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (req.signal?.aborted) return NextResponse.json({ error: 'aborted' }, { status: 499 });
    try {
      const hit = await fetchLatestOtpFromGmail(lookup.folderId, email, digits, filter, sinceTs);
      if (hit) {
        recordOtpEvent(lookup.folderId, email, hit.code, hit.from, hit.subject, lookup.keyId);
        return NextResponse.json({ code: hit.code, from: hit.from, subject: hit.subject, receivedAt: hit.receivedAt });
      }
    } catch (err) {
      return NextResponse.json({ error: String((err as Error).message || 'Gmail error') }, { status: 500 });
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return NextResponse.json({ code: null, error: 'timeout' }, { status: 408 });
}

export const runtime = 'nodejs';
export const maxDuration = 300;
