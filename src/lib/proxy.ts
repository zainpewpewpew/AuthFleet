/**
 * Proxy agent builder untuk routing semua panggilan Google API dari AuthFleet
 * lewat exit IP yang bukan datacenter VPS (mobile sticky Multilogin / provider
 * residential sejenis). Tujuan: hilangkan sinyal "impossible travel" antara
 * IP consent user (rumah/mobile) dan IP API call (sebelumnya VPS datacenter)
 * yang memicu Google protection untuk sign-out semua sesi user.
 *
 * Satu URL per gmail (desain yang dipilih operator: 1 IP = 1 gmail), dengan
 * fallback ke proxy default di folder ketika per-gmail belum di-set. Operator
 * bebas pakai HTTP/HTTPS (dengan basic auth di URL) atau SOCKS5 — builder
 * auto-detect dari skema URL.
 */
import type { Agent } from 'node:http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

export function isSupportedProxyUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^(https?|socks4?|socks5h?):\/\/[^\s]+:\d+/i.test(trimmed);
}

export function buildProxyAgent(url: string | null | undefined): Agent | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    if (/^socks[45]?h?:\/\//i.test(trimmed)) {
      return new SocksProxyAgent(trimmed) as unknown as Agent;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return new HttpsProxyAgent(trimmed) as unknown as Agent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Masking URL untuk ditampilkan di UI tanpa membocorkan credential.
 * `http://user:pass@host:port` → `http://user:***@host:port`.
 */
export function maskProxyUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return url.length > 32 ? url.slice(0, 16) + '…' + url.slice(-12) : url;
  }
}
