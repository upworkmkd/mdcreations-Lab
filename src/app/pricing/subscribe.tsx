'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/components/tracker';

type Tool = { slug: string; name: string; live: boolean };
type RzpSubResponse = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };

function loadCheckout(): Promise<void> {
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

/** Tool picker and Subscribe button for a plan that is open for sign-up. */
export function Subscribe({ plan, planName, currency, tools, pickTool, signedIn, ready, label }: {
  plan: string; planName: string; currency: string; tools: Tool[]; pickTool: boolean; signedIn: boolean; ready: boolean; label: string;
}) {
  const router = useRouter();
  const firstLive = tools.find((t) => t.live)?.slug ?? '';
  const [tool, setTool] = useState(firstLive);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setErr(null);
    if (!signedIn) { router.push(`/login?next=${encodeURIComponent('/pricing')}`); return; }
    try {
      setBusy('Starting…');
      const s = await post<{ keyId: string; subscriptionId: string; description: string; prefill: { name: string; email: string } }>('/api/subscriptions', { plan, currency, tool: pickTool ? tool : undefined });
      await loadCheckout();
      setBusy('Waiting for the payment…');
      const paid = await new Promise<RzpSubResponse | null>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: s.keyId, subscription_id: s.subscriptionId, name: 'MD Creations Labs', description: s.description,
          image: `${location.origin}/brand/mark-dark.svg`, prefill: s.prefill, theme: { color: '#424532' },
          handler: (r: RzpSubResponse) => resolve(r), modal: { ondismiss: () => resolve(null), confirm_close: true },
        });
        rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'The payment failed.')));
        rzp.open();
      });
      if (!paid) { track('subscribe_cancelled', `${planName} plan`); setBusy(null); setErr('Payment window closed. Nothing was charged.'); return; }
      setBusy('Opening your plan…');
      await post('/api/subscriptions/verify', paid);
      router.push('/account?plan=started#plan');
    } catch (e) {
      const er = e as Error & { status?: number };
      if (er.status === 401) { router.push(`/login?next=${encodeURIComponent('/pricing')}`); return; }
      track('subscribe_error', er.message);
      setBusy(null); setErr(er.message);
    }
  };

  return (
    <div className="sub-box">
      {pickTool && (
        <label className="lbl">Your tool
          <select className="input" value={tool} onChange={(e) => setTool(e.target.value)}>
            {tools.map((t) => <option key={t.slug} value={t.slug} disabled={!t.live}>{t.name}{t.live ? '' : ' (coming soon)'}</option>)}
          </select>
        </label>
      )}
      <button type="button" className="btn" onClick={go} disabled={Boolean(busy) || !ready || (pickTool && !tool)}>{busy ?? label}</button>
      {!ready && <p className="msg">This plan opens for {currency} payments soon. Switch the currency at the top, or contact us.</p>}
      {err && <p className="msg err" role="alert">{err}</p>}
    </div>
  );
}
