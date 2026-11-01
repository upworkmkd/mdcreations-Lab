'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { TEMPLATES, templateDraft, type TemplateId } from '@/lib/emails/auth-emails';
import { sendUserEmail } from './email-actions';

/** "Send email" on a user's page: pick a template (or a blank email), edit it, send. */
export function SendEmailButton({ userId, email, name, confirmed, signer }: { userId: string; email: string; name: string; confirmed: boolean; signer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn small" onClick={() => setOpen(true)}>Send email</button>
      {open && createPortal(<Dialog {...{ userId, email, name, confirmed, signer }} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Dialog({ userId, email, name, confirmed, signer, onClose }: { userId: string; email: string; name: string; confirmed: boolean; signer: string; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const first: TemplateId = confirmed ? 'blank' : 'confirm';
  const [tpl, setTpl] = useState<TemplateId>(first);
  const [subject, setSubject] = useState(() => templateDraft(first, name, signer).subject);
  const [body, setBody] = useState(() => templateDraft(first, name, signer).body);
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);

  const pick = (id: TemplateId) => { const d = templateDraft(id, name, signer); setTpl(id); setSubject(d.subject); setBody(d.body); setResult(null); };
  const send = () => start(async () => {
    const r: { ok?: string; error?: string } = await sendUserEmail(userId, tpl, subject, body).catch((e: Error) => ({ error: e.message || 'Could not send.' }));
    setResult(r);
    if (r.ok) router.refresh();
  });
  const info = TEMPLATES.find((t) => t.id === tpl)!;

  return (
    <dialog ref={ref} className="adm-dlg" onClose={onClose} onClick={(e) => { if (e.target === ref.current && !pending) ref.current?.close(); }} aria-labelledby="se-h">
      <div className="adm-dlg-in adm-se">
        <header className="adm-dlg-head">
          <div>
            <p className="adm-po-h">Send email</p>
            <h2 id="se-h">Email {name || email}</h2>
            <p className="adm-fu-note">{email} · {confirmed ? 'email confirmed' : 'email not confirmed yet'}</p>
          </div>
          <button type="button" className="adm-drawer-x" onClick={() => ref.current?.close()} aria-label="Close" disabled={pending}>×</button>
        </header>
        <div className="adm-fu-form">
          <label className="lbl">Template
            <select className="input" value={tpl} onChange={(e) => pick(e.target.value as TemplateId)} disabled={pending}>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}{t.id === 'confirm' && confirmed ? ' (already confirmed)' : ''}</option>)}
            </select>
          </label>
          <p className="adm-fu-note">{info.note}{tpl !== 'blank' ? ' The line [button] marks where the button goes; remove it and the button comes last.' : ' There is no button in a blank email.'} You can write {'{name}'}, {'{first_name}'} or {'{email}'} and they are filled in; any other text in {'{braces}'} stops the email from sending, so a placeholder never goes out by mistake.</p>
          <label className="lbl">Subject<input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} disabled={pending} /></label>
          <label className="lbl">Message<textarea className="input" rows={13} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} disabled={pending} /></label>
          <div className="adm-inline" style={{ alignItems: 'center' }}>
            <button type="button" className="btn small" onClick={send} disabled={pending || Boolean(result?.ok)}>{pending ? 'Sending…' : result?.ok ? 'Sent ✓' : 'Send email'}</button>
            <button type="button" className="linkish" onClick={() => pick(tpl)} disabled={pending}>Reset the text</button>
            {result?.ok && <><span className="msg ok">{result.ok}</span><button type="button" className="linkish" onClick={() => setResult(null)}>Send another</button></>}
            {result?.error && <span className="msg err">{result.error}</span>}
          </div>
        </div>
      </div>
    </dialog>
  );
}
