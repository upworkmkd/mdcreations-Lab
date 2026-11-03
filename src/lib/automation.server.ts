import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { followupDraft, sendFollowup, type FollowKind } from '@/lib/followup.server';

/* Automatic emails, run once a day (Vercel cron → /api/cron/emails) or by hand from Admin → Settings:
 *  - review request: some days after a completed order (download built, or print delivered)
 *  - follow-up: some days after an order that was not paid, or a plan that was started but not paid
 * Each order or plan gets each email at most once, whether it went out by hand or automatically, and nobody gets
 * more than one email of a kind per run. Only orders from the last two weeks before the due day are looked at,
 * so switching it on does not email old customers. */

export type Automation = {
  review: { on: boolean; daysDownload: number; daysPrint: number };
  unpaidOrder: { on: boolean; days: number };
  unpaidPlan: { on: boolean; days: number };
  signer: string;   // the first name the emails are signed with
};
export const DEFAULT_AUTOMATION: Automation = { review: { on: false, daysDownload: 5, daysPrint: 3 }, unpaidOrder: { on: false, days: 2 }, unpaidPlan: { on: false, days: 2 }, signer: '' };
const WINDOW_DAYS = 14, PER_RUN = 40;
const clampDays = (n: unknown, d: number) => { const v = Math.round(Number(n)); return Number.isFinite(v) && v >= 1 && v <= 60 ? v : d; };

export async function getAutomation(): Promise<Automation> {
  const { data } = await supabaseAdmin().from('site_settings').select('value').eq('key', 'automation').maybeSingle();
  const v = (data?.value ?? {}) as Partial<Automation>;
  return {
    review: { on: Boolean(v.review?.on), daysDownload: clampDays(v.review?.daysDownload, 5), daysPrint: clampDays(v.review?.daysPrint, 3) },
    unpaidOrder: { on: Boolean(v.unpaidOrder?.on), days: clampDays(v.unpaidOrder?.days, 2) },
    unpaidPlan: { on: Boolean(v.unpaidPlan?.on), days: clampDays(v.unpaidPlan?.days, 2) },
    signer: typeof v.signer === 'string' ? v.signer.slice(0, 40) : '',
  };
}
export const parseAutomation = (f: FormData): Automation => ({
  review: { on: f.get('review_on') === 'on', daysDownload: clampDays(f.get('review_days_download'), 5), daysPrint: clampDays(f.get('review_days_print'), 3) },
  unpaidOrder: { on: f.get('order_on') === 'on', days: clampDays(f.get('order_days'), 2) },
  unpaidPlan: { on: f.get('plan_on') === 'on', days: clampDays(f.get('plan_days'), 2) },
  signer: String(f.get('signer') ?? '').trim().slice(0, 40),
});

const ago = (days: number, now: number) => new Date(now - days * 86400_000).toISOString();
type Due = { kind: FollowKind; id: string; userId: string; label: string };

