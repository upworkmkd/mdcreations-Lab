import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { SITE_URL, SOCIALS } from '@/lib/env';
import { TOOLS } from '@/lib/tools';
import { formatMoney, isCurrency } from '@/lib/money';
import { replyAddress, sendMail } from '@/lib/mail.server';
import { getEmailSettings, log } from '@/lib/order-mail.server';
import { subAdminEmail, subWelcomeEmail, type SubMailData } from '@/lib/emails/subscription-emails';

/* The welcome email when a plan starts (what it includes, when it renews, how to manage it, and a one-tap
 * "how is it working for you?"), and a note to the shop. Each goes out once per plan. */

const secret = () => process.env.FEEDBACK_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'mdl-dev-feedback';
export const planToken = (id: string) => createHmac('sha256', secret()).update(`plan-feedback:${id}`).digest('base64url').slice(0, 32);
export function planTokenOk(id: string, t: unknown) {
  if (typeof t !== 'string') return false;
  const want = Buffer.from(planToken(id)), got = Buffer.from(t);
  return want.length === got.length && timingSafeEqual(want, got);
}
export const planFeedbackUrl = (id: string, r?: number) => `${SITE_URL}/feedback/plan/${id}?t=${planToken(id)}${r ? `&r=${r}` : ''}`;

async function subMailData(id: string): Promise<SubMailData | null> {
  const db = supabaseAdmin();
  const { data: s } = await db.from('subscriptions').select('id, user_id, plan_id, tool_slug, currency, amount_minor, status, current_end, created_at, plans(name, tools, daily_limit)').eq('id', id).maybeSingle();
  if (!s) return null;
  const { data: who } = await db.from('profiles').select('email, full_name').eq('id', s.user_id).maybeSingle();
  if (!who?.email) return null;
  const p = (Array.isArray(s.plans) ? s.plans[0] : s.plans) as { name: string; tools: number | null; daily_limit: number | null } | null;
  return {
    id: s.id, userId: s.user_id, customerName: who.full_name ?? '', customerEmail: who.email,
    planName: p?.name ?? s.plan_id, everyTool: p?.tools == null, toolName: s.tool_slug ? TOOLS.find((t) => t.slug === s.tool_slug)?.name ?? s.tool_slug : null,
    dailyLimit: p?.daily_limit ?? null, price: isCurrency(s.currency) ? formatMoney(s.amount_minor, s.currency) : '',
    renews: s.current_end, startedAt: s.created_at, siteUrl: SITE_URL, supportEmail: replyAddress(), socials: SOCIALS,
    toolCount: TOOLS.filter((t) => !t.free && t.status !== 'hidden').length,
    feedbackUrl: (r?: number) => planFeedbackUrl(s.id, r),
  };
}

async function claim(id: string, col: 'welcomed_at' | 'admin_notified_at') {
  const { data } = await supabaseAdmin().from('subscriptions').update({ [col]: new Date().toISOString() }).eq('id', id).is(col, null).select('id');
  return Boolean(data?.length);
}

/** Sends the welcome (and the shop's note) once a plan is paid. Safe to call on every webhook; never throws. */
export async function sendSubscriptionEmails(id: string) {
  try {
    const db = supabaseAdmin();
    const { data: s } = await db.from('subscriptions').select('status, paid_count').eq('id', id).maybeSingle();
    if (!s || !['active', 'authenticated'].includes(s.status)) return;
    const [settings, d] = await Promise.all([getEmailSettings(), subMailData(id)]);
    if (!d) return;
    if (settings.customer && (await claim(id, 'welcomed_at'))) {
      const m = subWelcomeEmail(d);
      const r = await sendMail({ to: d.customerEmail, ...m });
      await log('sub_welcome', [d.customerEmail], m.subject, null, r, { userId: d.userId, subscriptionId: id });
      if (!r.ok && !r.skipped) await db.from('subscriptions').update({ welcomed_at: null }).eq('id', id);
    }
    if (settings.admin && settings.notify.length && (await claim(id, 'admin_notified_at'))) {
      const m = subAdminEmail(d);
      const r = await sendMail({ to: settings.notify, ...m });
      await log('sub_admin', settings.notify, m.subject, null, r, { subscriptionId: id });
      if (!r.ok && !r.skipped) await db.from('subscriptions').update({ admin_notified_at: null }).eq('id', id);
    }
  } catch (e) {
    console.error('subscription emails', id, e);
  }
}

/** After the response, so the browser is not kept waiting. */
export function subscriptionEmailsLater(id: string) {
  try { after(() => sendSubscriptionEmails(id)); } catch { void sendSubscriptionEmails(id); }
}
