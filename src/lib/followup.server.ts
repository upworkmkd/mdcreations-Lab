import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/env';
import { TOOLS } from '@/lib/tools';
import { formatMoney, isCurrency } from '@/lib/money';
import { replyAddress, sendMail, type MailResult } from '@/lib/mail.server';
import { log } from '@/lib/order-mail.server';
import { noteEmail } from '@/lib/emails/note-email';

/* Follow-ups: a personal email to someone who started an order or a plan and did not finish paying,
 * written in the admin (a ready draft, edited as needed). Plus each customer's email history. */

export type FollowKind = 'order' | 'subscription';
export type Draft = { kind: FollowKind; id: string; to: string; name: string; userId: string; subject: string; body: string; ref: string; tool: string | null };
export type HistoryRow = { id: string; kind: string; subject: string | null; status: string; error: string | null; created_at: string; order_id: string | null; subscription_id: string | null; body: string | null; to_email: string };

const day = (s: string) => new Date(s).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });
const firstName = (n: string) => n.trim().split(/\s+/)[0] || '';

/** The ready-to-send draft for one unpaid order or unfinished plan. */
export async function followupDraft(kind: FollowKind, id: string, signer: string): Promise<Draft | null> {
  const db = supabaseAdmin();
  const sign = `Thanks,\n${firstName(signer) || 'The team'}\nMD Creations`;
  if (kind === 'order') {
    const { data: o } = await db.from('orders').select('id, user_id, tool_slug, currency, amount_minor, kind, created_at, designs(name)').eq('id', id).maybeSingle();
    if (!o) return null;
    const { data: who } = await db.from('profiles').select('email, full_name').eq('id', o.user_id).maybeSingle();
    if (!who?.email) return null;
    const tool = TOOLS.find((t) => t.slug === o.tool_slug);
    const thing = (tool?.name ?? 'design').replace(/\s+(Maker|Generator|Calculator)$/i, '');   // "Shadow Lamp", not "Shadow Lamp Maker"
    const d = Array.isArray(o.designs) ? o.designs[0] : (o.designs as { name: string } | null);
    const what = o.kind === 'print' ? `a printed ${thing}` : `the files for your ${thing} design`;
    const price = o.amount_minor > 0 && isCurrency(o.currency) ? ` (${formatMoney(o.amount_minor, o.currency)})` : '';
    const link = `${SITE_URL}${tool?.makePath ?? `/tools/${o.tool_slug}`}`;
    return {
      kind, id, to: who.email, name: who.full_name ?? '', userId: o.user_id, tool: o.tool_slug, ref: `Order #${o.id.slice(0, 8).toUpperCase()}`,
      subject: o.kind === 'print' ? `Your printed ${thing}: can I help?` : `Your ${thing} design: can I help?`,
      body: [
        `Hi ${firstName(who.full_name ?? '') || 'there'},`,
        `I saw that on ${day(o.created_at)} you started an order for ${what}${d?.name ? ` ("${d.name}")` : ''}${price} on MD Creations Labs, but the payment was not completed.`,
        `Could you tell me what stopped you? Was it the price, the payment page, a question about the files or the print, or something that did not work as expected? Just reply to this email; I read every reply and will help however I can.`,
        `If you would like to finish it, you can pick up here: ${link}`,
        sign,
      ].join('\n\n'),
    };
  }
  const { data: s } = await db.from('subscriptions').select('id, user_id, plan_id, currency, amount_minor, created_at, plans(name)').eq('id', id).maybeSingle();
  if (!s) return null;
  const { data: who } = await db.from('profiles').select('email, full_name').eq('id', s.user_id).maybeSingle();
  if (!who?.email) return null;
  const plan = (Array.isArray(s.plans) ? s.plans[0] : (s.plans as { name: string } | null))?.name ?? s.plan_id;
  const price = isCurrency(s.currency) ? ` (${formatMoney(s.amount_minor, s.currency)} a month)` : '';
  return {
    kind, id, to: who.email, name: who.full_name ?? '', userId: s.user_id, tool: null, ref: `${plan} plan`,
    subject: `Your ${plan} plan: can I help?`,
    body: [
      `Hi ${firstName(who.full_name ?? '') || 'there'},`,
      `I saw that on ${day(s.created_at)} you started the ${plan} plan${price} on MD Creations Labs, but the payment was not completed, so the plan did not start.`,
      `Could you tell me what stopped you? Was it the price, the payment page (some cards and UPI apps do not allow monthly payments), or a question about what the plan includes? Just reply to this email; I read every reply and will help however I can.`,
      `If you would like to try again, the plans are here: ${SITE_URL}/pricing`,
      sign,
    ].join('\n\n'),
  };
}

/** Sends the (edited) follow-up and logs it with its text, so the customer's history shows what was said. */
export async function sendFollowup(kind: FollowKind, id: string, subject: string, body: string, sentBy: string): Promise<MailResult & { to?: string }> {
  const d = await followupDraft(kind, id, '');
  if (!d) return { ok: false, error: 'Customer not found.' };
  const m = noteEmail({ subject, body, siteUrl: SITE_URL, supportEmail: replyAddress() });
  const r = await sendMail({ to: d.to, ...m });
  await log(kind === 'order' ? 'followup_order' : 'followup_subscription', [d.to], subject, kind === 'order' ? id : null, r,
    { userId: d.userId, subscriptionId: kind === 'subscription' ? id : null, body, sentBy });
  return { ...r, to: d.to };
}

/** Every email to this customer: by account, and by address for emails sent before accounts were linked. */
export async function emailHistory(o: { userId?: string | null; email?: string | null; orderId?: string | null; limit?: number }): Promise<HistoryRow[]> {
  const db = supabaseAdmin();
  const or = [o.userId && `user_id.eq.${o.userId}`, o.email && `to_email.ilike.${o.email.replace(/[%,()*]/g, '')}`, o.orderId && `order_id.eq.${o.orderId}`].filter(Boolean).join(',');
  if (!or) return [];
  const { data } = await db.from('email_log').select('id, kind, subject, status, error, created_at, order_id, subscription_id, body, to_email')
    .or(or).not('kind', 'in', '(order_admin,print_admin,sub_admin,test)').order('created_at', { ascending: false }).limit(o.limit ?? 50);
  return (data ?? []) as HistoryRow[];
}

export const KIND_LABEL: Record<string, string> = {
  order_customer: 'Receipt', print_customer: 'Printed order receipt', print_printing: 'Printing started', print_shipped: 'Shipped',
  print_tracking: 'Tracking number', print_delivered: 'Delivered', print_cancelled: 'Cancelled', followup_order: 'Follow-up (order)',
  followup_subscription: 'Follow-up (plan)', sub_welcome: 'Plan welcome', order_admin: 'Order alert', print_admin: 'Print order alert', sub_admin: 'Plan alert', test: 'Test',
};
