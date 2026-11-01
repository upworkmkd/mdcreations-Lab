'use client';
import { useActionState, useState } from 'react';
import { saveTool, type SaveState } from '../actions';

type P = { slug: string; name: string; status: string; free: boolean; alwaysFree: boolean; inr: number | null; usd: number | null; printInr: number | null; printUsd: number | null; printable: boolean };
const major = (v: number | null) => (v != null ? String(v / 100) : '');

function Money({ name, sign, value, label, placeholder = 'not sold', disabled }: { name: string; sign: string; value: number | null; label: string; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="adm-money"><span aria-hidden>{sign}</span>
      <input name={name} className="input" inputMode="decimal" defaultValue={major(value)} placeholder={disabled ? 'free' : placeholder} aria-label={label} readOnly={disabled} aria-disabled={disabled} />
    </label>
  );
}

/** One tool: status, the download price and the printed price (shipping included), in rupees and dollars. */
export function ToolRow({ slug, name, status, free: free0, alwaysFree, inr, usd, printInr, printUsd, printable }: P) {
  const [state, run, pending] = useActionState<SaveState, FormData>(saveTool, null);
  const [free, setFree] = useState(free0);
  return (
    <tr>
      <td><b className="serif" style={{ fontSize: 20 }}>{name}</b><div className="id">{slug}</div></td>
      <td colSpan={6}>
        <form action={run} className="adm-tool-form">
          <input type="hidden" name="slug" value={slug} />
          <select name="status" defaultValue={status} className="input" aria-label="Status">
            <option value="live">Live</option><option value="coming_soon">Coming soon</option><option value="hidden">Hidden</option>
          </select>
          <label className="adm-free" title={alwaysFree ? 'Works in the browser with nothing to sell, so it is always free' : 'Downloads cost nothing and the tool is listed with the free tools'}>
            <input type="checkbox" name="free" checked={free} disabled={alwaysFree} onChange={(e) => setFree(e.target.checked)} />
            {alwaysFree && <input type="hidden" name="free" value="on" />}
            <span>Free</span>
          </label>
          <Money name="price_INR" sign="₹" value={inr} label={`${name}: download price in rupees`} disabled={free} />
          <Money name="price_USD" sign="$" value={usd} label={`${name}: download price in dollars`} disabled={free} />
          {printable ? (
            <>
              <Money name="print_INR" sign="₹" value={printInr} label={`${name}: printed price in rupees`} placeholder="not offered" />
              <Money name="print_USD" sign="$" value={printUsd} label={`${name}: printed price in dollars`} placeholder="not offered" />
            </>
          ) : <span className="id adm-noprint">No printed option for this tool</span>}
          <button className="btn small" disabled={pending}>{pending ? 'Saving…' : state?.ok ? 'Saved ✓' : 'Save'}</button>
          {state?.error && <span className="msg err" style={{ gridColumn: '1 / -1' }}>{state.error}</span>}
        </form>
      </td>
    </tr>
  );
}
