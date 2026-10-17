import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env';

const API = 'https://api.razorpay.com/v1';

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
