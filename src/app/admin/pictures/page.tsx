import { supabaseAdmin } from '@/lib/supabase/admin';
import { purgeExpiredPictures } from '@/lib/pictures.server';
import { Card, Filters, PageHead, Pager, pageNum, str, visitorNames } from '../ui';
import { PictureGrid, type SharedPicture } from './grid';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shared pictures' };
const SIZE = 60;

export default async function Pictures({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), tool = str(sp.tool);
  await purgeExpiredPictures();
  const db = supabaseAdmin();
  let q = db.from('shared_pictures').select('id, visitor_id, user_id, tool, name, width, height, bytes, created_at', { count: 'exact' });
  if (tool) q = q.eq('tool', tool);
  const { data, count, error } = await q.order('created_at', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const rows = (data ?? []) as SharedPicture[];
  const names = await visitorNames([...new Set(rows.map((r) => r.visitor_id).filter(Boolean) as string[])]);
  return (
    <>
      <PageHead title="Shared pictures" sub="Pictures visitors chose to share by ticking “Help improve this tool” under an upload. Private: only admins can open them, search engines never see them, and each one is deleted after 10 days." />
      <Filters name="tool" base="/admin/pictures" current={tool} options={[['', 'All tools'], ['shadow-lamp', 'Shadow lamp'], ['shadow-lamp-plate', 'Lamp plate'], ['lithophane', 'Lithophane'], ['photo-relief', 'Photo relief'], ['cookie-cutter', 'Rangoli / cutter'], ['layered-sculpture', 'Layered sculpture']]} />
      {error && <div className="adm-alert">{error.message}. Have you run the 20261024000000_visitor_overview_pictures.sql migration?</div>}
      <Card><PictureGrid rows={rows} showVisitor names={names} /></Card>
      <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/pictures" params={{ tool }} />
    </>
  );
}
