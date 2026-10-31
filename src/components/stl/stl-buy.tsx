'use client';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AuthDialog } from '@/components/auth-dialog';
import { PrintOrder } from '@/components/print-order';
import { supabaseBrowser } from '@/lib/supabase/client';
import { formatMoney, type Currency } from '@/lib/money';
import { loadCheckout } from '@/lib/subscribe.client';
import { track } from '@/components/tracker';

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type Phase = { kind: 'idle' } | { kind: 'working'; text: string } | { kind: 'done'; fileId: string } | { kind: 'error'; text: string; orderId?: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong.'), { status: r.status, orderId: j.orderId });
  return j as T;
}

/** "Buy now" for the STL files (Razorpay, then the download), and "Order it printed" when the shop offers it. */
export function StlBuy({ productId, title, slug, currency, priceMinor, printPriceMinor, signedIn: signedIn0, payConfigured, ownedFileId, preview }: {
  productId: string; title: string; slug: string; currency: Currency; priceMinor: number | null; printPriceMinor: number | null;
  signedIn: boolean; payConfigured: boolean; ownedFileId: string | null; preview: string;
}) {
  const [phase, setPhase] = useState<Phase>(ownedFileId ? { kind: 'done', fileId: ownedFileId } : { kind: 'idle' });
  const [signedIn, setSignedIn] = useState(signedIn0);
  const [authOpen, setAuthOpen] = useState(false);
  const price = priceMinor == null ? null : priceMinor === 0 ? 'Free' : formatMoney(priceMinor, currency);
  const next = `/stl-files/${slug}`;

  const buy = useCallback(async () => {
    try {
      setPhase({ kind: 'working', text: 'Starting the payment…' });
      track('checkout_start', `STL: ${title}`, { productId });
      const co = await post<{ free?: boolean; owned?: boolean; fileId?: string; orderId: string; keyId: string; providerOrderId: string; amount: number; currency: string; description: string; prefill: Record<string, string> }>(
        '/api/checkout/stl', { productId, mode: 'download' });
      if (co.free && co.fileId) { setPhase({ kind: 'done', fileId: co.fileId }); return; }
      await loadCheckout();
      const paid = await new Promise<RzpResponse | null>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: co.keyId, order_id: co.providerOrderId, amount: co.amount, currency: co.currency,
          name: 'MD Creations', description: co.description, image: `${location.origin}/brand/mark-dark.svg`,
          prefill: co.prefill, theme: { color: '#424532' },
          handler: (r: RzpResponse) => resolve(r), modal: { ondismiss: () => resolve(null), confirm_close: true },
        });
        rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'The payment failed.')));
        rzp.open();
        setPhase({ kind: 'working', text: 'Waiting for the payment…' });
      });
      track(paid ? 'payment_done' : 'payment_cancelled', paid ? 'STL files paid' : 'Closed the payment window', { orderId: co.orderId });
      if (!paid) { setPhase({ kind: 'error', text: 'Payment cancelled. Nothing was charged; press Buy now when you are ready.' }); return; }
      setPhase({ kind: 'working', text: 'Payment received. Getting your files…' });
      const v = await post<{ fileId: string }>('/api/payments/verify', paid);
      setPhase({ kind: 'done', fileId: v.fileId });
    } catch (e) {
      const err = e as Error & { status?: number; orderId?: string };
      track('purchase_error', err.message, { orderId: err.orderId, productId });
      if (err.status === 401) { setSignedIn(false); setPhase({ kind: 'idle' }); setAuthOpen(true); return; }
      setPhase({ kind: 'error', text: err.message, orderId: err.orderId });
    }
  }, [productId, title]);

  const onBuy = useCallback(async () => {
    if (!signedIn) {
      const { data } = await supabaseBrowser().auth.getUser().catch(() => ({ data: { user: null } }));
      if (!data.user) { setAuthOpen(true); return; }
      setSignedIn(true);
    }
    void buy();
  }, [signedIn, buy]);

  const working = phase.kind === 'working';
  return (
    <div className="stl-buy">
      {phase.kind === 'done' ? (
        <div className="stl-owned">
          <p className="serif">Your files are ready.</p>
          <a className="btn" href={`/api/files/${phase.fileId}/download`}>Download the zip <span className="arrow">↓</span></a>
          <p className="hint">Saved in <Link href="/account#files">your account</Link> to download again any time.</p>
        </div>
      ) : price ? (
        <>
          <div className="stl-price"><span className="amount">{price}</span><span className="per">STL files · commercial license</span></div>
          <button type="button" className="btn stl-buybtn" onClick={onBuy} disabled={working || (!payConfigured && priceMinor !== 0)}>
            {working ? phase.text : <>Buy now <span className="arrow">→</span></>}</button>
          {!payConfigured && priceMinor !== 0 && <p className="note">Payments are being set up. Please check back soon.</p>}
        </>
      ) : <p className="note">The files are not sold in {currency} yet. Write to us and we will help.</p>}
      {phase.kind === 'error' && <p className="note">{phase.text}{phase.orderId ? <> If you were charged, your files will appear in <Link href="/account#files">your account</Link> within a few minutes.</> : null}</p>}
      {printPriceMinor != null && (
        <PrintOrder tool="stl" toolName={title} next={next} ready={!working} priceMinor={printPriceMinor} signedIn={signedIn}
          getDesign={() => ({ design: null, preview })} productId={productId} />
      )}
      {authOpen && createPortal(
        <AuthDialog open onClose={() => setAuthOpen(false)} next={next} reason="Sign in to buy the files. They are saved in your account to download again any time."
          onSignedIn={() => { setSignedIn(true); setAuthOpen(false); void buy(); }} />, document.body)}
    </div>
  );
}
