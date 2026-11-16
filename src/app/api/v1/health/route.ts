import { NextResponse } from 'next/server';
import { countAll } from '@/lib/store';

export async function GET() {
  const c = countAll();
  return NextResponse.json({
    ok: true,
    name: 'AuthFleet',
    version: '0.1.0',
    folders: c.folders,
    gmails: c.gmails,
    activeKeys: c.keys,
    otps7d: c.otps7d,
  });
}
