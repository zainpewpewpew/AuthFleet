/** Format helpers shared by server components. */

const RTF = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });

export function relativeTime(ts: number): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(diff / 60_000);
  const hours = Math.round(diff / 3_600_000);
  const days = Math.round(diff / 86_400_000);
  if (abs < 60_000) return 'baru saja';
  if (abs < 3_600_000) return RTF.format(minutes, 'minute');
  if (abs < 86_400_000) return RTF.format(hours, 'hour');
  return RTF.format(days, 'day');
}

/**
 * Mask the local part of an email, keeping first and last 2 chars.
 * zainpewpewpew@gmail.com → za***ew@gmail.com
 * Domain stays whole; it never carries the secret.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 4) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-2)}@${domain}`;
}

export function fullCode(code: string): string {
  const c = code.replace(/\D/g, '');
  if (c.length === 6) return c.slice(0, 3) + ' ' + c.slice(3);
  if (c.length === 8) return c.slice(0, 4) + ' ' + c.slice(4);
  return c;
}
