/**
 * AES-256-GCM at-rest encryption for OAuth client secrets and Gmail refresh
 * tokens. Key comes from AUTHFLEET_ENCRYPT_KEY env (32 raw bytes,
 * base64-encoded), or is seeded on disk for localhost dev.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SEED_FILE = path.join(DATA_DIR, 'encrypt.key');
const PREFIX = 'AF_ENC_V1:';

function key(): Buffer {
  const env = process.env.AUTHFLEET_ENCRYPT_KEY;
  if (env) {
    const buf = Buffer.from(env, env.length === 64 ? 'hex' : 'base64');
    if (buf.length !== 32) throw new Error('AUTHFLEET_ENCRYPT_KEY must be 32 bytes');
    return buf;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SEED_FILE)) {
    fs.writeFileSync(SEED_FILE, crypto.randomBytes(32), { mode: 0o600 });
  }
  return fs.readFileSync(SEED_FILE);
}

export function seal(plain: string): string {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), nonce);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function unseal(sealed: string): string {
  if (!sealed.startsWith(PREFIX)) throw new Error('unseal: unknown prefix');
  const blob = Buffer.from(sealed.slice(PREFIX.length), 'base64');
  if (blob.length < 29) throw new Error('unseal: too short');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), blob.subarray(0, 12));
  decipher.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString('utf8');
}
