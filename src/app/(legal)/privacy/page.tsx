import type { Metadata } from 'next';
import { Legal } from '@/components/legal';
import { SUPPORT_EMAIL } from '@/lib/env';
export const metadata: Metadata = { title: 'Privacy', description: 'How MD Creations Labs handles your account, designs and payment data.', alternates: { canonical: '/privacy' } };
export default function Page() {
  return (
    <Legal title="Privacy" updated="8 October 2026">
      <h2>What we keep</h2>
      <ul>
        <li>Your name, email address and password (stored securely by our login provider, Supabase).</li>
        <li>The designs you buy: a black-and-white outline of your picture, your settings and a small preview.</li>
        <li>Your orders, payment references and download history.</li>
      </ul>
      <p>Your original picture stays in your browser and is not uploaded. Card and UPI details are handled by Razorpay and never reach us.</p>
      <h2>Why</h2>
      <p>To build and deliver your files, let you download them again, answer support questions and meet tax and accounting rules.</p>
      <h2>Cookies</h2>
      <p>We use cookies to keep you signed in and to remember your currency. We do not use advertising cookies.</p>
      <h2>Your choices</h2>
      <p>Ask us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for a copy of your data or to delete your account. Order records we must keep for tax purposes are kept for the period the law requires.</p>
    </Legal>
  );
}
