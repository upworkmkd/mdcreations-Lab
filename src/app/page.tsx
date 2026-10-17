import Link from 'next/link';
import Image from 'next/image';
import { getCatalog, getCurrency } from '@/lib/catalog.server';
import { formatMoney } from '@/lib/money';
import { HeroSlider, type Slide } from '@/components/hero-slider';
import { LAMP_GALLERY, KIND_LABEL } from '@/lib/gallery';
import { SocialBand } from '@/components/social-band';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'MD Creations Labs – Shadow Lamp Maker & 3D Printing Tools',
  absoluteTitle: true,
  description: 'Make a custom 3D printed shadow lamp from any picture, preview the shadow on your wall and download print-ready STL files. More tools for makers coming: statue maker, layered sculptures and STL repair.',
  path: '/',
  keywords: ['shadow lamp maker', '3D printing tools', 'custom shadow lamp STL', 'photo to STL', 'MD Creations'],
});

const DELIVERABLES: Record<string, { file: string; lines: [string, string?][] }> = {
  'shadow-lamp': { file: 'your-design_shadow_lamp.zip', lines: [['1 top.stl'], ['2 right.stl'], ['3 left.stl'], ['4 bottom.stl'], ['plate.stl'], ['plate picture.stl', 'inlay'], ['Lamp base.stl'], ['Battery cover.stl'], ['shadow preview.jpg'], ['README.txt', 'how-to']] },
  statue: { file: 'your-design_statue.zip', lines: [['statue.stl', 'watertight'], ['statue_hollow.stl', 'resin'], ['base.stl'], ['README.txt']] },
  'layered-sculpture': { file: 'your-design_layers.zip', lines: [['layers_01-40.stl'], ['layers.svg  layers.dxf'], ['keys.stl', 'alignment'], ['assembly.pdf']] },
  'stl-repair': { file: 'your-model_repaired.zip', lines: [['repaired.stl'], ['report.html', 'every fix'], ['before-after.png']] },
};

export default async function Home() {
  const [tools, currency] = await Promise.all([getCatalog(), getCurrency()]);
  const slides: Slide[] = tools.map((t) => {
    const live = t.status === 'live', p = t.prices[currency];
    return {
      slug: t.slug, index: t.index, name: t.name, live, price: live && p != null ? formatMoney(p, currency) : null,
      title: t.slide.title, lede: t.slide.lede, image: t.image,
      primary: live && t.makePath ? { href: t.makePath, label: 'Start designing' } : { href: `/tools/${t.slug}`, label: 'See what is coming' },
      secondary: live ? { href: `/tools/${t.slug}`, label: 'How it works' } : { href: '/#tools', label: 'All tools' },
    };
  });

  return (
    <>
      <HeroSlider slides={slides} />

      <section className="section" id="tools">
        <div className="wrap">
          <div className="section-head">
            <h2>The workbench</h2>
            <p>Small, careful tools that turn pictures and models into files your 3D printer understands. Each tool has its own page. Trying them is free; you pay only when you download the files for a design.</p>
          </div>
          <ul className="catalog">
            {tools.map((t) => {
              const price = t.prices[currency], live = t.status === 'live';
              return (
                <li key={t.slug} className={live ? 'live' : 'soon'}>
                  <Link className="row" href={`/tools/${t.slug}`}>
                    <span className="thumb"><Image src={t.image} alt="" fill sizes="120px" /></span>
                    <span className="name"><span className="idx">{t.index}</span>{t.name}</span>
                    <span className="desc">{t.short}</span>
                    <span className={`status ${live ? 'live' : ''}`}>{live ? (price != null ? `Live · ${formatMoney(price, currency)}` : 'Live') : 'Coming soon'}</span>
                    <span className="go" aria-hidden>→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="section band">
        <div className="wrap">
          <div className="section-head">
            <h2>Every tool works the same way.</h2>
            <p>What you see on screen is worked out from the very files you will print, so there are no surprises when the printer is done.</p>
          </div>
          <div className="steps3">
            {[
              ['Bring a picture or a model', 'A photo, a drawing, a logo, a scan or an STL. It stays in your browser while you work.'],
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

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>Every download is ready for the slicer.</h2>
            <p>One zip per design, named after it, with every part and a short note on how to print and put it together.</p>
          </div>
          <div className="deliver">
            {tools.map((t) => {
              const d = DELIVERABLES[t.slug]; if (!d) return null;
              return (
                <div key={t.slug} className="card">
                  <div className="top"><b>{t.name}</b><span className={`status ${t.status === 'live' ? 'live' : ''}`}>{t.status === 'live' ? 'Live' : 'Soon'}</span></div>
                  <pre className="manifest small"><span className="dir">{d.file}</span>{'\n'}{d.lines.map(([a, b]) => `  ${a}${b ? `  ` : ''}`).map((l, i) => <span key={i}>{l}{d.lines[i][1] ? <span className="dim">· {d.lines[i][1]}</span> : null}{'\n'}</span>)}</pre>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <SocialBand />
    </>
  );
}
