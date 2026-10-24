import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { pageMeta } from '@/lib/seo';
import { LayerMaker } from '@/components/layers/layer-maker';
import { getCurrency, getTool } from '@/lib/catalog.server';
import { getViewer } from '@/lib/auth.server';
import { supabaseConfigured } from '@/lib/env';
import { entitlement, getPlans } from '@/lib/plans.server';
import { formatMoney } from '@/lib/money';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const metadata: Metadata = pageMeta({
  title: 'Layered Sculpture Maker – Turn a Picture into Colour Layer STL Files',
  absoluteTitle: true,
  description: 'Upload a picture and turn it into a layered 3D printed sculpture: one STL per colour, a frame, alignment pins and a 3D preview of the finished stack.',
  path: '/tools/layered-sculpture/make',
  keywords: ['layered sculpture STL', 'picture to layered 3D print', 'multi colour layer art generator', 'layered wall art 3D printing'],
});

export default async function MakeLayers() {
  const [tool, currency, viewer] = await Promise.all([getTool('layered-sculpture'), getCurrency(), getViewer()]);
  const live = tool?.status === 'live';
  const admin = viewer?.role === 'admin';
  if (!live && !admin) redirect('/tools/layered-sculpture');   // not launched yet: only the shop owner can try it

  const amount = tool?.prices[currency] ?? null;
  const payConfigured = supabaseConfigured() && Boolean(process.env.RAZORPAY_KEY_ID) && live;
  const ent = viewer ? await entitlement(viewer.id, 'layered-sculpture').catch(() => null) : null;
  const plan = ent?.covers ? { name: ent.plan.name, remaining: ent.remaining, limit: ent.plan.daily_limit } : null;
  const reviewed = viewer ? ((await supabaseAdmin().from('testimonials').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id).eq('source', 'site')).count ?? 0) > 0 : false;
  const plans = (await getPlans()).map((p) => ({
    id: p.id, name: p.name, status: p.status, ready: Boolean(p.ready[currency]), limit: p.daily_limit, tools: p.tools,
    price: p.prices[currency] != null ? formatMoney(p.prices[currency]!, currency) : null,
  }));

  return (
    <div className="wrap" style={{ maxWidth: 1480 }}>
      <div style={{ padding: '30px 0 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/#tools">Tools</Link><span>/</span><Link href="/tools/layered-sculpture">Layered Sculpture Maker</Link></nav>
          <h1 className="serif" style={{ font: '500 clamp(34px, 4.4vw, 52px)/1.02 var(--serif)', marginTop: 12 }}>Make a layered sculpture</h1>
        </div>
        <p className="muted" style={{ maxWidth: '50ch', fontSize: 15 }}>{live ? 'Free to try. We keep a copy of your picture for 10 days to improve the tool, unless you untick the box under the upload; the printable files are built when you download.' : 'Admin preview: this tool is not live yet. Try it, download for free, and switch it to Live in Admin → Tools and prices when you are happy.'}</p>
      </div>
      <LayerMaker currency={currency} amountMinor={amount} signedIn={Boolean(viewer)} payConfigured={payConfigured} plan={plan} plans={plans}
        otherPlan={Boolean(ent && !ent.covers)} viewerName={viewer?.name ?? ''} reviewed={reviewed} preview={!live && admin} />
      <div style={{ height: 64 }} />
    </div>
  );
}
