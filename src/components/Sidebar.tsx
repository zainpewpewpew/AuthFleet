'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  Radio,
  Settings,
  LogOut,
  BookOpen,
} from 'lucide-react';
import { Logo, Wordmark } from './Logo';
import clsx from './_clsx';

export type SidebarFolder = {
  id: string;
  label: string;
  tone: string; // hex for the band accent
  gmails: number;
  keys: number;
  attention?: 'none' | 'warning' | 'critical'; // badge dot: amber (expiring) or pink (reauth)
};

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> };

const NAV_OVERVIEW: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];
const NAV_FLEET: NavItem[] = [
  { href: '/folders', label: 'Folders', icon: FolderOpen },
  { href: '/activity', label: 'Activity', icon: Radio },
];
const NAV_CONFIG: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href !== '/' && pathname.startsWith(href + '/')) return true;
  return false;
}

export function Sidebar({ folders }: { folders: SidebarFolder[] }) {
  const pathname = usePathname();

  return (
    <aside className="af-sidebar" aria-label="Navigasi utama">
      <header className="af-sidebar__brand">
        <Logo size={36} />
        <Wordmark />
      </header>

      <nav className="af-sidebar__nav">
        <Section>
          {NAV_OVERVIEW.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </Section>

        <Section label="Fleet">
          {NAV_FLEET.map((item) => (
            <React.Fragment key={item.href}>
              <NavRow item={item} active={isActive(pathname, item.href)} />
              {item.href === '/folders' ? (
                <FolderRail folders={folders} activeFolderId={activeFolderIdFromPath(pathname)} />
              ) : null}
            </React.Fragment>
          ))}
        </Section>

        <Section label="Konfigurasi">
          {NAV_CONFIG.map((item) => (
            <NavRow key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          <li>
            <a
              href="https://github.com/zainpewpewpew/AuthFleet"
              className="af-navitem af-navitem--external"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen size={18} strokeWidth={2.2} aria-hidden />
              <span>Dokumentasi</span>
              <span className="af-navitem__external" aria-hidden>↗</span>
            </a>
          </li>
        </Section>
      </nav>

      <footer className="af-sidebar__footer">
        <div className="af-sidebar__footer-meta">
          <span className="af-mono af-mono-sm">v0.1.0</span>
          <span className="af-muted" style={{ fontSize: 11 }}>· localhost</span>
        </div>
        <form action="/api/session" method="POST">
          <input type="hidden" name="_method" value="DELETE" />
          <button className="af-navitem af-navitem--logout" type="submit">
            <LogOut size={16} strokeWidth={2.2} aria-hidden />
            <span>Keluar</span>
          </button>
        </form>
      </footer>
    </aside>
  );
}

function activeFolderIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/folders\/([^/?]+)/);
  return match ? match[1] : null;
}

function Section({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="af-sidebar__section">
      {label ? <p className="af-sidebar__section-label af-mono-sm">{label}</p> : null}
      <ul>{children}</ul>
    </div>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link href={item.href} className={clsx('af-navitem', active && 'af-navitem--active')}>
        <Icon size={18} strokeWidth={2.2} aria-hidden />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

function FolderRail({
  folders,
  activeFolderId,
}: {
  folders: SidebarFolder[];
  activeFolderId: string | null;
}) {
  if (folders.length === 0) {
    return (
      <ul className="af-navsub" aria-label="Daftar folder">
        <li className="af-navsub__empty">
          <span>Belum ada folder.</span>
          <Link href="/folders?modal=new">Buat baru ↗</Link>
        </li>
      </ul>
    );
  }
  return (
    <ul className="af-navsub" aria-label="Daftar folder">
      {folders.map((folder) => {
        const weight = Math.min(1, Math.max(0.35, folder.gmails / 10));
        const active = folder.id === activeFolderId;
        return (
          <li key={folder.id}>
            <Link
              href={`/folders/${folder.id}`}
              className={clsx('af-folderband', active && 'af-folderband--active')}
              style={
                {
                  '--band-tone': folder.tone,
                  '--band-weight': weight,
                } as React.CSSProperties
              }
            >
              <span className="af-folderband__cap" aria-hidden />
              <span className="af-folderband__label">
                <strong>{folder.label}</strong>
                <small className="af-mono-sm">
                  {folder.gmails} gmail · {folder.keys} key
                </small>
              </span>
              {folder.attention && folder.attention !== 'none' ? (
                <span
                  className={`af-folderband__alert af-folderband__alert--${folder.attention}`}
                  aria-label={folder.attention === 'critical' ? 'Perlu reauth' : 'Akan kadaluarsa'}
                />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
