import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, KeyRound, Trash2, Zap, Timer } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { KeyGenerator } from './KeyGenerator';
import { GmailActions } from './GmailActions';
import { FolderProxyPanel } from './FolderProxyPanel';
import {
  getFolder, listGmails, listApiKeys, listRecentOtp,
  gmailEffectiveStatus, gmailExpiresAt, gmailLifecycle,
  getFolderProxyEnc, getGmailProxyEnc,
} from '@/lib/store';
import { unseal } from '@/lib/crypto';
import { maskProxyUrl } from '@/lib/proxy';
import { maskEmail, relativeTime } from '@/lib/format';
import './folder-detail.css';

type GmailLifecycleTone = 'green' | 'amber' | 'pink';
const LIFECYCLE_TONE: Record<string, GmailLifecycleTone> = {
  fresh: 'green',
  warning: 'amber',
  critical: 'pink',
  expired: 'pink',
};
function lifecycleLabel(connectedAt: number): string {
  const remaining = gmailExpiresAt(connectedAt) - Date.now();
  if (remaining <= 0) {
    const overdueDays = Math.floor(-remaining / 86_400_000);
    return overdueDays === 0 ? 'Kadaluarsa hari ini' : `Kadaluarsa ${overdueDays}h lalu`;
  }
  const days = Math.floor(remaining / 86_400_000);
  if (days >= 1) return days === 1 ? '1 hari lagi' : `${days} hari lagi`;
  const hours = Math.floor(remaining / 3_600_000);
  if (hours >= 1) return hours === 1 ? '1 jam lagi' : `${hours} jam lagi`;
  const minutes = Math.max(1, Math.floor(remaining / 60_000));
  return `${minutes}m lagi`;
}

export const dynamic = 'force-dynamic';

type Notice = { tone: 'green' | 'pink' | 'amber' | 'neutral'; title: string; body?: string };

function describeOauth(code: string | undefined, email?: string): Notice | null {
  if (!code) return null;
  switch (code) {
    case 'ok': return { tone: 'green', title: email ? `${email} tersambung` : 'Gmail tersambung', body: 'Refresh token tersimpan. Siap dipakai Sociofy untuk ambil OTP.' };
    case 'denied': return { tone: 'neutral', title: 'Consent dibatalkan', body: 'Kamu klik batal di layar Google. Gmail belum tersambung.' };
    case 'no-code': return { tone: 'pink', title: 'Google tidak mengembalikan kode auth', body: 'Flow OAuth putus di tengah. Coba sambungkan lagi.' };
    case 'no-state': return { tone: 'pink', title: 'State OAuth hilang', body: 'Session browser berubah. Mulai lagi dari dalam folder.' };
    case 'no-client': return { tone: 'pink', title: 'OAuth Client ID belum di-set', body: 'Edit folder dulu — isi Client ID dari Google Cloud Console.' };
    case 'no-secret': return { tone: 'pink', title: 'OAuth Client Secret belum di-set', body: 'Edit folder dulu — paste Client Secret dari Google Cloud Console.' };
    case 'decrypt-fail': return { tone: 'pink', title: 'Gagal decrypt OAuth secret', body: 'AUTHFLEET_ENCRYPT_KEY mungkin berubah. Paste ulang Client Secret di folder ini.' };
    case 'no-email': return { tone: 'pink', title: 'Google tidak mengembalikan email', body: 'Scope "email" mungkin tidak granted. Coba lagi dan terima semua scope.' };
    case 'no-refresh': return { tone: 'amber', title: 'Google tidak mengembalikan refresh token', body: 'Buka myaccount.google.com → Keamanan → Aplikasi pihak ketiga, cabut akses AuthFleet, lalu sambung ulang.' };
    case 'exchange-fail': return { tone: 'pink', title: 'Gagal tukar kode → token', body: 'Pastikan Client ID + Secret di folder ini cocok dengan yang di Google Cloud Console.' };
    default: return { tone: 'neutral', title: `OAuth: ${code}` };
  }
}

