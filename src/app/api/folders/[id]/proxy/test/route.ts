/**
 * Smoke test proxy URL sebelum disimpan. Panggil ipinfo.io/json via proxy
 * yang di-posting; pulangkan IP + country + ASN + ISP. Operator cocokkan
 * dengan preview Multilogin supaya tahu exit IP benar-benar mobile Jakarta
 * dan bukan datacenter. Tidak menyimpan URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { Gaxios } from 'gaxios';
import type { Agent } from 'node:http';
import { buildProxyAgent, isSupportedProxyUrl, maskProxyUrl } from '@/lib/proxy';

async function guard() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return Boolean(token && (await verifySessionToken(token)));
}

type IpInfo = {
  ip?: string; country?: string; region?: string; city?: string;
  org?: string; hostname?: string;
};

export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { url?: string } = {};
  try { body = await req.json(); } catch {}
  const raw = String(body.url || '').trim();
  if (!raw || !isSupportedProxyUrl(raw)) {
    return NextResponse.json({ error: 'URL proxy tidak valid' }, { status: 400 });
  }
  const agent = buildProxyAgent(raw);
  if (!agent) {
    return NextResponse.json({ error: 'Gagal bangun proxy agent' }, { status: 400 });
  }
  const gax = new Gaxios({ timeout: 15_000 });
  try {
    const res = await gax.request<IpInfo>({
      url: 'https://ipinfo.io/json',
      method: 'GET',
      agent: agent as Agent,
      responseType: 'json',
    });
    const data = res.data || {};
    return NextResponse.json({
      ok: true,
      masked: maskProxyUrl(raw),
      ip: data.ip || null,
      country: data.country || null,
      region: data.region || null,
      city: data.city || null,
      org: data.org || null,
      hostname: data.hostname || null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      masked: maskProxyUrl(raw),
      error: String((err as Error).message || 'Proxy test failed'),
    }, { status: 502 });
  }
}

export const runtime = 'nodejs';