/** Who is due today, without sending anything. */
export async function dueEmails(a: Automation, now = Date.now()): Promise<Due[]> {
  const db = supabaseAdmin();
  const out: Due[] = [];
  const sentFor = async (kind: string, col: 'order_id' | 'subscription_id', ids: string[]) => {
    if (!ids.length) return new Set<string>();
    const { data } = await db.from('email_log').select(col).eq('kind', kind).in(col, ids);
    return new Set((data ?? []).map((r) => (r as Record<string, string>)[col]));
  };

  if (a.review.on) {
    const [dl, pr] = await Promise.all([
      db.from('orders').select('id, user_id, fulfilled_at').eq('status', 'fulfilled').neq('kind', 'print').neq('provider', 'admin')
        .lte('fulfilled_at', ago(a.review.daysDownload, now)).gte('fulfilled_at', ago(a.review.daysDownload + WINDOW_DAYS, now)).limit(500),
      db.from('orders').select('id, user_id, delivered_at').eq('kind', 'print').eq('print_status', 'delivered').neq('provider', 'admin')
        .lte('delivered_at', ago(a.review.daysPrint, now)).gte('delivered_at', ago(a.review.daysPrint + WINDOW_DAYS, now)).limit(500),
    ]);
    const rows = [...(dl.data ?? []).map((o) => ({ ...o, print: false })), ...(pr.data ?? []).map((o) => ({ ...o, print: true }))];
    const asked = await sentFor('review_request', 'order_id', rows.map((r) => r.id));
    const users = [...new Set(rows.map((r) => r.user_id))];
    // someone who already wrote a review, or was asked in the last 60 days, is not asked again
    const [{ data: reviewed }, { data: recent }] = users.length ? await Promise.all([
      db.from('testimonials').select('user_id').in('user_id', users).eq('source', 'site'),
      db.from('email_log').select('user_id').eq('kind', 'review_request').in('user_id', users).gte('created_at', ago(60, now)),
    ]) : [{ data: [] }, { data: [] }];
    const skip = new Set([...(reviewed ?? []).map((r) => r.user_id), ...(recent ?? []).map((r) => r.user_id)]);
    for (const r of rows) {
      if (asked.has(r.id) || skip.has(r.user_id)) continue;
      skip.add(r.user_id);
      out.push({ kind: 'review', id: r.id, userId: r.user_id, label: r.print ? 'review (printed order)' : 'review (download)' });
    }
  }

  if (a.unpaidOrder.on) {
    const { data: rows } = await db.from('orders').select('id, user_id, created_at').in('status', ['created', 'failed']).eq('provider', 'razorpay')
      .lte('created_at', ago(a.unpaidOrder.days, now)).gte('created_at', ago(a.unpaidOrder.days + WINDOW_DAYS, now)).order('created_at', { ascending: false }).limit(500);
    const list = rows ?? [];
    const done = await sentFor('followup_order', 'order_id', list.map((r) => r.id));
    const users = [...new Set(list.map((r) => r.user_id))];
    const [{ data: paidLater }, { data: recent }] = users.length ? await Promise.all([
      db.from('orders').select('user_id, created_at').in('user_id', users).in('status', ['paid', 'fulfilled']).neq('provider', 'admin').gte('created_at', ago(a.unpaidOrder.days + WINDOW_DAYS, now)),
      db.from('email_log').select('user_id').eq('kind', 'followup_order').in('user_id', users).gte('created_at', ago(14, now)),
    ]) : [{ data: [] }, { data: [] }];
    const skip = new Set((recent ?? []).map((r) => r.user_id));
    for (const r of list) {
      // they came back and paid (for anything) after this one: no need to ask
      if (done.has(r.id) || skip.has(r.user_id) || (paidLater ?? []).some((p) => p.user_id === r.user_id && p.created_at > r.created_at)) continue;
      skip.add(r.user_id);
      out.push({ kind: 'order', id: r.id, userId: r.user_id, label: 'unpaid order' });
    }
  }

  if (a.unpaidPlan.on) {
    const { data: rows } = await db.from('subscriptions').select('id, user_id, created_at').eq('status', 'created')
      .lte('created_at', ago(a.unpaidPlan.days, now)).gte('created_at', ago(a.unpaidPlan.days + WINDOW_DAYS, now)).order('created_at', { ascending: false }).limit(500);
    const list = rows ?? [];
    const done = await sentFor('followup_subscription', 'subscription_id', list.map((r) => r.id));
    const users = [...new Set(list.map((r) => r.user_id))];
    const { data: onPlan } = users.length ? await db.from('subscriptions').select('user_id').in('user_id', users).in('status', ['active', 'authenticated', 'pending']) : { data: [] };
    const skip = new Set((onPlan ?? []).map((r) => r.user_id));
    for (const r of list) {
      if (done.has(r.id) || skip.has(r.user_id)) continue;
      skip.add(r.user_id);
      out.push({ kind: 'subscription', id: r.id, userId: r.user_id, label: 'unfinished plan' });
    }
  }
  return out;
}

export type RunResult = { at: string; sent: number; failed: number; byKind: Record<string, number>; errors: string[]; dry?: boolean; due?: { label: string; to: string; ref: string }[] };

/** Sends what is due (or, with dry, only lists it). Records the result for the Settings page. */
export async function runAutomation(o: { dry?: boolean; trigger: 'cron' | 'admin' } = { trigger: 'cron' }): Promise<RunResult> {
  const a = await getAutomation();
  const due = await dueEmails(a);
  const res: RunResult = { at: new Date().toISOString(), sent: 0, failed: 0, byKind: {}, errors: [], dry: o.dry };
  const counts: Record<string, number> = {};
  if (o.dry) {
    res.due = [];
    for (const d of due.slice(0, 100)) {
      const draft = await followupDraft(d.kind, d.id, a.signer);
      if (draft) res.due.push({ label: d.label, to: draft.to, ref: draft.ref });
    }
    return res;
  }
  for (const d of due) {
    counts[d.kind] = (counts[d.kind] ?? 0) + 1;
    if (counts[d.kind] > PER_RUN) continue;   // the rest go out tomorrow
    const draft = await followupDraft(d.kind, d.id, a.signer);
    if (!draft) continue;
    const r = await sendFollowup(d.kind, d.id, draft.subject, draft.body, null, { auto: true });
    if (r.ok) { res.sent++; res.byKind[d.label] = (res.byKind[d.label] ?? 0) + 1; } else { res.failed++; if (!('skipped' in r && r.skipped)) res.errors.push(`${draft.to}: ${r.error}`); }
  }
  await supabaseAdmin().from('site_settings').upsert({ key: 'automation_last', value: { ...res, trigger: o.trigger }, updated_at: new Date().toISOString() });
  return res;
}

export async function lastRun(): Promise<(RunResult & { trigger?: string }) | null> {
  const { data } = await supabaseAdmin().from('site_settings').select('value').eq('key', 'automation_last').maybeSingle();
  return (data?.value as RunResult & { trigger?: string }) ?? null;
}
