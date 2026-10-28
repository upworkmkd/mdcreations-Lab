'use client';
import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AuthDialog } from '@/components/auth-dialog';
import { supabaseBrowser } from '@/lib/supabase/client';
import { formatMoney, type Currency } from '@/lib/money';
import { track } from '@/components/tracker';
import { loadCheckout, startPlan } from '@/lib/subscribe.client';
import { PlanChooser, type ChooserPlan, type Choice } from '@/components/maker/plan-chooser';
import { ThankYou } from '@/components/maker/thank-you';
import type { MakerPlan } from '@/components/maker/maker';
import { PrintOrder } from '@/components/print-order';

type Phase = { kind: 'idle' } | { kind: 'working'; text: string } | { kind: 'done'; fileId: string } | { kind: 'error'; text: string; orderId?: string };
type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong.'), { status: r.status, orderId: j.orderId });
  return j as T;
}

export type BuyBoxProps = {
  tool: string; next: string; ready: boolean; getDesign: () => { design: unknown; preview: string } | null;
  currency: Currency; amountMinor: number | null; signedIn: boolean; payConfigured: boolean;
  plan?: MakerPlan | null; plans?: ChooserPlan[]; otherPlan?: boolean; viewerName?: string; reviewed?: boolean;
  doneBlurb?: string; preview?: boolean;   // preview = the tool is not public yet (admins only)
  print?: { priceMinor: number; toolName: string } | null;   // "Order it printed", when the tool has a printed price (India)
};

