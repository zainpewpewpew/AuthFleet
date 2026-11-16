'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderOpen,
  KeyRound,
  Radio,
  Settings,
  LogOut,
} from 'lucide-react';
import { Logo, Wordmark } from './Logo';
import clsx from './_clsx';

export type SidebarFolder = {
  id: string;
  label: string;
  tone: string; // hex for the band accent
  gmails: number;
  keys: number;
};

const NAV_PRIMARY = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/folders', label: 'Folders', icon: FolderOpen },
  { href: '/activity', label: 'Activity', icon: Radio },
];
const NAV_SECONDARY = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ folders }: { folders: SidebarFolder[] }) {
  const pathname = usePathname();
  // Folder stepped tab-rail is always visible; the direction contract names
  // it as the sidebar's signature navigator, not a lazy submenu.
  const foldersOpen = true;

  return (
    <aside className="af-sidebar" aria-label="Navigasi utama">
      <header className="af-sidebar__brand">
        <Logo size={36} />
        <Wordmark />
      </header>

      <nav className="af-sidebar__nav">
        <ul>
          {NAV_PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/folders'
              ? foldersOpen
              : pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link href={item.href} className={clsx('af-navitem', active && 'af-navitem--active')}>
                  <Icon size={18} strokeWidth={2.2} aria-hidden />
                  <span>{item.label}</span>
                </Link>
                {item.href === '/folders' && foldersOpen ? (
                  <ul className="af-navsub" aria-label="Daftar folder">
                    {folders.length === 0 ? (
                      <li className="af-navsub__empty">
                        <span>Belum ada folder.</span>
                        <Link href="/folders">Buat baru ↗</Link>
                      </li>
                    ) : (
                      folders.map((folder) => {
                        const weight = Math.min(1, Math.max(0.35, folder.gmails / 10));
                        const isActive = pathname === `/folders/${folder.id}`;
                        return (
                          <li key={folder.id}>
                            <Link
                              href={`/folders/${folder.id}`}
                              className={clsx('af-folderband', isActive && 'af-folderband--active')}
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
                            </Link>
                          </li>
                        );
                      })
                    )}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>

        <hr className="af-sidebar__rule" aria-hidden />

        <ul>
          <li>
            <Link href="/folders" className="af-navitem af-navitem--quiet">
              <KeyRound size={18} strokeWidth={2.2} aria-hidden />
              <span>API Keys</span>
            </Link>
          </li>
          {NAV_SECONDARY.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link href={item.href} className={clsx('af-navitem', active && 'af-navitem--active')}>
                  <Icon size={18} strokeWidth={2.2} aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/api/session" method="POST" className="af-sidebar__footer">
        {/* method override — a POST with _method=DELETE calls the route's DELETE */}
        <input type="hidden" name="_method" value="DELETE" />
        <button className="af-navitem af-navitem--logout" type="submit">
          <LogOut size={18} strokeWidth={2.2} aria-hidden />
          <span>Keluar</span>
        </button>
      </form>
    </aside>
  );
}
