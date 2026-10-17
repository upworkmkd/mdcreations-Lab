import type { Metadata } from 'next';
import { Legal } from '@/components/legal';
import { SUPPORT_EMAIL } from '@/lib/env';
export const metadata: Metadata = { title: 'Terms of use', description: 'Terms of use and file licence for MD Creations Labs.', alternates: { canonical: '/terms' } };
export default function Page() {
  return (
    <Legal title="Terms of use" updated="8 October 2026">
      <p>MD Creations Labs (“Labs”, “we”) is run by MD Creations, India. By using this site you agree to these terms.</p>
      <h2>What you buy</h2>
      <p>Each purchase is a digital download: 3D printing files made from the picture and settings you chose. Prices are shown before you pay and include applicable taxes. Payments are processed by Razorpay.</p>
      <h2>Your licence</h2>
      <ul>
        <li>You may print the files as often as you like and sell the printed objects you make yourself.</li>
        <li>You may not share, upload, resell or give away the files, whether changed or not.</li>
        <li>The base and battery cover files are licensed with your design on the same terms.</li>
      </ul>
      <h2>Your pictures</h2>
      <p>Only upload pictures you own or have permission to use. Pictures are processed in your browser; only a black-and-white outline of the picture is sent to us to build your files. You are responsible for the pictures you use.</p>
      <h2>Accounts</h2>
      <p>Keep your password private. We may close accounts used to abuse the service or to share paid files.</p>
      <h2>Liability</h2>
      <p>Files are provided as designed for the lamp described on the tool page. Results depend on your printer, filament and settings. Our total liability for any purchase is limited to the amount you paid for it.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </Legal>
  );
}
