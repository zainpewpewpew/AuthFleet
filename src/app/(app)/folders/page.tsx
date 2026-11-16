import Link from 'next/link';
import { ArrowUpRight, FolderPlus, Mail, KeyRound } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { FolderComposer } from './FolderComposer';
import { listFolders, listGmails, listApiKeys } from '@/lib/store';
import { relativeTime } from '@/lib/format';
import './folders.css';

export const dynamic = 'force-dynamic';

export default async function FoldersPage({
  searchParams,
}: {
  searchParams: Promise<{ modal?: string }>;
}) {
  const params = await searchParams;
  const folders = listFolders().map((f) => {
    const gmails = listGmails(f.id);
    const keys = listApiKeys(f.id);
    return { ...f, gmails, keys };
  });

  return (
    <div className="af-folders">
      <header className="af-folders__intro">
        <div>
          <h1 className="af-display af-h1">Folders</h1>
          <p className="af-body">
            Tiap folder adalah satu Google OAuth client. Di dalamnya hidup Gmail
            yang kamu sambungkan dan API key yang Sociofy pakai untuk minta OTP.
          </p>
        </div>
        <Link href="?modal=new" scroll={false}>
          <Button variant="primary" iconLeading={<FolderPlus size={16} />}>
            Folder baru
          </Button>
        </Link>
      </header>

      <ul className="af-folders__grid">
        {folders.map((f) => (
          <li key={f.id}>
            <article className="af-folders__card" style={{ '--tone': f.tone } as React.CSSProperties}>
              <header className="af-folders__card-head">
                <span className="af-folders__card-cover" aria-hidden>
                  <span />
                </span>
                <h2 className="af-display af-h2">{f.label}</h2>
                <p className="af-mono af-mono-sm">
                  {f.client_id
                    ? f.client_id.slice(0, 12) + '…' + f.client_id.slice(-24)
                    : 'OAuth client belum di-paste'}
                </p>
                <p className="af-folders__card-created af-muted">
                  Dibuat {relativeTime(f.created_at)}
                </p>
              </header>
              <dl className="af-folders__card-stats">
                <div>
                  <dt><Mail size={12} /> Gmail</dt>
                  <dd className="af-mono af-tabular">{f.gmails.length}</dd>
                  <small>
                    {f.gmails.filter((g) => g.status === 'connected').length} aktif ·{' '}
                    {f.gmails.filter((g) => g.status !== 'connected').length} perlu cek
                  </small>
                </div>
                <div>
                  <dt><KeyRound size={12} /> API Keys</dt>
                  <dd className="af-mono af-tabular">
                    {f.keys.filter((k) => !k.revoked_at).length}
                  </dd>
                  <small>
                    {f.keys.filter((k) => k.revoked_at).length > 0
                      ? `${f.keys.filter((k) => k.revoked_at).length} revoked`
                      : 'semua aktif'}
                  </small>
                </div>
              </dl>
              <footer className="af-folders__card-foot">
                {f.gmails.some((g) => g.status === 'needs_relogin') ? (
                  <Chip tone="pink">1 Gmail reauth</Chip>
                ) : f.gmails.some((g) => g.status === 'degraded') ? (
                  <Chip tone="amber">1 degraded</Chip>
                ) : (
                  <Chip tone="green">Semua siap</Chip>
                )}
                <Link href={`/folders/${f.id}`} className="af-folders__card-link">
                  Buka folder <ArrowUpRight size={14} />
                </Link>
              </footer>
            </article>
          </li>
        ))}
        <li>
          <Link href="?modal=new" scroll={false} className="af-folders__new">
            <span aria-hidden>+</span>
            <strong>Buat folder baru</strong>
            <small className="af-muted">
              Paste OAuth client ID + secret, kasih nama, pilih warna. Semenit selesai.
            </small>
          </Link>
        </li>
      </ul>

      {params.modal === 'new' ? <FolderComposer /> : null}
      {params.modal === 'connect-gmail' ? (
        <Panel tone="chrome" radius="md" className="af-folders__connect">
          <h2 className="af-display af-h3">Sambung Gmail</h2>
          <p className="af-body">Pilih folder dulu, lalu klik Sambung Gmail dari dalam folder.</p>
          <ul>
            {folders.map((f) => (
              <li key={f.id}>
                <Link href={`/folders/${f.id}?action=connect-gmail`}>→ {f.label}</Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
