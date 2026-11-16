import Link from 'next/link';
import { Panel } from '@/components/Panel';
import { Chip } from '@/components/Chip';
import { listRecentOtp, listFolders } from '@/lib/store';
import { maskEmail, relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function ActivityPage() {
  const folders = listFolders();
  const events = listRecentOtp(80);
  return (
    <div className="af-activity-page">
      <header className="af-activity-page__head">
        <div>
          <h1 className="af-display af-h1">Activity</h1>
          <p className="af-body">
            Semua OTP yang pernah mendarat di armada. Kolom folder ikut warna cover-nya.
          </p>
        </div>
        <Chip tone="teal" pulse>Live · {folders.length} folder</Chip>
      </header>
      <Panel tone="chrome" radius="md" padded={false}>
        <ol className="af-activity-page__list">
          {events.map((e, i) => (
            <li key={e.id} className={i === 0 ? 'is-fresh' : ''}>
              <span className="af-mono af-mono-sm">{relativeTime(e.received_at)}</span>
              <span className="af-mono af-tabular af-activity-page__code">
                {e.code.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </span>
              <span>{maskEmail(e.email)}</span>
              <Link
                href={`/folders/${e.folder_id}`}
                className="af-activity-page__folder"
                style={{ '--tone': e.folder_tone } as React.CSSProperties}
              >
                <span aria-hidden /> {e.folder_label}
              </Link>
              <span className="af-muted">{e.sender}</span>
            </li>
          ))}
          {events.length === 0 ? (
            <li className="af-muted" style={{ padding: 32, textAlign: 'center' }}>
              Belum ada OTP yang masuk.
            </li>
          ) : null}
        </ol>
      </Panel>

      <style>{`
        .af-activity-page { display: grid; gap: 24px; }
        .af-activity-page__head {
          display: flex; justify-content: space-between; align-items: end; padding: 4px;
        }
        .af-activity-page__head h1 { margin: 0 0 8px; }
        .af-activity-page__head p { margin: 0; max-width: 60ch; }
        .af-activity-page__list { padding: 8px 6px; display: grid; }
        .af-activity-page__list li {
          display: grid;
          grid-template-columns: 100px auto minmax(0, 1fr) auto minmax(0, 1.2fr);
          gap: 14px;
          align-items: center;
          padding: 10px 16px;
          border-radius: var(--af-r-xs);
          font-size: 13px;
        }
        .af-activity-page__list li:hover { background: rgba(14, 55, 107, 0.04); }
        .af-activity-page__list li.is-fresh {
          background: linear-gradient(90deg, rgba(255, 79, 170, 0.14) 0%, transparent 100%);
          box-shadow: inset 2px 0 0 var(--af-pink);
        }
        .af-activity-page__code {
          padding: 3px 10px;
          background: rgba(14, 55, 107, 0.08);
          border-radius: 999px;
          color: var(--af-ink);
        }
        .af-activity-page__folder {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: color-mix(in srgb, var(--tone) 18%, white);
          color: color-mix(in srgb, var(--tone) 60%, #0E1A3B);
        }
        .af-activity-page__folder:hover { background: color-mix(in srgb, var(--tone) 28%, white); }
        .af-activity-page__folder span {
          width: 6px; height: 6px; border-radius: 999px; background: var(--tone);
        }
        @media (max-width: 720px) {
          .af-activity-page__list li { grid-template-columns: 1fr; gap: 6px; }
        }
      `}</style>
    </div>
  );
}