/** "Get the files": download options, sign-in, Razorpay (one design or a plan), and the thank-you window. */
export function BuyBox({ tool, next, ready, getDesign, currency, amountMinor, signedIn: signedIn0, payConfigured, plan: plan0, plans = [], otherPlan = false, viewerName = '', reviewed = false, doneBlurb, preview, print }: BuyBoxProps) {
  const [thanks, setThanks] = useState<string | null>(null);
  const [askedReview, setAskedReview] = useState(reviewed);
  const [plan, setPlan] = useState<MakerPlan | null>(plan0 ?? null);
  const [chooser, setChooser] = useState(false);
  const choice = useRef<Choice>('single');
  const [signedIn, setSignedIn] = useState(signedIn0);
  const [authOpen, setAuthOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [left, setLeft] = useState<number | null | undefined>(plan0 ? plan0.remaining : undefined);
  const onPlan = plan != null && (left == null || left > 0);
  const finish = (fileId: string) => { setPhase({ kind: 'done', fileId }); setThanks(fileId); };

  const purchase = useCallback(async () => {
    const d = getDesign();
    if (!d) { setPhase({ kind: 'error', text: 'Still building the layers. Try again in a moment.' }); return; }
    try {
      setPhase({ kind: 'working', text: 'Saving your design…' });
      const { id: designId } = await post<{ id: string }>('/api/designs', { tool, design: d.design, preview: d.preview });
      setPhase({ kind: 'working', text: 'Starting the payment…' });
      const co = await post<{ free?: boolean; plan?: boolean; remaining?: number | null; fileId?: string; orderId?: string; keyId: string; providerOrderId: string; amount: number; currency: string; description: string; prefill: { name: string; email: string } }>('/api/checkout', { designId });
      if (co.free && co.fileId) { if (co.plan) setLeft(co.remaining ?? null); finish(co.fileId); return; }
      await loadCheckout();
      const paid = await new Promise<RzpResponse | null>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: co.keyId, order_id: co.providerOrderId, amount: co.amount, currency: co.currency,
          name: 'MD Creations Labs', description: co.description, image: `${location.origin}/brand/mark-dark.svg`,
          prefill: co.prefill, theme: { color: '#424532' },
          handler: (r: RzpResponse) => resolve(r), modal: { ondismiss: () => resolve(null), confirm_close: true },
        });
        rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'The payment failed.')));
        rzp.open();
        setPhase({ kind: 'working', text: 'Waiting for the payment…' });
      });
      track(paid ? 'payment_done' : 'payment_cancelled', paid ? 'Razorpay payment completed' : 'Closed the payment window', { orderId: co.orderId });
      if (!paid) { setPhase({ kind: 'error', text: 'Payment cancelled. Your design is still here; press the button again when you are ready.' }); return; }
      setPhase({ kind: 'working', text: 'Payment received. Building your files…' });
      const v = await post<{ fileId: string }>('/api/payments/verify', paid);
      finish(v.fileId);
    } catch (e) {
      const err = e as Error & { status?: number; orderId?: string };
      track('purchase_error', err.message, { status: err.status, orderId: err.orderId });
      if (err.status === 401) { setSignedIn(false); setPhase({ kind: 'idle' }); setAuthOpen(true); return; }
      setPhase({ kind: 'error', text: err.message, orderId: err.orderId });
    }
  }, [getDesign, tool]);

  const proceed = useCallback(async () => {
    const c = choice.current;
    if (c === 'single') { purchase(); return; }
    const p = plans.find((x) => x.id === c); if (!p) return;
    try {
      const ok = await startPlan({ plan: p.id, planName: p.name, currency, tool: p.tools === 1 ? tool : undefined, onStep: (text) => setPhase({ kind: 'working', text }) });
      if (!ok) { setPhase({ kind: 'error', text: 'Payment window closed. Nothing was charged; your design is still here.' }); return; }
      setPlan({ name: p.name, remaining: p.limit, limit: p.limit }); setLeft(p.limit);
      setPhase({ kind: 'working', text: 'Plan started. Building your files…' });
      purchase();
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401) { setSignedIn(false); setPhase({ kind: 'idle' }); setAuthOpen(true); return; }
      setPhase({ kind: 'error', text: err.message });
    }
  }, [plans, currency, purchase, tool]);

  const ensureSignedIn = useCallback(async () => {
    if (signedIn) return true;
    const { data } = await supabaseBrowser().auth.getUser().catch(() => ({ data: { user: null } }));
    if (!data.user) { setAuthOpen(true); return false; }
    setSignedIn(true); return true;
  }, [signedIn]);

  const onBuy = useCallback(async () => {
    if (plan || preview) { choice.current = 'single'; if (await ensureSignedIn()) purchase(); return; }
    track('chooser_open', 'Download options');
    setChooser(true);
  }, [plan, preview, ensureSignedIn, purchase]);

  const onChoose = useCallback(async (c: Choice) => {
    choice.current = c; setChooser(false);
    track('chooser_pick', c === 'single' ? 'Just this design' : `${c} plan`);
    if (await ensureSignedIn()) proceed();
  }, [ensureSignedIn, proceed]);

  const price = amountMinor != null ? formatMoney(amountMinor, currency) : null;
  const working = phase.kind === 'working';

  return (
    <div className="buy-slot">
      {phase.kind === 'done' ? (
        <div className="done">
          <p className="serif">Your files are ready.</p>
          <a className="btn" href={`/api/files/${phase.fileId}/download`}>Download the zip <span className="arrow">↓</span></a>
          <p className="hint">Saved in <Link href="/account">your account</Link> to download again any time.</p>
          <button type="button" className="linkish" onClick={() => setPhase({ kind: 'idle' })}>Make another version</button>
        </div>
      ) : (
        <>
          <button type="button" className="btn buybtn" onClick={onBuy} disabled={!ready || working || (!onPlan && !preview && !payConfigured)}>
            {working ? phase.text : !ready ? 'Building the layers…' : preview ? <>Download <span className="mono">admin preview</span></> : onPlan ? <>Download <span className="mono">in your {plan!.name} plan</span></> : plan ? <>Buy and download <span className="mono">{price}</span></> : <>Download <span className="mono">{price ? `from ${price}` : 'choose an option'}</span></>}
          </button>
          {preview ? <p className="note">Admin preview: this tool is not live yet, so only you can download. It is free for your account.</p>
            : onPlan ? <p className="note ok">{left == null ? 'Unlimited designs on your plan.' : `${left} of ${plan!.limit} plan designs left today.`}</p>
            : plan ? <p className="note">You have used today&apos;s {plan.limit} plan designs. This one is charged separately, or come back after midnight (India time).</p>
            : !payConfigured ? <p className="note">Payments are being set up. Please check back soon.</p>
            : amountMinor == null ? <p className="note">This tool is not sold in {currency} yet. Please contact us to buy it.</p> : null}
          {phase.kind === 'error' && <p className="note">{phase.text}{phase.orderId ? <> If you were charged, your files will appear in <Link href="/account">your account</Link> within a few minutes.</> : null}</p>}
          {print && <PrintOrder tool={tool} toolName={print.toolName} next={next} ready={ready && !working} priceMinor={print.priceMinor} signedIn={signedIn} getDesign={getDesign} />}
          <p className="hint">Free to try. {onPlan ? 'Your files stay in your account.' : <>One payment per design, or <Link href="/pricing">a monthly plan</Link>.</>} Every download includes a <Link href="/license">commercial license</Link>.</p>
        </>
      )}
      {/* the windows live on <body>, outside the tool's own styles */}
      {thanks != null && createPortal(<ThankYou open onClose={() => { setThanks(null); setAskedReview(true); }} fileId={thanks} name={viewerName} askReview={!askedReview} blurb={doneBlurb} tool={tool} />, document.body)}
      {chooser && createPortal(<PlanChooser open onClose={() => setChooser(false)} onChoose={onChoose} single={price} plans={plans} otherPlan={otherPlan} />, document.body)}
      {authOpen && createPortal(<AuthDialog open onClose={() => setAuthOpen(false)} onSignedIn={() => { setSignedIn(true); setAuthOpen(false); proceed(); }} next={next} reason="Sign in to buy and download your files. Your design stays right here." />, document.body)}
    </div>
  );
}
