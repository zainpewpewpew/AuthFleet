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
 * auto-detect dari skema URL. Format Multilogin native `host:port:user:pass`
 * juga diterima dan di-normalisasi ke `socks5://user:pass@host:port`.
 */
import type { Agent } from 'node:http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

/**
 * Normalisasi input proxy. Menerima:
 *  - URL lengkap: `socks5://user:pass@host:port`, `http://user:pass@host:port`
 *  - Format Multilogin: `host:port:user:pass` → default SOCKS5
 * Return URL string yang sudah ter-encode, atau null kalau tidak kenal.
 */
export function normalizeProxyInput(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?|socks4?|socks5h?):\/\//i.test(trimmed)) return trimmed;
  const m = trimmed.match(/^([a-z0-9][a-z0-9.-]*[a-z0-9]):(\d{1,5}):([^:\s]+):([^:\s]+)$/i);
  if (!m) return null;
  const [, host, port, user, pass] = m;
  return `socks5://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
}

export function isSupportedProxyUrl(url: string): boolean {
  const normalized = normalizeProxyInput(url);
  if (!normalized) return false;
  return /^(https?|socks4?|socks5h?):\/\/[^\s]+:\d+/i.test(normalized);
}

export function buildProxyAgent(url: string | null | undefined): Agent | null {
  const normalized = normalizeProxyInput(url);
  if (!normalized) return null;
  try {
    if (/^socks[45]?h?:\/\//i.test(normalized)) {
      return new SocksProxyAgent(normalized) as unknown as Agent;
    }
    if (/^https?:\/\//i.test(normalized)) {
      return new HttpsProxyAgent(normalized) as unknown as Agent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Masking URL untuk ditampilkan di UI tanpa membocorkan credential.
 * `http://user:pass@host:port` → `http://user:***@host:port`.
 * Input Multilogin `host:port:user:pass` dinormalisasi dulu.
 */
export function maskProxyUrl(url: string | null | undefined): string {
  if (!url) return '';
  const normalized = normalizeProxyInput(url) || url;
  try {
    const u = new URL(normalized);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return normalized.length > 32 ? normalized.slice(0, 16) + '…' + normalized.slice(-12) : normalized;
  }
}
