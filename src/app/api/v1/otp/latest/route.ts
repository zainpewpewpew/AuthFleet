import { NextRequest, NextResponse } from 'next/server';
import { resolveApiKey, fetchLatestOtpFromGmail, recordOtpEvent, ExpiredGmailError } from '@/lib/otp';

export async function GET(req: NextRequest) {
  const lookup = await resolveApiKey(req.headers.get('authorization'));
  if (!lookup) return NextResponse.json({ error: 'API key tidak valid' }, { status: 401 });
  const url = new URL(req.url);
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  const digits = (Number(url.searchParams.get('digits')) === 8 ? 8 : 6) as 6 | 8;
  const filter = url.searchParams.get('filter');
  const sinceTs = url.searchParams.get('since') ? Number(url.searchParams.get('since')) : null;
  if (!email) return NextResponse.json({ error: 'email wajib' }, { status: 400 });

  try {
    const hit = await fetchLatestOtpFromGmail(lookup.folderId, email, digits, filter, sinceTs);
    if (!hit) return NextResponse.json({ code: null });
    recordOtpEvent(lookup.folderId, email, hit.code, hit.from, hit.subject, lookup.keyId);
    return NextResponse.json({ code: hit.code, from: hit.from, subject: hit.subject, receivedAt: hit.receivedAt });
  } catch (err) {
    if (err instanceof ExpiredGmailError) {
      return NextResponse.json({ error: err.message, code: 'GMAIL_EXPIRED', email }, { status: 410 });
    }
    return NextResponse.json({ error: String((err as Error).message || 'Gmail error') }, { status: 500 });
  }
}
