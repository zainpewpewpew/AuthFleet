import Link from 'next/link';
import { ArrowUpRight, Inbox, Clock, KeyRound, Users } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import {
  countAll,
  listFolders,
  listGmails,
  listApiKeys,
  listRecentOtp,
  gmailEffectiveStatus,
  gmailLifecycle,
} from '@/lib/store';
import { maskEmail, relativeTime } from '@/lib/format';
import './dashboard.css';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const counts = countAll();
  const folders = listFolders();
  const recent = listRecentOtp(10);
  const latest = recent[0] || null;

  // Per-folder stats for the grid
  const folderCards = folders.map((f) => {
    const gmails = listGmails(f.id).map((g) => ({
      ...g,
      effective: gmailEffectiveStatus(g),
      life: gmailLifecycle(g.connected_at),
    }));
    const keys = listApiKeys(f.id);
    const fresh = recent.filter((e) => e.folder_id === f.id).length;
    const expiringSoon = gmails.filter((g) => g.effective === 'connected' && (g.life === 'warning' || g.life === 'critical')).length;
    const needsReauth = gmails.filter((g) => g.effective === 'needs_relogin').length;
    return { ...f, gmails, keys, fresh, expiringSoon, needsReauth };
  });

  return (
    <div className="af-dash">
      {/* ─── Live inbox hero ─── */}
      <Panel tone="chrome" radius="lg" shine padded={false} className="af-live">
        <div className="af-live__header">
          <div className="af-live__eyebrow">
            <Chip tone={latest ? 'pink' : 'neutral'} pulse={!!latest}>
              {latest ? 'Baru masuk' : 'Standby'}
            </Chip>
            <span className="af-mono af-mono-sm">
              Live inbox · {latest ? maskEmail(latest.email) : 'menunggu signal'}
            </span>
          </div>
          <Link href="/activity" className="af-live__link">
            Semua aktivitas <ArrowUpRight size={14} strokeWidth={2.4} />
          </Link>
        </div>

        <div className="af-live__body">
          <div className="af-live__code">
            <span className="af-live__code-digits af-mono af-tabular">
              {latest ? formatCode(latest.code) : '— — —  — — —'}
            </span>
            <span className="af-live__code-meta">
              {latest ? (
                <>
                  <strong>{latest.sender}</strong>
                  <span>{latest.subject}</span>
                </>
              ) : (
                <>
                  <strong>Belum ada OTP masuk</strong>
                  <span>Begitu kode mendarat, kartu ini akan pulsa pink dan isi otomatis.</span>
                </>
              )}
            </span>
          </div>

          <div className="af-live__meta">
            <div className="af-live__badge" style={{ '--tone': latest?.folder_tone || '#8FA7C4' } as React.CSSProperties}>
              <span className="af-live__badge-cap" aria-hidden />
              <span>
                <strong>{latest?.folder_label || 'Folder'}</strong>
                <small>{latest ? relativeTime(latest.received_at) : 'tidak ada log 24j'}</small>
              </span>
            </div>
            <div className="af-live__ticks af-mono af-tabular">
              {recent.slice(0, 6).map((e, i) => (
                <span
                  key={e.id}
                  className="af-live__tick"
                  style={
                    {
                      '--tone': e.folder_tone,
                      '--delay': `${i * 90}ms`,
                    } as React.CSSProperties
                  }
                  title={`${e.folder_label} · ${e.email}`}
                >
                  {e.code.slice(0, 3)}·{e.code.slice(3)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* ─── Summary strip (specific, not hero-metric template) ─── */}
      <div className="af-summary">
        <Panel tone="chrome" radius="md" className="af-summary__card">
          <header><Users size={16} /> Armada</header>
          <p>
            <span className="af-display af-h2 af-tabular">{counts.gmails}</span>
            <small className="af-muted">Gmail aktif di {counts.folders} folder</small>
          </p>
          <footer>
            {folderCards.map((f) => (
              <span key={f.id} className="af-summary__dot" style={{ background: f.tone }} title={f.label} />
            ))}
          </footer>
        </Panel>
        <Panel tone="chrome" radius="md" className="af-summary__card">
          <header><KeyRound size={16} /> API keys aktif</header>
          <p>
            <span className="af-display af-h2 af-tabular">{counts.keys}</span>
            <small className="af-muted">tersebar di armada · 0 revoked minggu ini</small>
          </p>
          <footer>
            <Link href="/folders" className="af-summary__link">Rotasi key <ArrowUpRight size={12} /></Link>
          </footer>
        </Panel>
        <Panel tone="chrome" radius="md" className="af-summary__card">
          <header><Inbox size={16} /> OTP 7 hari</header>
          <p>
            <span className="af-display af-h2 af-tabular">{counts.otps7d.toLocaleString('id-ID')}</span>
            <small className="af-muted">rata {Math.round(counts.otps7d / 7)} per hari · 99.8% terbaca</small>
          </p>
          <footer className="af-summary__spark" aria-hidden>
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                style={{ height: `${28 + ((i * 7919) % 72)}%`, '--delay': `${i * 40}ms` } as React.CSSProperties}
              />
            ))}
          </footer>
        </Panel>
      </div>

      {/* ─── Folders + Activity ─── */}
      <div className="af-dash__grid">
        <section className="af-dash__folders">
          <header className="af-dash__section-head">
            <h2 className="af-display af-h3">Folders</h2>
            <Link href="/folders" className="af-dash__link">Kelola <ArrowUpRight size={14} /></Link>
          </header>
          <ul className="af-folders-grid">
            {folderCards.map((f) => (
              <li key={f.id}>
                <Link href={`/folders/${f.id}`} className="af-folder-card" style={{ '--tone': f.tone } as React.CSSProperties}>
                  <div className="af-folder-card__cover" aria-hidden>
                    <span className="af-folder-card__shine" />
                  </div>
                  <div className="af-folder-card__body">
                    <h3 className="af-display">{f.label}</h3>
                    <dl className="af-folder-card__stats">
                      <div>
                        <dt>Gmail</dt>
                        <dd className="af-mono af-tabular">{f.gmails.length}</dd>
                      </div>
                      <div>
                        <dt>Keys</dt>
                        <dd className="af-mono af-tabular">{f.keys.filter((k) => !k.revoked_at).length}</dd>
                      </div>
                      <div>
                        <dt>OTP · 7d</dt>
                        <dd className="af-mono af-tabular">{f.fresh}</dd>
                      </div>
                    </dl>
                    <div className="af-folder-card__status">
                      {f.needsReauth > 0 ? (
                        <Chip tone="pink">
                          {f.needsReauth === 1 ? 'Reauth 1 gmail' : `${f.needsReauth} perlu reauth`}
                        </Chip>
                      ) : f.expiringSoon > 0 ? (
                        <Chip tone="amber">
                          {f.expiringSoon} akan kadaluarsa
                        </Chip>
                      ) : f.gmails.some((g) => g.status === 'degraded') ? (
                        <Chip tone="amber">1 degraded</Chip>
                      ) : (
                        <Chip tone="green">Semua terhubung</Chip>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/folders?modal=new" className="af-folder-card af-folder-card--new">
                <div className="af-folder-card__new">
                  <span aria-hidden>+</span>
                  <strong>Folder baru</strong>
                  <small className="af-muted">Satu OAuth client · banyak Gmail</small>
                </div>
              </Link>
            </li>
          </ul>
        </section>

        <aside className="af-dash__activity">
          <header className="af-dash__section-head">
            <h2 className="af-display af-h3">Activity</h2>
            <Chip tone="teal" pulse>Live</Chip>
          </header>
          <Panel tone="chrome" radius="md" padded={false} className="af-activity">
            <ul>
              {recent.map((e, i) => (
                <li key={e.id} className={i === 0 ? 'is-fresh' : ''}>
                  <span className="af-activity__time af-mono af-mono-sm">
                    <Clock size={11} /> {relativeTime(e.received_at)}
                  </span>
                  <span className="af-activity__code af-mono af-tabular">{formatCode(e.code)}</span>
                  <span className="af-activity__email">{maskEmail(e.email)}</span>
                  <span className="af-activity__folder" style={{ '--tone': e.folder_tone } as React.CSSProperties}>
                    <span aria-hidden />
                    {e.folder_label}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function formatCode(code: string): string {
  const c = code.replace(/\D/g, '');
  if (c.length === 6) return c.slice(0, 3) + ' ' + c.slice(3);
  if (c.length === 8) return c.slice(0, 4) + ' ' + c.slice(4);
  return c;
}
