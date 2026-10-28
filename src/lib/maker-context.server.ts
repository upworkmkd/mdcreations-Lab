import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrency, getTool } from '@/lib/catalog.server';
import { getViewer } from '@/lib/auth.server';
import { supabaseConfigured } from '@/lib/env';
import { entitlement, getPlans } from '@/lib/plans.server';
import { formatMoney } from '@/lib/money';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Everything a maker page needs for its "Get the files" box. Tools that are not live yet are open to admins only
 * (others are sent to the tool page). Pass the result's `buy` straight to <BuyBox> (plus tool, next, ready, getDesign).
 */
export async function makerContext(slug: string) {
  const [tool, currency, viewer] = await Promise.all([getTool(slug), getCurrency(), getViewer()]);
  const live = tool?.status === 'live', admin = viewer?.role === 'admin';
  if (!live && !admin) redirect(`/tools/${slug}`);
  const amount = tool?.prices[currency] ?? null;
  // printed and posted: India only for now, so only for visitors paying in rupees
  const printMinor = currency === 'INR' ? tool?.printPrices.INR ?? null : null;
  const ent = viewer ? await entitlement(viewer.id, slug).catch(() => null) : null;
  const reviewed = viewer ? ((await supabaseAdmin().from('testimonials').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id).eq('source', 'site')).count ?? 0) > 0 : false;
  const plans = (await getPlans()).map((p) => ({
    id: p.id, name: p.name, status: p.status, ready: Boolean(p.ready[currency]), limit: p.daily_limit, tools: p.tools,
    price: p.prices[currency] != null ? formatMoney(p.prices[currency]!, currency) : null,
  }));
  return {
    tool, live, admin, viewer, currency,
    buy: {
      currency, amountMinor: amount, signedIn: Boolean(viewer),
      payConfigured: supabaseConfigured() && Boolean(process.env.RAZORPAY_KEY_ID) && live,
      plan: ent?.covers ? { name: ent.plan.name, remaining: ent.remaining, limit: ent.plan.daily_limit } : null,
      plans, otherPlan: Boolean(ent && !ent.covers), viewerName: viewer?.name ?? '', reviewed, preview: !live && admin,
      print: printMinor != null && tool && supabaseConfigured() && (admin || (live && Boolean(process.env.RAZORPAY_KEY_ID))) ? { priceMinor: printMinor, toolName: tool.name } : null,
    },
  };
}
