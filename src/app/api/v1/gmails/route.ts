import { NextRequest, NextResponse } from 'next/server';
import { resolveApiKey } from '@/lib/otp';
import {
  getFolder,
  listGmails,
  gmailEffectiveStatus,
  gmailLifecycle,
  gmailExpiresAt,
} from '@/lib/store';

/**
 * GET /api/v1/gmails
 *
 * Returns the Gmail accounts connected to the folder that owns the
 * presented API key. Agent-side Gmail Connector UI (Sociofy) reads this
 * to render dropdowns and status pills without needing to spawn a local
 * OTP server anymore. One API key = one folder = one list.
 *
 * Auth: Authorization: Bearer afk_live_...
 */
export async function GET(req: NextRequest) {
  const lookup = await resolveApiKey(req.headers.get('authorization'));
  if (!lookup) return NextResponse.json({ error: 'API key tidak valid' }, { status: 401 });

  const folder = getFolder(lookup.folderId);
  if (!folder) return NextResponse.json({ error: 'Folder tidak ditemukan' }, { status: 404 });

  const rows = listGmails(lookup.folderId);
  const accounts = rows.map((g) => {
    const effective = gmailEffectiveStatus(g);
    return {
      email: g.email,
      status: effective,
      hasGrant: g.status === 'connected',
      lifecycle: gmailLifecycle(g.connected_at),
      connectedAt: g.connected_at,
      expiresAt: gmailExpiresAt(g.connected_at),
      lastOtpAt: g.last_otp_at,
    };
  });

  const connected = accounts.filter((a) => a.hasGrant && a.status !== 'needs_relogin').length;
  const needsRelogin = accounts.filter((a) => a.status === 'needs_relogin').length;

  return NextResponse.json({
    folder: { id: folder.id, label: folder.label, tone: folder.tone },
    oauthConfigured: Boolean(folder.client_id),
    accounts,
    total: accounts.length,
    connected,
    needsRelogin,
  });
}

export const runtime = 'nodejs';
