'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/env';
import { trackServer, linkVisitor } from '@/lib/track.server';

export type FormState = { ok?: boolean; error?: string; message?: string } | null;
const safeNext = (v: FormDataEntryValue | null) => { const s = String(v || '/account'); return s.startsWith('/') && !s.startsWith('//') ? s : '/account'; };
async function origin() { const h = await headers(); return h.get('origin') || SITE_URL; }

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(form.get('email') || '').trim(), password: String(form.get('password') || '') });
  if (error) { await trackServer('signin_failed', { name: 'Sign-in failed', props: { reason: error.message } }); return { error: error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message }; }
  if (data.user) { await linkVisitor(data.user.id); await trackServer('signin', { name: data.user.email ?? 'Signed in', userId: data.user.id }); }
  redirect(safeNext(form.get('next')));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const email = String(form.get('email') || '').trim();
  const { data, error } = await supabase.auth.signUp({
    email, password: String(form.get('password') || ''),
    options: { data: { full_name: String(form.get('name') || '').trim() }, emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(form.get('next')))}` },
  });
  if (error) return { error: error.message };
  if (data.user) { await linkVisitor(data.user.id); await trackServer('signup', { name: email, userId: data.user.id, props: { confirmed: Boolean(data.session) } }); }
  if (data.session) redirect(safeNext(form.get('next')));
  return { ok: true, message: `Almost there. We sent a confirmation link to ${email}.` };
}

export async function sendReset(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const email = String(form.get('email') || '').trim();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origin()}/auth/callback?next=/account/password` });
  if (error) return { error: error.message };
  return { ok: true, message: `If ${email} has an account, a link to choose a new password is on its way.` };
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
