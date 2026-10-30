'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_REVIEW_PHOTOS, shrinkPhoto, uploadReviewPhoto } from '@/lib/review-photos';

export type Picked = { blob: Blob; w: number; h: number; url: string };

/** Pick up to 4 photos (shrunk in the browser) and show them as thumbnails. Used by the review form. */
export function PhotoPicker({ photos, onChange, max = MAX_REVIEW_PHOTOS, disabled }: { photos: Picked[]; onChange(p: Picked[]): void; max?: number; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (next.length >= max) break;
      if (!/^image\//.test(f.type)) continue;
      const s = await shrinkPhoto(f); if (s) next.push(s);
    }
    onChange(next); setBusy(false);
    if (input.current) input.current.value = '';
  };
  return (
    <div className="rp">
      <div className="rp-grid">
        {photos.map((p, i) => (
          <figure key={p.url} className="rp-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Photo ${i + 1}`} />
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(photos.filter((x) => x !== p))} disabled={disabled}>×</button>
          </figure>
        ))}
        {photos.length < max && (
          <button type="button" className="rp-add" onClick={() => input.current?.click()} disabled={disabled || busy}>
            <span aria-hidden>＋</span>{busy ? 'Adding…' : photos.length ? 'Add another' : 'Add photos of your print'}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} />
      <p className="rp-note">Optional: up to {max} photo{max === 1 ? '' : 's'} of what you made. They appear with your review once we have had a look.</p>
    </div>
  );
}

/** On the account page, for a review already written: its photos (with their status), remove one, add more. */
export function ReviewPhotosManager({ photos }: { photos: { id: string; status: string }[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [state, setState] = useState<{ busy?: boolean; error?: string; ok?: string }>({});
  const room = MAX_REVIEW_PHOTOS - photos.filter((p) => p.status !== 'hidden').length;
  const upload = async () => {
    setState({ busy: true });
    for (const p of picked) {
      const r = await uploadReviewPhoto(p);
      if (!r.ok) { setState({ error: r.error }); return; }
    }
    setPicked([]); setState({ ok: 'Thank you! Your photos will appear once we have had a look.' });
    router.refresh();
  };
  const remove = async (id: string) => {
    await fetch(`/api/reviews/photos?id=${id}`, { method: 'DELETE' });
    router.refresh();
  };
  return (
    <div className="rp-manage">
      {photos.length > 0 && (
        <div className="rp-grid">
          {photos.map((p) => (
            <figure key={p.id} className="rp-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/reviews/photos/${p.id}`} alt="" />
              <figcaption className={`rp-st ${p.status}`}>{p.status === 'published' ? 'On the site' : p.status === 'hidden' ? 'Not shown' : 'Waiting for a look'}</figcaption>
              <button type="button" aria-label="Remove this photo" onClick={() => remove(p.id)}>×</button>
            </figure>
          ))}
        </div>
      )}
      {room > 0 && (
        <>
          <PhotoPicker photos={picked} onChange={setPicked} max={room} disabled={state.busy} />
          {picked.length > 0 && <button type="button" className="btn small" onClick={upload} disabled={state.busy}>{state.busy ? 'Uploading…' : `Add ${picked.length} photo${picked.length === 1 ? '' : 's'}`}</button>}
        </>
      )}
      {state.error && <p className="msg err">{state.error}</p>}
      {state.ok && <p className="msg ok">{state.ok}</p>}
    </div>
  );
}
