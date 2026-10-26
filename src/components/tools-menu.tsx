'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type MenuTool = { slug: string; name: string; short: string; image: string; live: boolean; price: string | null };

/**
 * "Tools" in the main menu: a panel with every tool, paid ones on the left and free ones on the right.
 * Opens on hover (with a short delay) or click, closes on Esc, a click outside or moving to another page.
 * On phones it opens as a sheet under the header.
 */
export function ToolsMenu({ paid, free }: { paid: MenuTool[]; free: MenuTool[] }) {
  const path = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);   // the page it was opened on: a new page closes it
  const open = openOn === path;
  const id = useId(), wrap = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), timer = useRef(0);

  const later = (fn: () => void, ms: number) => { clearTimeout(timer.current); timer.current = window.setTimeout(fn, ms); };
  const show = () => setOpenOn(path), hide = () => setOpenOn(null);
  const hover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { hide(); btn.current?.focus(); } };
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) hide(); };
    window.addEventListener('keydown', key); window.addEventListener('pointerdown', down);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', down); };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const item = (t: MenuTool) => (
    <li key={t.slug}>
      <Link href={`/tools/${t.slug}`} className="tm-item" onClick={hide}>
        <span className="tm-thumb"><Image src={t.image} alt="" fill sizes="88px" loading="eager" fetchPriority="low" /></span>
        <span className="tm-text">
          <span className="tm-name">{t.name}{!t.live && <span className="tm-soon">Soon</span>}</span>
          <span className="tm-short">{t.short}</span>
          {t.live && t.price && <span className="tm-price">{t.price}</span>}
        </span>
      </Link>
    </li>
  );

  return (
    <div ref={wrap} className={`tm${open ? ' open' : ''}`}
      onMouseEnter={() => { if (hover()) later(show, 120); }}
      onMouseLeave={() => { if (hover()) later(hide, 220); }}>
      <button ref={btn} type="button" className="tm-btn" aria-expanded={open} aria-controls={id}
        onClick={() => { clearTimeout(timer.current); if (open) hide(); else show(); }}>
        Tools <span className="tm-caret" aria-hidden>▾</span>
      </button>
      <div id={id} className="tm-panel" hidden={!open}>
        <div className="wrap tm-grid">
          <section className="tm-paid" aria-labelledby={`${id}-p`}>
            <header><h2 id={`${id}-p`}>Design and download</h2><p>Free to design and preview. Pay once per design for the print-ready files.</p></header>
            <ul className="tm-list two">{paid.map(item)}</ul>
          </section>
          <section className="tm-free" aria-labelledby={`${id}-f`}>
            <header><h2 id={`${id}-f`}>Free tools</h2><p>No account, no payment.</p></header>
            <ul className="tm-list">{free.map(item)}</ul>
            <div className="tm-foot">
              <Link href="/#tools" className="btn small" onClick={hide}>See all tools <span className="arrow">→</span></Link>
              <Link href="/pricing" className="linkish" onClick={hide}>Pricing and plans</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
