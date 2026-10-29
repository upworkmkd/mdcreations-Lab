'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { EMAIL_RE, getEmailSettings, sendTestEmail } from '@/lib/order-mail.server';

export type FormState = { ok?: string; error?: string } | null;

/** Saves who gets order emails. Alert addresses: one per line, or separated by commas. */
export async function saveEmailSettings(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const raw = String(form.get('notify') ?? '');
  const list = [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
  const bad = list.filter((e) => !EMAIL_RE.test(e));
  if (bad.length) return { error: `This does not look like an email address: ${bad.join(', ')}` };
  if (list.length > 10) return { error: 'Up to 10 alert addresses.' };
  const value = { customer: form.get('customer') === 'on', admin: form.get('admin') === 'on', notify: list };
  const { error } = await supabaseAdmin().from('site_settings').upsert({ key: 'emails', value, updated_at: new Date().toISOString() });
  if (error) return { error: `${error.message}. Did you run the order emails SQL migration?` };
  revalidatePath('/admin/settings');
  return { ok: 'Saved.' };
}

/** Sends a sample receipt to you, or a sample alert to the alert addresses. */
export async function sendTest(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const kind = form.get('kind') === 'admin' ? 'admin' : 'customer';
  const to = kind === 'customer' ? [me.email] : (await getEmailSettings()).notify;
  if (!to.length) return { error: 'Add an alert address and save first.' };
  const r = await sendTestEmail(kind, to, { email: me.email, name: me.name });
  revalidatePath('/admin/settings');
  return r.ok ? { ok: `Sent to ${to.join(', ')}. Check the inbox (and the spam folder the first time).` } : { error: r.error };
}

/** The return address printed on parcel labels for printed orders. */
export async function saveShopSettings(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const returnAddress = String(form.get('returnAddress') ?? '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8).join('\n').slice(0, 500);
  const { error } = await supabaseAdmin().from('site_settings').upsert({ key: 'shop', value: { returnAddress }, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath('/admin/settings');
  return { ok: 'Saved.' };
}

/** Automatic emails: what is switched on, after how many days, and who signs them. */
export async function saveAutomation(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { parseAutomation } = await import('@/lib/automation.server');
  const { error } = await supabaseAdmin().from('site_settings').upsert({ key: 'automation', value: parseAutomation(form), updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath('/admin/settings');
  return { ok: 'Saved. The daily job uses this from its next run.' };
}

export type RunState = { ok?: string; error?: string; due?: { label: string; to: string; ref: string }[] } | null;

/** "Who is due?" lists the emails today's run would send; "Send now" sends them straight away. */
export async function runAutomationNow(_: RunState, form: FormData): Promise<RunState> {
  await requireAdmin();
  const { runAutomation } = await import('@/lib/automation.server');
  const dry = form.get('mode') !== 'send';
  try {
    const r = await runAutomation({ dry, trigger: 'admin' });
    if (dry) return { ok: r.due?.length ? `${r.due.length} email${r.due.length === 1 ? '' : 's'} due.` : 'Nobody is due an email today.', due: r.due ?? [] };
    revalidatePath('/admin/settings');
    if (!r.sent && !r.failed) return { ok: 'Nothing to send today.' };
    return r.failed ? { error: `Sent ${r.sent}, ${r.failed} failed. ${r.errors.slice(0, 3).join(' · ')}` } : { ok: `Sent ${r.sent}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not run.' };
  }
}
