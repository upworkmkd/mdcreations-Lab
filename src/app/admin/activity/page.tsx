import { supabaseAdmin } from '@/lib/supabase/admin';
import { Card, Filters, PageHead, Pager, pageNum, str, visitorNames } from '../ui';
import { NOISE, Timeline, type Ev, type Sess } from '../timeline';
import { AutoRefresh } from '../auto-refresh';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Live activity' };
const SIZE = 200;
const GROUPS: Record<string, string[]> = {
  pages: ['pageview'],
  sales: ['subscribe_start', 'subscribed', 'subscribe_cancelled', 'subscription_cancel', 'plan_build', 'design_saved', 'checkout', 'payment_done', 'payment', 'payment_cancelled', 'purchase_error', 'download'],
  accounts: ['signup', 'email_confirmed', 'signin', 'signin_failed', 'signout', 'password_reset'],
  errors: ['error', 'purchase_error', 'signin_failed'],
};

export default async function Activity({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = pageNum(sp.page), f = str(sp.f);
  const db = supabaseAdmin();
  let q = db.from('visitor_events').select('*', { count: 'exact' });
  if (GROUPS[f]) q = q.in('type', GROUPS[f]);
  else if (f === 'key') q = q.not('type', 'in', `(${NOISE.join(',')})`);
  const { data, count, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
  const sids = [...new Set((data ?? []).map((e) => e.session_id).filter(Boolean))] as string[];
  const [{ data: sess }, names] = await Promise.all([
    sids.length ? db.from('visitor_sessions').select('*').in('id', sids) : Promise.resolve({ data: [] }),
    visitorNames((data ?? []).map((e) => e.visitor_id)),
  ]);

  return (
    <>
      <PageHead title="Live activity" sub="Everything visitors do, newest first, grouped into visits.">
        <AutoRefresh />
      </PageHead>
      <Filters base="/admin/activity" current={f} options={[['', 'Everything'], ['key', 'Without clicks and settings'], ['pages', 'Page views'], ['sales', 'Designs and sales'], ['accounts', 'Accounts'], ['errors', 'Problems']]} />
      {error && <div className="adm-alert">{error.message}. Have you run the visitors SQL migration?</div>}
      <Card>
        <Timeline events={(data ?? []) as Ev[]} sessions={(sess ?? []) as Sess[]} showVisitor names={names} />
        <Pager page={page} size={SIZE} total={count ?? 0} base="/admin/activity" params={{ f }} />
      </Card>
    </>
  );
}
