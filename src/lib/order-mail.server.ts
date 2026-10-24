import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SITE_URL, SOCIALS, SUPPORT_EMAIL } from '@/lib/env';
import { TOOLS } from '@/lib/tools';
import { formatMoney, isCurrency } from '@/lib/money';
import { sendMail, type MailResult } from '@/lib/mail.server';
import { adminOrderEmail, customerOrderEmail, type OrderMailData } from '@/lib/emails/order-emails';

/* ------------------------------------------------------------------ settings (Admin → Settings) */
export type EmailSettings = { customer: boolean; admin: boolean; notify: string[] };
export const DEFAULT_EMAIL_SETTINGS: EmailSettings = { customer: true, admin: true, notify: [] };
export const EMAIL_RE = /^[^\s@,;<>]{1,64}@[^\s@,;<>]{1,100}\.[^\s@,;<>]{2,24}$/;

export async function getEmailSettings(): Promise<EmailSettings> {
  const { data } = await supabaseAdmin().from('site_settings').select('value').eq('key', 'emails').maybeSingle();
  const v = (data?.value ?? {}) as Partial<EmailSettings>;
  return {
    customer: v.customer !== false,
    admin: v.admin !== false,
    notify: Array.isArray(v.notify) ? v.notify.filter((e): e is string => typeof e === 'string' && EMAIL_RE.test(e)) : [],
  };
}

/* ------------------------------------------------------------------ the feedback link in the email */
const secret = () => process.env.FEEDBACK_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'mdl-dev-feedback';
export const orderToken = (orderId: string) => createHmac('sha256', secret()).update(`order-feedback:${orderId}`).digest('base64url').slice(0, 32);
export function orderTokenOk(orderId: string, t: unknown) {
  if (typeof t !== 'string') return false;
  const want = Buffer.from(orderToken(orderId)), got = Buffer.from(t);
  return want.length === got.length && timingSafeEqual(want, got);
}
export const orderFeedbackUrl = (orderId: string, rating?: number) =>
  `${SITE_URL}/feedback/order/${orderId}?t=${orderToken(orderId)}${rating ? `&r=${rating}` : ''}`;

