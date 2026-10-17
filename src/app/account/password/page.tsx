import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { updatePassword } from '../../login/actions';
import { requireViewer } from '@/lib/auth.server';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function NewPassword() {
  await requireViewer('/account/password');
  return (
    <AuthShell>
      <p className="eyebrow">Account</p>
      <h1>Choose a new password</h1>
      <AuthForm action={updatePassword} submit="Save password" fields={[
        { name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password', minLength: 8 },
        { name: 'again', label: 'The same again', type: 'password', autoComplete: 'new-password', minLength: 8 },
      ]} />
      <p className="alt"><a href="/account">Back to your account</a></p>
    </AuthShell>
  );
}
