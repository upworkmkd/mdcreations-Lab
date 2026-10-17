import type { Metadata } from 'next';
import { Legal } from '@/components/legal';
import { SUPPORT_EMAIL } from '@/lib/env';
export const metadata: Metadata = { title: 'Refunds and cancellations', description: 'Refund and cancellation policy for digital downloads from MD Creations Labs.', alternates: { canonical: '/refunds' } };
export default function Page() {
  return (
    <Legal title="Refunds and cancellations" updated="8 October 2026">
      <p>Every download is generated for your own picture and is delivered immediately, so orders cannot be cancelled once the files are built.</p>
      <h2>When we refund</h2>
      <ul>
        <li>You were charged but no files appeared in your account within 24 hours.</li>
        <li>You were charged twice for the same order.</li>
        <li>The files do not open, or the parts do not fit together as described, and we cannot fix them for you.</li>
      </ul>
      <p>Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within 7 days of the purchase with your payment ID (it is in your account under Payments). Approved refunds go back to the original payment method within 5–7 working days.</p>
      <h2>When we do not refund</h2>
      <p>Changing your mind after downloading, or a shadow that matches the preview but is not what you hoped for. Please check the preview carefully: it shows the shadow the printed walls will cast.</p>
    </Legal>
  );
}
