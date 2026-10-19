import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { toolBySlug } from '@/lib/tools';
import { Card, Empty, PageHead, Pager, ago, emails, pageNum, when } from '../ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Designs' };
const SIZE = 48;

export default async function Designs({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = pageNum((await searchParams).page);
  const db = supabaseAdmin();
  const { data, count } = await db.from('designs').select('id, user_id, name, preview, tool_slug, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const ids = (data ?? []).map((d) => d.id);
  const [who, orders] = await Promise.all([
    emails((data ?? []).map((d) => d.user_id)),
    ids.length ? db.from('orders').select('design_id, status').in('design_id', ids) : Promise.resolve({ data: [] as { design_id: string; status: string }[] }),
  ]);
  const bought = new Set((orders.data ?? []).filter((o) => o.status === 'paid' || o.status === 'fulfilled').map((o) => o.design_id));
  return (
    <>
      <PageHead title="Designs" sub="Every design saved by a signed-in visitor, with the shadow preview. A design is saved when they press Buy." />
      <Card>
        {data?.length ? (
          <div className="adm-designs">
            {data.map((d) => (
              <figure key={d.id} title={when(d.created_at)}>
                {d.preview ? <img src={d.preview} alt="" /> : <div className="ph" />}
                <figcaption>
                  <b>{d.name}</b>{bought.has(d.id) && <span className="pill fulfilled">bought</span>}
                  <span>{toolBySlug(d.tool_slug)?.name ?? d.tool_slug} · {ago(d.created_at)}</span>
                  <Link href={`/admin/users/${d.user_id}`}>{who.get(d.user_id)?.email ?? 'user'}</Link>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : <Empty>No designs yet.</Empty>}
        <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/designs" />
      </Card>
    </>
  );
}
