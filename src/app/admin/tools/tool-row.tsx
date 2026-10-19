'use client';
import { useActionState } from 'react';
import { saveTool, type SaveState } from '../actions';

export function ToolRow({ slug, name, status, inr, usd }: { slug: string; name: string; status: string; inr: number | null; usd: number | null }) {
  const [state, run, pending] = useActionState<SaveState, FormData>(saveTool, null);
  return (
    <tr>
      <td><b className="serif" style={{ fontSize: 20 }}>{name}</b><div className="id">{slug}</div></td>
      <td colSpan={4}>
        <form action={run} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px,1fr) minmax(110px,1fr) minmax(110px,1fr) auto', gap: 10, alignItems: 'center' }}>
          <input type="hidden" name="slug" value={slug} />
          <select name="status" defaultValue={status} className="input" aria-label="Status">
            <option value="live">Live</option><option value="coming_soon">Coming soon</option><option value="hidden">Hidden</option>
          </select>
          <label className="lbl" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>₹<input name="price_INR" className="input" inputMode="decimal" defaultValue={inr != null ? String(inr / 100) : ''} placeholder="not sold" aria-label="Price in rupees" /></label>
          <label className="lbl" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>$<input name="price_USD" className="input" inputMode="decimal" defaultValue={usd != null ? String(usd / 100) : ''} placeholder="not sold" aria-label="Price in dollars" /></label>
          <button className="btn small" disabled={pending}>{pending ? 'Saving…' : state?.ok ? 'Saved ✓' : 'Save'}</button>
          {state?.error && <span className="msg err" style={{ gridColumn: '1 / -1' }}>{state.error}</span>}
        </form>
      </td>
    </tr>
  );
}
