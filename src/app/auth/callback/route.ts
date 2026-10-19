import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { trackServer, linkVisitor } from '@/lib/track.server';

// Landing point for the links in Supabase emails (confirm sign-up, reset password).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextRaw = url.searchParams.get('next') ?? '/account';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/account';
  const supabase = await createClient();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash'), type = url.searchParams.get('type') as EmailOtpType | null;
  let error: string | null = url.searchParams.get('error_description');
  if (!error && code) error = (await supabase.auth.exchangeCodeForSession(code)).error?.message ?? null;
  else if (!error && tokenHash && type) error = (await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error?.message ?? null;
  else if (!error) error = 'This link is not valid.';

  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('That link has expired or was already used. Please sign in, or ask for a new link.')}`, url.origin));
  const { data: u } = await supabase.auth.getUser();
  if (u.user) { await linkVisitor(u.user.id); await trackServer(type === 'recovery' ? 'password_reset' : 'email_confirmed', { name: u.user.email ?? '', userId: u.user.id }); }
  return NextResponse.redirect(new URL(next, url.origin));
}
