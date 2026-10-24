import 'server-only';
import { cookies, headers } from 'next/headers';
import { supabasePublic } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { TOOLS, type Tool, type ToolStatus } from '@/lib/tools';
import { isCurrency, type Currency } from '@/lib/money';

// Used only when the database cannot be reached (first run, local preview without keys).
const FALLBACK_PRICES: Record<string, Partial<Record<Currency, number>>> = { 'shadow-lamp': { INR: 19900, USD: 300 } };

export type CatalogTool = Tool & { prices: Partial<Record<Currency, number>> };

// Small in-memory cache so every page view does not hit the database; the admin page clears it on save.
let memo: { at: number; data: CatalogTool[] } | null = null;
export function clearCatalogCache() { memo = null; }

export async function getCatalog(): Promise<CatalogTool[]> {
  if (memo && Date.now() - memo.at < 60_000) return memo.data;
  const data = await loadCatalog();
  memo = { at: Date.now(), data };
  return data;
}

async function loadCatalog(): Promise<CatalogTool[]> {
  let status: Record<string, ToolStatus> = {}, prices: Record<string, Partial<Record<Currency, number>>> = FALLBACK_PRICES;
  if (supabaseConfigured()) {
    try {
      const db = supabasePublic();
      const [t, p] = await Promise.all([db.from('tools').select('slug,status'), db.from('tool_prices').select('tool_slug,currency,amount_minor')]);
      if (!t.error && t.data) status = Object.fromEntries(t.data.map((r) => [r.slug, r.status as ToolStatus]));
      if (!p.error && p.data) {
        prices = {};
        for (const r of p.data) if (isCurrency(r.currency)) (prices[r.tool_slug] ??= {})[r.currency] = r.amount_minor;
      }
    } catch { /* fall back to the defaults below */ }
  }
  return TOOLS.map((t) => ({ ...t, status: status[t.slug] ?? t.status, prices: prices[t.slug] ?? {} })).filter((t) => t.status !== 'hidden');
}

export async function getTool(slug: string) {
  return (await getCatalog()).find((t) => t.slug === slug) ?? null;
}

/** Cookie an admin sets to see the site in another currency ('INR' or 'USD'). Ignored for everyone else. */
export const ADMIN_CURRENCY_COOKIE = 'mdl_cur';

/**
 * The visitor's currency, from where they are: INR in India, USD everywhere else. Visitors cannot switch it.
 * Admins can, to test prices and checkout in the other currency (see /api/admin/currency).
 */
export async function getCurrency(): Promise<Currency> {
  const forced = (await cookies()).get(ADMIN_CURRENCY_COOKIE)?.value;
  if (isCurrency(forced)) {
    const { getViewer } = await import('@/lib/auth.server');
    const me = await getViewer().catch(() => null);
    if (me?.role === 'admin') return forced;
  }
  const country = (await headers()).get('x-vercel-ip-country');
  return !country || country === 'IN' ? 'INR' : 'USD';
}

/** Lowest and highest price for one design across the live paid tools, in this currency (null when none has a price). */
export function designPriceRange(tools: CatalogTool[], currency: Currency) {
  const list = tools.filter((t) => t.status === 'live' && !t.free && t.prices[currency] != null)
    .map((t) => ({ slug: t.slug, name: t.name, price: t.prices[currency] as number }))
    .sort((a, b) => a.price - b.price);
  if (!list.length) return null;
  return { min: list[0].price, max: list[list.length - 1].price, tools: list };
}
