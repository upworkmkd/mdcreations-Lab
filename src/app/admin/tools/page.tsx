import { supabaseAdmin } from '@/lib/supabase/admin';
import { TOOLS } from '@/lib/tools';
import { kitFor } from '@/lib/kits.server';
import { Card, PageHead } from '../ui';
import { ToolRow } from './tool-row';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tools and prices' };

export default async function Tools() {
  const db = supabaseAdmin();
  const [tools, prices, print] = await Promise.all([
    db.from('tools').select('*').order('sort'),
    db.from('tool_prices').select('tool_slug, currency, amount_minor'),
    db.from('tool_print_prices').select('tool_slug, currency, amount_minor'),
  ]);
  const priceOf = (slug: string, c: string) => prices.data?.find((p) => p.tool_slug === slug && p.currency === c)?.amount_minor ?? null;
  const printOf = (slug: string, c: string) => print.data?.find((p) => p.tool_slug === slug && p.currency === c)?.amount_minor ?? null;
  // a printed option needs files the shop can print: every paid tool that builds files on the server
  const alwaysFree = (slug: string) => Boolean(TOOLS.find((x) => x.slug === slug)?.free);   // browser-only utilities: nothing to sell
  const printable = (slug: string) => Boolean(kitFor(slug)) && !alwaysFree(slug);
  return (
    <>
      <PageHead title="Tools and prices" sub={<>Download: the price per design, including tax. Printed: the price to print, assemble and post the design to the customer, shipping and tax included (India only for now, so only the ₹ price is used; $ is kept for later). Leave a download price empty to stop selling downloads; tick Free to give the downloads away and list the tool with the free tools (signing in is still needed to download). As admin you download your own designs free, unless “Admin orders” in the sidebar is set to pay with Razorpay.</>} />
      <Card flush>
        <div className="tbl-wrap">
          <table className="tbl adm-tbl">
            <thead><tr><th>Tool</th><th colSpan={6}><div className="adm-tool-form adm-tool-head"><span>Status</span><span>Free</span><span className="g">Download, per design</span><span className="g">Printed and posted, shipping incl.</span><span /></div></th></tr></thead>
            <tbody>
              {(tools.data ?? []).map((t) => (
                <ToolRow key={t.slug} slug={t.slug} name={TOOLS.find((x) => x.slug === t.slug)?.name ?? t.name} status={t.status} free={Boolean(t.free) || alwaysFree(t.slug)} alwaysFree={alwaysFree(t.slug)} inr={priceOf(t.slug, 'INR')} usd={priceOf(t.slug, 'USD')}
                  printInr={printOf(t.slug, 'INR')} printUsd={printOf(t.slug, 'USD')} printable={printable(t.slug)} />
              ))}
              {tools.error && <tr><td colSpan={7} className="msg err">Could not read the tools table: {tools.error.message}. Did you run the SQL migration?</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