export default async function FolderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ action?: string; newKey?: string; oauth?: string; email?: string; gmail?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const folder = getFolder(id);
  if (!folder) notFound();

  const gmailsRaw = listGmails(id);
  const gmails = gmailsRaw.map((g) => ({ ...g, effective: gmailEffectiveStatus(g), life: gmailLifecycle(g.connected_at) }));

  // Proxy state untuk panel bawah. Decrypt hanya di server lalu mask credential
  // sebelum dikirim ke komponen client, supaya password Multilogin tidak pernah
  // terlihat di HTML view-source atau client state.
  const folderProxyEnc = getFolderProxyEnc(id);
  const folderProxyUrl = folderProxyEnc ? unseal(folderProxyEnc) : null;
  const folderProxyMasked = folderProxyUrl ? maskProxyUrl(folderProxyUrl) : null;
  const proxyGmailEntries = gmailsRaw.map((g) => {
    const enc = getGmailProxyEnc(id, g.email);
    const url = enc ? unseal(enc) : null;
    return {
      email: g.email,
      maskedOwn: url ? maskProxyUrl(url) : null,
      hasOwnProxy: Boolean(url),
    };
  });
  const keys = listApiKeys(id);
  const recent = listRecentOtp(100).filter((e) => e.folder_id === id).slice(0, 12);
  const freshKey = sp.newKey;
  const expiringSoon = gmails.filter((g) => g.effective === 'connected' && (g.life === 'warning' || g.life === 'critical')).length;
  const oauthNotice = describeOauth(sp.oauth, sp.email);
  const gmailNotice: Notice | null = sp.gmail === 'disconnected'
    ? { tone: 'neutral', title: 'Gmail dilepas dari folder', body: 'Refresh token dihapus. Sambungkan ulang kapan saja.' }
    : null;
  const notice = oauthNotice ?? gmailNotice;

  return (
    <div className="af-folder" style={{ '--tone': folder.tone } as React.CSSProperties}>
      <Link href="/folders" className="af-folder__back">
        <ArrowLeft size={14} /> Semua folder
      </Link>

      {notice ? (
        <Panel
          tone="chrome"
          radius="sm"
          className="af-folder__notice"
          role="status"
          aria-live="polite"
        >
          <div className="af-folder__notice-row">
            <Chip tone={notice.tone}>{notice.title}</Chip>
          </div>
          {notice.body ? <p className="af-body af-muted af-folder__notice-body">{notice.body}</p> : null}
        </Panel>
      ) : null}

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
            <Chip tone="green">{gmails.filter((g) => g.effective === 'connected').length} gmail siap</Chip>
            {gmails.some((g) => g.effective === 'needs_relogin') ? (
              <Chip tone="pink">{gmails.filter((g) => g.effective === 'needs_relogin').length} perlu reauth</Chip>
            ) : null}
            {expiringSoon > 0 ? (
              <Chip tone="amber">{expiringSoon} akan kadaluarsa</Chip>
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
                Setiap Gmail minta sekali consent Google. Refresh token disimpan terenkripsi (AES-256-GCM) di server AuthFleet.
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
              <li key={g.email} className={`af-gmail-row af-gmail-row--${g.effective} af-gmail-row--life-${g.life}`}>
                <div className="af-gmail-row__badge" aria-hidden>
                  <span className="af-gmail-row__badge-dot" />
                </div>
                <div className="af-gmail-row__meta">
                  <strong>{maskEmail(g.email)}</strong>
                  <small className="af-muted">
                    {g.last_otp_at ? `OTP terakhir ${relativeTime(g.last_otp_at)}` : 'belum ada OTP'}
                    {' · '}Disambungkan {relativeTime(g.connected_at)}
                  </small>
                </div>
                <div className="af-gmail-row__status">
                  {g.effective === 'connected' ? (
                    <Chip tone="green">Terhubung</Chip>
                  ) : g.effective === 'needs_relogin' ? (
                    <Chip tone="pink">Perlu reauth</Chip>
                  ) : (
                    <Chip tone="amber">Degraded</Chip>
                  )}
                  <Chip tone={LIFECYCLE_TONE[g.life]}>
                    <Timer size={10} aria-hidden /> {lifecycleLabel(g.connected_at)}
                  </Chip>
                </div>
                <div className="af-gmail-row__actions">
                  <GmailActions folderId={id} email={g.email} status={g.effective} />
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

      {/* ─── Proxy exit ─── */}
      <FolderProxyPanel
        folderId={id}
        initialFolderMasked={folderProxyMasked}
        folderHasProxy={Boolean(folderProxyUrl)}
        gmails={proxyGmailEntries}
      />

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
