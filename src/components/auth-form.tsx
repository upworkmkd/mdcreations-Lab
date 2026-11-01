'use client';
import { useActionState, useEffect } from 'react';
import type { FormState } from '@/app/login/actions';
import { track } from '@/components/tracker';

type Field = { name: string; label: string; type: string; autoComplete?: string; minLength?: number; defaultValue?: string };

export function AuthForm({ action, fields, submit, hidden }: {
  action: (s: FormState, f: FormData) => Promise<FormState>; fields: Field[]; submit: string; hidden?: Record<string, string>;
}) {
  // a request that never comes back (a timeout, no connection) shows a message instead of a broken page;
  // the failed request itself is recorded by the tracker, and the message shown is recorded below
  const [state, run, pending] = useActionState(async (s: FormState, f: FormData): Promise<FormState> => {
    try { return await action(s, f); }
    catch (e) {
      const m = (e as Error)?.message || String(e);
      if ((e as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT') || /NEXT_REDIRECT/.test(m)) throw e;   // a redirect after signing in, not an error
      return { error: 'We could not reach the server, or it took too long. Please try again in a minute.' };
    }
  }, null);

  useEffect(() => { if (state?.error) track('form_error', state.error, { form: submit }); }, [state, submit]);

  return (
    <form action={run} className="form">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <label key={f.name}>{f.label}<input name={f.name} type={f.type} autoComplete={f.autoComplete} minLength={f.minLength} defaultValue={f.defaultValue} required /></label>
      ))}
      {state?.error && <p className="msg err" role="alert">{state.error}</p>}
      {state?.message && <p className="msg ok" role="status">{state.message}</p>}
      <button className="btn" disabled={pending}>{pending ? 'One moment…' : submit}</button>
    </form>
  );
}
