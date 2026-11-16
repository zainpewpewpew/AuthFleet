'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/Button';

const PRESET_TONES = [
  '#FF4FAA', // signal pink
  '#00C9D4', // teal
  '#00A676', // green
  '#FFB020', // amber
  '#7D5BFF', // violet
  '#FF6A3D', // coral
];

export function FolderComposer() {
  const router = useRouter();
  const [label, setLabel] = React.useState('');
  const [tone, setTone] = React.useState(PRESET_TONES[0]);
  const [clientId, setClientId] = React.useState('');
  const [clientSecret, setClientSecret] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const close = () => router.push('/folders');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (label.trim().length < 2) { setError('Nama folder minimal 2 karakter.'); return; }
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
      setError('Client ID harus berakhiran .apps.googleusercontent.com');
      return;
    }
    if (clientSecret.length < 8) { setError('Client secret kelihatan terlalu pendek.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, tone, clientId, clientSecret }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Gagal buat folder.');
        setBusy(false);
        return;
      }
      const data = await res.json();
      router.push(`/folders/${data.id}`);
    } catch (err) {
      setError('Server tidak merespons.');
      setBusy(false);
    }
  }

  return (
    <div className="af-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">
      <div className="af-modal__scrim" onClick={close} aria-hidden />
      <Panel tone="chrome" radius="lg" className="af-modal__dialog">
        <header className="af-modal__head">
          <div>
            <h2 className="af-display af-h2" id="composer-title">Folder baru</h2>
            <p className="af-body af-muted">
              Satu folder = satu Google OAuth client. Buat OAuth-nya di Google Cloud dulu,
              baru paste ID + secret di sini.
            </p>
          </div>
          <button className="af-modal__close" onClick={close} aria-label="Tutup">
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>

        <form onSubmit={submit} className="af-modal__form" noValidate>
          <label className="af-field">
            <span className="af-field__label">Nama folder</span>
            <span className="af-field__slot">
              <input
                type="text"
                placeholder="Mis. Dapur IG · Lab Signup Nov"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                minLength={2}
                maxLength={80}
                autoFocus
                required
              />
            </span>
          </label>

          <label className="af-field">
            <span className="af-field__label">Warna band</span>
            <span className="af-tone-picker">
              {PRESET_TONES.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`af-tone-picker__chip${tone === t ? ' is-active' : ''}`}
                  style={{ '--tone': t } as React.CSSProperties}
                  onClick={() => setTone(t)}
                  aria-label={`Warna ${t}`}
                  aria-pressed={tone === t}
                />
              ))}
            </span>
          </label>

          <label className="af-field">
            <span className="af-field__label">Google OAuth Client ID</span>
            <span className="af-field__slot">
              <input
                type="text"
                placeholder="1234567890-abc.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value.trim())}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </span>
          </label>

          <label className="af-field">
            <span className="af-field__label">Client secret</span>
            <span className="af-field__slot">
              <input
                type="password"
                placeholder="GOCSPX-…"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </span>
          </label>

          {error ? <p role="alert" className="af-field__error">{error}</p> : null}

          <footer className="af-modal__foot">
            <Button variant="ghost" size="md" onClick={close} type="button">
              Batal
            </Button>
            <Button variant="primary" size="md" loading={busy} type="submit">
              Buat folder
            </Button>
          </footer>
        </form>
      </Panel>
    </div>
  );
}
