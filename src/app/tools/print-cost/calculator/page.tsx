import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { pageMeta } from '@/lib/seo';
import { getCurrency, getTool } from '@/lib/catalog.server';
import { getViewer } from '@/lib/auth.server';
import { KitPage } from '@/components/kit/kit-page';
import { PrintCost } from '@/components/print-cost/calculator';

export const metadata: Metadata = pageMeta({
  title: '3D Print Cost Calculator – Filament, Electricity, Printer Depreciation & Selling Price',
  absoluteTitle: true,
  description: 'Free 3D printing cost calculator: filament, electricity, printer depreciation, maintenance, failed prints, labour, packaging, profit margin, marketplace fees and GST. Reads G-code and 3MF files.',
  path: '/tools/print-cost/calculator',
  keywords: ['3d print cost calculator', '3d printing price calculator', 'filament cost calculator', '3d print pricing', 'printer depreciation calculator', '3d printing cost india', 'how much to charge for 3d printing'],
});

export default async function PrintCostPage() {
  const [tool, currency, viewer] = await Promise.all([getTool('print-cost'), getCurrency(), getViewer()]);
  if (tool?.status !== 'live' && viewer?.role !== 'admin') redirect('/tools/print-cost');
  return (
    <KitPage slug="print-cost" name="Print Cost Calculator" title="What does this print really cost?"
      note="Free, no account. Filament, power, printer wear, failed prints and your time, then the price to charge. Everything stays in your browser.">
      <PrintCost currency={currency} />
    </KitPage>
  );
}
