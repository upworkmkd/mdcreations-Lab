'use client';
import { track } from '@/components/tracker';

type RzpSubResponse = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };

export function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('The payment window could not be loaded. Check your connection and try again.'));
    document.head.append(s);
  });
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong.'), { status: r.status });
  return j as T;
}

/**
 * Starts a monthly plan: creates the Razorpay subscription, opens Checkout for the mandate and first payment,
 * then confirms it with the server. Resolves true when the plan is active, false if the window was closed.
 */
export async function startPlan(o: { plan: string; planName: string; currency: string; tool?: string; onStep?: (text: string) => void }): Promise<boolean> {
  o.onStep?.('Starting your plan…');
  const s = await post<{ keyId: string; subscriptionId: string; description: string; prefill: { name: string; email: string } }>('/api/subscriptions', { plan: o.plan, currency: o.currency, tool: o.tool });
  await loadCheckout();
  o.onStep?.('Waiting for the payment…');
  const paid = await new Promise<RzpSubResponse | null>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: s.keyId, subscription_id: s.subscriptionId, name: 'MD Creations Labs', description: s.description,
      image: `${location.origin}/brand/mark-dark.svg`, prefill: s.prefill, theme: { color: '#424532' },
      handler: (r: RzpSubResponse) => resolve(r), modal: { ondismiss: () => resolve(null), confirm_close: true },
    });
    rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'The payment failed.')));
    rzp.open();
  });
  if (!paid) { track('subscribe_cancelled', `${o.planName} plan`); return false; }
  o.onStep?.('Opening your plan…');
  await post('/api/subscriptions/verify', paid);
  return true;
}
