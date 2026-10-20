'use client';
import { useActionState, useRef, useState } from 'react';
import { deleteRecords, type DeleteState } from './actions';

/**
 * Wraps a table or grid: rows carry <input type="checkbox" name="ids">, and this adds
 * "select all", a two-step "Delete selected" and a per-row two-step delete (<RowDelete>).
 */
export function BulkForm({ kind, noun, children, warn }: { kind: string; noun: string; children: React.ReactNode; warn?: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [sure, setSure] = useState(false);
  const [state, run, pending] = useActionState<DeleteState, FormData>(async (prev, fd) => {
    const r = await deleteRecords(prev, fd);
    form.current?.querySelectorAll<HTMLInputElement>('input[name="ids"], .adm-selall').forEach((i) => { i.checked = false; });
    setCount(0); setSure(false);
    return r;
  }, null);
  const recount = () => setCount(form.current?.querySelectorAll('input[name="ids"]:checked').length ?? 0);
  const all = (on: boolean) => { form.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((i) => { i.checked = on; }); recount(); };

  return (
    <form action={run} ref={form} onChange={recount} className="adm-bulk">
      <input type="hidden" name="kind" value={kind} />
      <div className={`adm-bulkbar${count ? ' on' : ''}`}>
        <label className="check"><input type="checkbox" className="adm-selall" onChange={(e) => all(e.target.checked)} aria-label="Select all on this page" /> Select all</label>
        {count > 0 && <span>{count} {noun}{count === 1 ? '' : 's'} selected</span>}
        {count > 0 && !sure && <button type="button" className="btn small ghost danger" onClick={() => setSure(true)}>Delete selected</button>}
        {count > 0 && sure && (
          <>
            <span className="warn">Delete {count} {noun}{count === 1 ? '' : 's'} for good?{warn ? ` ${warn}` : ''}</span>
            <button type="submit" name="mode" value="selected" className="btn small danger" disabled={pending}>{pending ? 'Deleting…' : 'Yes, delete'}</button>
            <button type="button" className="linkish" onClick={() => setSure(false)}>Keep</button>
          </>
        )}
        {state?.message && <span className={state.error ? 'msg err' : 'msg ok'} role="status">{state.message}</span>}
      </div>
      {children}
    </form>
  );
}

/** Per-row delete: first click asks, second click deletes. */
export function RowDelete({ id, label = 'Delete' }: { id: string; label?: string }) {
  const [sure, setSure] = useState(false);
  if (!sure) return <button type="button" className="adm-rowdel" onClick={() => setSure(true)} title={label} aria-label={label}>✕</button>;
  return (
    <span className="adm-rowsure">
      <button type="submit" name="one" value={id} className="btn small danger">Delete</button>
      <button type="button" className="linkish" onClick={() => setSure(false)}>Keep</button>
    </span>
  );
}

export function Sel({ id }: { id: string }) {
  return <input type="checkbox" name="ids" value={id} className="adm-sel" aria-label="Select" onClick={(e) => e.stopPropagation()} />;
}

/** A labelled two-step delete for a detail page; goes back to the list afterwards. */
export function DeleteOne({ kind, id, label, after, warn }: { kind: string; id: string; label: string; after: string; warn?: string }) {
  const [sure, setSure] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const f = new FormData(); f.set('kind', kind); f.set('one', id);
    const r = await deleteRecords(null, f);
    if (r?.error) { setMsg(r.message); setBusy(false); return; }
    location.assign(after);
  };
  if (!sure) return <button type="button" className="btn small ghost danger" onClick={() => setSure(true)}>{label}</button>;
  return (
    <span className="adm-rowsure">
      <span className="warn">{warn ?? 'This cannot be undone.'}</span>
      <button type="button" className="btn small danger" onClick={go} disabled={busy}>{busy ? 'Deleting…' : 'Yes, delete'}</button>
      <button type="button" className="linkish" onClick={() => setSure(false)}>Keep</button>
      {msg && <span className="msg err">{msg}</span>}
    </span>
  );
}
