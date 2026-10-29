import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseConfigured } from '@/lib/env';
import { UUID_RE } from '@/lib/consent';
import { TOOLS } from '@/lib/tools';
import { reviewContext, reviewTokenOk } from '@/lib/review-request.server';
import { ReviewByLink } from './form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'How did it turn out?', robots: { index: false, follow: false } };

/* Opened from a review-request email. The link is signed for one order, so no sign-in is needed. */
export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params, sp = await searchParams;
  const t = typeof sp.t === 'string' ? sp.t : '', r = Number(sp.r) || 0;
  const ctx = UUID_RE.test(id) && reviewTokenOk(id, t) && supabaseConfigured() ? await reviewContext(id) : null;
  if (!ctx) {
    return (
      <main className="ofb"><div className="ofb-card">
        <p className="eyebrow">Review</p><h1>This link does not work</h1>
        <p className="muted">It may have been copied only in part. Open it from the email again, or write a review from <Link href="/account#review">your account</Link>.</p>
      </div></main>
    );
  }
  const tool = TOOLS.find((x) => x.slug === ctx.order.tool_slug);
  return (
    <main className="rv-page">
      <ReviewByLink orderId={id} token={t} stars={r >= 1 && r <= 5 ? r : 0}
        design={{ name: ctx.design?.name ?? 'Your design', preview: ctx.design?.preview ?? null, tool: tool?.name ?? ctx.order.tool_slug, printed: ctx.order.kind === 'print' }}
        defaultName={ctx.who?.full_name ?? ''} existing={ctx.review} photos={ctx.photos} />
    </main>
  );
}
