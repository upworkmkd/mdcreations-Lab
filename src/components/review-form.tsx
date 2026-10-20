'use client';
import { useActionState, useState } from 'react';
import { submitReview } from '@/app/account/actions';

const WORDS = ['', 'Poor', 'Could be better', 'Good', 'Very good', 'Excellent'];

/** Stars, a few words, a name. One review per account. */
export function ReviewForm({ name, tool = 'shadow-lamp', compact }: { name: string; tool?: string; compact?: boolean }) {
  const [state, run, pending] = useActionState(submitReview, null);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  if (state?.ok) {
    return (
      <div className="review-thanks" role="status">
        <span className="big" aria-hidden>❤</span>
        <p className="serif">Thank you for your review!</p>
        <p>We read every one. Yours will appear on the site once we have had a look.</p>
      </div>
    );
  }
  const shown = hover || stars;
  return (
    <form action={run} className={`form review-form${compact ? ' compact' : ''}`} aria-label="Review">
      <input type="hidden" name="tool" value={tool} />
      <fieldset className="stars-pick" onMouseLeave={() => setHover(0)}>
        <legend>How would you rate it?</legend>
        <div>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={stars === n} onChange={() => setStars(n)} required />
              <span aria-hidden>★</span><span className="visually-hidden">{n} of 5</span>
            </label>
          ))}
          <span className="word">{WORDS[shown]}</span>
        </div>
      </fieldset>
      <label>Your review<textarea name="body" required minLength={10} maxLength={1000} rows={compact ? 3 : 4} className="input" placeholder="How did your lamp come out? Was the maker easy to use?" /></label>
      <div className="split" style={{ gap: 14 }}>
        <label>Name to show<input name="name" type="text" required maxLength={80} defaultValue={name} placeholder="e.g. Priya S." /></label>
        <label>Your city (optional)<input name="place" type="text" maxLength={80} placeholder="e.g. Pune" /></label>
      </div>
      {state?.error && <p className="msg err" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Sending…' : 'Send review'}</button>
    </form>
  );
}
