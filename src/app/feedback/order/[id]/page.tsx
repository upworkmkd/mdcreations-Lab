import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { UUID_RE } from '@/lib/consent';
import { TOOLS } from '@/lib/tools';
import { orderTokenOk } from '@/lib/order-mail.server';
import { orderNo } from '@/lib/emails/order-emails';
import { OrderFeedbackForm } from './form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'How was your order?', robots: { index: false, follow: false } };

const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });

/* Opened from the faces in the order email. The link carries a signed token, so no sign-in is needed. */
export default async function OrderFeedback({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params, sp = await searchParams;
  const t = typeof sp.t === 'string' ? sp.t : '', r = Number(sp.r) || 0;
  const rating = r >= 1 && r <= 5 ? r : 0;

  if (id === 'sample') return <Shell><OrderFeedbackForm orderId="sample" token="" initial={{ rating, message: '' }} sample summary="Sample order · Lithophane · “Grandma’s 80th”" /></Shell>;
  if (!UUID_RE.test(id) || !orderTokenOk(id, t) || !supabaseConfigured()) return <Shell><Gone /></Shell>;

  const db = supabaseAdmin();
  const [{ data: o }, { data: fb }] = await Promise.all([
    db.from('orders').select('id, tool_slug, created_at, paid_at, designs(name)').eq('id', id).maybeSingle(),
    db.from('feedback').select('rating, message').eq('order_id', id).maybeSingle(),
  ]);
  if (!o) return <Shell><Gone /></Shell>;
  const d = Array.isArray(o.designs) ? o.designs[0] : (o.designs as { name: string } | null);
  const tool = TOOLS.find((x) => x.slug === o.tool_slug)?.name ?? o.tool_slug;
  const summary = `Order #${orderNo(o.id)} · ${tool}${d?.name ? ` · “${d.name}”` : ''} · ${date(o.paid_at ?? o.created_at)}`;
  return (
    <Shell>
      <OrderFeedbackForm orderId={o.id} token={t} summary={summary} again={Boolean(fb)}
        initial={{ rating: rating || fb?.rating || 0, message: fb?.message ?? '' }} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="ofb"><div className="ofb-card">{children}</div></main>;
}
function Gone() {
  return (
    <>
      <p className="eyebrow">Order feedback</p>
      <h1>This link does not work</h1>
      <p className="muted">It may have been copied only in part. Open the link in your order email again, or <Link href="/">tell us from the website</Link>.</p>
    </>
  );
}
