'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL, SUPPORT_EMAIL } from '@/lib/env';
import { accountState, sendAccountEmail, signUpAndEmail } from '@/lib/auth-mail.server';
import { trackServer, linkVisitor } from '@/lib/track.server';

export type FormState = { ok?: boolean; error?: string; message?: string } | null;
const safeNext = (v: FormDataEntryValue | null) => { const s = String(v || '/account'); return s.startsWith('/') && !s.startsWith('//') ? s : '/account'; };
/** Where links in emails point: this site's own address. The browser's origin is used only when it is the host this
 *  request came to (a preview deployment, or localhost), so a forged header cannot send a sign-in link elsewhere. */
async function origin() {
  const h = await headers(), o = h.get('origin'), host = h.get('x-forwarded-host') ?? h.get('host');
  try { if (o && host && new URL(o).host === host) return o; } catch { /* ignore */ }
  return SITE_URL;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SORRY = 'Something went wrong on our side. Please try again in a minute.';

/** Records a problem in the visitor's timeline (Admin → Visitors), so a failed sign-up is visible, not silent. */
const problem = (where: string, message: string, props: Record<string, unknown> = {}) => trackServer('server_error', { name: message.slice(0, 160), props: { where, ...props } });

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const email = String(form.get('email') || '').trim();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: String(form.get('password') || '') });
  if (error) {
    await trackServer('signin_failed', { name: 'Sign-in failed', props: { reason: error.message } });
    if (error.code === 'email_not_confirmed') return confirmAgain(email, String(form.get('next') || ''));
    return { error: error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message };
  }
  if (data.user) { await linkVisitor(data.user.id); await trackServer('signin', { name: data.user.email ?? 'Signed in', userId: data.user.id }); }
  redirect(safeNext(form.get('next')));
}

/** The account exists but the email is not confirmed yet: send a fresh confirmation link. */
async function confirmAgain(email: string, next: string): Promise<FormState> {
  try {
    const r = await sendAccountEmail('confirm', email, { next: safeNext(next), origin: await origin() });
    if (r.ok) return { ok: true, message: `Your email is not confirmed yet, so we sent a new confirmation link to ${email}. Open it and you are signed in.` };
    await problem('confirm email', r.error, { limited: Boolean(r.limited) });
    return { error: r.limited ? r.error : `Your email is not confirmed yet, and we could not send a new link just now. Please try again in a few minutes, or write to ${SUPPORT_EMAIL}.` };
  } catch (e) {
    await problem('confirm email', (e as Error).message);
    return { error: SORRY };
  }
}

/** Creates the account and emails the confirmation link (sent by the site, not by Supabase). */
export async function createAccount(o: { name: string; email: string; password: string; next: string }): Promise<FormState> {
  const email = o.email.trim().toLowerCase(), name = o.name.trim().slice(0, 80), next = safeNext(o.next);
  if (!EMAIL_RE.test(email)) return { error: 'Please check the email address.' };
  if (o.password.length < 8) return { error: 'Use at least 8 characters for the password.' };
  try {
    const r = await signUpAndEmail({ email, password: o.password, name, next, origin: await origin() });
    if (r.code === 'exists') {
      const acc = await accountState(email);
      if (acc && !acc.confirmed) return confirmAgain(email, next);
      return { error: 'An account with this email already exists. Please sign in, or use “Forgot password” to choose a new one.' };
    }
    if (r.userId) { await linkVisitor(r.userId); await trackServer('signup', { name: email, userId: r.userId, props: { confirmed: false, emailed: r.ok } }); }
    if (r.ok) return { ok: true, message: `Almost there. We sent a confirmation link to ${email}. Open it and you are signed in. (Check the spam folder if it is not there in a minute.)` };
    await problem('sign-up', r.error, { created: Boolean(r.created), limited: Boolean(r.limited) });
    if (r.limited) return { error: r.error };
    if (r.created) return { error: `Your account is created, but the confirmation email could not be sent just now. Please sign in again in a few minutes and we will send a new link, or write to ${SUPPORT_EMAIL}.` };
    return { error: /password/i.test(r.error) ? r.error : SORRY };
  } catch (e) {
    await problem('sign-up', (e as Error).message);
    return { error: SORRY };
  }
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  return createAccount({ name: String(form.get('name') || ''), email: String(form.get('email') || ''), password: String(form.get('password') || ''), next: String(form.get('next') || '') });
}

/** For the sign-in window on tool pages: an unconfirmed account asks for a new confirmation link. */
export async function resendConfirmation(email: string, next: string): Promise<FormState> {
  if (!EMAIL_RE.test(email.trim())) return { error: 'Please check the email address.' };
  return confirmAgain(email.trim().toLowerCase(), next);
}

export async function sendReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Please check the email address.' };
  const done: FormState = { ok: true, message: `If ${email} has an account, a link to choose a new password is on its way.` };
  try {
    const r = await sendAccountEmail('reset', email, { origin: await origin() });
    if (r.ok || r.code === 'missing') return done;   // the same answer either way, so the form does not tell who has an account
    await problem('password reset', r.error, { limited: Boolean(r.limited) });
    return { error: r.limited ? r.error : SORRY };
  } catch (e) {
    await problem('password reset', (e as Error).message);
    return { error: SORRY };
  }
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const pw = String(form.get('password') || ''), again = String(form.get('again') || '');
  if (pw.length < 8) return { error: 'Use at least 8 characters.' };
  if (pw !== again) return { error: 'The two passwords are different.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };
  return { ok: true, message: 'Your password has been changed.' };
}

export async function updateName(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: 'Please sign in again.' };
  const name = String(form.get('name') || '').trim().slice(0, 80);
  const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', data.user.id);
  if (error) return { error: 'Could not save your name.' };
  return { ok: true, message: 'Saved.' };
}
