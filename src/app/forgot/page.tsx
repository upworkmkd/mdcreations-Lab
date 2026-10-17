import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { sendReset } from '../login/actions';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false, follow: false } };

export default function Forgot() {
  return (
    <AuthShell>
      <p className="eyebrow">It happens</p>
      <h1>Reset your password</h1>
      <p className="muted">We will email you a link to choose a new one.</p>
      <AuthForm action={sendReset} submit="Send the link" fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]} />
      <p className="alt"><Link href="/login">Back to sign in</Link></p>
    </AuthShell>
  );
}
