'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';

/**
 * Gmail row actions: reauthorize (jumps to OAuth consent) + disconnect
 * (deletes the grant). Confirm on disconnect — irreversible, operator
 * will have to re-consent on Google to restore.
 */
export function GmailActions({
  folderId,
  email,
  status,
}: {
  folderId: string;
  email: string;
  status: 'connected' | 'needs_relogin' | 'degraded';
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/folders/${folderId}/gmails/${encodeURIComponent(email)}`,
        { method: 'DELETE', headers: { Accept: 'application/json' } },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Gagal melepas Gmail. Coba lagi.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      alert('Server tidak merespons.');
      setBusy(false);
    }
  }

  function reauth() {
    // The OAuth start route handles the consent redirect. login_hint is not
    // set yet at the server level; operator picks the account from Google.
    window.location.href = `/api/folders/${folderId}/oauth/start?email=${encodeURIComponent(email)}`;
  }

  if (confirming) {
    return (
      <div className="af-gmail-row__confirm" role="alertdialog">
        <span>Yakin lepas @{email.split('@')[0]}?</span>
        <Button variant="danger" size="sm" onClick={disconnect} loading={busy}>
          Ya, lepas
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setConfirming(false)} type="button">
          Batal
        </Button>
      </div>
    );
  }

  return (
    <>
      {status !== 'connected' ? (
        <Button
          variant="ghost"
          size="sm"
          iconLeading={<RefreshCw size={12} />}
          onClick={reauth}
          type="button"
        >
          Izin ulang
        </Button>
      ) : null}
      <Button
        variant="quiet"
        size="sm"
        iconLeading={<Trash2 size={12} />}
        onClick={() => setConfirming(true)}
        type="button"
      >
        Lepas
      </Button>
    </>
  );
}
