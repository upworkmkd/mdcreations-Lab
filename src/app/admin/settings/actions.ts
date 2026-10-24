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
