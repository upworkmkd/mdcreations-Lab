import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { signUp } from '../login/actions';

export const metadata: Metadata = { title: 'Create an account' };

export default async function Signup({ searchParams }: PageProps<'/signup'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '/account';
  return (
    <AuthShell quote="Every design you buy stays in your account, ready to download again.">
      <p className="eyebrow">New here</p>
      <h1>Create your account</h1>
      <p className="muted">You need an account to buy and download files. Trying the tools is free.</p>
      <AuthForm action={signUp} submit="Create account" hidden={{ next }} fields={[
        { name: 'name', label: 'Your name', type: 'text', autoComplete: 'name' },
        { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
        { name: 'password', label: 'Password (8 characters or more)', type: 'password', autoComplete: 'new-password', minLength: 8 },
      ]} />
      <p className="alt">Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
      <p className="alt" style={{ fontSize: 13 }}>By creating an account you agree to the <Link href="/terms">terms of use</Link> and <Link href="/privacy">privacy policy</Link>.</p>
    </AuthShell>
  );
}
