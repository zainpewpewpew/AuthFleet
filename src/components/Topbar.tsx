'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Mail } from 'lucide-react';
import { Button } from './Button';
import { Chip } from './Chip';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/folders': 'Folders',
  '/activity': 'Activity',
  '/settings': 'Settings',
};

function titleFromPath(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  for (const [prefix, label] of Object.entries(TITLES)) {
    if (pathname.startsWith(prefix + '/')) return label;
  }
  return 'AuthFleet';
}

export function Topbar() {
  const pathname = usePathname();
  const [now, setNow] = React.useState<string>('');
  React.useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      setNow(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="af-topbar">
      <div className="af-topbar__title">
        <h1 className="af-display af-h3">{titleFromPath(pathname)}</h1>
        <Chip tone="green" pulse>
          Fleet online
        </Chip>
      </div>
      <div className="af-topbar__actions">
        <span className="af-topbar__clock af-mono af-tabular" aria-label="Jam lokal">
          {now || '--:--:--'} <small className="af-muted">WIB</small>
        </span>
        <Link href="/folders?modal=connect-gmail">
          <Button variant="ghost" size="sm" iconLeading={<Mail size={16} strokeWidth={2.2} />}>
            Sambung Gmail
          </Button>
        </Link>
        <Link href="/folders?modal=new">
          <Button variant="primary" size="sm" iconLeading={<Plus size={16} strokeWidth={2.4} />}>
            Folder baru
          </Button>
        </Link>
      </div>
    </header>
  );
}
