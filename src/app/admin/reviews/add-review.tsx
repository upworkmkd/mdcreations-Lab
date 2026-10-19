'use client';
import { useActionState, useRef, useEffect } from 'react';
import { addReview, type SaveState } from '../actions';

export function AddReview({ tools }: { tools: { slug: string; name: string }[] }) {
  const [state, run, pending] = useActionState<SaveState, FormData>(addReview, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form action={run} ref={form} className="form adm-form">
      <div className="adm-form-row">
        <label>Customer name<input name="name" type="text" required maxLength={80} placeholder="As they agreed to be shown" /></label>
        <label>Place<input name="place" type="text" maxLength={80} placeholder="City, country (optional)" /></label>
      </div>
      <div className="adm-form-row">
        <label>Tool<select name="tool" defaultValue="shadow-lamp"><option value="">General</option>{tools.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select></label>
        <label>Rating<select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></label>
      </div>
      <label>What they said<textarea name="body" required minLength={10} maxLength={1000} rows={4} className="input" placeholder="Paste their words from the message, comment or email" /></label>
      <label className="check"><input type="checkbox" name="verified" /> They bought from us (shows “Verified buyer”)</label>
      {state?.error && <p className="msg err">{state.error}</p>}
      {state?.ok && <p className="msg ok">Added and published.</p>}
      <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Add review'}</button>
    </form>
  );
}
