import type { NextRequest } from 'next/server';

/**
 * Behind nginx + Cloudflare, `req.url` resolves to the server's bind address
 * (localhost:3000), not the public hostname. Read forwarded headers instead
 * so redirects + OAuth redirect_uri point at the real domain.
 */
export function absoluteUrl(req: NextRequest, path: string): URL {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'http';
    return new URL(path, `${proto}://${host}`);
  }
  return new URL(path, req.url);
}
