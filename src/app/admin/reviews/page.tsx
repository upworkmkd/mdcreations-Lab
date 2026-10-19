import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TOOLS, toolBySlug } from '@/lib/tools';
import { Card, Empty, Filters, PageHead, Pill, str, when } from '../ui';
import { setReview } from '../actions';
import { AddReview } from './add-review';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reviews' };

export default async function Reviews({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = str((await searchParams).f);
  let q = supabaseAdmin().from('testimonials').select('*');
  if (['pending', 'published', 'hidden'].includes(f)) q = q.eq('status', f);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
  return (
    <>
      <PageHead title="Reviews" sub="Customers can leave a review from their account. Reviews wait here until you publish them; only published ones show on the site." />
      {error && <div className="adm-alert">{error.message}. Have you run the visitors SQL migration?</div>}
      <div className="adm-grid2 wide">
        <div>
          <Filters base="/admin/reviews" current={f} options={[['', 'All'], ['pending', 'Waiting'], ['published', 'Published'], ['hidden', 'Hidden']]} />
          <Card>
            {data?.length ? (
              <ul className="adm-reviews">
                {data.map((r) => (
                  <li key={r.id}>
                    <div className="top">
                      <b>{r.name}</b><span className="muted">{r.place}</span>
                      <span className="stars" aria-label={`${r.rating} of 5`}>{'★'.repeat(r.rating)}<span>{'★'.repeat(5 - r.rating)}</span></span>
                      <Pill s={r.status} />{r.verified && <span className="pill fulfilled">verified buyer</span>}
                    </div>
                    <p>{r.body}</p>
                    <div className="meta">
                      <span>{toolBySlug(r.tool_slug ?? '')?.name ?? 'General'} · {when(r.created_at)} · {r.source === 'site' ? 'written on the site' : 'added by admin'}{r.user_id && <> · <Link href={`/admin/users/${r.user_id}`}>account</Link></>}</span>
                      <form action={setReview}>
                        <input type="hidden" name="id" value={r.id} />
                        {r.status !== 'published' && <button name="to" value="published" className="btn small">Publish</button>}
                        {r.status !== 'hidden' && <button name="to" value="hidden" className="btn small ghost">Hide</button>}
                        <button name="to" value="delete" className="linkish">Delete</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty>No reviews yet. When customers write one from their account it appears here.</Empty>}
          </Card>
        </div>
        <Card title="Add a review you received">
          <p className="muted adm-note">For real feedback that came by Instagram, WhatsApp or email. Ask the customer first, and use the name they are happy to show.</p>
          <AddReview tools={TOOLS.map((t) => ({ slug: t.slug, name: t.name }))} />
        </Card>
      </div>
    </>
  );
}
