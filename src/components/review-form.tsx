'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitReview } from '@/app/account/actions';
import type { FormState } from '@/app/login/actions';
import { PhotoPicker, type Picked } from '@/components/review-photos';
import { uploadReviewPhoto } from '@/lib/review-photos';

const WORDS = ['', 'Poor', 'Could be better', 'Good', 'Very good', 'Excellent'];

/** Stars, a few words, a name, and photos of the print if they like. One review per account. */
export function ReviewForm({ name, tool = 'shadow-lamp', compact }: { name: string; tool?: string; compact?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(null);
  const [pending, setPending] = useState(false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [sent, setSent] = useState<{ done: number; error?: string } | null>(null);

  // The review is saved first, then its photos go up one by one, all from this one handler: the account page
  // re-renders once the review exists, so nothing here may wait for this form to stay on the screen.
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const r = await submitReview(null, fd);
    setPending(false); setState(r);
    if (!r?.ok || !photos.length) return;
    let done = 0;
    setSent({ done });
    for (const p of photos) {
      const u = await uploadReviewPhoto(p);
      if (!u.ok) { setSent({ done, error: u.error }); router.refresh(); return; }
      setSent({ done: ++done });
    }
    router.refresh();
  };

  if (state?.ok && photos.length && sent && sent.done < photos.length && !sent.error) {
    return <div className="review-thanks" role="status"><p className="serif">Uploading your photos… {sent.done} of {photos.length}</p></div>;
  }
  if (state?.ok) {
    return (
      <div className="review-thanks" role="status">
        <span className="big" aria-hidden>❤</span>
        <p className="serif">Thank you for your review!</p>
        <p>We read every one. Yours{photos.length ? ' and your photos' : ''} will appear on the site once we have had a look.</p>
        {sent?.error && <p className="msg err">{sent.error} You can add photos again from your account.</p>}
      </div>
    );
  }
  const shown = hover || stars;
  return (
    <form onSubmit={submit} className={`form review-form${compact ? ' compact' : ''}`} aria-label="Review">
      <input type="hidden" name="tool" value={tool} />
      <input type="hidden" name="photos" value={photos.length} />
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
      <label>Your review<textarea name="body" required minLength={10} maxLength={1000} rows={compact ? 3 : 4} className="input" placeholder={tool === 'layered-sculpture' ? 'How did your sculpture come out? Was the maker easy to use?' : 'How did your lamp come out? Was the maker easy to use?'} /></label>
      <div className="split" style={{ gap: 14 }}>
        <label>Name to show<input name="name" type="text" required maxLength={80} defaultValue={name} placeholder="e.g. Priya S." /></label>
        <label>Your city (optional)<input name="place" type="text" maxLength={80} placeholder="e.g. Pune" /></label>
      </div>
      <PhotoPicker photos={photos} onChange={setPhotos} disabled={pending} />
      {state?.error && <p className="msg err" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Sending…' : 'Send review'}</button>
    </form>
  );
}
