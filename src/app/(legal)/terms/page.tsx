import type { Metadata } from 'next';
import { Legal } from '@/components/legal';
import Link from 'next/link';
import { SUPPORT_EMAIL } from '@/lib/env';
export const metadata: Metadata = { title: 'Terms of use', description: 'Terms of use and file licence for MD Creations Labs.', alternates: { canonical: '/terms' } };
export default function Page() {
  return (
    <Legal title="Terms of use" updated="20 October 2026">
      <p>MD Creations Labs (“Labs”, “we”) is run by MD Creations, India. By using this site you agree to these terms.</p>
      <h2>What you buy</h2>
      <p>Each purchase is a digital download: 3D printing files made from the picture and settings you chose. You can buy one design at a time or subscribe to a monthly plan. Prices are shown before you pay and include applicable taxes. Payments are processed by Razorpay.</p>
      <h2>Plans</h2>
      <ul>
        <li>Plans renew every month on the date you subscribed, until you cancel. Razorpay charges the payment method you approved (card or UPI Autopay).</li>
        <li>Both plans cover every live tool. The Starter plan allows up to 10 designs a day in total (India time); the Standard plan has no daily limit.</li>
        <li>You can cancel at any time from your account. You keep your plan until the end of the month you have paid for, and it does not renew after that. Files you made stay in your account.</li>
        <li>A plan is for one person. Sharing an account or reselling plan access is not allowed.</li>
      </ul>
      <h2>Your licence</h2>
      <p>Every download comes with the <Link href="/license">MD Creations Labs Commercial License</Link>: you may print the files, sell the printed objects, and sell or share the files themselves, changed or not. A copy is included in each zip.</p>
      <h2>Your pictures</h2>
      <p>Only upload pictures you own or have permission to use. Pictures are processed in your browser; only a black-and-white outline of the picture is sent to us to build your files. You are responsible for the pictures you use.</p>
      <h2>Accounts</h2>
      <p>Keep your password private. We may close accounts used to abuse the service.</p>
      <h2>Liability</h2>
      <p>Files are provided as designed for the lamp described on the tool page. Results depend on your printer, filament and settings. Our total liability for any purchase is limited to the amount you paid for it.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </Legal>
  );
}
