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

/** The visitor's currency: INR in India and USD everywhere else, unless they switched it themselves from the same country. */
export async function getCurrency(): Promise<Currency> {
  const country = (await headers()).get('x-vercel-ip-country');
  const byPlace: Currency = !country || country === 'IN' ? 'INR' : 'USD';
  const saved = (await cookies()).get('cur')?.value ?? '';
  const [choice, madeIn] = saved.split('|');
  // old cookies without a country ("INR") are ignored, so everyone starts from their location again
  if (saved.includes('|') && isCurrency(choice) && (!country || !madeIn || madeIn === country)) return choice;
  return byPlace;
}
