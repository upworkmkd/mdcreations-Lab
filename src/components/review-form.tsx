'use client';
import { useActionState } from 'react';
import { submitReview } from '@/app/account/actions';

export function ReviewForm({ name }: { name: string }) {
  const [state, run, pending] = useActionState(submitReview, null);
  if (state?.ok) return <p className="msg ok" role="status">{state.message}</p>;
  return (
    <form action={run} className="form" aria-label="Review">
      <div className="split" style={{ gap: 16 }}>
        <label>Name to show<input name="name" type="text" required maxLength={80} defaultValue={name} /></label>
        <label>Your city (optional)<input name="place" type="text" maxLength={80} placeholder="e.g. Pune" /></label>
      </div>
      <label>Rating<select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} {n} of 5</option>)}</select></label>
      <label>Your review<textarea name="body" required minLength={10} maxLength={1000} rows={4} className="input" placeholder="How did the lamp come out? Was the maker easy to use?" /></label>
      {state?.error && <p className="msg err" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Sending…' : 'Send review'}</button>
    </form>
  );
}
