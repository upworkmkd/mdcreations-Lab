import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { UUID_RE } from '@/lib/consent';
import { planTokenOk } from '@/lib/subscription-mail.server';
import { OrderFeedbackForm } from '../../order/[id]/form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'How is your plan working for you?', robots: { index: false, follow: false } };

/* Opened from the faces in the plan welcome email. The link carries a signed token, so no sign-in is needed. */
export default async function PlanFeedback({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params, sp = await searchParams;
  const t = typeof sp.t === 'string' ? sp.t : '', r = Number(sp.r) || 0;
  const shell = (c: React.ReactNode) => <main className="ofb"><div className="ofb-card">{c}</div></main>;
  if (!UUID_RE.test(id) || !planTokenOk(id, t) || !supabaseConfigured()) return shell(
    <><p className="eyebrow">Plan feedback</p><h1>This link does not work</h1><p className="muted">Open the link in your plan email again, or <Link href="/">tell us from the website</Link>.</p></>,
  );
  const db = supabaseAdmin();
  const [{ data: s }, { data: fb }] = await Promise.all([
    db.from('subscriptions').select('id, plan_id, created_at, plans(name)').eq('id', id).maybeSingle(),
    db.from('feedback').select('rating, message').eq('subscription_id', id).maybeSingle(),
  ]);
  const plan = s ? ((Array.isArray(s.plans) ? s.plans[0] : s.plans) as { name: string } | null)?.name ?? s.plan_id : 'Your plan';
  const since = s ? new Date(s.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return shell(
    <OrderFeedbackForm kind="plan" orderId={id} token={t} summary={`${plan} plan · since ${since}`} again={Boolean(fb)}
      initial={{ rating: r >= 1 && r <= 5 ? r : fb?.rating ?? 0, message: fb?.message ?? '' }} />,
  );
}
