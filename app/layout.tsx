import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cơm Tấm Làng CEO Dashboard',
  description: 'Next.js CEO dashboard reading Google Sheets directly via server-side API.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
