'use client';
import { useActionState } from 'react';
import { saveTool, type SaveState } from '../actions';

type P = { slug: string; name: string; status: string; inr: number | null; usd: number | null; printInr: number | null; printUsd: number | null; printable: boolean };
const major = (v: number | null) => (v != null ? String(v / 100) : '');

function Money({ name, sign, value, label, placeholder = 'not sold' }: { name: string; sign: string; value: number | null; label: string; placeholder?: string }) {
  return (
    <label className="adm-money"><span aria-hidden>{sign}</span>
      <input name={name} className="input" inputMode="decimal" defaultValue={major(value)} placeholder={placeholder} aria-label={label} />
    </label>
  );
}

/** One tool: status, the download price and the printed price (shipping included), in rupees and dollars. */
export function ToolRow({ slug, name, status, inr, usd, printInr, printUsd, printable }: P) {
  const [state, run, pending] = useActionState<SaveState, FormData>(saveTool, null);
  return (
    <tr>
      <td><b className="serif" style={{ fontSize: 20 }}>{name}</b><div className="id">{slug}</div></td>
      <td colSpan={6}>
        <form action={run} className="adm-tool-form">
          <input type="hidden" name="slug" value={slug} />
          <select name="status" defaultValue={status} className="input" aria-label="Status">
            <option value="live">Live</option><option value="coming_soon">Coming soon</option><option value="hidden">Hidden</option>
          </select>
          <Money name="price_INR" sign="₹" value={inr} label={`${name}: download price in rupees`} />
          <Money name="price_USD" sign="$" value={usd} label={`${name}: download price in dollars`} />
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
