import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth.server';
import { UUID_RE } from '@/lib/consent';
import { shipLines, type ShipTo } from '@/lib/ship';
import { getShopSettings } from '@/lib/order-mail.server';
import { PrintNow } from './print-now';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Parcel label', robots: { index: false, follow: false } };

/** A parcel label to print and stick on: big "To" address, the return address, the order number. */
export default async function Label({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [{ data: o }, shop] = await Promise.all([
    supabaseAdmin().from('orders').select('id, ship_to').eq('id', id).eq('kind', 'print').maybeSingle(),
    getShopSettings(),
  ]);
  if (!o?.ship_to) notFound();
  const to = shipLines(o.ship_to as ShipTo);
  return (
    <div className="label-page">
      <div className="label">
        <p className="label-k">To</p>
        <address className="label-to">{to.map((l) => <span key={l}>{l}</span>)}</address>
        <div className="label-from">
          <p className="label-k">From</p>
          <address>{(shop.returnAddress || 'MD Creations\n(add your return address in Admin → Settings)').split('\n').map((l) => <span key={l}>{l}</span>)}</address>
        </div>
        <p className="label-no">Order #{o.id.slice(0, 8).toUpperCase()}</p>
      </div>
      <PrintNow />
    </div>
  );
}
