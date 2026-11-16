import { headers } from 'next/headers';
import { Panel } from '@/components/Panel';
import { Chip } from '@/components/Chip';
import { countAll } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const counts = countAll();
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const publicUrl = `${proto}://${host}`;
  const isLocalhost = host.startsWith('localhost');

  return (
    <div className="af-settings">
      <header>
        <h1 className="af-display af-h1">Settings</h1>
        <p className="af-body">
          Preferensi armada. Kredensial OAuth terenkripsi AES-256-GCM di server.
        </p>
      </header>

      <Panel tone="chrome" radius="md">
        <h2 className="af-display af-h3" style={{ marginTop: 0 }}>Instance</h2>
        <dl className="af-settings__list">
          <div><dt>Versi</dt><dd className="af-mono">0.1.0 · y2k-frutiger-aero</dd></div>
          <div><dt>Mode</dt><dd><Chip tone="green">{isLocalhost ? 'localhost dev' : 'production'}</Chip></dd></div>
          <div><dt>Host</dt><dd className="af-mono">{host}</dd></div>
          <div><dt>Folder</dt><dd className="af-mono af-tabular">{counts.folders}</dd></div>
          <div><dt>Gmail</dt><dd className="af-mono af-tabular">{counts.gmails}</dd></div>
          <div><dt>API Keys aktif</dt><dd className="af-mono af-tabular">{counts.keys}</dd></div>
          <div><dt>OTP · 7 hari</dt><dd className="af-mono af-tabular">{counts.otps7d.toLocaleString('id-ID')}</dd></div>
        </dl>
      </Panel>

      <Panel tone="chrome" radius="md">
        <h2 className="af-display af-h3" style={{ marginTop: 0 }}>Environment</h2>
        <p className="af-body af-muted">
          Variabel yang dibaca server saat start. Dikelola lewat SSH di file <code className="af-mono">.env</code>.
        </p>
        <ul className="af-settings__env">
          <li>
            <code className="af-mono">AUTHFLEET_PASSWORD</code>
            <span className="af-muted">Password login dashboard (min 4 karakter).</span>
          </li>
          <li>
            <code className="af-mono">AUTHFLEET_SESSION_KEY</code>
            <span className="af-muted">Base64 32 bytes untuk tanda tangan session JWT. Di-generate otomatis oleh installer.</span>
          </li>
          <li>
            <code className="af-mono">AUTHFLEET_ENCRYPT_KEY</code>
            <span className="af-muted">Base64 32 bytes untuk AES-256-GCM OAuth client secrets + Gmail refresh tokens. Di-generate otomatis oleh installer.</span>
          </li>
        </ul>
      </Panel>

      <Panel tone="chrome" radius="md">
        <h2 className="af-display af-h3" style={{ marginTop: 0 }}>Integrasi Sociofy</h2>
        <p className="af-body">
          Set <code className="af-mono">AUTHFLEET_API_KEY</code> di Agent env, lalu panggil:
        </p>
        <pre className="af-settings__snippet">
{`POST ${publicUrl}/api/v1/otp/wait
Authorization: Bearer afk_live_xxx
Content-Type: application/json

{ "email": "akun@gmail.com", "digits": 6, "filter": "instagram",
  "timeoutMs": 180000 }`}
        </pre>
      </Panel>

      <style>{`
        .af-settings { display: grid; gap: 24px; }
        .af-settings header h1 { margin: 0 0 8px; }
        .af-settings header p { margin: 0 0 8px; max-width: 60ch; }
        .af-settings__list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 0; }
        .af-settings__list div { display: grid; gap: 4px; padding: 12px 14px; border-radius: var(--af-r-xs); background: rgba(14, 55, 107, 0.05); }
        .af-settings__list dt { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--af-ink-mute); font-weight: 700; }
        .af-settings__list dd { margin: 0; font-size: 16px; }
        .af-settings__env { display: grid; gap: 10px; }
        .af-settings__env li { display: grid; grid-template-columns: 260px 1fr; gap: 14px; padding: 10px 14px; border-radius: var(--af-r-xs); background: rgba(14, 55, 107, 0.05); align-items: center; }
        .af-settings__env code { font-size: 12px; background: rgba(0, 36, 81, 0.08); padding: 2px 8px; border-radius: 4px; color: var(--af-ink); }
        .af-settings__snippet {
          margin: 0;
          padding: 16px 18px;
          border-radius: var(--af-r-sm);
          background: linear-gradient(180deg, #001B3E 0%, #000B1C 100%);
          color: #B8DBFF;
          font-family: var(--af-font-mono);
          font-size: 13px;
          line-height: 1.6;
          overflow-x: auto;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 20, 48, 0.4);
        }
        @media (max-width: 720px) {
          .af-settings__list { grid-template-columns: 1fr 1fr; }
          .af-settings__env li { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
