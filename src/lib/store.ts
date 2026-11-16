/**
 * AuthFleet local store — better-sqlite3.
 *
 * File-based. One operator per install, folders are first-class entities.
 * Gmail refresh tokens + OAuth client secrets are encrypted at rest with
 * AES-256-GCM (see lib/crypto.ts). API keys are hashed (argon2id) — the
 * raw key is only returned once at generation.
 *
 * On first launch with an empty DB, the store seeds representative
 * content so the dashboard reads as a real fleet, not placeholders.
 * Seeded rows are marked seed=1 so the app can show a "demo data" banner
 * and purge them once the operator creates their first real folder.
 */
import { randomUUID, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'authfleet.sqlite');

type DbHandle = Database.Database;
let dbInstance: DbHandle | null = null;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (process.platform !== 'win32') {
    try { fs.chmodSync(DATA_DIR, 0o700); } catch { /* ignore */ }
  }
}

function openDb(): DbHandle {
  ensureDataDir();
  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      tone TEXT NOT NULL DEFAULT '#00C9D4',
      client_id TEXT,
      client_secret_enc TEXT,
      created_at INTEGER NOT NULL,
      seed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS gmails (
      email TEXT NOT NULL,
      folder_id TEXT NOT NULL,
      refresh_token_enc TEXT,
      status TEXT NOT NULL DEFAULT 'connected',
      last_otp_at INTEGER,
      connected_at INTEGER NOT NULL,
      PRIMARY KEY (email, folder_id),
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL,
      label TEXT NOT NULL,
      hash TEXT NOT NULL,
      prefix TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS otp_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id TEXT NOT NULL,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      sender TEXT,
      subject TEXT,
      received_at INTEGER NOT NULL,
      api_key_id TEXT,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_otp_events_folder_time ON otp_events(folder_id, received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gmails_folder ON gmails(folder_id);
    CREATE INDEX IF NOT EXISTS idx_keys_folder ON api_keys(folder_id);
  `);
  return db;
}

export function db(): DbHandle {
  if (!dbInstance) {
    dbInstance = openDb();
    seedIfEmpty(dbInstance);
  }
  return dbInstance;
}

/* ─── Types ─────────────────────────────────────────── */
export type FolderRow = {
  id: string;
  label: string;
  tone: string;
  client_id: string | null;
  created_at: number;
  seed: number;
};
export type GmailRow = {
  email: string;
  folder_id: string;
  status: 'connected' | 'needs_relogin' | 'degraded';
  last_otp_at: number | null;
  connected_at: number;
};

/**
 * Google OAuth consent in Testing mode invalidates refresh_tokens after
 * 7 days. AuthFleet surfaces that clock to the operator so re-authorize
 * never comes as a surprise: a countdown chip shows on every Gmail row
 * and the OTP endpoints refuse expired ones with a clear error.
 */
export const GMAIL_GRANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type GmailLifecycle = 'fresh' | 'warning' | 'critical' | 'expired';

export function gmailExpiresAt(connectedAt: number): number {
  return connectedAt + GMAIL_GRANT_TTL_MS;
}

export function gmailLifecycle(connectedAt: number): GmailLifecycle {
  const remaining = gmailExpiresAt(connectedAt) - Date.now();
  if (remaining <= 0) return 'expired';
  if (remaining < 24 * 60 * 60 * 1000) return 'critical'; // < 1 day
  if (remaining < 3 * 24 * 60 * 60 * 1000) return 'warning'; // < 3 days
  return 'fresh';
}

/**
 * The effective status for decisions and display: a Gmail that was
 * marked 'connected' but whose 7-day grant has elapsed reads as
 * 'needs_relogin' everywhere.
 */
export function gmailEffectiveStatus(row: { status: string; connected_at: number }):
  'connected' | 'needs_relogin' | 'degraded' {
  if (row.status === 'connected' && gmailLifecycle(row.connected_at) === 'expired') {
    return 'needs_relogin';
  }
  return row.status as 'connected' | 'needs_relogin' | 'degraded';
}
export type ApiKeyRow = {
  id: string;
  folder_id: string;
  label: string;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
};
export type OtpEventRow = {
  id: number;
  folder_id: string;
  email: string;
  code: string;
  sender: string | null;
  subject: string | null;
  received_at: number;
  api_key_id: string | null;
};

/* ─── Queries ───────────────────────────────────────── */

export function listFolders(): FolderRow[] {
  return db().prepare('SELECT id,label,tone,client_id,created_at,seed FROM folders ORDER BY created_at ASC').all() as FolderRow[];
}
export function getFolder(id: string): FolderRow | null {
  return (db().prepare('SELECT id,label,tone,client_id,created_at,seed FROM folders WHERE id=?').get(id) as FolderRow | undefined) || null;
}
export function listGmails(folderId: string): GmailRow[] {
  return db().prepare('SELECT email,folder_id,status,last_otp_at,connected_at FROM gmails WHERE folder_id=? ORDER BY connected_at DESC').all(folderId) as GmailRow[];
}
export function listApiKeys(folderId: string): ApiKeyRow[] {
  return db().prepare('SELECT id,folder_id,label,prefix,created_at,last_used_at,revoked_at FROM api_keys WHERE folder_id=? ORDER BY created_at DESC').all(folderId) as ApiKeyRow[];
}
export function listRecentOtp(limit = 8): (OtpEventRow & { folder_label: string; folder_tone: string })[] {
  return db().prepare(`
    SELECT e.*, f.label AS folder_label, f.tone AS folder_tone
    FROM otp_events e
    JOIN folders f ON f.id = e.folder_id
    ORDER BY e.received_at DESC
    LIMIT ?
  `).all(limit) as (OtpEventRow & { folder_label: string; folder_tone: string })[];
}
export function countAll(): { folders: number; gmails: number; keys: number; otps7d: number } {
  const row = db().prepare(`
    SELECT
      (SELECT COUNT(*) FROM folders) AS folders,
      (SELECT COUNT(*) FROM gmails) AS gmails,
      (SELECT COUNT(*) FROM api_keys WHERE revoked_at IS NULL) AS keys,
      (SELECT COUNT(*) FROM otp_events WHERE received_at > ?) AS otps7d
  `).get(Date.now() - 7 * 24 * 3600 * 1000) as { folders: number; gmails: number; keys: number; otps7d: number };
  return row;
}

export function getFoldersForSidebar() {
  const folders = listFolders();
  return folders.map((f) => {
    const gmails = listGmails(f.id);
    const keys = db().prepare('SELECT COUNT(*) AS n FROM api_keys WHERE folder_id=? AND revoked_at IS NULL').get(f.id) as { n: number };
    // critical = any Gmail already expired or in its last day (needs operator action).
    // warning = any Gmail in the 1–3 day expiry window.
    const effectives = gmails.map((g) => ({ effective: gmailEffectiveStatus(g), life: gmailLifecycle(g.connected_at) }));
    const critical = effectives.some((e) => e.effective === 'needs_relogin' || e.life === 'critical');
    const warning = !critical && effectives.some((e) => e.life === 'warning');
    const attention: 'none' | 'warning' | 'critical' = critical ? 'critical' : warning ? 'warning' : 'none';
    return {
      id: f.id,
      label: f.label,
      tone: f.tone,
      gmails: gmails.length,
      keys: keys.n,
      attention,
    };
  });
}

/* ─── Seed (demo data on first launch) ──────────────── */

const SEED_FOLDERS: Array<{ label: string; tone: string; gmails: string[] }> = [
  {
    label: 'Dapur IG',
    tone: '#FF4FAA',
    gmails: [
      'zainpewpewpew@gmail.com',
      'z.a.i.npewpewpew@gmail.com',
      'zain+dapur01@gmail.com',
      'zain+dapur02@gmail.com',
      'ratuvoyage.id@gmail.com',
    ],
  },
  {
    label: 'Studio Koneksi',
    tone: '#00C9D4',
    gmails: [
      'studio.koneksi@gmail.com',
      'studio.koneksi+n01@gmail.com',
      'studio.koneksi+n02@gmail.com',
      'studio.koneksi+n03@gmail.com',
    ],
  },
  {
    label: 'Lab Akun 3K',
    tone: '#00A676',
    gmails: [
      'lab.akun.3k@gmail.com',
      'labakun+pageone@gmail.com',
      'labakun+pagetwo@gmail.com',
      'labakun+pagethree@gmail.com',
      'labakun+pagefour@gmail.com',
      'labakun+pagefive@gmail.com',
    ],
  },
  {
    label: 'Arsip 2025',
    tone: '#FFB020',
    gmails: [
      'arsip.op2025@gmail.com',
      'arsip.op2025+a@gmail.com',
    ],
  },
];

function seedIfEmpty(d: DbHandle) {
  // Demo data only in dev. Production stays empty until the operator
  // creates their first real folder. Opt back in with AUTHFLEET_SEED=1.
  if (process.env.NODE_ENV === 'production' && process.env.AUTHFLEET_SEED !== '1') return;
  const n = (d.prepare('SELECT COUNT(*) AS n FROM folders').get() as { n: number }).n;
  if (n > 0) return;
  const now = Date.now();
  const insertFolder = d.prepare(`
    INSERT INTO folders (id, label, tone, client_id, client_secret_enc, created_at, seed)
    VALUES (?, ?, ?, ?, NULL, ?, 1)
  `);
  const insertGmail = d.prepare(`
    INSERT INTO gmails (email, folder_id, refresh_token_enc, status, last_otp_at, connected_at)
    VALUES (?, ?, NULL, ?, ?, ?)
  `);
  const insertKey = d.prepare(`
    INSERT INTO api_keys (id, folder_id, label, hash, prefix, created_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOtp = d.prepare(`
    INSERT INTO otp_events (folder_id, email, code, sender, subject, received_at, api_key_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const senders = ['no-reply@instagram.com', 'security@mail.instagram.com', 'security@facebookmail.com'];
  const subjects = [
    'Your Instagram confirmation code',
    'Kode konfirmasi Instagram kamu',
    'Verifikasi dua langkah Accounts Center',
  ];

  d.transaction(() => {
    for (let fi = 0; fi < SEED_FOLDERS.length; fi++) {
      const f = SEED_FOLDERS[fi];
      const folderId = randomUUID();
      insertFolder.run(folderId, f.label, f.tone,
        `${randomBytes(12).toString('hex')}.apps.googleusercontent.com`, now - fi * 86_400_000);

      for (let gi = 0; gi < f.gmails.length; gi++) {
        const email = f.gmails[gi];
        const status = (fi === 0 && gi === f.gmails.length - 1) ? 'needs_relogin'
          : (fi === 2 && gi === f.gmails.length - 1) ? 'degraded'
          : 'connected';
        // Spread connected_at across the 7-day grant window so the dashboard
        // demos all lifecycle tones: fresh (<4d), warning (4-6d), critical
        // (6-7d), expired (>7d). (fi, gi) keep it deterministic per seed.
        const ageHours = (fi * 42 + gi * 19) % 192; // 0..7.99 days
        const connectedAt = now - ageHours * 3_600_000;
        insertGmail.run(email, folderId, status, now - gi * 1800_000, connectedAt);
      }

      const keyCount = fi === 0 ? 2 : 1;
      for (let ki = 0; ki < keyCount; ki++) {
        const keyId = randomUUID();
        const prefix = 'afk_live_' + randomBytes(3).toString('hex');
        insertKey.run(
          keyId,
          folderId,
          ki === 0 ? 'sociofy-agent-primary' : 'sociofy-agent-backup',
          'seed:$argon2id$seeded',
          prefix,
          now - ki * 3600_000 - fi * 43200_000,
          now - ki * 2400_000,
        );
        // Deterministic but varied codes so a fresh seed shows a real-looking
        // spread of 6-digit OTPs instead of 100000-100005-100010 in a row.
        for (let oi = 0; oi < 6 + fi * 2; oi++) {
          const email = f.gmails[oi % f.gmails.length];
          const mix = ((fi + 1) * 48271 * (oi + 1) + 2147483647) % 900000;
          const code = String(100000 + mix).padStart(6, '0');
          insertOtp.run(
            folderId,
            email,
            code,
            senders[oi % senders.length],
            subjects[oi % subjects.length],
            now - (fi * 1800_000 + oi * 240_000 + (mix % 60_000)),
            keyId,
          );
        }
      }
    }
  })();
}
