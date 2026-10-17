import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { signIn } from './actions';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function Login({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '/account';
  const err = typeof sp.error === 'string' ? sp.error : null;
  return (
    <AuthShell>
      <p className="eyebrow">Welcome back</p>
      <h1>Sign in</h1>
      {err && <p className="msg err">{err}</p>}
      <AuthForm action={signIn} submit="Sign in" hidden={{ next }} fields={[
        { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
        { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
      ]} />
      <p className="alt">New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link> · <Link href="/forgot">Forgot password</Link></p>
    </AuthShell>
  );
}
