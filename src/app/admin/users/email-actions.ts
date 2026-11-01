'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/consent';
import { SITE_URL } from '@/lib/env';
import { sendMail, replyAddress } from '@/lib/mail.server';
import { log } from '@/lib/order-mail.server';
import { noteEmail } from '@/lib/emails/note-email';
import { makeLink, sendLinkEmail } from '@/lib/auth-mail.server';
import type { TemplateId } from '@/lib/emails/auth-emails';

type Result = { ok?: string; error?: string };

/** Admin → Users → a user → Send email: one of the account templates (with its one-time link) or a blank email. */
export async function sendUserEmail(userId: string, template: TemplateId, subject: string, body: string): Promise<Result> {
  const me = await requireAdmin();
  if (!UUID_RE.test(userId) || !['confirm', 'login', 'reset', 'blank'].includes(template)) return { error: 'Bad request.' };
  const s = subject.replace(/\s+/g, ' ').trim().slice(0, 200), b = body.replace(/\r/g, '').trim().slice(0, 8000);
  if (s.length < 3) return { error: 'Write a subject.' };
  if (b.length < 10) return { error: 'Write a message.' };
  const db = supabaseAdmin();
  const { data: u } = await db.from('profiles').select('id, email, full_name').eq('id', userId).maybeSingle();
  if (!u?.email) return { error: 'This user has no email address.' };
  try {
    if (template === 'blank') {
      const r = await sendMail({ to: u.email, ...noteEmail({ subject: s, body: b, siteUrl: SITE_URL, supportEmail: replyAddress() }) });
      await log('manual', [u.email], s, null, r, { userId, body: b, sentBy: me.id });
      revalidatePath(`/admin/users/${userId}`);
      return r.ok ? { ok: `Sent to ${u.email}.` } : { error: r.error };
    }
    const link = await makeLink(template === 'reset' ? 'recovery' : 'magiclink', u.email, { name: u.full_name ?? '' });
    if (!link.ok) return { error: `Supabase could not make the link: ${link.error}` };
    const r = await sendLinkEmail(template, link, { subject: s, body: b, sentBy: me.id });
    revalidatePath(`/admin/users/${userId}`);
    return r.ok ? { ok: `Sent to ${u.email}.` } : { error: r.error };
  } catch (e) {
    return { error: (e as Error).message || 'Could not send.' };
  }
}

/** Confirms the email by hand (for someone whose emails do not arrive). */
export async function confirmUserEmail(form: FormData) {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  if (!UUID_RE.test(id)) return;
  await supabaseAdmin().auth.admin.updateUserById(id, { email_confirm: true });
  revalidatePath(`/admin/users/${id}`);
  revalidatePath('/admin/users');
}
