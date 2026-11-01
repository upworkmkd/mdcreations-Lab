'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { BUTTON_MARK, PLACEHOLDERS, TEMPLATES, templateDraft, unknownPlaceholders, fillPlaceholders, type TemplateId } from '@/lib/emails/auth-emails';
import { sendUserEmail } from './email-actions';

/** "Send email" on a user's page: pick a template (or a blank email), edit it, send. */
export function SendEmailButton({ userId, email, name, confirmed, signer, siteUrl }: { userId: string; email: string; name: string; confirmed: boolean; signer: string; siteUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn small" onClick={() => setOpen(true)}>Send email</button>
      {open && createPortal(<Dialog {...{ userId, email, name, confirmed, signer, siteUrl }} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Dialog({ userId, email, name, confirmed, signer, siteUrl, onClose }: { userId: string; email: string; name: string; confirmed: boolean; signer: string; siteUrl: string; onClose(): void }) {
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
  const vars = { name, email, siteUrl };

  // placeholders go where the cursor was, in the subject or the message (whichever was used last)
  const subjRef = useRef<HTMLInputElement>(null), bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<'subject' | 'body'>('body');
  const insert = (token: string) => {
    const inBody = lastField.current === 'body', el = inBody ? bodyRef.current : subjRef.current;
    const value = inBody ? body : subject, set = inBody ? setBody : setSubject;
    const a = el?.selectionStart ?? value.length, z = el?.selectionEnd ?? value.length;
    const text = inBody && token === '[button]' ? `\n\n[button]\n\n` : token;
    set(value.slice(0, a) + text + value.slice(z));
    setResult(null);
    requestAnimationFrame(() => { el?.focus(); const at = a + text.length; el?.setSelectionRange(at, at); });
  };

  // problems that would stop the email, shown before pressing Send
  const filled = fillPlaceholders(`${subject}\n${body}`, vars);
  const unknown = unknownPlaceholders(filled);
  const strayButton = tpl === 'blank' && BUTTON_MARK.test(body);
  const blocked = unknown.length > 0 || strayButton;

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
          <p className="adm-fu-note">{info.note}</p>
          <div className="adm-ph">
            <p className="adm-ph-h">Placeholders <span>· click to insert where the cursor is; each is filled in for {name || email} when the email is sent</span></p>
            <ul>
              {tpl !== 'blank' && (
                <li><button type="button" onClick={() => insert('[button]')} disabled={pending}><code>[button]</code><span>{info.id === 'confirm' ? '“Confirm my email” button' : info.id === 'reset' ? '“Choose a new password” button' : '“Sign in” button'} (on its own line; without it the button comes last)</span></button></li>
              )}
              {PLACEHOLDERS.map((p) => (
                <li key={p.key}><button type="button" onClick={() => insert(`{${p.key}}`)} disabled={pending} title={p.label}><code>{`{${p.key}}`}</code><span>{p.label} · <b>{p.value(vars)}</b></span></button></li>
              ))}
            </ul>
            {tpl === 'blank' && <p className="adm-ph-note">A blank email has no button. For a link that signs them in, pick the Sign-in link template.</p>}
          </div>
          <label className="lbl">Subject<input ref={subjRef} onFocus={() => { lastField.current = 'subject'; }} className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} disabled={pending} /></label>
          <label className="lbl">Message<textarea ref={bodyRef} onFocus={() => { lastField.current = 'body'; }} className="input" rows={13} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} disabled={pending} /></label>
          {unknown.length > 0 && <p className="msg err">Replace {unknown.map((x) => `“${x}”`).join(', ')} with the real words before sending. Only the placeholders listed above are filled in.</p>}
          {strayButton && <p className="msg err">Remove the [button] line: a blank email has no button. Pick the Sign-in link template if you want one.</p>}
          <div className="adm-inline" style={{ alignItems: 'center' }}>
            <button type="button" className="btn small" onClick={send} disabled={pending || blocked || Boolean(result?.ok)}>{pending ? 'Sending…' : result?.ok ? 'Sent ✓' : 'Send email'}</button>
            <button type="button" className="linkish" onClick={() => pick(tpl)} disabled={pending}>Reset the text</button>
            {result?.ok && <><span className="msg ok">{result.ok}</span><button type="button" className="linkish" onClick={() => setResult(null)}>Send another</button></>}
            {result?.error && <span className="msg err">{result.error}</span>}
          </div>
        </div>
      </div>
    </dialog>
  );
}
