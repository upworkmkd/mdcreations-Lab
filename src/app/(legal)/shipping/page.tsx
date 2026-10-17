import type { Metadata } from 'next';
import { Legal } from '@/components/legal';
export const metadata: Metadata = { title: 'Delivery' };
export default function Page() {
  return (
    <Legal title="Delivery" updated="8 October 2026">
      <p>Everything sold on Labs is a digital download. Nothing is shipped.</p>
      <p>Your files are built as soon as your payment is confirmed, usually within a minute, and stay in your account under Files. You can download them again at any time. A confirmation of the payment is emailed to you by Razorpay.</p>
      <p>Printed lamps are sold separately on the MD Creations store and ship under that store’s delivery policy.</p>
    </Legal>
  );
}
