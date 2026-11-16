import type { Metadata } from 'next';
import './globals.css';

// Fonts loaded via <link> so build does not need to reach fonts.googleapis.com.
// Restricted/offline VPS env still builds; browser loads the sheet at runtime.
// display=swap keeps a readable fallback until the web font arrives.
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Bricolage+Grotesque:wght@400;600;700;800',
    'family=Nunito:wght@400;600;700;900',
    'family=JetBrains+Mono:wght@400;500;700',
    'display=swap',
  ].join('&');

export const metadata: Metadata = {
  title: 'AuthFleet — Armada OTP otomatis',
  description: 'Satu kapal buat semua Gmail OTP kamu.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      </head>
      <body>{children}</body>
    </html>
  );
}
