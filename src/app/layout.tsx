import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Analytics } from '@vercel/analytics/next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SiteChrome } from '@/components/site-chrome';
import { AdminCurrencyBadge } from '@/components/admin-currency';
import { FeedbackPopup } from '@/components/feedback-popup';
import { TOOLS } from '@/lib/tools';
import { Tracker } from '@/components/tracker';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';
import { JsonLd, organizationLd } from '@/lib/seo';
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
  title: { default: 'MD Creations Labs – Shadow Lamp Maker & 3D Printing Tools', template: '%s | MD Creations Labs' },
  description: 'Online tools that turn your pictures into print-ready 3D files. Make a custom shadow lamp from any picture and download the STL files.',
  applicationName: 'MD Creations Labs',
  authors: [{ name: 'MD Creations' }],
  creator: 'MD Creations',
  category: '3D printing',
  openGraph: { siteName: 'MD Creations Labs', type: 'website', locale: 'en_IN', images: ['/images/hero-shadow-lamp.jpg'] },
  twitter: { card: 'summary_large_image' },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
};
export const viewport: Viewport = { themeColor: '#424532' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <JsonLd data={organizationLd()} />
        <SiteChrome><SiteHeader /></SiteChrome>
        <main id="main">{children}</main>
        <SiteChrome><SiteFooter /></SiteChrome>
        <SiteChrome><FeedbackPopup tools={TOOLS.filter((t) => t.status !== 'hidden').map((t) => [t.slug, t.name] as [string, string])} /></SiteChrome>
        <AdminCurrencyBadge />
        <Tracker />
        <Analytics />
      </body>
    </html>
  );
}
