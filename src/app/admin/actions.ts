'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CURRENCIES } from '@/lib/money';
import { clearCatalogCache } from '@/lib/catalog.server';
import { createPlan } from '@/lib/razorpay.server';

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

/* ------------------------------------------------------------------ plans */
/** Saves a plan. A changed price gets a fresh Razorpay plan (Razorpay plans cannot change price); current subscribers keep their old price. */
export async function savePlan(_: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const id = String(form.get('id') || ''), status = String(form.get('status') || '');
  if (!id || !['live', 'contact', 'hidden'].includes(status)) return { error: 'Bad input.' };
  const limitRaw = String(form.get('daily_limit') ?? '').trim();
  const daily = limitRaw === '' ? null : Math.max(1, Math.round(Number(limitRaw)));
  if (limitRaw !== '' && !Number.isFinite(daily)) return { error: 'The daily limit must be a number (or empty for no limit).' };
  const db = supabaseAdmin();
  const { data: plan } = await db.from('plans').select('*').eq('id', id).single();
  if (!plan) return { error: 'Plan not found.' };
  const up = await db.from('plans').update({ status, daily_limit: daily, updated_at: new Date().toISOString() }).eq('id', id);
  if (up.error) return { error: up.error.message };

  const notes: string[] = [];
  for (const c of CURRENCIES) {
    const raw = String(form.get(`price_${c}`) ?? '').trim();
    if (raw === '') { await db.from('plan_prices').delete().eq('plan_id', id).eq('currency', c); continue; }
    const major = Number(raw);
    if (!Number.isFinite(major) || major <= 0 || major > 1_000_000) return { error: `Price in ${c} is not a number.` };
    const amount = Math.round(major * 100);
    const { data: cur } = await db.from('plan_prices').select('*').eq('plan_id', id).eq('currency', c).maybeSingle();
    let rzp: string | null = cur?.amount_minor === amount ? cur?.razorpay_plan_id ?? null : null;
    if (!rzp && (status === 'live' || form.get('make_rzp') === 'on')) {
      try {
        rzp = (await createPlan(amount, c, `${plan.name} plan`, `MD Creations Labs ${plan.name} plan, monthly`)).id;
        notes.push(`Razorpay plan made for ${c}.`);
      } catch (e) { notes.push(`${c}: Razorpay said “${(e as Error).message}”.`); }
    }
    const p = await db.from('plan_prices').upsert({ plan_id: id, currency: c, amount_minor: amount, razorpay_plan_id: rzp, updated_at: new Date().toISOString() });
    if (p.error) return { error: p.error.message };
  }
  revalidatePath('/pricing'); revalidatePath('/admin/plans');
  return { ok: true, error: notes.some((n) => n.includes('said')) ? notes.join(' ') : undefined };
}
