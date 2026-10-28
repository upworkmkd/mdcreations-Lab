'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AuthDialog } from '@/components/auth-dialog';
import { supabaseBrowser } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/money';
import { track } from '@/components/tracker';
import { loadCheckout } from '@/lib/subscribe.client';
import { EMPTY_SHIP, IN_STATES, checkShipTo, type ShipTo } from '@/lib/ship';

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type Step = { kind: 'form' } | { kind: 'working'; text: string } | { kind: 'done'; orderId: string } | { kind: 'error'; text: string; orderId?: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong.'), { status: r.status, orderId: j.orderId, fields: j.fields });
  return j as T;
}

export type PrintOrderProps = {
  tool: string; toolName: string; next: string; ready: boolean; priceMinor: number; signedIn: boolean;
  getDesign: () => { design: unknown; preview: string } | null;
};

/**
 * "Order it printed": under the download button on a maker page. The customer gives a shipping address (India),
 * pays the printed price (shipping included) and the shop prints, assembles and posts the design.
 */
export function PrintOrder({ tool, toolName, next, ready, priceMinor, signedIn: signedIn0, getDesign }: PrintOrderProps) {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(signedIn0);
  const [snap, setSnap] = useState<{ design: unknown; preview: string } | null>(null);
  const price = formatMoney(priceMinor, 'INR');

  const start = useCallback(async () => {
    const d = getDesign();
    if (!d) return;
    if (!signedIn) {
      const { data } = await supabaseBrowser().auth.getUser().catch(() => ({ data: { user: null } }));
      if (!data.user) { setAuthOpen(true); return; }
      setSignedIn(true);
    }
    setSnap(d); setOpen(true);
    track('print_open', `Order printed: ${toolName}`);
  }, [getDesign, signedIn, toolName]);

  return (
    <div className="po">
      <div className="po-or"><span>or</span></div>
      <button type="button" className="po-card" onClick={start} disabled={!ready}>
        <span className="po-ic" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 8.5 12 4l9 4.5-9 4.5L3 8.5Zm0 0V16l9 4.5m0-7.5v7.5m9-12V16l-9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        </span>
        <span className="po-t">
          <b>Order it printed</b>
          <span>We print it, put it together and post it to you. India only.</span>
        </span>
        <span className="po-p mono">{price}<small>shipping incl.</small></span>
      </button>
      {open && snap && createPortal(<PrintDialog onClose={() => setOpen(false)} tool={tool} toolName={toolName} price={price} snap={snap} />, document.body)}
      {authOpen && createPortal(
        <AuthDialog open onClose={() => setAuthOpen(false)} next={next} reason="Sign in to order a printed piece. Your design stays right here."
          onSignedIn={() => { setSignedIn(true); setAuthOpen(false); const d = getDesign(); if (d) { setSnap(d); setOpen(true); } }} />, document.body)}
    </div>
  );
}

