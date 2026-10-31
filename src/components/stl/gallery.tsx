'use client';
import { useState } from 'react';

/** The product pictures: a big one and thumbnails. Arrow keys move between them. */
export function Gallery({ pics }: { pics: { src: string; alt: string }[] }) {
  const [i, setI] = useState(0);
  if (!pics.length) return <div className="stl-gal"><div className="stl-gal-main ph" /></div>;
  const go = (n: number) => setI((n + pics.length) % pics.length);
  return (
    <div className="stl-gal" onKeyDown={(e) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); }}>
      <div className="stl-gal-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pics[i].src} alt={pics[i].alt} width={1400} height={1050} fetchPriority={i === 0 ? 'high' : 'auto'} />
        {pics.length > 1 && <>
          <button type="button" className="stl-gal-nav prev" aria-label="Previous picture" onClick={() => go(i - 1)}>‹</button>
          <button type="button" className="stl-gal-nav next" aria-label="Next picture" onClick={() => go(i + 1)}>›</button>
        </>}
      </div>
      {pics.length > 1 && (
        <div className="stl-gal-thumbs" role="tablist" aria-label="Pictures">
          {pics.map((p, k) => (
            <button key={p.src} type="button" role="tab" aria-selected={k === i} aria-label={p.alt} onClick={() => setI(k)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" loading="lazy" width={140} height={105} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
