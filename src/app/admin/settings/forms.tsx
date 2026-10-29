'use client';
import { useActionState } from 'react';
import { runAutomationNow, saveAutomation, saveEmailSettings, saveShopSettings, sendTest, type FormState, type RunState } from './actions';
import type { Automation } from '@/lib/automation.server';

export function EmailSettingsForm({ customer, admin, notify }: { customer: boolean; admin: boolean; notify: string[] }) {
  const [state, run, pending] = useActionState<FormState, FormData>(saveEmailSettings, null);
  return (
    <form action={run} className="adm-set">
      <label className="adm-tick"><input type="checkbox" name="customer" defaultChecked={customer} />
        <span><b>Email the customer a receipt</b><small>Order details, a button to their files and a one-tap “How was your order?” for feedback.</small></span></label>
      <label className="adm-tick"><input type="checkbox" name="admin" defaultChecked={admin} />
        <span><b>Email us about every new order</b><small>Sent to the alert addresses below. It has a button to reply to the customer.</small></span></label>
      <label className="lbl">Order alert addresses
        <textarea name="notify" className="input" rows={3} defaultValue={notify.join('\n')} placeholder={'you@themdcreations.com\npartner@example.com'} />
        <small className="muted">One per line, up to 10.</small>
      </label>
      <div className="adm-inline" style={{ alignItems: 'center' }}>
        <button className="btn small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        {state?.ok && <span className="msg ok">{state.ok}</span>}
        {state?.error && <span className="msg err">{state.error}</span>}
      </div>
    </form>
  );
}

export function TestButton({ kind, label, disabled }: { kind: 'customer' | 'admin'; label: string; disabled?: boolean }) {
  const [state, run, pending] = useActionState<FormState, FormData>(sendTest, null);
  return (
    <form action={run} className="adm-test">
      <input type="hidden" name="kind" value={kind} />
      <button className="btn small ghost" disabled={pending || disabled}>{pending ? 'Sending…' : label}</button>
      {state?.ok && <span className="msg ok">{state.ok}</span>}
      {state?.error && <span className="msg err">{state.error}</span>}
    </form>
  );
}

export function ShopForm({ returnAddress }: { returnAddress: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(saveShopSettings, null);
  return (
    <form action={run} className="adm-set">
      <label className="lbl">Return address on parcel labels
        <textarea name="returnAddress" className="input" rows={5} defaultValue={returnAddress} placeholder={'MD Creations\nHouse, street\nTown, State – PIN\nPhone: +91 …'} />
        <small className="muted">Printed as the “From” address on labels for printed orders. One line each, up to 8.</small>
      </label>
      <div className="adm-inline" style={{ alignItems: 'center' }}>
        <button className="btn small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        {state?.ok && <span className="msg ok">{state.ok}</span>}
        {state?.error && <span className="msg err">{state.error}</span>}
      </div>
    </form>
  );
}

function Days({ name, value, label, after }: { name: string; value: number; label: string; after: string }) {
  return <label className="adm-days">{label}<input type="number" name={name} min={1} max={60} defaultValue={value} className="input" /> days {after}</label>;
}

export function AutomationForm({ a }: { a: Automation }) {
  const [state, run, pending] = useActionState<FormState, FormData>(saveAutomation, null);
  return (
    <form action={run} className="adm-set">
      <label className="adm-tick"><input type="checkbox" name="review_on" defaultChecked={a.review.on} />
        <span><b>Ask for a review after an order</b><small>How it went, tips for printing and a link to leave a review with photos. Not sent to someone who already left a review, or was asked in the last 60 days.</small></span></label>
      <div className="adm-inline adm-days-row">
        <Days name="review_days_download" value={a.review.daysDownload} label="Downloads:" after="after the files are ready" />
        <Days name="review_days_print" value={a.review.daysPrint} label="Printed:" after="after it is marked delivered" />
      </div>
      <label className="adm-tick"><input type="checkbox" name="order_on" defaultChecked={a.unpaidOrder.on} />
        <span><b>Follow up an order that was not paid</b><small>A friendly “need a hand?” note. Skipped if they paid for something since.</small></span></label>
      <div className="adm-inline adm-days-row"><Days name="order_days" value={a.unpaidOrder.days} label="Send" after="after the order was started" /></div>
      <label className="adm-tick"><input type="checkbox" name="plan_on" defaultChecked={a.unpaidPlan.on} />
        <span><b>Follow up a plan that was started but not paid</b><small>Skipped if they are on a plan now.</small></span></label>
      <div className="adm-inline adm-days-row"><Days name="plan_days" value={a.unpaidPlan.days} label="Send" after="after the plan was started" /></div>
      <label className="lbl">Sign the emails as
        <input name="signer" className="input" maxLength={40} defaultValue={a.signer} placeholder="Manoj" />
        <small className="muted">The same emails as the Follow-up button, sent once a day at about 10:00 IST. Each order or plan gets each email once, by hand or automatically.</small>
      </label>
      <div className="adm-inline" style={{ alignItems: 'center' }}>
        <button className="btn small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        {state?.ok && <span className="msg ok">{state.ok}</span>}
        {state?.error && <span className="msg err">{state.error}</span>}
      </div>
    </form>
  );
}

export function AutomationRun() {
  const [state, run, pending] = useActionState<RunState, FormData>(runAutomationNow, null);
  return (
    <form action={run} className="adm-set">
      <div className="adm-inline" style={{ alignItems: 'center' }}>
        <button className="btn small ghost" name="mode" value="preview" disabled={pending}>Who is due today?</button>
        <button className="btn small" name="mode" value="send" disabled={pending}>{pending ? 'Working…' : 'Send due emails now'}</button>
        {state?.ok && <span className="msg ok">{state.ok}</span>}
        {state?.error && <span className="msg err">{state.error}</span>}
      </div>
      {!!state?.due?.length && (
        <ul className="adm-due">{state.due.map((d, i) => <li key={i}><b>{d.label}</b> <span className="adm-mails-meta">{d.to} · {d.ref}</span></li>)}</ul>
      )}
    </form>
  );
}
