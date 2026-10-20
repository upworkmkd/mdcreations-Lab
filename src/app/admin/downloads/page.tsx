import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { BulkForm, RowDelete, Sel } from '../bulk';
import { Card, PageHead, Pager, Stat, emails, num, one, pageNum, when } from '../ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Downloads' };
const SIZE = 50;
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export default async function Downloads({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = pageNum((await searchParams).page);
  const db = supabaseAdmin();
  const [dl, files] = await Promise.all([
    db.from('downloads').select('id, user_id, file_id, created_at, files(name, size_bytes, tool_slug)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1),
    db.from('files').select('id, user_id, name, size_bytes, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(20),
  ]);
  const who = await emails([...(dl.data ?? []).map((d) => d.user_id), ...(files.data ?? []).map((f) => f.user_id)]);
  return (
    <>
      <PageHead title="Downloads" sub="Every time a customer downloaded their files, and the files that have been built." />
      <div className="adm-stats">
        <Stat label="Downloads" value={num(dl.count)} />
        <Stat label="Files built" value={num(files.count)} />
      </div>
      <div className="adm-grid2 wide">
        <Card title="Downloads" flush>
          <BulkForm kind="downloads" noun="download record">
<div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th className="sel" /><th>When</th><th>Customer</th><th>File</th><th /></tr></thead>
            <tbody>
              {(dl.data ?? []).map((d) => {
                const f = one(d.files as { name: string; size_bytes: number } | { name: string; size_bytes: number }[] | null);
                return (
                  <tr key={d.id}>
                    <td className="sel"><Sel id={String(d.id)} /></td>
                    <td>{when(d.created_at)}</td>
                    <td><Link href={`/admin/users/${d.user_id}`}>{who.get(d.user_id)?.email ?? d.user_id.slice(0, 8)}</Link></td>
                    <td>{f?.name ?? '—'}{f && <div className="id">{kb(f.size_bytes)}</div>}</td>
                    <td className="act"><RowDelete id={String(d.id)} /></td>
                  </tr>
                );
              })}
              {!dl.data?.length && <tr><td colSpan={5} className="muted">No downloads yet.</td></tr>}
            </tbody>
          </table></div>
          </BulkForm>
          <Pager page={page} size={SIZE} total={dl.count ?? 0} base="/admin/downloads" />
        </Card>
        <Card title="Latest files built" flush>
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th>Built</th><th>Customer</th><th>File</th></tr></thead>
            <tbody>
              {(files.data ?? []).map((f) => (
                <tr key={f.id}><td>{when(f.created_at)}</td><td><Link href={`/admin/users/${f.user_id}`}>{who.get(f.user_id)?.email ?? '—'}</Link></td><td>{f.name}<div className="id">{kb(f.size_bytes)}</div></td></tr>
              ))}
              {!files.data?.length && <tr><td colSpan={3} className="muted">No files yet.</td></tr>}
            </tbody>
          </table></div>
        </Card>
      </div>
    </>
  );
}
