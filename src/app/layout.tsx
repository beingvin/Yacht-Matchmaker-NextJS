import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yacht Matchmaker - Lite | Luxury Yacht Charter Concierge',
  description: 'AI-powered bespoke luxury yacht charter concierge for Goa and Mumbai coastline.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-zinc-950">
      <body className="h-full w-full overflow-hidden antialiased bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
