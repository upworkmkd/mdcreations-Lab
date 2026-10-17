'use client';
import { useActionState } from 'react';
import type { FormState } from '@/app/login/actions';

type Field = { name: string; label: string; type: string; autoComplete?: string; minLength?: number; defaultValue?: string };

export function AuthForm({ action, fields, submit, hidden }: {
  action: (s: FormState, f: FormData) => Promise<FormState>; fields: Field[]; submit: string; hidden?: Record<string, string>;
}) {
  const [state, run, pending] = useActionState(action, null);
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
