import 'server-only';
import { cookies } from 'next/headers';
import { CONSENT_COOKIE, NOTRACK_COOKIE } from '@/lib/consent';
import { GA_QUEUE_COOKIE } from '@/lib/ga';

/**
 * Hands an event that happens on the server (sign-up, checkout, payment …) to Google Analytics in the browser: it is
 * put in a short-lived cookie that the page reads and sends with its own GA session, so the event lands in the right
 * visit and campaign. Only for visitors who accepted analytics; never throws.
 */
export async function gaLater(name: string, params: Record<string, unknown> = {}) {
  try {
    const jar = await cookies();
    if (jar.get(CONSENT_COOKIE)?.value !== 'all' || jar.get(NOTRACK_COOKIE)) return;
    let list: [string, Record<string, unknown>][] = [];
    try { const v = jar.get(GA_QUEUE_COOKIE)?.value; if (v) list = JSON.parse(decodeURIComponent(v)); } catch { list = []; }
    list = [...(Array.isArray(list) ? list : []), [name, params] as [string, Record<string, unknown>]].slice(-6);
    let value = encodeURIComponent(JSON.stringify(list));
    while (value.length > 3500 && list.length > 1) { list.shift(); value = encodeURIComponent(JSON.stringify(list)); }
    jar.set(GA_QUEUE_COOKIE, value, { path: '/', maxAge: 900, sameSite: 'lax', httpOnly: false, secure: process.env.NODE_ENV === 'production' });
  } catch { /* outside a request (webhooks, background work): nothing to hand over */ }
}

const money = (minor: unknown) => (typeof minor === 'number' ? Math.round(minor) / 100 : undefined);
const kindOf = (k: unknown) => (k === 'print' ? 'printed' : k === 'stl' || k === 'download' ? String(k) : 'download');

/** Our server-side event names (trackServer) → GA events. */
export async function gaFromServer(type: string, name: string | undefined, p: Record<string, unknown> = {}) {
  // STL shop files are their own kind; printed orders (designs or shop products) are 'printed'
  const kind = p.tool === 'stl' && p.kind !== 'print' ? 'stl' : kindOf(p.kind);
  const item = (cat: string) => ({ item_id: String(p.tool ?? p.plan ?? 'design'), item_name: String(name ?? '').replace(/^(Printed|STL): /, '').slice(0, 100), item_category: cat });
  switch (type) {
    case 'signup': return gaLater('sign_up', { method: 'email' });
    case 'signin': return gaLater('login', { method: 'password' });
    case 'link_signin': return gaLater('login', { method: 'email_link' });
    case 'email_confirmed': return gaLater('email_confirmed', {});
    case 'checkout': return gaLater('begin_checkout', { currency: p.currency, value: money(p.amount), order_kind: kind, items: [item(kind)] });
    case 'payment': return gaLater('purchase', { transaction_id: p.orderId, currency: p.currency, value: money(p.amount), order_kind: kind, items: [{ ...item(kind), price: money(p.amount), quantity: 1 }] });
    case 'subscribe_start': return gaLater('begin_checkout', { currency: p.currency, value: money(p.amount), order_kind: 'plan', plan: p.plan, items: [{ item_id: `plan-${p.plan}`, item_name: name, item_category: 'plan' }] });
    case 'subscribed': return gaLater('purchase', { transaction_id: p.paymentId, currency: p.currency, value: money(p.amount), order_kind: 'plan', plan: p.plan, items: [{ item_id: `plan-${p.plan}`, item_name: name, item_category: 'plan', price: money(p.amount), quantity: 1 }] });
    case 'plan_build': return gaLater('plan_design', { plan: p.plan, item_name: name });
    case 'design_saved': return gaLater('save_design', { tool: p.tool, item_name: name });
    case 'download': return gaLater('download_files', { item_name: name });
    case 'review': return gaLater('post_review', { rating: p.rating });
    case 'feedback': return gaLater('send_feedback', { rating: p.rating });
    case 'subscription_cancel': return gaLater('cancel_plan', { item_name: name });
  }
}
