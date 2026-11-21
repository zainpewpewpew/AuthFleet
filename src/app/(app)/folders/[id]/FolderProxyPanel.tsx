'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Network, Shield, Trash2 } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';

type Hint = { ok: boolean; ip?: string; country?: string; city?: string; org?: string; error?: string };

type GmailEntry = {
  email: string;
  maskedOwn: string | null;
  hasOwnProxy: boolean;
};

export function FolderProxyPanel({
  folderId,
  initialFolderMasked,
  folderHasProxy,
  gmails,
}: {
  folderId: string;
  initialFolderMasked: string | null;
  folderHasProxy: boolean;
  gmails: GmailEntry[];
}) {
  const router = useRouter();
  const [folderUrl, setFolderUrl] = React.useState('');
  const [folderMasked, setFolderMasked] = React.useState<string | null>(initialFolderMasked);
  const [folderHas, setFolderHas] = React.useState(folderHasProxy);
  const [folderBusy, setFolderBusy] = React.useState<'idle' | 'test' | 'save' | 'clear' | 'auto'>('idle');
  const [folderHint, setFolderHint] = React.useState<Hint | null>(null);
  const [autoResult, setAutoResult] = React.useState<{ count: number; folderDefault: string | null } | null>(null);

  async function autoApply() {
    if (!confirm('Auto-apply proxy ke semua gmail di folder ini?\n\n• Pakai template MULTILOGIN_PROXY_TEMPLATE di server.\n• Rotate sid unique per gmail (1 IP = 1 gmail).\n• Override proxy per-gmail yang sudah ada.\n\nLanjutkan?')) return;
    setFolderBusy('auto');
    setAutoResult(null);
    try {
      const res = await fetch(`/api/folders/${folderId}/proxy/auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applyFolderDefault: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert((data.error || 'Gagal auto apply') + (data.hint ? '\n\n' + data.hint : ''));
        return;
      }
      setAutoResult({ count: data.count, folderDefault: data.folderDefault });
      setFolderMasked(data.folderDefault);
      setFolderHas(Boolean(data.folderDefault));
      router.refresh();
    } catch (err) {
      alert('Network error: ' + (err as Error).message);
    } finally {
      setFolderBusy('idle');
    }
  }

  async function testFolder() {
    if (!folderUrl.trim()) return;
    setFolderBusy('test');
    setFolderHint(null);
    try {
      const res = await fetch(`/api/folders/${folderId}/proxy/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: folderUrl.trim() }),
      });
      const data = (await res.json()) as Hint;
      setFolderHint(data);
    } catch {
      setFolderHint({ ok: false, error: 'Server tidak merespons' });
    } finally {
      setFolderBusy('idle');
    }
  }

  async function saveFolder() {
    if (!folderUrl.trim()) return;
    setFolderBusy('save');
    try {
      const res = await fetch(`/api/folders/${folderId}/proxy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: folderUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal simpan');
        return;
      }
      setFolderMasked(data.masked);
      setFolderHas(true);
      setFolderUrl('');
      setFolderHint(null);
      router.refresh();
    } finally {
      setFolderBusy('idle');
    }
  }

  async function clearFolder() {
    if (!confirm('Hapus proxy default folder? Gmail tanpa override sendiri akan jalan tanpa proxy (datacenter VPS — tidak disarankan).')) return;
    setFolderBusy('clear');
    try {
      await fetch(`/api/folders/${folderId}/proxy`, { method: 'DELETE' });
      setFolderMasked(null);
      setFolderHas(false);
      router.refresh();
    } finally {
      setFolderBusy('idle');
    }
  }

  return (
    <Panel tone="chrome" radius="md" padded={false} className="af-folder__panel">
      <header className="af-folder__panel-head">
        <div>
          <h2 className="af-display af-h3">Proxy exit (mobile sticky)</h2>
          <p className="af-body af-muted">
            Semua request Google API (token exchange + Gmail API) dari folder ini keluar lewat proxy. Default folder dipakai saat per-gmail belum di-set. Rekomendasi: 1 IP = 1 gmail agar terlihat seperti user asli berbeda-beda.
          </p>
        </div>
        <Chip tone={folderHas ? 'green' : 'pink'}>
          <Shield size={10} /> {folderHas ? 'Default aktif' : 'Default kosong'}
        </Chip>
      </header>

      <div style={{ padding: '16px 24px', display: 'grid', gap: 16 }}>
        {folderMasked ? (
          <div className="af-muted af-mono af-mono-sm" style={{ wordBreak: 'break-all' }}>
            Default saat ini: {folderMasked}
          </div>
        ) : null}
        <div style={{ padding: 12, borderRadius: 8, border: '1px solid rgba(0,200,120,.2)', background: 'rgba(0,200,120,.05)' }}>
          <div className="af-body" style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>Auto apply</strong> — pakai template proxy di server + sid unique per gmail (1 IP = 1 gmail).
          </div>
          <Button variant="primary" size="sm" iconLeading={<Network size={12} />} onClick={autoApply} loading={folderBusy === 'auto'} type="button">
            Auto apply proxy ke semua gmail
          </Button>
          {autoResult ? (
            <div className="af-body af-muted" style={{ fontSize: 12, marginTop: 8 }}>
              Berhasil apply ke {autoResult.count} gmail
              {autoResult.folderDefault ? ' + folder default.' : '.'}
            </div>
          ) : null}
        </div>
        <details>
          <summary className="af-body" style={{ cursor: 'pointer', fontSize: 13 }}>
            Advanced: set URL proxy manual (override template)
          </summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 8 }}>
          <span className="af-body" style={{ fontSize: 13 }}>URL proxy baru (http/https/socks5)</span>
          <input
            type="text"
            value={folderUrl}
            onChange={(e) => setFolderUrl(e.target.value)}
            placeholder="http://user-session-xxx-country-id:pass@gate.multilogin.com:9000"
            spellCheck={false}
            autoComplete="off"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.25)',
              color: '#fff', fontFamily: 'ui-monospace, monospace', fontSize: 13,
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" iconLeading={<Globe size={12} />} onClick={testFolder} loading={folderBusy === 'test'} disabled={!folderUrl.trim()} type="button">
            Test exit IP
          </Button>
          <Button variant="primary" size="sm" iconLeading={<Shield size={12} />} onClick={saveFolder} loading={folderBusy === 'save'} disabled={!folderUrl.trim()} type="button">
            Simpan default
          </Button>
          {folderHas ? (
            <Button variant="danger" size="sm" iconLeading={<Trash2 size={12} />} onClick={clearFolder} loading={folderBusy === 'clear'} type="button">
              Hapus default
            </Button>
          ) : null}
        </div>
        {folderHint ? <HintView hint={folderHint} /> : null}
          </div>
        </details>
      </div>

      {gmails.length > 0 ? (
        <>
          <header className="af-folder__panel-head" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <div>
              <h2 className="af-display af-h3">Per-gmail override (1 IP = 1 gmail)</h2>
              <p className="af-body af-muted">
                Set proxy khusus untuk satu gmail supaya tiap canonical gmail terlihat sebagai user yang berbeda di sisi Google. Operator Multilogin: generate N session ID (1 session = 1 gmail) dari dashboard, paste tiap URL di bawah.
              </p>
            </div>
          </header>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {gmails.map((g) => (
              <GmailProxyRow key={g.email} folderId={folderId} entry={g} />
            ))}
          </ul>
        </>
      ) : null}
    </Panel>
  );
}

function HintView({ hint }: { hint: Hint }) {
  if (!hint.ok) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,79,170,.08)', border: '1px solid rgba(255,79,170,.25)' }}>
        <strong style={{ color: '#FF4FAA' }}>Test gagal</strong>
        <div className="af-mono af-mono-sm af-muted" style={{ marginTop: 4 }}>{hint.error || 'Proxy tidak merespons'}</div>
      </div>
    );
  }
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,201,212,.08)', border: '1px solid rgba(0,201,212,.25)' }}>
      <strong style={{ color: '#00C9D4' }}>Exit IP: {hint.ip || 'n/a'}</strong>
      <div className="af-mono af-mono-sm af-muted" style={{ marginTop: 4 }}>
        {[hint.city, hint.country].filter(Boolean).join(' · ')} {hint.org ? `· ${hint.org}` : ''}
      </div>
    </div>
  );
}

function GmailProxyRow({ folderId, entry }: { folderId: string; entry: GmailEntry }) {
  const router = useRouter();
  const [url, setUrl] = React.useState('');
  const [masked, setMasked] = React.useState<string | null>(entry.maskedOwn);
  const [has, setHas] = React.useState(entry.hasOwnProxy);
  const [busy, setBusy] = React.useState<'idle' | 'test' | 'save' | 'clear'>('idle');
  const [hint, setHint] = React.useState<Hint | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  // Sync local display state saat parent refresh props (misal setelah Auto
  // apply global). Tanpa ini useState init hanya jalan sekali, chip tetap
  // "PAKAI DEFAULT FOLDER" walau server sudah set per-gmail proxy.
  React.useEffect(() => {
    setMasked(entry.maskedOwn);
    setHas(entry.hasOwnProxy);
  }, [entry.maskedOwn, entry.hasOwnProxy]);

  async function test() {
    if (!url.trim()) return;
    setBusy('test');
    setHint(null);
    try {
      const res = await fetch(`/api/folders/${folderId}/proxy/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as Hint;
      setHint(data);
    } catch {
      setHint({ ok: false, error: 'Server tidak merespons' });
    } finally {
      setBusy('idle');
    }
  }

  async function save() {
    if (!url.trim()) return;
    setBusy('save');
    try {
      const res = await fetch(`/api/folders/${folderId}/gmails/${encodeURIComponent(entry.email)}/proxy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Gagal simpan'); return; }
      setMasked(data.masked);
      setHas(true);
      setUrl('');
      setHint(null);
      router.refresh();
    } finally {
      setBusy('idle');
    }
  }

  async function clearIt() {
    if (!confirm(`Hapus proxy khusus untuk ${entry.email}? Gmail ini akan fallback ke proxy default folder (kalau ada), atau tanpa proxy sama sekali.`)) return;
    setBusy('clear');
    try {
      await fetch(`/api/folders/${folderId}/gmails/${encodeURIComponent(entry.email)}/proxy`, { method: 'DELETE' });
      setMasked(null);
      setHas(false);
      router.refresh();
    } finally {
      setBusy('idle');
    }
  }

  return (
    <li style={{ borderTop: '1px solid rgba(255,255,255,.04)', padding: '14px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Network size={14} />
        <strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{entry.email}</strong>
        <Chip tone={has ? 'green' : 'neutral'}>
          {has ? 'Punya proxy sendiri' : 'Pakai default folder'}
        </Chip>
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="quiet" size="sm" onClick={() => setExpanded((v) => !v)} type="button">
            {expanded ? 'Tutup' : has ? 'Ubah' : 'Set proxy'}
          </Button>
        </div>
      </div>
      {masked ? (
        <div className="af-muted af-mono af-mono-sm" style={{ marginTop: 6, wordBreak: 'break-all' }}>
          {masked}
        </div>
      ) : null}
      {expanded ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://user-session-<hash>-country-id:pass@gate.multilogin.com:9000"
            spellCheck={false}
            autoComplete="off"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,0,0,.25)',
              color: '#fff', fontFamily: 'ui-monospace, monospace', fontSize: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" iconLeading={<Globe size={10} />} onClick={test} loading={busy === 'test'} disabled={!url.trim()} type="button">
              Test
            </Button>
            <Button variant="primary" size="sm" onClick={save} loading={busy === 'save'} disabled={!url.trim()} type="button">
              Simpan
            </Button>
            {has ? (
              <Button variant="danger" size="sm" iconLeading={<Trash2 size={10} />} onClick={clearIt} loading={busy === 'clear'} type="button">
                Hapus
              </Button>
            ) : null}
          </div>
          {hint ? <HintView hint={hint} /> : null}
        </div>
      ) : null}
    </li>
  );
}
