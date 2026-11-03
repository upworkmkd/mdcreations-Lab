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
import { BUTTON_MARK, fillPlaceholders, unknownPlaceholders, type TemplateId } from '@/lib/emails/auth-emails';

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
  // known placeholders ({first_name}, {pricing_url} …) are filled in; anything else in {braces} was meant to be replaced by hand
  const vars = { name: u.full_name ?? '', email: u.email, siteUrl: SITE_URL };
  const s2 = fillPlaceholders(s, vars), b2 = fillPlaceholders(b, vars);
  const left = unknownPlaceholders(`${s2}\n${b2}`);
  if (left.length) return { error: `Not sent: ${left.map((x) => `“${x}”`).join(', ')} is still in the text. Replace it with the real words, or use one of the placeholders listed above the message.` };
  if (template === 'blank' && BUTTON_MARK.test(b2)) return { error: 'Not sent: a Blank email has no button, so the [button] line would show as text. Remove it, or pick the Sign-in link, Email confirmation or Password reset template, which add the button there.' };
  try {
    if (template === 'blank') {
      const r = await sendMail({ to: u.email, ...noteEmail({ subject: s2, body: b2, siteUrl: SITE_URL, supportEmail: replyAddress() }) });
      await log('manual', [u.email], s2, null, r, { userId, body: b2, sentBy: me.id });
      revalidatePath(`/admin/users/${userId}`);
      return r.ok ? { ok: `Sent to ${u.email}.` } : { error: r.error };
    }
    const link = await makeLink(template === 'reset' ? 'recovery' : 'magiclink', u.email, { name: u.full_name ?? '' });
    if (!link.ok) return { error: `Supabase could not make the link: ${link.error}` };
    const r = await sendLinkEmail(template, link, { subject: s2, body: b2, sentBy: me.id });
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
