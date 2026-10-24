'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin, FILES_BUCKET } from '@/lib/supabase/admin';
import { CURRENCIES } from '@/lib/money';
import { clearCatalogCache } from '@/lib/catalog.server';
import { cancelSubscription, createPlan } from '@/lib/razorpay.server';

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

/* ------------------------------------------------------------------ feedback */
/** Bound per row in the feedback table: setFeedback.bind(null, id, 'read'). */
export async function setFeedback(id: string, to: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['new', 'read', 'archived'].includes(to)) return;
  await supabaseAdmin().from('feedback').update({ status: to }).eq('id', id);
  revalidatePath('/admin', 'layout');
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
  const tools = form.get('tools') === '1' ? 1 : null;
  const up = await db.from('plans').update({ status, tools, daily_limit: daily, updated_at: new Date().toISOString() }).eq('id', id);
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

/* ------------------------------------------------------------------ deleting records */
export type DeleteState = { message: string; error?: boolean } | null;
const KINDS = ['anon', 'visitors', 'events', 'users', 'designs', 'orders', 'payments', 'downloads', 'subscriptions', 'reviews', 'feedback'] as const;
type Kind = (typeof KINDS)[number];

async function removeStoredFiles(db: ReturnType<typeof supabaseAdmin>, filter: { orderIds?: string[]; userIds?: string[] }) {
  let q = db.from('files').select('storage_path');
  if (filter.orderIds) q = q.in('order_id', filter.orderIds);
  if (filter.userIds) q = q.in('user_id', filter.userIds);
  const { data } = await q;
  const paths = (data ?? []).map((f) => f.storage_path).filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) await db.storage.from(FILES_BUCKET).remove(paths.slice(i, i + 100));
}

/** Deletes one row (the "one" button) or every ticked row ("ids") of a kind. */
export async function deleteRecords(_: DeleteState, form: FormData): Promise<DeleteState> {
  const me = await requireAdmin();
  const kind = String(form.get('kind') || '') as Kind;
  if (!KINDS.includes(kind)) return { message: 'Unknown record type.', error: true };
  const one = form.get('one');
  const ids = (one ? [String(one)] : form.getAll('ids').map(String)).filter(Boolean).slice(0, 500);
  if (!ids.length) return { message: 'Nothing selected.', error: true };
  const db = supabaseAdmin();
  let done = 0; const notes: string[] = [];
  try {
    switch (kind) {
      case 'anon': { const r = await db.from('anon_views').delete({ count: 'exact' }).in('visit', ids); if (r.error) throw r.error; done = new Set(ids).size; break; }
      case 'visitors': { const r = await db.from('visitors').delete({ count: 'exact' }).in('id', ids); if (r.error) throw r.error; done = r.count ?? 0; break; }
      case 'events': { const r = await db.from('visitor_events').delete({ count: 'exact' }).in('id', ids.map(Number)); if (r.error) throw r.error; done = r.count ?? 0; break; }
      case 'payments': { const r = await db.from('payments').delete({ count: 'exact' }).in('id', ids); if (r.error) throw r.error; done = r.count ?? 0; break; }
      case 'downloads': { const r = await db.from('downloads').delete({ count: 'exact' }).in('id', ids.map(Number)); if (r.error) throw r.error; done = r.count ?? 0; break; }
      case 'reviews': { const r = await db.from('testimonials').delete({ count: 'exact' }).in('id', ids); if (r.error) throw r.error; done = r.count ?? 0; break; }
      case 'feedback': { const r = await db.from('feedback').delete({ count: 'exact' }).in('id', ids); if (r.error) throw r.error; done = r.count ?? 0; break; }
      case 'orders': {
        await removeStoredFiles(db, { orderIds: ids });
        const r = await db.from('orders').delete({ count: 'exact' }).in('id', ids);   // files, payments and downloads go with them
        if (r.error) throw r.error; done = r.count ?? 0; break;
      }
      case 'designs': {
        const { data: used } = await db.from('orders').select('design_id').in('design_id', ids);
        const keep = new Set((used ?? []).map((o) => o.design_id));
        const free = ids.filter((id) => !keep.has(id));
        if (keep.size) notes.push(`${keep.size} kept because they have orders (delete the orders first)`);
        if (free.length) { const r = await db.from('designs').delete({ count: 'exact' }).in('id', free); if (r.error) throw r.error; done = r.count ?? 0; }
        break;
      }
      case 'subscriptions': {
        const { data: subs } = await db.from('subscriptions').select('id, status, provider_subscription_id').in('id', ids);
        for (const s of subs ?? []) {
          if (s.provider_subscription_id && ['active', 'authenticated', 'pending', 'halted', 'created'].includes(s.status)) {
            try { await cancelSubscription(s.provider_subscription_id, false); } catch (e) { notes.push(`Razorpay: ${(e as Error).message}`); }
          }
        }
        const r = await db.from('subscriptions').delete({ count: 'exact' }).in('id', ids);
        if (r.error) throw r.error; done = r.count ?? 0; break;
      }
      case 'users': {
        const targets = ids.filter((id) => id !== me.id);
        if (targets.length < ids.length) notes.push('your own account was skipped');
        for (const id of targets) {
          const { data: subs } = await db.from('subscriptions').select('provider_subscription_id, status').eq('user_id', id);
          for (const s of subs ?? []) if (s.provider_subscription_id && ['active', 'authenticated', 'pending', 'halted'].includes(s.status)) {
            try { await cancelSubscription(s.provider_subscription_id, false); } catch { /* already gone */ }
          }
          await db.rpc('forget_tracking', { p_uid: id });
          await removeStoredFiles(db, { userIds: [id] });
          await db.from('orders').delete().eq('user_id', id);
          const r = await db.auth.admin.deleteUser(id);
          if (r.error) notes.push(r.error.message); else done++;
        }
        break;
      }
    }
  } catch (e) {
    return { message: `Could not delete: ${(e as { message?: string }).message ?? e}`, error: true };
  }
  revalidatePath('/admin', 'layout');
  if (kind === 'reviews') revalidatePath('/', 'layout');
  return { message: `Deleted ${done}.${notes.length ? ' ' + notes.join('; ') + '.' : ''}` };
}

/** Turns tracking on or off for one account. Turning it off also removes everything recorded for it. */
export async function setTracking(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') || ''), on = form.get('on') === '1';
  const db = supabaseAdmin();
  await db.from('profiles').update({ track: on }).eq('id', id);
  if (!on) await db.rpc('forget_tracking', { p_uid: id });
  revalidatePath('/admin', 'layout');
}
