'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import type { Draft, FollowKind, HistoryRow } from '@/lib/followup.server';
import { loadFollowup, sendFollowupAction } from './actions';
import { EmailHistory } from './history';

/**
 * "Follow up" on an unpaid order or an unfinished plan: opens a window with a ready email (subject and text can be
 * edited) and everything this customer has been sent before. Lives outside any form, so it works inside bulk lists.
 */
export function FollowUpButton({ kind, id, sent = 0 }: { kind: FollowKind; id: string; sent?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn small ghost adm-fu-btn" onClick={() => setOpen(true)} title="Email this customer to ask what stopped them">
        Follow up{sent ? <span className="adm-fu-n" title={`${sent} follow-up${sent === 1 ? '' : 's'} sent`}>{sent}</span> : null}
      </button>
      {open && createPortal(<FollowUpDialog kind={kind} id={id} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function FollowUpDialog({ kind, id, onClose }: { kind: FollowKind; id: string; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<{ draft: Draft; history: HistoryRow[] } | null>(null);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  useEffect(() => {
    let live = true;
    loadFollowup(kind, id).then((r) => {
      if (!live) return;
      if ('error' in r) { setError(r.error); return; }
      setData(r); setSubject(r.draft.subject); setBody(r.draft.body);
    }).catch(() => live && setError('Could not load the customer.'));
    return () => { live = false; };
  }, [kind, id]);

  const send = () => start(async () => {
    const r = await sendFollowupAction(kind, id, subject, body);
    setResult(r);
    if (r.ok) { const fresh = await loadFollowup(kind, id); if (!('error' in fresh)) setData((d) => d && { ...d, history: fresh.history }); }
  });

  return (
    <dialog ref={ref} className="adm-dlg" onClose={onClose} onClick={(e) => { if (e.target === ref.current && !pending) ref.current?.close(); }} aria-labelledby="fu-h">
      <div className="adm-dlg-in">
        <header className="adm-dlg-head">
          <div>
            <p className="adm-po-h">Follow up · {kind === 'order' ? 'unpaid order' : 'unfinished plan'}</p>
            <h2 id="fu-h">{data ? <>Email {data.draft.name || data.draft.to}</> : 'Follow up'}</h2>
            {data && <p className="adm-fu-note">{data.draft.to} · {data.draft.ref}</p>}
          </div>
          <button type="button" className="adm-drawer-x" onClick={() => ref.current?.close()} aria-label="Close" disabled={pending}>×</button>
        </header>
        {error ? <p className="msg err">{error}</p> : !data ? <p className="muted">Loading…</p> : (
          <div className="adm-fu-grid">
            <div className="adm-fu-form">
              <label className="lbl">Subject<input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} disabled={pending} /></label>
              <label className="lbl">Message<textarea className="input" rows={14} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} disabled={pending} /></label>
              <p className="adm-fu-note">Sent from the site&apos;s email address; the customer&apos;s reply comes to you. Links become clickable.</p>
              <div className="adm-inline" style={{ alignItems: 'center' }}>
                <button type="button" className="btn small" onClick={send} disabled={pending || Boolean(result?.ok)}>{pending ? 'Sending…' : result?.ok ? 'Sent ✓' : 'Send email'}</button>
                <button type="button" className="linkish" onClick={() => { setSubject(data.draft.subject); setBody(data.draft.body); setResult(null); }} disabled={pending}>Reset the draft</button>
                {result?.ok && <span className="msg ok">{result.ok}</span>}
                {result?.error && <span className="msg err">{result.error}</span>}
              </div>
            </div>
            <aside className="adm-fu-hist">
              <p className="adm-po-h">Emails to this customer</p>
              <EmailHistory rows={data.history} compact />
            </aside>
          </div>
        )}
      </div>
    </dialog>
  );
}