function PrintDialog({ onClose, tool, toolName, price, snap }: { onClose(): void; tool: string; toolName: string; price: string; snap: { design: unknown; preview: string } }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [ship, setShip] = useState<ShipTo>(EMPTY_SHIP);
  const [errors, setErrors] = useState<Partial<Record<keyof ShipTo, string>>>({});
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const working = step.kind === 'working';
  const touched = useRef(false);   // the saved address only fills an untouched form

  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  // the last address this customer used
  useEffect(() => {
    let live = true;
    fetch('/api/checkout/print', { cache: 'no-store' }).then((r) => r.json()).then((j: { shipTo?: ShipTo | null; name?: string }) => {
      if (!live) return;
      if (touched.current) return;
      setShip(j.shipTo ? { ...EMPTY_SHIP, ...j.shipTo, country: 'IN' } : { ...EMPTY_SHIP, name: j.name ?? '' });
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  const set = (k: keyof ShipTo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    touched.current = true;
    const v = e.target.value; setShip((s) => ({ ...s, [k]: v })); if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = checkShipTo(ship);
    if (!c.ok) { setErrors(c.errors); ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); return; }
    try {
      setStep({ kind: 'working', text: 'Saving your design…' });
      const { id: designId } = await post<{ id: string }>('/api/designs', { tool, design: snap.design, preview: snap.preview });
      setStep({ kind: 'working', text: 'Starting the payment…' });
      const co = await post<{ free?: boolean; orderId: string; keyId: string; providerOrderId: string; amount: number; currency: string; description: string; prefill: Record<string, string> }>(
        '/api/checkout/print', { designId, shipTo: c.value });
      if (co.free) { setStep({ kind: 'done', orderId: co.orderId }); return; }
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
        setStep({ kind: 'working', text: 'Waiting for the payment…' });
      });
      track(paid ? 'payment_done' : 'payment_cancelled', paid ? 'Printed order paid' : 'Closed the payment window', { orderId: co.orderId, kind: 'print' });
      if (!paid) { setStep({ kind: 'error', text: 'Payment cancelled. Nothing was charged; press Pay again when you are ready.' }); return; }
      setStep({ kind: 'working', text: 'Payment received. Placing your order…' });
      const v = await post<{ orderId: string }>('/api/payments/verify', paid);
      setStep({ kind: 'done', orderId: v.orderId });
    } catch (err) {
      const x = err as Error & { orderId?: string; fields?: Partial<Record<keyof ShipTo, string>> };
      if (x.fields) setErrors(x.fields);
      track('purchase_error', x.message, { orderId: x.orderId, kind: 'print' });
      setStep({ kind: 'error', text: x.message, orderId: x.orderId });
    }
  };

  const field = (k: keyof ShipTo, lab: string, input: React.ReactNode, wide = false) => (
    <label className={`po-f${wide ? ' wide' : ''}`}>
      <span>{lab}</span>{input}
      {errors[k] && <small className="po-err" id={`${titleId}-${k}`}>{errors[k]}</small>}
    </label>
  );
  const inp = (k: keyof ShipTo, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input className="input" value={ship[k]} onChange={set(k)} aria-invalid={Boolean(errors[k])} aria-describedby={errors[k] ? `${titleId}-${k}` : undefined} disabled={working} {...extra} />
  );

  return (
    <dialog ref={ref} className="chooser po-dlg" onClose={onClose} onCancel={(e) => { if (working) e.preventDefault(); }} aria-labelledby={titleId}>
      <div className="chooser-in">
        <header>
          <div>
            <p className="eyebrow">{step.kind === 'done' ? 'Order placed' : 'Printed and posted to you'}</p>
            <h2 id={titleId}>{step.kind === 'done' ? 'Thank you! We will print it.' : 'Order it printed'}</h2>
          </div>
          <button type="button" className="x" onClick={() => ref.current?.close()} aria-label="Close" disabled={working}>✕</button>
        </header>

        {step.kind === 'done' ? (
          <div className="po-done">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {snap.preview && <img src={snap.preview} alt="" />}
            <div>
              <p>Your order <b className="mono">#{step.orderId.slice(0, 8).toUpperCase()}</b> is in. We will print your {toolName}, put it together by hand and post it to:</p>
              <p className="po-addr">{ship.name}<br />{ship.line1}{ship.line2 ? <>, {ship.line2}</> : null}<br />{ship.city}, {ship.state} – {ship.pin}</p>
              <p className="muted">A receipt is on its way to your email, and we will email you again when it ships.</p>
              <div className="po-acts"><Link className="btn" href="/account#orders">See your orders</Link><button type="button" className="linkish" onClick={() => ref.current?.close()}>Back to the design</button></div>
            </div>
          </div>
        ) : (
          <form className="po-body" onSubmit={pay} noValidate>
            <aside className="po-sum">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {snap.preview ? <img src={snap.preview} alt="Your design" /> : <div className="po-ph" />}
              <p className="po-tool">{toolName}<small>Your design, printed</small></p>
              <dl>
                <div><dt>Printed, assembled and posted</dt><dd className="mono">{price}</dd></div>
                <div><dt>Shipping in India</dt><dd>Included</dd></div>
                <div className="tot"><dt>Total</dt><dd className="mono">{price}</dd></div>
              </dl>
              <p className="po-note">Printed to order in our workshop and sent by India Post. We email you when it ships.</p>
            </aside>
            <div className="po-form">
              <p className="po-h">Shipping address</p>
              <div className="po-grid">
                {field('name', 'Full name', inp('name', { autoComplete: 'name', maxLength: 80 }), true)}
                {field('phone', 'Mobile number', <div className="po-tel"><span>+91</span>{inp('phone', { autoComplete: 'tel-national', inputMode: 'tel', maxLength: 14, placeholder: '98765 43210' })}</div>)}
                {field('pin', 'PIN code', inp('pin', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 6, placeholder: '6 digits' }))}
                {field('line1', 'House, building, street', inp('line1', { autoComplete: 'address-line1', maxLength: 120 }), true)}
                {field('line2', 'Area, landmark (optional)', inp('line2', { autoComplete: 'address-line2', maxLength: 120 }), true)}
                {field('city', 'Town or city', inp('city', { autoComplete: 'address-level2', maxLength: 60 }))}
                {field('state', 'State', (
                  <select className="input" value={ship.state} onChange={set('state')} aria-invalid={Boolean(errors.state)} autoComplete="address-level1" disabled={working}>
                    <option value="">Choose…</option>
                    {IN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ))}
              </div>
              {step.kind === 'error' && (
                <p className="msg err" role="alert">{step.text}{step.orderId ? ' If you were charged, your order is safe: it will appear in your account within a few minutes.' : ''}</p>
              )}
              <button type="submit" className="btn po-pay" disabled={working}>{working ? step.text : <>Pay {price} <span className="arrow">→</span></>}</button>
              <p className="po-fine">Secure payment by Razorpay: UPI, cards and net banking. Each piece is printed to order, just for you. <Link href="/refunds" target="_blank">Refunds and cancellations</Link></p>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
