'use client';
import { useState } from 'react';
import Link from 'next/link';
import { PhotoPicker, type Picked } from '@/components/review-photos';
import { MAX_REVIEW_PHOTOS, uploadReviewPhoto } from '@/lib/review-photos';

const WORDS = ['', 'Poor', 'Could be better', 'Good', 'Very good', 'Excellent'];
type Existing = { id: string; rating: number; body: string; name: string; place: string | null; status: string } | null;

/** The review page behind a review-request email: stars, a few words, a name, and photos of the print. */
export function ReviewByLink({ orderId, token, stars: s0, design, defaultName, existing, photos: had }: {
  orderId: string; token: string; stars: number; design: { name: string; preview: string | null; tool: string; printed: boolean };
  defaultName: string; existing: Existing; photos: { id: string; status: string }[];
}) {
  const locked = existing?.status === 'published';
  const [stars, setStars] = useState(existing?.rating ?? s0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(existing?.body ?? '');
  const [name, setName] = useState(existing?.name ?? defaultName.split(/\s+/).map((w, i) => (i === 0 ? w : w ? `${w[0]}.` : '')).join(' ').trim());
  const [place, setPlace] = useState(existing?.place ?? '');
  const [website, setWebsite] = useState('');
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [step, setStep] = useState<{ kind: 'form' } | { kind: 'busy'; text: string } | { kind: 'done'; photoError?: string } | { kind: 'error'; text: string }>({ kind: 'form' });
  const room = MAX_REVIEW_PHOTOS - had.filter((p) => p.status !== 'hidden').length;
  const shown = hover || stars;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locked) {
      if (!stars) { setStep({ kind: 'error', text: 'Tap a star first.' }); return; }
      if (body.trim().length < 10) { setStep({ kind: 'error', text: 'Please write at least a sentence.' }); return; }
    } else if (!photos.length) { setStep({ kind: 'error', text: 'Add a photo first.' }); return; }
    setStep({ kind: 'busy', text: 'Sending your review…' });
    if (!locked) {
      const r = await fetch('/api/reviews/by-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, t: token, rating: stars, body, name, place, website }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) { setStep({ kind: 'error', text: j.error || 'Could not send it just now. Please try again.' }); return; }
    }
    let done = 0;
    for (const p of photos) {
      setStep({ kind: 'busy', text: `Uploading photo ${done + 1} of ${photos.length}…` });
      const u = await uploadReviewPhoto(p, { order: orderId, t: token });
      if (!u.ok) { setStep({ kind: 'done', photoError: u.error }); return; }
      done++;
    }
    setStep({ kind: 'done' });
  };

  if (step.kind === 'done') return (
    <div className="rv-card rv-done" role="status">
      <span aria-hidden>❤</span>
      <h1>Thank you!</h1>
      <p className="muted">We read every review{photos.length ? ' and look at every photo' : ''}. Yours will appear on the site once we have had a look.</p>
      {step.photoError && <p className="msg err">{step.photoError} You can add photos again from this link.</p>}
      <p className="ofb-links"><Link href="/#tools" className="btn small">Make something new</Link> <Link href="/account#review" className="linkish">Your account</Link></p>
    </div>
  );

  const busy = step.kind === 'busy';
  return (
    <form className="rv-card" onSubmit={send} noValidate>
      <div className="rv-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {design.preview ? <img src={design.preview} alt="" /> : <span className="ph" />}
        <div>
          <p className="eyebrow">{design.printed ? 'Your printed order' : 'Your design'}</p>
          <h1>How did it turn out?</h1>
          <p className="muted">{design.name} · {design.tool}</p>
        </div>
      </div>

      {locked ? (
        <div className="rv-locked">
          <p><b>Your review is already on the site.</b> Thank you! You can still add photos of your print below.</p>
          <blockquote>{existing!.body}</blockquote>
        </div>
      ) : (
        <>
          <fieldset className="rv-stars" onMouseLeave={() => setHover(0)}>
            <legend>Your rating</legend>
            <div>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setStars(n)} aria-pressed={stars === n} aria-label={`${n} of 5`} disabled={busy}>★</button>
              ))}
              <span className="word">{WORDS[shown]}</span>
            </div>
          </fieldset>
          <label className="rv-f">Your review
            <textarea className="input" rows={5} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} disabled={busy}
              placeholder={design.printed ? 'How does it look? How was the packing and delivery?' : 'How did it print? Did it come out like the preview? Was the tool easy to use?'} />
          </label>
          <div className="rv-row">
            <label className="rv-f">Name to show<input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Priya S." disabled={busy} /></label>
            <label className="rv-f"><span>Your city <i>optional</i></span><input className="input" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="e.g. Pune" disabled={busy} /></label>
          </div>
          {existing && <p className="fb-note">You wrote a review before; sending again updates it.</p>}
        </>
      )}

      {had.length > 0 && (
        <div className="rp-grid rv-had">
          {had.map((p) => (
            <figure key={p.id} className="rp-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/reviews/photos/${p.id}`} alt="" />
              <figcaption className={`rp-st ${p.status}`}>{p.status === 'published' ? 'On the site' : p.status === 'hidden' ? 'Not shown' : 'Waiting for a look'}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {room > 0 && <PhotoPicker photos={photos} onChange={setPhotos} max={room} disabled={busy} />}
      <label className="fb-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      {step.kind === 'error' && <p className="msg err" role="alert">{step.text}</p>}
      <button type="submit" className="btn" disabled={busy}>{busy ? step.text : locked ? 'Add photos' : 'Send review'}</button>
    </form>
  );
}
