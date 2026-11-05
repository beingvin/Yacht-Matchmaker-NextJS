import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yacht Matchmaker - Lite | Luxury Yacht Charter Concierge',
  description: 'AI-powered bespoke luxury yacht charter concierge for Goa and Mumbai coastline.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-dvh bg-[#1c1c1f]">
      <body className="h-dvh w-full overflow-hidden bg-[#1c1c1f] text-[#e7e7e9] antialiased">
        {children}
      </body>
    </html>
  );
}
