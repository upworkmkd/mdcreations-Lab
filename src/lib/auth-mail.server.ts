import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/env';
import { sendMail, type MailResult } from '@/lib/mail.server';
import { log } from '@/lib/order-mail.server';
import { BUTTON, accountEmail, templateDraft, type AuthLinkKind } from '@/lib/emails/auth-emails';

/* Account emails sent by the site, not by Supabase.
 * Supabase's admin API creates the account and the one-time link without sending anything (generateLink); the site then
 * emails the link itself through Resend or SMTP. So there is no hourly limit from Supabase, signing up never waits on
 * Supabase's mail server, and every email is in the log (Admin → Users → a user, and Admin → Settings). */

export const AUTH_KINDS = { confirm: 'auth_confirm', login: 'auth_login', reset: 'auth_reset' } as const;
const PER_HOUR = 4;   // automatic account emails to one address per hour (sign-up, resend, reset), so the form cannot be used to spam

const safeNext = (s?: string | null) => (s && s.startsWith('/') && !s.startsWith('//') ? s : '/account');

type GenType = 'signup' | 'magiclink' | 'recovery';
export type LinkResult = { ok: true; href: string; userId: string; email: string; name: string } | { ok: false; error: string; code?: string };

/**
 * The one-time link for an existing account (or, for 'signup', a new one created with this password).
 * It opens /auth/callback, which checks the token with Supabase and signs the person in.
 */
export async function makeLink(type: GenType, email: string, o: { password?: string; name?: string; next?: string; origin?: string } = {}): Promise<LinkResult> {
  const db = supabaseAdmin();
  const params = type === 'signup'
    ? { type, email, password: o.password ?? '', options: { data: { full_name: o.name ?? '' } } }
    : { type, email };
  const { data, error } = await db.auth.admin.generateLink(params as Parameters<typeof db.auth.admin.generateLink>[0]);
  if (error || !data?.properties?.hashed_token || !data.user) {
    const code = (error as { code?: string } | null)?.code;
    const exists = code === 'email_exists' || code === 'user_already_exists' || /already (been )?registered|already exists/i.test(error?.message ?? '');
    const missing = code === 'user_not_found' || /not found/i.test(error?.message ?? '');
    return { ok: false, error: error?.message ?? 'Could not make the link.', code: exists ? 'exists' : missing ? 'missing' : code };
  }
  const p = data.properties;
  const next = type === 'recovery' ? '/account/password' : safeNext(o.next);
  const href = `${(o.origin ?? SITE_URL).replace(/\/$/, '')}/auth/callback?token_hash=${encodeURIComponent(p.hashed_token)}&type=${encodeURIComponent(p.verification_type)}&next=${encodeURIComponent(next)}`;
  const name = String((data.user.user_metadata as { full_name?: string } | undefined)?.full_name ?? o.name ?? '');
  return { ok: true, href, userId: data.user.id, email: data.user.email ?? email, name };
}

/** How many automatic account emails went to this address in the last hour. */
async function recentCount(email: string) {
  const { count } = await supabaseAdmin().from('email_log').select('id', { count: 'exact', head: true })
    .ilike('to_email', email.replace(/[%_\\]/g, (c) => `\\${c}`)).in('kind', Object.values(AUTH_KINDS)).is('sent_by', null)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  return count ?? 0;
}

export type SendResult = MailResult & { to?: string; userId?: string; limited?: boolean };

/** Emails the link (and logs it). `link` comes from makeLink; subject and body default to the template. */
export async function sendLinkEmail(kind: AuthLinkKind, link: Extract<LinkResult, { ok: true }>, o: { subject?: string; body?: string; sentBy?: string | null; signer?: string } = {}): Promise<SendResult> {
  const d = templateDraft(kind, link.name, o.signer);
  const subject = o.subject ?? d.subject, body = o.body ?? d.body;
  const m = accountEmail({ subject, body, siteUrl: SITE_URL, link: { href: link.href, label: BUTTON[kind] } });
  const r = await sendMail({ to: link.email, ...m });
  // the log keeps the text (without the one-time link) so the history shows what was said
  await log(AUTH_KINDS[kind], [link.email], subject, null, r, { userId: link.userId, sentBy: o.sentBy ?? null, body: o.sentBy ? body : undefined });
  return { ...r, to: link.email, userId: link.userId };
}

/**
 * The automatic emails from the sign-up, sign-in and forgot-password forms. Limited per address per hour.
 * `confirm` and `login` both use a magic link for an existing account (opening it also confirms the email).
 */
export async function sendAccountEmail(kind: 'confirm' | 'reset', email: string, o: { next?: string; origin?: string } = {}): Promise<SendResult & { code?: string }> {
  if (await recentCount(email) >= PER_HOUR) return { ok: false, limited: true, error: 'Too many emails to this address in the last hour. Please wait a little and try again.' };
  const link = await makeLink(kind === 'reset' ? 'recovery' : 'magiclink', email, o);
  if (!link.ok) return { ok: false, error: link.error, code: link.code };
  return sendLinkEmail(kind, link);
}

/** Sign-up: creates the account (not confirmed yet) and emails the confirmation link. */
export async function signUpAndEmail(o: { email: string; password: string; name: string; next?: string; origin?: string }): Promise<SendResult & { code?: string; created?: boolean }> {
  if (await recentCount(o.email) >= PER_HOUR) return { ok: false, limited: true, error: 'Too many emails to this address in the last hour. Please wait a little and try again.' };
  const link = await makeLink('signup', o.email, o);
  if (!link.ok) return { ok: false, error: link.error, code: link.code };
  const r = await sendLinkEmail('confirm', link);
  return { ...r, created: true };
}

/** Whether this address has an account, and whether its email is confirmed. */
export async function accountState(email: string): Promise<{ id: string; confirmed: boolean } | null> {
  const db = supabaseAdmin();
  const { data: p } = await db.from('profiles').select('id').ilike('email', email.replace(/[%_\\]/g, (c) => `\\${c}`)).limit(1).maybeSingle();
  if (!p) return null;
  const { data } = await db.auth.admin.getUserById(p.id);
  return data?.user ? { id: p.id, confirmed: Boolean(data.user.email_confirmed_at) } : null;
}
