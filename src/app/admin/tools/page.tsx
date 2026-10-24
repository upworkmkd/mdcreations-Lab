import { supabaseAdmin } from '@/lib/supabase/admin';
import { TOOLS } from '@/lib/tools';
import { Card, PageHead } from '../ui';
import { ToolRow } from './tool-row';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tools and prices' };

export default async function Tools() {
  const db = supabaseAdmin();
  const [tools, prices] = await Promise.all([
    db.from('tools').select('slug, name, status').order('sort'),
    db.from('tool_prices').select('tool_slug, currency, amount_minor'),
  ]);
  const priceOf = (slug: string, c: string) => prices.data?.find((p) => p.tool_slug === slug && p.currency === c)?.amount_minor ?? null;
  return (
    <>
      <PageHead title="Tools and prices" sub="Prices are per design download, including tax. Leave a price empty to stop selling in that currency. As admin you download your own designs free, unless “Admin orders” in the sidebar is set to pay with Razorpay." />
      <Card flush>
        <div className="tbl-wrap">
          <table className="tbl adm-tbl">
            <thead><tr><th>Tool</th><th>Status</th><th>Price ₹</th><th>Price $</th><th /></tr></thead>
            <tbody>
              {(tools.data ?? []).map((t) => (
                <ToolRow key={t.slug} slug={t.slug} name={TOOLS.find((x) => x.slug === t.slug)?.name ?? t.name} status={t.status} inr={priceOf(t.slug, 'INR')} usd={priceOf(t.slug, 'USD')} />
              ))}
              {tools.error && <tr><td colSpan={5} className="msg err">Could not read the tools table: {tools.error.message}. Did you run the SQL migration?</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
