'use client';
import { useState } from 'react';
import Link from 'next/link';

const FACES: [number, string, string][] = [[1, '😞', 'Not good'], [2, '🙁', 'Could be better'], [3, '😐', 'Okay'], [4, '🙂', 'Good'], [5, '😍', 'Loved it']];

export function OrderFeedbackForm({ orderId, token, summary, initial, again, sample }: {
  orderId: string; token: string; summary: string; initial: { rating: number; message: string }; again?: boolean; sample?: boolean;
}) {
  const [rating, setRating] = useState(initial.rating);
  const [message, setMessage] = useState(initial.message);
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const hint = rating && rating <= 2 ? 'Sorry about that. What went wrong?' : rating === 3 ? 'What would have made it better?' : 'Anything you would like to tell us? (optional)';

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { setError('Pick how it went first.'); return; }
    if (sample) { setState('sent'); return; }
    setState('sending'); setError('');
    try {
      const r = await fetch('/api/feedback/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, t: token, rating, message, website }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) { setState('error'); setError(j.error || 'Could not send it just now. Please try again.'); return; }
      setState('sent');
    } catch { setState('error'); setError('Could not send it just now. Please try again.'); }
  };

  if (state === 'sent') return (
    <div className="ofb-done" role="status">
      <span aria-hidden>🙏</span>
      <h1>Thank you!</h1>
      <p className="muted">{rating <= 2 ? 'We are sorry it was not better. We read every note and will look into this, and we will get back to you by email.' : 'Every note is read, and it shapes what we build next.'}</p>
      <p className="ofb-links"><Link href="/account#files" className="btn small">Your files</Link> <Link href="/#tools" className="linkish">More tools</Link></p>
      {sample && <p className="fb-note">This was a sample from a test email, so nothing was saved.</p>}
    </div>
  );

  return (
    <form onSubmit={send} noValidate>
      <p className="eyebrow">Order feedback</p>
      <h1>How was your order?</h1>
      <p className="ofb-sum mono">{summary}</p>
      {again && <p className="fb-note">You told us about this order before; sending again updates it.</p>}
      <div className="fb-faces ofb-faces" role="radiogroup" aria-label="How did it go">
        {FACES.map(([n, face, label]) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} className={`face${rating === n ? ' on' : ''}`} onClick={() => { setRating(n); setError(''); }}>
            <span aria-hidden>{face}</span><small>{label}</small>
          </button>
        ))}
      </div>
      <label className="fb-field ofb-field"><span>{hint}</span>
        <textarea className="input" rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="The tool, the files, the print, checkout… anything" />
      </label>
      <label className="fb-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      {error && <p className="fb-err" role="alert">{error}</p>}
      <div className="fb-actions"><button type="submit" className="btn" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send feedback'}</button></div>
    </form>
  );
}
