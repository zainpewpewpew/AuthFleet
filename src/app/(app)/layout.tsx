import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { getFoldersForSidebar } from '@/lib/store';
import './app-shell.css';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const session = jar.get('af_session')?.value;
  if (!session) redirect('/login');

  const folders = getFoldersForSidebar();

  return (
    <div className="af-shell">
      <Sidebar folders={folders} />
      <div className="af-shell__frame">
        <Topbar />
        <main className="af-shell__content">{children}</main>
      </div>
    </div>
  );
}
