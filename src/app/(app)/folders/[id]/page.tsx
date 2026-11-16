import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, KeyRound, Trash2, Zap, RefreshCw } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { KeyGenerator } from './KeyGenerator';
import { getFolder, listGmails, listApiKeys, listRecentOtp } from '@/lib/store';
import { maskEmail, relativeTime } from '@/lib/format';
import './folder-detail.css';

export const dynamic = 'force-dynamic';

export default async function FolderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string; newKey?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const folder = getFolder(id);
  if (!folder) notFound();

  const gmails = listGmails(id);
  const keys = listApiKeys(id);
  const recent = listRecentOtp(100).filter((e) => e.folder_id === id).slice(0, 12);
  const freshKey = sp.newKey;

  return (
    <div className="af-folder" style={{ '--tone': folder.tone } as React.CSSProperties}>
      <Link href="/folders" className="af-folder__back">
        <ArrowLeft size={14} /> Semua folder
      </Link>

      <header className="af-folder__head">
        <div className="af-folder__cover" aria-hidden>
          <span />
          <strong>{folder.label[0]?.toUpperCase() || 'F'}</strong>
        </div>
        <div className="af-folder__title">
          <h1 className="af-display af-h1">{folder.label}</h1>
          <p className="af-mono af-mono-sm">
            OAuth · {folder.client_id ? folder.client_id.slice(0, 12) + '…' + folder.client_id.slice(-24) : 'belum di-paste'}
          </p>
          <div className="af-folder__badges">
            <Chip tone="green">{gmails.filter((g) => g.status === 'connected').length} gmail siap</Chip>
            {gmails.some((g) => g.status === 'needs_relogin') ? (
              <Chip tone="pink">{gmails.filter((g) => g.status === 'needs_relogin').length} perlu reauth</Chip>
            ) : null}
            {gmails.some((g) => g.status === 'degraded') ? (
              <Chip tone="amber">{gmails.filter((g) => g.status === 'degraded').length} degraded</Chip>
            ) : null}
            <Chip tone="teal">{keys.filter((k) => !k.revoked_at).length} api key aktif</Chip>
          </div>
        </div>
        <div className="af-folder__actions">
          <Link href={`/folders/${id}/edit`}>
            <Button variant="ghost" size="sm">Edit folder</Button>
          </Link>
          <form action={`/api/folders/${id}`} method="POST">
            <input type="hidden" name="_method" value="DELETE" />
            <Button variant="danger" size="sm" iconLeading={<Trash2 size={14} />} type="submit">
              Hapus
            </Button>
          </form>
        </div>
      </header>

      <div className="af-folder__grid">
        {/* ─── Gmail column ─── */}
        <Panel tone="chrome" radius="md" padded={false} className="af-folder__panel">
          <header className="af-folder__panel-head">
            <div>
              <h2 className="af-display af-h3">Gmail dalam folder</h2>
              <p className="af-body af-muted">
                Setiap Gmail minta sekali consent Google. Refresh token disimpan terenkripsi di laptop ini.
              </p>
            </div>
            <Link href={`/api/folders/${id}/oauth/start`}>
              <Button variant="primary" size="sm" iconLeading={<Mail size={14} />}>
                Sambung Gmail
              </Button>
            </Link>
          </header>
          <ul className="af-gmail-list">
            {gmails.map((g) => (
              <li key={g.email} className={`af-gmail-row af-gmail-row--${g.status}`}>
                <div className="af-gmail-row__badge" aria-hidden>
                  <span className="af-gmail-row__badge-dot" />
                </div>
                <div className="af-gmail-row__meta">
                  <strong>{maskEmail(g.email)}</strong>
                  <small className="af-muted">
                    {g.last_otp_at ? `OTP terakhir ${relativeTime(g.last_otp_at)}` : 'belum ada OTP'}
                  </small>
                </div>
                <div className="af-gmail-row__status">
                  {g.status === 'connected' ? (
                    <Chip tone="green">Terhubung</Chip>
                  ) : g.status === 'needs_relogin' ? (
                    <Chip tone="pink">Reauth</Chip>
                  ) : (
                    <Chip tone="amber">Degraded</Chip>
                  )}
                </div>
                <div className="af-gmail-row__actions">
                  {g.status !== 'connected' ? (
                    <Button variant="ghost" size="sm" iconLeading={<RefreshCw size={12} />}>
                      Izin ulang
                    </Button>
                  ) : null}
                  <Button variant="quiet" size="sm">Lepas</Button>
                </div>
              </li>
            ))}
            {gmails.length === 0 ? (
              <li className="af-gmail-empty">
                <Mail size={20} />
                <strong>Belum ada Gmail dalam folder ini</strong>
                <span className="af-muted">
                  Klik <em>Sambung Gmail</em> di kanan atas untuk tambahkan yang pertama.
                </span>
              </li>
            ) : null}
          </ul>
        </Panel>

        {/* ─── API key column ─── */}
        <Panel tone="chrome" radius="md" padded={false} className="af-folder__panel">
          <header className="af-folder__panel-head">
            <div>
              <h2 className="af-display af-h3">API Keys</h2>
              <p className="af-body af-muted">
                Sociofy pakai key ini untuk minta OTP. Satu key per use case supaya mudah dirotasi.
              </p>
            </div>
            <KeyGenerator folderId={id} />
          </header>
          {freshKey ? (
            <div className="af-folder__fresh-key">
              <header>
                <Chip tone="green" pulse>
                  Key baru tersimpan
                </Chip>
                <span className="af-muted af-mono-sm">Copy sekarang — tidak muncul lagi.</span>
              </header>
              <code className="af-mono af-tabular">{freshKey}</code>
            </div>
          ) : null}
          <ul className="af-keys-list">
            {keys.map((k) => (
              <li key={k.id} className={k.revoked_at ? 'is-revoked' : ''}>
                <div className="af-keys-list__slug">
                  <KeyRound size={14} />
                  <span>
                    <strong>{k.label}</strong>
                    <small className="af-mono af-mono-sm">{k.prefix}•••••••••••••</small>
                  </span>
                </div>
                <div className="af-keys-list__meta af-muted">
                  <span>Dibuat {relativeTime(k.created_at)}</span>
                  <span>
                    {k.last_used_at ? `Terakhir dipakai ${relativeTime(k.last_used_at)}` : 'belum pernah dipakai'}
                  </span>
                </div>
                <div className="af-keys-list__actions">
                  {k.revoked_at ? (
                    <Chip tone="pink">Revoked</Chip>
                  ) : (
                    <form action={`/api/folders/${id}/keys/${k.id}`} method="POST">
                      <input type="hidden" name="_method" value="DELETE" />
                      <Button variant="danger" size="sm" iconLeading={<Trash2 size={12} />} type="submit">
                        Revoke
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
            {keys.length === 0 ? (
              <li className="af-keys-empty">
                <KeyRound size={20} />
                <strong>Belum ada API key</strong>
                <span className="af-muted">
                  Generate key pertama untuk mulai konek Sociofy ke folder ini.
                </span>
              </li>
            ) : null}
          </ul>
        </Panel>
      </div>

      {/* ─── Activity ─── */}
      <Panel tone="chrome" radius="md" padded={false} className="af-folder__activity">
        <header className="af-folder__panel-head">
          <div>
            <h2 className="af-display af-h3">OTP yang mendarat</h2>
            <p className="af-body af-muted">12 event terakhir dari folder ini.</p>
          </div>
          <Chip tone="teal" pulse>
            <Zap size={10} /> Live
          </Chip>
        </header>
        <ol className="af-folder__timeline">
          {recent.map((e, i) => (
            <li key={e.id} className={i === 0 ? 'is-fresh' : ''}>
              <span className="af-folder__timeline-time af-mono af-mono-sm">
                {relativeTime(e.received_at)}
              </span>
              <span className="af-folder__timeline-code af-mono af-tabular">
                {e.code.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </span>
              <span className="af-folder__timeline-email">{maskEmail(e.email)}</span>
              <span className="af-folder__timeline-subject af-muted">
                {e.sender}
              </span>
            </li>
          ))}
          {recent.length === 0 ? (
            <li className="af-folder__timeline-empty af-muted">Belum ada OTP yang masuk di folder ini.</li>
          ) : null}
        </ol>
      </Panel>
    </div>
  );
}