/* ------------------------------------------------------------------ what goes into the emails */
export async function orderMailData(orderId: string): Promise<OrderMailData | null> {
  const db = supabaseAdmin();
  const { data: o } = await db.from('orders').select('id, user_id, design_id, tool_slug, currency, amount_minor, provider, subscription_id, created_at, paid_at').eq('id', orderId).maybeSingle();
  if (!o) return null;
  const [{ data: who }, { data: design }, { data: pay }, sub] = await Promise.all([
    db.from('profiles').select('email, full_name').eq('id', o.user_id).maybeSingle(),
    db.from('designs').select('name').eq('id', o.design_id).maybeSingle(),
    db.from('payments').select('provider_payment_id, method').eq('order_id', o.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    o.subscription_id ? db.from('subscriptions').select('plan_id, plans(name)').eq('id', o.subscription_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!who?.email) return null;
  const plan = sub.data as { plan_id?: string; plans?: { name?: string } | { name?: string }[] | null } | null;
  const planName = plan ? (Array.isArray(plan.plans) ? plan.plans[0]?.name : plan.plans?.name) ?? plan.plan_id ?? null : null;
  const how: OrderMailData['how'] = o.provider === 'plan' ? 'plan' : o.provider === 'admin' ? 'admin' : o.amount_minor > 0 ? 'razorpay' : 'free';
  return {
    orderId: o.id, createdAt: o.paid_at ?? o.created_at, userId: o.user_id,
    customerName: who.full_name ?? '', customerEmail: who.email,
    toolSlug: o.tool_slug, toolName: TOOLS.find((t) => t.slug === o.tool_slug)?.name ?? o.tool_slug,
    designName: design?.name || 'Your design',
    amount: o.amount_minor > 0 && isCurrency(o.currency) ? formatMoney(o.amount_minor, o.currency) : '',
    how, planName, method: pay?.method ?? null, paymentId: pay?.provider_payment_id ?? null,
    siteUrl: SITE_URL, supportEmail: SUPPORT_EMAIL, socials: SOCIALS,
    feedbackUrl: (r?: number) => orderFeedbackUrl(o.id, r),
  };
}

/** A made-up order for the previews and the test button on the Settings page. */
export function sampleMailData(email: string, name: string): OrderMailData {
  const id = '3f9c2a71-0000-4000-8000-000000000000';
  return {
    orderId: id, createdAt: new Date().toISOString(), userId: '00000000-0000-0000-0000-000000000000',
    customerName: name || 'Asha Verma', customerEmail: email || 'asha@example.com',
    toolSlug: 'lithophane', toolName: TOOLS.find((t) => t.slug === 'lithophane')?.name ?? 'Lithophane', designName: 'Grandma’s 80th',
    amount: formatMoney(29900, 'INR'), how: 'razorpay', method: 'upi', paymentId: 'pay_TEST1234567890',
    siteUrl: SITE_URL, supportEmail: SUPPORT_EMAIL, socials: SOCIALS,
    feedbackUrl: (r?: number) => `${SITE_URL}/feedback/order/sample${r ? `?r=${r}` : ''}`,
  };
}

/* ------------------------------------------------------------------ sending */
async function log(kind: 'order_customer' | 'order_admin' | 'test', to: string[], subject: string, orderId: string | null, r: MailResult) {
  await supabaseAdmin().from('email_log').insert({
    kind, to_email: to.join(', ').slice(0, 600), subject: subject.slice(0, 300), order_id: orderId,
    status: r.ok ? 'sent' : r.skipped ? 'skipped' : 'failed', error: r.ok ? null : r.error.slice(0, 500), provider_id: r.ok ? r.id : null,
  });
}

/** Claims the order's "emailed" mark, so the browser and the Razorpay webhook never send the same email twice. */
async function claim(orderId: string, col: 'customer_emailed_at' | 'admin_notified_at') {
  const { data } = await supabaseAdmin().from('orders').update({ [col]: new Date().toISOString() }).eq('id', orderId).is(col, null).select('id');
  return Boolean(data?.length);
}
const release = (orderId: string, col: 'customer_emailed_at' | 'admin_notified_at') =>
  supabaseAdmin().from('orders').update({ [col]: null }).eq('id', orderId);

/**
 * Emails the customer their receipt and the shop a "new order" note, once each, after the files are built.
 * Never throws: an email problem must not fail an order that is already paid. Problems show in Admin → Settings.
 */
export async function sendOrderEmails(orderId: string) {
  try {
    const [settings, d] = await Promise.all([getEmailSettings(), orderMailData(orderId)]);
    if (!d) return;
    if (settings.customer && (await claim(orderId, 'customer_emailed_at'))) {
      const m = customerOrderEmail(d);
      const r = await sendMail({ to: d.customerEmail, ...m });
      await log('order_customer', [d.customerEmail], m.subject, orderId, r);
      if (!r.ok && !r.skipped) await release(orderId, 'customer_emailed_at');   // try again next time the order is touched
    }
    if (settings.admin && settings.notify.length && (await claim(orderId, 'admin_notified_at'))) {
      const m = adminOrderEmail(d);
      const r = await sendMail({ to: settings.notify, ...m, replyTo: d.customerEmail });
      await log('order_admin', settings.notify, m.subject, orderId, r);
      if (!r.ok && !r.skipped) await release(orderId, 'admin_notified_at');
    }
  } catch (e) {
    console.error('order emails', orderId, e);
  }
}

/** The Settings page's "Send a test" button. */
export async function sendTestEmail(kind: 'customer' | 'admin', to: string[], me: { email: string; name: string }) {
  const d = sampleMailData(me.email, me.name);
  const m = kind === 'customer' ? customerOrderEmail(d) : adminOrderEmail(d);
  const subject = `[Test] ${m.subject}`;
  const r = await sendMail({ to, ...m, subject });
  await log('test', to, subject, null, r);
  return r;
}
