import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { pageMeta } from '@/lib/seo';
import { getTool } from '@/lib/catalog.server';
import { getViewer } from '@/lib/auth.server';
import { KitPage } from '@/components/kit/kit-page';
import { QrMaker } from '@/components/qr/qr-maker';

export const metadata: Metadata = pageMeta({
  title: 'QR Code to STL – Free 3D Printable QR Code Generator (Wi-Fi, UPI, URL)',
  absoluteTitle: true,
  description: 'Make a 3D printable QR code for Wi-Fi, UPI payments, WhatsApp, a website or a contact card. One ready-to-print STL with a label, in plate, keychain or coaster shapes. Free, in your browser.',
  path: '/tools/qr-code/make',
  keywords: ['qr code to stl', '3d printable qr code', 'qr code stl generator', 'wifi qr code 3d print', 'upi qr code stand', 'qr code keychain stl'],
});

export default async function QrPage() {
  const [tool, viewer] = await Promise.all([getTool('qr-code'), getViewer()]);
  if (tool?.status !== 'live' && viewer?.role !== 'admin') redirect('/tools/qr-code');
  return (
    <KitPage slug="qr-code" name="QR Code to STL" title="Make a printable QR code"
      note="Free, no account. Wi-Fi, UPI, WhatsApp, a website or a contact card, as a printable STL. Everything is made in your browser.">
      <QrMaker />
    </KitPage>
  );
}
