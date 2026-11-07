import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrency, getTool, type CatalogTool } from '@/lib/catalog.server';
import type { Currency } from '@/lib/money';
import { getViewer } from '@/lib/auth.server';
import { supabaseConfigured } from '@/lib/env';
import { entitlement, getPlans } from '@/lib/plans.server';
import { formatMoney } from '@/lib/money';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadSavedDesign } from '@/lib/saved-design.server';
import { regularPrice } from '@/lib/sale';
import { getSalePercent } from '@/lib/sale.server';

/**
 * Everything a maker page needs for its "Get the files" box. Tools that are not live yet are open to admins only
 * (others are sent to the tool page). Pass the result's `buy` straight to <BuyBox> (plus tool, next, ready, getDesign).
 * `design` is the ?design=<id> of a saved design to open for editing (see loadSavedDesign): it comes back as `saved`.
 */
export async function makerContext(slug: string, design?: unknown) {
  const [tool, currency, viewer, sale] = await Promise.all([getTool(slug), getCurrency(), getViewer(), getSalePercent()]);
  const live = tool?.status === 'live', admin = viewer?.role === 'admin';
  if (!live && !admin) redirect(`/tools/${slug}`);
  const amount = tool?.prices[currency] ?? null;
  const ent = viewer ? await entitlement(viewer.id, slug).catch(() => null) : null;
  const reviewed = viewer ? ((await supabaseAdmin().from('testimonials').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id).eq('source', 'site')).count ?? 0) > 0 : false;
  const saved = design ? await loadSavedDesign(slug, design) : null;
  const plans = (await getPlans()).map((p) => ({
    id: p.id, name: p.name, status: p.status, ready: Boolean(p.ready[currency]), limit: p.daily_limit, tools: p.tools,
    price: p.prices[currency] != null ? formatMoney(p.prices[currency]!, currency) : null,
  }));
  return {
    tool, live, admin, viewer, currency, saved,
    buy: {
      currency, amountMinor: amount, regularMinor: tool?.free ? null : regularPrice(amount, sale, currency), signedIn: Boolean(viewer), free: Boolean(tool?.free),
      payConfigured: supabaseConfigured() && Boolean(process.env.RAZORPAY_KEY_ID) && live,
      plan: ent?.covers ? { name: ent.plan.name, remaining: ent.remaining, limit: ent.plan.daily_limit } : null,
      plans, otherPlan: Boolean(ent && !ent.covers), viewerName: viewer?.name ?? '', reviewed, preview: !live && admin,
      print: printOffer(tool, currency, admin),
    },
  };
}

/**
 * "Order it printed" under a maker: when the tool has a printed price (Admin → Tools and prices), for visitors paying
 * in rupees (India only for now), once payments are set up. Admins always see it, to test.
 */
export function printOffer(tool: CatalogTool | null, currency: Currency, admin: boolean) {
  const printMinor = currency === 'INR' ? tool?.printPrices.INR ?? null : null;
  if (printMinor == null || !tool || !supabaseConfigured()) return null;
  if (!admin && !(tool.status === 'live' && process.env.RAZORPAY_KEY_ID)) return null;
  return { priceMinor: printMinor, toolName: tool.name };
}
