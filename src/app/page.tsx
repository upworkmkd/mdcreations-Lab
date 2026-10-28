import Link from 'next/link';
import Image from 'next/image';
import { getCatalog, getCurrency, type CatalogTool } from '@/lib/catalog.server';
import type { Currency } from '@/lib/money';
import { formatMoney } from '@/lib/money';
import { HeroSlider, type Slide } from '@/components/hero-slider';
import { LAMP_GALLERY, KIND_LABEL } from '@/lib/gallery';
import { SocialBand } from '@/components/social-band';
import { Reviews } from '@/components/reviews';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'MD Creations Labs – Shadow Lamp Maker & 3D Printing Tools',
  absoluteTitle: true,
  description: 'Design 3D prints in your browser: custom shadow lamps, Diwali rangoli stencils, photo lithophanes, name keychains and more. Download print-ready STL files.',
  path: '/',
  keywords: ['3D printing tools', 'shadow lamp maker', '3D printed rangoli stencil', 'lithophane maker', 'name keychain STL', 'custom shadow lamp STL', 'photo to STL', 'MD Creations'],
});

// The tools in the slider at the top, in this order, with the little badge on each. Everything else is listed below.
const FEATURED: { slug: string; badge: string }[] = [
  { slug: 'shadow-lamp', badge: 'Most loved' },
  { slug: 'cookie-cutter', badge: 'Diwali special' },
  { slug: 'lithophane', badge: 'Perfect gift' },
  { slug: 'name-sign', badge: 'Best seller' },
];

function chip(t: CatalogTool, currency: Currency) {
  const p = t.prices[currency];
  if (t.status !== 'live') return { text: 'Coming soon', cls: 'soon' };
  if (t.free) return { text: 'Free', cls: 'free' };
  return { text: p != null ? `from ${formatMoney(p, currency)}` : 'Live', cls: 'live' };
}

function ToolCard({ t, currency }: { t: CatalogTool; currency: Currency }) {
  const c = chip(t, currency);
  return (
    <li className={`tcard ${t.status === 'live' ? 'live' : 'soon'}`}>
      <Link href={`/tools/${t.slug}`}>
        <span className="pic">
          <Image src={t.image} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 380px" />
          <span className={`chip ${c.cls}`}>{c.text}</span>
        </span>
        <span className="body">
          <span className="head"><span className="name">{t.name}</span><span className="go" aria-hidden>→</span></span>
          <span className="desc">{t.short}</span>
        </span>
      </Link>
    </li>
  );
}

