'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fulfilOrder } from '@/lib/fulfil.server';
import { sendPrintStatusEmail } from '@/lib/order-mail.server';
import { checkShipTo } from '@/lib/ship';

export type ActState = { ok?: string; error?: string } | null;
const STEPS = ['to_print', 'printing', 'shipped', 'delivered', 'cancelled'] as const;
const clean = (v: FormDataEntryValue | null, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const refresh = (id: string) => { revalidatePath('/admin/print-orders'); revalidatePath(`/admin/print-orders/${id}`); };

/** Moves a printed order along. "Shipped" can carry the courier and tracking number and emails the customer. */
export async function setPrintStatus(id: string, _: ActState, form: FormData): Promise<ActState> {
  await requireAdmin();
  const to = String(form.get('status') ?? '') as (typeof STEPS)[number];
  if (!STEPS.includes(to)) return { error: 'Bad status.' };
  const db = supabaseAdmin();
  const { data: o } = await db.from('orders').select('id, kind, print_status, shipped_at').eq('id', id).maybeSingle();
  if (!o || o.kind !== 'print') return { error: 'Order not found.' };
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { print_status: to };
  if (to === 'printing') patch.printing_at = now;
  if (to === 'shipped') {
    patch.shipped_at = o.shipped_at ?? now;
    patch.courier = clean(form.get('courier'), 80) || 'India Post';
    patch.tracking_no = clean(form.get('tracking'), 80) || null;
  }
  if (to === 'delivered') patch.delivered_at = now;
  const { error } = await db.from('orders').update(patch).eq('id', id);
  if (error) return { error: error.message };

  let note = '';
  if ((to === 'shipped' || to === 'delivered') && form.get('notify') === 'on' && o.print_status !== to) {
    const r = await sendPrintStatusEmail(id, to);
    note = r == null ? ' (the customer was already told it shipped)' : r.ok ? ' The customer has been emailed.' : ` The email was not sent: ${r.error}`;
  }
  refresh(id);
  return { ok: `Marked as ${to.replace('_', ' ')}.${note}` };
}

/** Changes the courier or tracking number after shipping, without emailing again. */
export async function saveTracking(id: string, _: ActState, form: FormData): Promise<ActState> {
  await requireAdmin();
  const { error } = await supabaseAdmin().from('orders').update({ courier: clean(form.get('courier'), 80) || 'India Post', tracking_no: clean(form.get('tracking'), 80) || null }).eq('id', id).eq('kind', 'print');
  if (error) return { error: error.message };
  refresh(id);
  return { ok: 'Saved.' };
}

/** A note only the shop sees (what was printed in which colour, a call with the customer …). */
export async function saveShopNote(id: string, _: ActState, form: FormData): Promise<ActState> {
  await requireAdmin();
  const note = String(form.get('note') ?? '').trim().slice(0, 2000);
  const { error } = await supabaseAdmin().from('orders').update({ shop_note: note || null }).eq('id', id).eq('kind', 'print');
  if (error) return { error: error.message };
  refresh(id);
  return { ok: 'Saved.' };
}

/** Corrects the shipping address (when the customer writes in with a change). */
export async function saveShipTo(id: string, _: ActState, form: FormData): Promise<ActState> {
  await requireAdmin();
  const c = checkShipTo(Object.fromEntries(['name', 'phone', 'line1', 'line2', 'city', 'state', 'pin'].map((k) => [k, form.get(k)])));
  if (!c.ok) return { error: Object.values(c.errors).join(' ') };
  const { error } = await supabaseAdmin().from('orders').update({ ship_to: c.value }).eq('id', id).eq('kind', 'print');
  if (error) return { error: error.message };
  refresh(id);
  return { ok: 'Address updated.' };
}

/** Builds the print files again (when the first build failed). */
export async function rebuildPrintFiles(id: string, _: ActState): Promise<ActState> {
  await requireAdmin();
  const db = supabaseAdmin();
  await db.from('orders').update({ print_file: null }).eq('id', id).eq('kind', 'print');
  try { await fulfilOrder(id); } catch (e) { refresh(id); return { error: (e as Error).message }; }
  refresh(id);
  return { ok: 'Files built.' };
}
