import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SITE_URL } from '@/lib/env';
import './globals.css';

const serif = localFont({
  src: [{ path: '../fonts/cormorant.woff2', style: 'normal' }, { path: '../fonts/cormorant-italic.woff2', style: 'italic' }],
  variable: '--font-serif', display: 'swap', weight: '300 700',
});
const sans = localFont({ src: '../fonts/hanken.woff2', variable: '--font-sans', display: 'swap', weight: '100 900' });
const mono = localFont({
  src: [{ path: '../fonts/plex-mono-400.woff2', weight: '400' }, { path: '../fonts/plex-mono-500.woff2', weight: '500' }],
  variable: '--font-mono', display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'MD Creations Labs', template: '%s · MD Creations Labs' },
  description: 'Browser tools that turn your pictures into print-ready 3D files. Start with the Shadow Lamp Maker.',
  openGraph: { siteName: 'MD Creations Labs', type: 'website', images: ['/images/hero-shadow-lamp.jpg'] },
};
export const viewport: Viewport = { themeColor: '#424532' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