export default async function Home() {
  const [tools, currency] = await Promise.all([getCatalog(), getCurrency()]);
  const slides: Slide[] = FEATURED.flatMap(({ slug, badge }) => {
    const t = tools.find((x) => x.slug === slug); if (!t) return [];
    const live = t.status === 'live', p = t.prices[currency];
    return [{
      slug: t.slug, index: t.index, name: t.name, badge, live, price: live && !t.free && p != null ? formatMoney(p, currency) : null,
      title: t.slide.title, lede: t.slide.lede, image: t.image,
      primary: live && t.makePath ? { href: t.makePath, label: 'Start designing' } : { href: `/tools/${t.slug}`, label: 'See what is coming' },
      secondary: live ? { href: `/tools/${t.slug}`, label: 'How it works' } : { href: '/#tools', label: 'All tools' },
    }];
  });
  // live tools first, then the ones that are coming; the free utilities get their own row
  const order = (a: CatalogTool, b: CatalogTool) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1);
  const design = tools.filter((t) => !t.free).sort(order), free = tools.filter((t) => t.free).sort(order);
  const liveCount = tools.filter((t) => t.status === 'live').length;

  return (
    <>
      <HeroSlider slides={slides} />

      <section className="section ways">
        <div className="wrap">
          <div className="ways-head">
            <p className="eyebrow">Labs · {liveCount} {liveCount === 1 ? 'tool' : 'tools'} live, more every month</p>
            <h2>Design it in your browser.<br /><em>Print it yourself, or let us print it for you.</em></h2>
            <p className="lede">Shape your shadow lamp, rangoli stencil, lithophane or name sign with a live 3D preview. Then take the print-ready files to your own printer, or place an order and we print it in our workshop and ship it to your door.</p>
          </div>
          <div className="ways-grid">
            <div className="way">
              <p className="num">Way 1 · For makers</p>
              <h3>Print it on your printer</h3>
              <p>Download the files for your design and print them at home or in your shop.</p>
              <ul>
                <li>Print-ready STL and two-colour 3MF files</li>
                <li>Print notes with layer heights and colour changes</li>
                <li>Commercial license: sell what you print</li>
              </ul>
              <div className="actions"><Link href="#tools" className="btn">Pick a tool <span className="arrow">→</span></Link></div>
            </div>
            <div className="way dark">
              <p className="num">Way 2 · No printer needed <span className="soon">Coming soon</span></p>
              <h3>We print it and ship it</h3>
              <p>Customise any design, place your order, and we print it in our workshop and deliver it to your address.</p>
              <ul>
                <li>Your design, your colours, printed by us</li>
                <li>Checked and packed by hand</li>
                <li>Delivered across India</li>
              </ul>
              <div className="actions"><span className="btn light" aria-disabled="true">Ordering opens soon</span><span className="note">Design now, order when it opens.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="tools">
        <div className="wrap">
          <div className="center-head">
            <p className="eyebrow">The workbench</p>
            <h2>Design tools</h2>
            <p>Pick a tool and shape your design with a live preview. A tool for every idea, from gifts to Diwali decor.</p>
          </div>
          <ul className={`toolgrid${design.length < 4 ? ' few' : ''}`}>{design.map((t) => <ToolCard key={t.slug} t={t} currency={currency} />)}</ul>
        </div>
      </section>

      {free.length > 0 && (
        <section className="section soft" id="free-tools">
          <div className="wrap">
            <div className="center-head">
              <p className="eyebrow">No account needed</p>
              <h2>Free tools</h2>
              <p>Handy utilities for the jobs around printing. Nothing to install and nothing to pay.</p>
            </div>
            <ul className={`toolgrid${free.length < 4 ? ' few' : ''}`}>{free.map((t) => <ToolCard key={t.slug} t={t} currency={currency} />)}</ul>
          </div>
        </section>
      )}

      <section className="section band">
        <div className="wrap">
          <div className="section-head">
            <h2>Every tool works the same way.</h2>
            <p>What you see on screen is worked out from the very files you will print, so there are no surprises when the printer is done.</p>
          </div>
          <div className="steps3">
            {[
              ['Bring a picture or a model', 'A photo, a drawing, a logo, a scan or an STL. A copy is kept for 10 days to improve the tools, unless you untick the box under the upload.'],
              ['Shape it, free', 'Size, place and tune it with a live preview of the finished piece. Try as many versions as you like.'],
              ['Pay once, keep it', 'Buy the design you like and the print-ready files are built for you. They stay in your account to download again.'],
            ].map(([h, p], i) => (
              <div key={h} style={{ borderTopColor: 'color-mix(in srgb, var(--paper) 45%, transparent)' }}>
                <span className="n" style={{ color: 'var(--light)' }}>{['i.', 'ii.', 'iii.'][i]}</span>
                <h3>{h}</h3>
                <p className="muted">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>Made with the Shadow Lamp Maker</h2>
            <p>Animals, places, plants, symbols. If it reads as a shape, it can be a lamp. Each shadow below was worked out by the maker from a single picture.</p>
          </div>
          <div className="mosaic">
            {LAMP_GALLERY.slice(0, 7).map((g, i) => (
              <figure key={g.src} className={`tile${i === 0 ? ' wide' : ''}`}>
                <Image src={g.src} alt={`${g.title} shadow lamp`} fill sizes="(max-width: 820px) 50vw, 25vw" />
                <figcaption><b>{g.title}</b><span>{KIND_LABEL[g.kind]}</span></figcaption>
              </figure>
            ))}
          </div>
          <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/tools/shadow-lamp/make" className="btn">Make one from your picture <span className="arrow">→</span></Link>
            <Link href="/tools/shadow-lamp#gallery" className="btn ghost">See all designs</Link>
          </div>
        </div>
      </section>

      <Reviews />

      <SocialBand />
    </>
  );
}
