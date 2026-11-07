import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd, makerLd, pageMeta } from '@/lib/seo';
import { Maker } from '@/components/maker/maker';
import { getCurrency, getTool } from '@/lib/catalog.server';
import { getViewer } from '@/lib/auth.server';
import { supabaseConfigured } from '@/lib/env';
import { entitlement, getPlans } from '@/lib/plans.server';
import { formatMoney } from '@/lib/money';
import { regularPrice } from '@/lib/sale';
import { getSalePercent } from '@/lib/sale.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getGuides } from '@/lib/guides.server';
import { youtubeId } from '@/lib/youtube';
import { VideoButton } from '@/components/video/youtube';
import { loadSavedDesign } from '@/lib/saved-design.server';
import { EditingBanner } from '@/components/kit/kit-page';

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
  const [tool, currency, viewer, guides, saved, sale] = await Promise.all([getTool('shadow-lamp'), getCurrency(), getViewer(), getGuides(), loadSavedDesign('shadow-lamp', sp.design), getSalePercent()]);
  const amount = tool?.prices[currency] ?? null;
  const regular = tool?.free ? null : regularPrice(amount, sale, currency);   // shown crossed out (Admin → Settings → Sale)
  const ent = viewer ? await entitlement(viewer.id, 'shadow-lamp').catch(() => null) : null;
  const reviewed = viewer ? ((await supabaseAdmin().from('testimonials').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id).eq('source', 'site')).count ?? 0) > 0 : false;
  const plan = ent?.covers ? { name: ent.plan.name, remaining: ent.remaining, limit: ent.plan.daily_limit } : null;
  const plans = (await getPlans()).map((p) => ({
    id: p.id, name: p.name, status: p.status, ready: Boolean(p.ready[currency]), limit: p.daily_limit, tools: p.tools,
    price: p.prices[currency] != null ? formatMoney(p.prices[currency]!, currency) : null,
  }));
  const payConfigured = supabaseConfigured() && Boolean(process.env.RAZORPAY_KEY_ID) && tool?.status === 'live';
  // printed and posted: India only for now, so only for visitors paying in rupees
  const printMinor = currency === 'INR' && (payConfigured || viewer?.role === 'admin') ? tool?.printPrices.INR ?? null : null;
  const videoId = youtubeId(guides.shadowVideo);
  return (
    <div className="wrap">
      <JsonLd data={makerLd('shadow-lamp', 'Shadow Lamp Maker', '/tools/shadow-lamp/make')} />
      <div style={{ padding: '36px 0 26px', display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/tools">Tools</Link><span>/</span><Link href="/tools/shadow-lamp">Shadow Lamp Maker</Link></nav>
          <h1 className="serif" style={{ font: '500 clamp(36px, 4.6vw, 56px)/1.02 var(--serif)', marginTop: 12 }}>Make a shadow lamp</h1>
        </div>
        <div style={{ maxWidth: '46ch', display: 'grid', gap: 10, justifyItems: 'start' }}>
          <p className="muted" style={{ fontSize: 15 }}>Everything on this page runs in your browser and is free to try. The printable files are built when you buy.</p>
          {videoId && <VideoButton id={videoId} title="How to make a shadow lamp" label="Watch the 2-minute tutorial" where="shadow-maker" />}
        </div>
      </div>
      {saved && <EditingBanner name={saved.name} slug="shadow-lamp" />}
      <Maker saved={saved} currency={currency} amountMinor={amount} regularMinor={regular} signedIn={Boolean(viewer)} payConfigured={payConfigured} example={example} plan={plan} plans={plans} otherPlan={Boolean(ent && !ent.covers)} viewerName={viewer?.name ?? ''} reviewed={reviewed} printMinor={printMinor} free={Boolean(tool?.free)} guideVideo={guides.shadowVideo || null} />
    </div>
  );
}
