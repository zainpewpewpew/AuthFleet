/**
 * API key generation + verification.
 *
 * Shape: `afk_live_<24 url-safe chars>`. The prefix is stored in the clear
 * so the dashboard can display the leading characters without ever holding
 * the raw secret. The hash uses argon2id so a leaked DB cannot be bruteforced.
 */
import crypto from 'node:crypto';
import argon2 from 'argon2';

const PREFIX_LIVE = 'afk_live_';
const RANDOM_BYTES = 18; // 24 base64url chars

export function generateApiKey(): { raw: string; prefix: string } {
  const buf = crypto.randomBytes(RANDOM_BYTES);
  const slug = buf.toString('base64url');
  return { raw: PREFIX_LIVE + slug, prefix: (PREFIX_LIVE + slug).slice(0, 13) };
}

export async function hashApiKey(raw: string): Promise<string> {
  return argon2.hash(raw, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyApiKey(raw: string, hash: string): Promise<boolean> {
  if (!raw.startsWith(PREFIX_LIVE)) return false;
  try { return await argon2.verify(hash, raw); } catch { return false; }
}
