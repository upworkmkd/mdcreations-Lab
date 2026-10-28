import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { pageMeta } from '@/lib/seo';
import { getCurrency, getTool } from '@/lib/catalog.server';
import { getViewer } from '@/lib/auth.server';
import { KitPage } from '@/components/kit/kit-page';
import { PrintCost } from '@/components/print-cost/calculator';

export const metadata: Metadata = pageMeta({
  title: '3D Printing Price Calculator – What to Charge per Print',
  absoluteTitle: true,
  description: 'Work out the real cost of a 3D print and the price to charge: filament, electricity, printer wear, failed prints, labour, margin, fees and GST. Free.',
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
