/**
 * Operator session.
 *
 * Password check: compare submitted password against AUTHFLEET_PASSWORD env.
 * In dev with no env set, "authfleet-dev" is the fallback so the app runs
 * out of the box. In production the env is required.
 *
 * Token: jose-signed JWT (HS256) with the session's expiry. Signing key
 * is AUTHFLEET_SESSION_KEY (hex/base64) or derived at boot from a stable
 * random seed on disk for localhost.
 */
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SEED_FILE = path.join(DATA_DIR, 'session.key');

export const SESSION_COOKIE = 'af_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function readOrSeedKey(): Uint8Array {
  const envKey = process.env.AUTHFLEET_SESSION_KEY;
  if (envKey && envKey.length >= 16) {
    return Buffer.from(envKey, envKey.length === 64 ? 'hex' : 'base64');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SEED_FILE)) {
    const seed = crypto.randomBytes(32);
    fs.writeFileSync(SEED_FILE, seed, { mode: 0o600 });
  }
  return fs.readFileSync(SEED_FILE);
}

function signingKey(): Uint8Array {
  return readOrSeedKey();
}

export function operatorPassword(): string {
  const env = process.env.AUTHFLEET_PASSWORD;
  if (env && env.length >= 4) return env;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTHFLEET_PASSWORD env required in production');
  }
  return 'authfleet-dev';
}

export async function createSessionToken(): Promise<string> {
  const key = signingKey();
  return await new SignJWT({ role: 'operator' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const key = signingKey();
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}
