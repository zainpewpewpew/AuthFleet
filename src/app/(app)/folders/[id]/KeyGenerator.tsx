'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Plus } from 'lucide-react';

export function KeyGenerator({ folderId }: { folderId: string }) {
  const router = useRouter();
  const [label, setLabel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/folders/${folderId}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (res.ok && data.rawKey) {
        router.push(`/folders/${folderId}?newKey=${encodeURIComponent(data.rawKey)}`);
        router.refresh();
        setLabel('');
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="primary"
        size="sm"
        iconLeading={<Plus size={14} />}
        onClick={() => setOpen(true)}
      >
        Generate key
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="af-key-gen">
      <label className="af-field" style={{ minWidth: 220 }}>
        <span className="sr-only">Label key</span>
        <span className="af-field__slot">
          <input
            type="text"
            placeholder="mis. sociofy-agent-primary"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            maxLength={60}
            required
          />
        </span>
      </label>
      <Button variant="primary" size="sm" type="submit" loading={busy}>
        Buat key
      </Button>
      <Button variant="quiet" size="sm" type="button" onClick={() => setOpen(false)}>
        Batal
      </Button>
    </form>
  );
}
