'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export type Slide = {
  slug: string; name: string; badge: string; live: boolean; price: string | null;
  title: string; lede: string; image: string; primary: { href: string; label: string }; secondary: { href: string; label: string };
};

const DELAY = 6500;

/** The featured-tools card on the home page: a few tools, one at a time. Crossfades, swipes on touch,
 * pauses on hover or focus, and does not move on its own for people who prefer reduced motion. */
export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const touch = useRef<number | null>(null);
  const go = useCallback((i: number) => setAt((i + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches); on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (paused || reduce || slides.length < 2) return;
    const t = setTimeout(() => go(at + 1), DELAY);
    return () => clearTimeout(t);
  }, [at, paused, reduce, go, slides.length]);

  return (
    <div className="feature" aria-roledescription="carousel" aria-label="Featured tools"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const s = touch.current; touch.current = null; if (s == null) return; const dx = e.changedTouches[0].clientX - s; if (Math.abs(dx) > 50) go(at + (dx < 0 ? 1 : -1)); }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(at + 1); if (e.key === 'ArrowLeft') go(at - 1); }}>
      <div className="feature-stage">
        {slides.map((s, i) => (
          <article key={s.slug} className={`fslide${i === at ? ' on' : ''}`} role="group" aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${s.name}`} aria-hidden={i !== at} inert={i !== at}>
            <div className="fslide-pic"><Image src={s.image} alt="" fill priority={i === 0} sizes="(max-width: 860px) 100vw, 62vw" /></div>
            <div className="fslide-text">
              <p className="fslide-top">
                <span className="badge">{s.badge}</span>
                <span className="fname">{s.name}</span>
              </p>
              <h2>{s.title}</h2>
              <p className="lede">{s.lede}</p>
              <div className="actions">
                <Link href={s.primary.href} className="btn light">{s.primary.label} <span className="arrow">→</span></Link>
                <Link href={s.secondary.href} className="btn on-dark">{s.secondary.label}</Link>
              </div>
              <p className="fprice">{s.live ? (s.price ? <>Try free · files from <b>{s.price}</b></> : 'Free to use') : 'Coming soon · try the preview'}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="feature-nav">
        <div className="dots" role="tablist" aria-label="Choose a featured tool">
          {slides.map((s, i) => (
            <button key={s.slug} role="tab" aria-selected={i === at} aria-label={s.name} className={i === at ? 'on' : ''} onClick={() => go(i)}>
              <span className="t">{s.name}</span>
              <span className="bar"><span style={i === at && !paused && !reduce ? { animationDuration: `${DELAY}ms` } : { animation: 'none', width: i === at ? '100%' : 0 }} key={`${at}-${paused}`} /></span>
            </button>
          ))}
        </div>
        <div className="arrows">
          <button type="button" aria-label="Previous tool" onClick={() => go(at - 1)}>←</button>
          <button type="button" aria-label="Next tool" onClick={() => go(at + 1)}>→</button>
        </div>
      </div>
    </div>
  );
}
