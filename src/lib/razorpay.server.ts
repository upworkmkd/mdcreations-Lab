import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

const API = process.env.RAZORPAY_API_URL ?? 'https://api.razorpay.com/v1';   // overridable for local tests

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const auth = Buffer.from(`${serverEnv('RAZORPAY_KEY_ID')}:${serverEnv('RAZORPAY_KEY_SECRET')}`).toString('base64');
  const res = await fetch(API + path, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { description?: string } }).error?.description ?? `Razorpay error ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export type RzpOrder = { id: string; amount: number; currency: string; status: string; receipt: string };
export type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; method?: string; email?: string };

export const createOrder = (amount: number, currency: string, receipt: string, notes: Record<string, string>) =>
  call<RzpOrder>('/orders', { method: 'POST', body: { amount, currency, receipt, notes } });

export const fetchPayment = (id: string) => call<RzpPayment>(`/payments/${encodeURIComponent(id)}`);

export const capturePayment = (id: string, amount: number, currency: string) =>
  call<RzpPayment>(`/payments/${encodeURIComponent(id)}/capture`, { method: 'POST', body: { amount, currency } });

/* ------------------------------------------------------------------ subscriptions */
export type RzpPlan = { id: string; period: string; interval: number; item: { amount: number; currency: string; name: string } };
export type RzpSubscription = {
  id: string; plan_id: string; status: string; current_start: number | null; current_end: number | null;
  charge_at: number | null; paid_count: number; total_count: number; short_url?: string; notes?: Record<string, string>;
  ended_at?: number | null;
};

/** A monthly plan. Razorpay plans cannot change price, so a new price means a new plan. */
export const createPlan = (amount: number, currency: string, name: string, description: string) =>
  call<RzpPlan>('/plans', { method: 'POST', body: { period: 'monthly', interval: 1, item: { name, amount, currency, description }, notes: { app: 'mdcreations-labs' } } });

/** 120 monthly cycles = it renews for up to ten years until cancelled. */
export const createSubscription = (planId: string, notes: Record<string, string>) =>
  call<RzpSubscription>('/subscriptions', { method: 'POST', body: { plan_id: planId, total_count: 120, quantity: 1, customer_notify: 1, notes } });

export const fetchSubscription = (id: string) => call<RzpSubscription>(`/subscriptions/${encodeURIComponent(id)}`);

export const cancelSubscription = (id: string, atCycleEnd: boolean) =>
  call<RzpSubscription>(`/subscriptions/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: { cancel_at_cycle_end: atCycleEnd ? 1 : 0 } });

/** Subscription checkout success: signature = HMAC_SHA256(payment_id + "|" + subscription_id, key_secret). */
export function verifySubscriptionSignature(paymentId: string, subscriptionId: string, signature: string, secret = serverEnv('RAZORPAY_KEY_SECRET')) {
  const expected = createHmac('sha256', secret).update(`${paymentId}|${subscriptionId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, 'utf8'), y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = serverEnv('RAZORPAY_KEY_SECRET')) {
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Webhooks: signature = HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = serverEnv('RAZORPAY_WEBHOOK_SECRET')) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
