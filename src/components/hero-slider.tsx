'use client';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export type Slide = {
  slug: string; index: string; name: string; live: boolean; price: string | null; badge?: string;
  title: string; lede: string; image: string; primary: { href: string; label: string }; secondary: { href: string; label: string };
};

const DELAY = 7000;

/** Full-bleed slider for the featured tools: one slide per tool. Crossfades, pauses on hover or focus, no autoplay for reduced motion. */
export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
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
    <section className="slider" aria-roledescription="carousel" aria-label="Featured tools"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => { if (e.key === 'ArrowRight') go(at + 1); if (e.key === 'ArrowLeft') go(at - 1); }}>
      {slides.map((s, i) => (
        <div key={s.slug} className={`slide${i === at ? ' on' : ''}`} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${slides.length}: ${s.name}`} aria-hidden={i !== at} inert={i !== at}>
          <div className="bg"><Image src={s.image} alt="" fill priority={i === 0} sizes="100vw" /></div>
          <div className="wrap">
            <p className="eyebrow">{s.badge && <span className="badge">{s.badge}</span>}<span className="idx">{s.index}</span> {s.name} <span className={`tag ${s.live ? 'live' : ''}`}>{s.live ? (s.price ? `Live · ${s.price}` : 'Live') : 'Coming soon'}</span></p>
            <h1>{s.title}</h1>
            <p className="lede">{s.lede}</p>
            <div className="actions">
              <Link href={s.primary.href} className="btn light">{s.primary.label} <span className="arrow">→</span></Link>
              <Link href={s.secondary.href} className="btn on-dark">{s.secondary.label}</Link>
            </div>
          </div>
        </div>
      ))}
      <div className="slider-nav wrap">
        <div className="tabs" role="tablist" aria-label="Choose a tool" style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }}>
          {slides.map((s, i) => (
            <button key={s.slug} role="tab" aria-selected={i === at} className={i === at ? 'on' : ''} onClick={() => go(i)}>
              <span className="n">{s.index}</span>
              <span className="t">{s.name}</span>
              <span className="bar"><span style={i === at && !paused && !reduce ? { animationDuration: `${DELAY}ms` } : { animation: 'none', width: i === at ? '100%' : 0 }} key={`${at}-${paused}`} /></span>
            </button>
          ))}
        </div>
        <div className="arrows">
          <button aria-label="Previous tool" onClick={() => go(at - 1)}>←</button>
          <button aria-label="Next tool" onClick={() => go(at + 1)}>→</button>
        </div>
      </div>
    </section>
  );
}
