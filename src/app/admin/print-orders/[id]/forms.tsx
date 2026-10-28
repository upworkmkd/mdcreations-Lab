'use client';
import { useActionState, useState } from 'react';
import { IN_STATES, type ShipTo } from '@/lib/ship';
import { rebuildPrintFiles, saveShipTo, saveShopNote, saveTracking, setPrintStatus, type ActState } from '../actions';

function Msg({ s }: { s: ActState }) {
  return s?.ok ? <span className="msg ok">{s.ok}</span> : s?.error ? <span className="msg err">{s.error}</span> : null;
}

/** The next step for this order, as one clear button (plus courier and tracking when shipping). */
export function StatusControl({ id, status }: { id: string; status: string }) {
  const [state, run, pending] = useActionState<ActState, FormData>(setPrintStatus.bind(null, id), null);
  return (
    <div className="adm-po-steps">
      {status === 'to_print' && (
        <form action={run}><input type="hidden" name="status" value="printing" />
          <button className="btn" disabled={pending}>Start printing →</button>
          <p className="id">Just for you: the customer is not emailed.</p></form>
      )}
      {(status === 'to_print' || status === 'printing') && (
        <form action={run} className="adm-po-ship">
          <input type="hidden" name="status" value="shipped" />
          <p className="adm-po-h">Posted it?</p>
          <div className="adm-po-row">
            <label className="lbl">Sent by<input name="courier" className="input" defaultValue="India Post" maxLength={80} /></label>
            <label className="lbl">Tracking number (optional)<input name="tracking" className="input" maxLength={80} placeholder="e.g. EK123456789IN" /></label>
          </div>
          <label className="adm-tick"><input type="checkbox" name="notify" defaultChecked /><span><b>Email the customer</b><small>&ldquo;Your order is on its way&rdquo;, with the tracking number if you entered one.</small></span></label>
          <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Mark as shipped'}</button>
        </form>
      )}
      {status === 'shipped' && (
        <form action={run}>
          <input type="hidden" name="status" value="delivered" />
          <label className="adm-tick"><input type="checkbox" name="notify" defaultChecked /><span><b>Email the customer</b><small>&ldquo;Delivered&rdquo;, with a one-tap &ldquo;How do you like it?&rdquo;</small></span></label>
          <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Mark as delivered'}</button>
        </form>
      )}
      {status === 'delivered' && <p className="msg ok">Delivered. All done.</p>}
      {status === 'cancelled' && <p className="msg">Cancelled. Refund the payment in the Razorpay dashboard if you have not already.</p>}
      <Msg s={state} />
      {status !== 'cancelled' && status !== 'delivered' && (
        <details className="adm-po-more">
          <summary>Other changes</summary>
          <div className="adm-inline">
            {status !== 'to_print' && <form action={run}><input type="hidden" name="status" value="to_print" /><button className="linkish">Back to “To print”</button></form>}
            {status === 'shipped' && <form action={run}><input type="hidden" name="status" value="printing" /><button className="linkish">Back to “Printing”</button></form>}
            <form action={run} onSubmit={(e) => { if (!confirm('Cancel this order? This does not refund the payment; do that in Razorpay.')) e.preventDefault(); }}>
              <input type="hidden" name="status" value="cancelled" /><button className="linkish" style={{ color: 'var(--bad)' }}>Cancel order</button>
            </form>
          </div>
        </details>
      )}
    </div>
  );
}

export function TrackingForm({ id, courier, tracking }: { id: string; courier: string; tracking: string }) {
  const [state, run, pending] = useActionState<ActState, FormData>(saveTracking.bind(null, id), null);
  return (
    <form action={run} className="adm-po-row">
      <label className="lbl">Sent by<input name="courier" className="input" defaultValue={courier} maxLength={80} /></label>
      <label className="lbl">Tracking number<input name="tracking" className="input" defaultValue={tracking} maxLength={80} /></label>
      <div className="adm-inline" style={{ alignItems: 'center' }}><button className="btn small ghost" disabled={pending}>Save</button><Msg s={state} /></div>
    </form>
  );
}

export function NoteForm({ id, note }: { id: string; note: string }) {
  const [state, run, pending] = useActionState<ActState, FormData>(saveShopNote.bind(null, id), null);
  return (
    <form action={run} className="adm-set">
      <textarea name="note" className="input" rows={3} defaultValue={note} maxLength={2000} placeholder="Only you see this: colours used, a call with the customer…" />
      <div className="adm-inline" style={{ alignItems: 'center' }}><button className="btn small ghost" disabled={pending}>Save note</button><Msg s={state} /></div>
    </form>
  );
}

export function RebuildButton({ id }: { id: string }) {
  const [state, run, pending] = useActionState<ActState, FormData>(rebuildPrintFiles.bind(null, id), null);
  return (
    <form action={run} className="adm-inline" style={{ alignItems: 'center' }}>
      <button className="btn small ghost" disabled={pending}>{pending ? 'Building…' : 'Build the files again'}</button><Msg s={state} />
    </form>
  );
}

/** The address, with "Copy" for a courier form, and an "Edit" for when the customer writes in with a change. */
export function AddressCard({ id, ship }: { id: string; ship: ShipTo }) {
  const [edit, setEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, run, pending] = useActionState<ActState, FormData>(saveShipTo.bind(null, id), null);
  const lines = [ship.name, ship.line1, ship.line2, `${ship.city}, ${ship.state} – ${ship.pin}`, 'India', `Phone: +91 ${ship.phone}`].filter(Boolean);
  if (edit) return (
    <form action={run} className="adm-po-addr-edit">
      {(['name', 'phone', 'line1', 'line2', 'city'] as const).map((k) => (
        <label key={k} className="lbl">{{ name: 'Name', phone: 'Mobile (10 digits)', line1: 'House, building, street', line2: 'Area, landmark', city: 'Town or city' }[k]}
          <input name={k} className="input" defaultValue={ship[k]} /></label>
      ))}
      <label className="lbl">State<select name="state" className="input" defaultValue={ship.state}>{IN_STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="lbl">PIN code<input name="pin" className="input" defaultValue={ship.pin} inputMode="numeric" maxLength={6} /></label>
      <div className="adm-inline" style={{ alignItems: 'center' }}>
        <button className="btn small" disabled={pending}>Save address</button>
        <button type="button" className="linkish" onClick={() => setEdit(false)}>Done</button><Msg s={state} />
      </div>
    </form>
  );
  return (
    <div className="adm-po-addr">
      <address>{lines.map((l) => <span key={l}>{l}</span>)}</address>
      <div className="adm-inline">
        <button type="button" className="btn small ghost" onClick={async () => { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied ✓' : 'Copy address'}</button>
        <a className="btn small ghost" href={`/admin/print-orders/${id}/label`} target="_blank" rel="noopener">Print label</a>
        <button type="button" className="linkish" onClick={() => setEdit(true)}>Edit</button>
      </div>
    </div>
  );
}
