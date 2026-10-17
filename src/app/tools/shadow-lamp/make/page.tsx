import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { Maker } from '@/components/maker/maker';
import { getCurrency, getTool } from '@/lib/catalog.server';
import { getViewer } from '@/lib/auth.server';
import { supabaseConfigured } from '@/lib/env';

export const metadata: Metadata = pageMeta({
  title: 'Make a Shadow Lamp Online – Free Preview, Download STL Files',
  absoluteTitle: true,
  description: 'Upload any picture and turn it into a 3D printable shadow lamp in your browser. See the real shadow on the wall before you buy, then download the walls, base and cover plate as STL.',
  path: '/tools/shadow-lamp/make',
  keywords: ['make a shadow lamp', 'shadow lamp generator online', 'custom shadow lamp STL download', 'picture to shadow lamp'],
});

export default async function MakePage({ searchParams }: PageProps<'/tools/shadow-lamp/make'>) {
  const sp = await searchParams;
  const example = typeof sp.example === 'string' ? sp.example : undefined;
  const [tool, currency, viewer] = await Promise.all([getTool('shadow-lamp'), getCurrency(), getViewer()]);
  const amount = tool?.prices[currency] ?? null;
  const payConfigured = supabaseConfigured() && Boolean(process.env.RAZORPAY_KEY_ID) && tool?.status === 'live';
  return (
    <div className="wrap">
      <div style={{ padding: '36px 0 26px', display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/#tools">Tools</Link><span>/</span><Link href="/tools/shadow-lamp">Shadow Lamp Maker</Link></nav>
          <h1 className="serif" style={{ font: '500 clamp(36px, 4.6vw, 56px)/1.02 var(--serif)', marginTop: 12 }}>Make a shadow lamp</h1>
        </div>
        <p className="muted" style={{ maxWidth: '46ch', fontSize: 15 }}>Everything on this page runs in your browser and is free to try. The printable files are built when you buy.</p>
      </div>
      <Maker currency={currency} amountMinor={amount} signedIn={Boolean(viewer)} payConfigured={payConfigured} example={example} />
    </div>
  );
}
