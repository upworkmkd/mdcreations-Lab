import 'server-only';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { isCurrency, type Currency } from '@/lib/money';
import type { RzpSubscription } from '@/lib/razorpay.server';

export type Plan = {
  id: string; name: string; tools: number | null; daily_limit: number | null; status: 'live' | 'contact' | 'hidden'; sort: number;
  prices: Partial<Record<Currency, number>>; ready: Partial<Record<Currency, boolean>>;   // ready = has a Razorpay plan
};
export type Subscription = {
  id: string; user_id: string; plan_id: string; tool_slug: string | null; currency: string; amount_minor: number; status: string;
  provider_subscription_id: string | null; current_start: string | null; current_end: string | null; paid_count: number;
  cancel_at_period_end: boolean; cancelled_at: string | null; created_at: string; short_url: string | null;
};

const FALLBACK: Plan[] = [
  { id: 'starter', name: 'Starter', tools: null, daily_limit: 10, status: 'live', sort: 1, prices: { INR: 99900, USD: 1200 }, ready: {} },
  { id: 'standard', name: 'Standard', tools: null, daily_limit: null, status: 'live', sort: 2, prices: { INR: 199900, USD: 2400 }, ready: {} },
];

export async function getPlans(): Promise<Plan[]> {
  if (!supabaseConfigured()) return FALLBACK;
  try {
    const db = supabasePublic();
    const [p, pr] = await Promise.all([db.from('plans').select('*').order('sort'), db.from('plan_prices').select('plan_id, currency, amount_minor, razorpay_plan_id')]);
    if (p.error || !p.data?.length) return FALLBACK;
    return p.data.filter((x) => x.status !== 'hidden').map((x) => {
      const rows = (pr.data ?? []).filter((r) => r.plan_id === x.id && isCurrency(r.currency));
      return {
        ...x,
        prices: Object.fromEntries(rows.map((r) => [r.currency, r.amount_minor])),
        ready: Object.fromEntries(rows.map((r) => [r.currency, Boolean(r.razorpay_plan_id) || Boolean(process.env.RAZORPAY_KEY_ID)])),
      } as Plan;
    });
  } catch { return FALLBACK; }
}

/** Statuses that still give access while the paid month lasts. */
const ACCESS = ['active', 'authenticated', 'pending', 'cancelled'];

export function hasAccess(s: Pick<Subscription, 'status' | 'current_end'>, now = Date.now()) {
  if (!ACCESS.includes(s.status)) return false;
  if (!s.current_end) return s.status === 'active' || s.status === 'authenticated';
  return new Date(s.current_end).getTime() > now;
}

/** The plan this person is on right now, if any. */
export async function currentSubscription(userId: string): Promise<Subscription | null> {
  const { data } = await supabaseAdmin().from('subscriptions').select('*').eq('user_id', userId).in('status', ACCESS).order('created_at', { ascending: false }).limit(5);
  return ((data ?? []) as Subscription[]).find((s) => hasAccess(s)) ?? null;
}

/** Start of today in India, as an ISO time. */
export function startOfIndianDay(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600_000).toISOString();
}

export type Entitlement = { sub: Subscription; plan: { id: string; name: string; daily_limit: number | null }; used: number; remaining: number | null; covers: boolean };

/** What the plan allows for this tool today. `covers` is false when the plan is for another tool. */
export async function entitlement(userId: string, tool: string): Promise<Entitlement | null> {
  if (!supabaseConfigured()) return null;
  const sub = await currentSubscription(userId);
  if (!sub) return null;
  const db = supabaseAdmin();
  const { data: plan } = await db.from('plans').select('id, name, tools, daily_limit').eq('id', sub.plan_id).single();
  if (!plan) return null;
  const covers = plan.tools == null || sub.tool_slug === tool;
  const { count } = await db.from('orders').select('id', { count: 'exact', head: true }).eq('subscription_id', sub.id).gte('created_at', startOfIndianDay());
  const used = count ?? 0;
  return { sub, plan, used, covers, remaining: plan.daily_limit == null ? null : Math.max(0, plan.daily_limit - used) };
}

const ts = (n: number | null | undefined) => (n ? new Date(n * 1000).toISOString() : null);

/** Copies Razorpay's view of a subscription into ours. */
export async function syncSubscription(r: RzpSubscription) {
  const patch: Record<string, unknown> = { status: r.status, paid_count: r.paid_count ?? 0, updated_at: new Date().toISOString(), provider_plan_id: r.plan_id };
  if (r.current_start) patch.current_start = ts(r.current_start);
  if (r.current_end) patch.current_end = ts(r.current_end);
  if (r.short_url) patch.short_url = r.short_url;
  if (r.status === 'cancelled') patch.cancelled_at = ts(r.ended_at) ?? new Date().toISOString();
  const { data } = await supabaseAdmin().from('subscriptions').update(patch).eq('provider_subscription_id', r.id).select('*').maybeSingle();
  return data as Subscription | null;
}
