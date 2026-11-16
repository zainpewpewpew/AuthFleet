'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark } from '@/components/Logo';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import './login.css';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || password.length < 4) {
      setError('Password minimal 4 karakter.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Password salah atau server belum siap.');
        setBusy(false);
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      setError('Tidak bisa menghubungi server. Pastikan service AuthFleet jalan.');
      setBusy(false);
    }
  }

  return (
    <main className="af-login">
      {/* soft specular halo top-right, lens-flare style */}
      <div aria-hidden className="af-login__flare" />
      <div aria-hidden className="af-login__orb af-login__orb--a" />
      <div aria-hidden className="af-login__orb af-login__orb--b" />

      <header className="af-login__brand">
        <Logo size={44} />
        <Wordmark />
      </header>

      <section className="af-login__stage">
        <aside className="af-login__intro">
          <Chip tone="teal" pulse>
            Armada Sinyal · Live
          </Chip>
          <h1 className="af-display af-h1">
            OTP kamu <em>mendarat</em>&nbsp;sendirian.
          </h1>
          <p className="af-body">
            AuthFleet jaga setiap Gmail yang kamu sambungkan — folder demi folder, api key
            demi api key — biar Sociofy nggak pernah berhenti nungguin kode.
          </p>
          <dl className="af-login__facts">
            <div>
              <dt>Folder aktif</dt>
              <dd className="af-mono af-tabular">04</dd>
            </div>
            <div>
              <dt>Gmail armada</dt>
              <dd className="af-mono af-tabular">17</dd>
            </div>
            <div>
              <dt>OTP terbang · 7d</dt>
              <dd className="af-mono af-tabular">2 341</dd>
            </div>
          </dl>
          <p className="af-muted af-login__hint">
            Kredensial OAuth terenkripsi AES-256-GCM di server AuthFleet. Nggak ada telemetry, nggak ada signup publik.
          </p>
        </aside>

        <Panel tone="chrome" radius="lg" className="af-login__card">
          <form onSubmit={submit} className="af-login__form" noValidate>
            <h2 className="af-display af-h2">Masuk dulu, kapten.</h2>
            <p className="af-body af-muted">Gunakan password operator yang kamu set di <code className="af-mono">.env</code>.</p>

            <label className="af-field">
              <span className="af-field__label">Password operator</span>
              <span className="af-field__slot">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Minimal 4 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  minLength={4}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="af-field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </span>
            </label>

            {error ? (
              <p role="alert" className="af-field__error">
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" size="lg" loading={busy}>
              Masuk ke dashboard
            </Button>

            <footer className="af-login__footer">
              <span className="af-muted">
                Belum punya password? Setel <code className="af-mono">AUTHFLEET_PASSWORD</code> di file{' '}
                <code className="af-mono">.env</code> server lalu restart service.
              </span>
              <Link href="https://github.com/zainpewpewpew/AuthFleet" className="af-login__link">
                Dokumentasi ↗
              </Link>
            </footer>
          </form>
        </Panel>
      </section>

      <footer className="af-login__system">
        <span className="af-mono af-mono-sm">v0.1.0 · self-hosted · ID</span>
        <span className="af-mono af-mono-sm">build: y2k frutiger aero · code-led</span>
      </footer>
    </main>
  );
}
