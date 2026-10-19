'use client';
import { useActionState } from 'react';
import { savePlan, type SaveState } from '../actions';

export function PlanRow({ id, name, status, limit, tools, inr, usd, rzp }: { id: string; name: string; status: string; limit: number | null; tools: number | null; inr: number | null; usd: number | null; rzp: { INR?: string | null; USD?: string | null } }) {
  const [state, run, pending] = useActionState<SaveState, FormData>(savePlan, null);
  return (
    <tr>
      <td><b className="serif" style={{ fontSize: 20 }}>{name}</b><div className="id">{tools == null ? 'every tool' : `${tools} tool of their choice`}</div></td>
      <td colSpan={5}>
        <form action={run} className="adm-plan-form">
          <input type="hidden" name="id" value={id} />
          <select name="status" defaultValue={status} className="input" aria-label="Sign-up">
            <option value="live">Open: Subscribe button</option><option value="contact">Contact us button</option><option value="hidden">Hidden</option>
          </select>
          <label className="lbl">Designs a day<input name="daily_limit" className="input" inputMode="numeric" defaultValue={limit ?? ''} placeholder="no limit" /></label>
          <label className="lbl">₹ a month<input name="price_INR" className="input" inputMode="decimal" defaultValue={inr != null ? String(inr / 100) : ''} placeholder="not sold" /><span className="id">{rzp.INR ?? (inr != null ? 'no Razorpay plan yet' : '')}</span></label>
          <label className="lbl">$ a month<input name="price_USD" className="input" inputMode="decimal" defaultValue={usd != null ? String(usd / 100) : ''} placeholder="not sold" /><span className="id">{rzp.USD ?? (usd != null ? 'no Razorpay plan yet' : '')}</span></label>
          <label className="check"><input type="checkbox" name="make_rzp" /> Make Razorpay plans now</label>
          <button className="btn small" disabled={pending}>{pending ? 'Saving…' : state?.ok && !state.error ? 'Saved ✓' : 'Save'}</button>
          {state?.error && <span className="msg err" style={{ gridColumn: '1 / -1' }}>{state.error}</span>}
        </form>
      </td>
    </tr>
  );
}
