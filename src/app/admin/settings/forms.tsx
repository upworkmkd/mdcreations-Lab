'use client';
import { useActionState } from 'react';
import { saveEmailSettings, sendTest, type FormState } from './actions';

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
