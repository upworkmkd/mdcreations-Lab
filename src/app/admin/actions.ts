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

/* ------------------------------------------------------------------ reviews */
export async function addReview(_: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const name = String(form.get('name') || '').trim().slice(0, 80), body = String(form.get('body') || '').trim().slice(0, 1000);
  if (!name || body.length < 10) return { error: 'A name and at least a sentence of feedback are needed.' };
  const rating = Math.min(5, Math.max(1, Number(form.get('rating')) || 5));
  const tool = String(form.get('tool') || '') || null;
  const { error } = await supabaseAdmin().from('testimonials').insert({
    name, place: String(form.get('place') || '').trim().slice(0, 80) || null, body, rating, tool_slug: tool,
    verified: form.get('verified') === 'on', source: 'admin', status: 'published',
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setReview(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || ''), to = String(form.get('to') || '');
  const db = supabaseAdmin();
  if (to === 'delete') await db.from('testimonials').delete().eq('id', id);
  else if (['published', 'hidden', 'pending'].includes(to)) await db.from('testimonials').update({ status: to }).eq('id', id);
  revalidatePath('/', 'layout');
}
