'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CURRENCIES } from '@/lib/money';
import { clearCatalogCache } from '@/lib/catalog.server';

export type SaveState = { ok?: boolean; error?: string } | null;

/** Saves the status and the price in every currency for one tool. Prices are typed in rupees / dollars. */
export async function saveTool(_: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const slug = String(form.get('slug') || ''), status = String(form.get('status') || '');
  if (!slug || !['live', 'coming_soon', 'hidden'].includes(status)) return { error: 'Bad input.' };
  const db = supabaseAdmin();
  const t = await db.from('tools').update({ status, updated_at: new Date().toISOString() }).eq('slug', slug);
  if (t.error) return { error: t.error.message };
  for (const c of CURRENCIES) {
    const raw = String(form.get(`price_${c}`) ?? '').trim();
    if (raw === '') { await db.from('tool_prices').delete().eq('tool_slug', slug).eq('currency', c); continue; }
    const major = Number(raw);
    if (!Number.isFinite(major) || major < 0 || major > 1_000_000) return { error: `Price in ${c} is not a number.` };
    const p = await db.from('tool_prices').upsert({ tool_slug: slug, currency: c, amount_minor: Math.round(major * 100), updated_at: new Date().toISOString() });
    if (p.error) return { error: p.error.message };
  }
  clearCatalogCache();
  revalidatePath('/', 'layout');
  return { ok: true };
}
