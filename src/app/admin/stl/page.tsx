import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fmtBytes, publicImageUrl, type AdminProduct } from '@/lib/stl/product';
import { formatMoney } from '@/lib/money';
import { Card, Empty, PageHead, ago } from '../ui';
import { NewProduct } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'STL files' };

export default async function StlProducts() {
  const db = supabaseAdmin();
  const [{ data, error }, { data: sold }] = await Promise.all([
    db.from('stl_products').select('*').order('sort').order('created_at', { ascending: false }),
    db.from('orders').select('product_id, kind').not('product_id', 'is', null).in('status', ['paid', 'fulfilled']).neq('provider', 'admin'),
  ]);
  const count = (id: string, kind: string) => (sold ?? []).filter((o) => o.product_id === id && o.kind === kind).length;
  const rows = (data ?? []) as AdminProduct[];
  return (
    <>
      <PageHead title="STL files" sub="Your own designs, sold as STL files with a commercial license (print and sell the prints, not the files), or printed and posted. The files are private: buyers get them only after paying." />
      {error && <div className="adm-alert">{error.message}. Run <code>supabase/migrations/20261103000000_stl_shop.sql</code> in the Supabase SQL editor.</div>}
      <Card title="Add a design"><NewProduct /></Card>
      <Card flush>
        {!rows.length ? <Empty>No STL designs yet.</Empty> : (
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th>Design</th><th>Status</th><th>Files</th><th>Download</th><th>Printed</th><th>Sold</th><th>Updated</th></tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/stl/${p.id}`} className="adm-mini">
                  {p.images[0] ? <img src={publicImageUrl(p.images[0].path)} alt="" /> : <span className="ph" />}
                  <span>{p.title}<span className="id">/stl-files/{p.slug}</span></span></Link></td>
                <td><span className={`pill ${p.status === 'live' ? 'fulfilled' : p.status === 'hidden' ? 'failed' : ''}`}>{p.status}</span></td>
                <td>{p.files.length} STL{p.package_path ? <div className="id">zip {fmtBytes(p.package_bytes ?? 0)}</div> : <div className="id" style={{ color: 'var(--bad)' }}>no zip yet</div>}</td>
                <td>{[p.price_inr != null ? formatMoney(p.price_inr, 'INR') : null, p.price_usd != null ? formatMoney(p.price_usd, 'USD') : null].filter(Boolean).join(' · ') || '—'}</td>
                <td>{p.print_price_inr != null ? formatMoney(p.print_price_inr, 'INR') : '—'}</td>
                <td>{count(p.id, 'download')} files{count(p.id, 'print') ? <div className="id">{count(p.id, 'print')} printed</div> : null}</td>
                <td>{ago(p.updated_at)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
