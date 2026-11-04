import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/auth.server';
import type { Metadata } from 'next';
import { getCurrency, getTool } from '@/lib/catalog.server';
import { TOOLS } from '@/lib/tools';
import { formatMoney } from '@/lib/money';
import Image from 'next/image';
import { INSTAGRAM_URL, SUPPORT_EMAIL } from '@/lib/env';
import { LAMP_GALLERY, KIND_LABEL } from '@/lib/gallery';
import { SocialBand } from '@/components/social-band';
import { Reviews } from '@/components/reviews';
import { LICENSE_POINTS } from '@/lib/license';
import { JsonLd, pageMeta, TOOL_SEO } from '@/lib/seo';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';
import { getGuides } from '@/lib/guides.server';
import { KNOWN_VIDEOS, youtubeId, ytThumb, ytWatch } from '@/lib/youtube';
import { YouTubeEmbed } from '@/components/video/youtube';
import { SampleLink } from '@/components/maker/sample-link';

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<'/tools/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const tool = TOOLS.find((x) => x.slug === slug);
  if (!tool) return {};
  const seo = TOOL_SEO[slug];
  return pageMeta({ title: seo?.title ?? tool.name, absoluteTitle: true, description: seo?.description ?? tool.short, path: `/tools/${slug}`, image: tool.image, keywords: seo?.keywords });
}

export default async function ToolPage({ params }: PageProps<'/tools/[slug]'>) {
  const { slug } = await params;
  const [tool, currency, viewer] = await Promise.all([getTool(slug), getCurrency(), getViewer()]);
  if (!tool) notFound();
  const live = tool.status === 'live';
  const price = tool.prices[currency];
  // the tutorial video (shadow lamp for now), with its details for Google's video results
  const videoId = live && tool.slug === 'shadow-lamp' ? youtubeId((await getGuides()).shadowVideo) : null;
  const video = videoId ? KNOWN_VIDEOS[videoId] : null;

  const url = `${SITE_URL}/tools/${tool.slug}`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication', name: tool.name, url, description: TOOL_SEO[tool.slug]?.description ?? tool.lede,
        applicationCategory: 'DesignApplication', operatingSystem: 'Any (web browser)', image: `${SITE_URL}${tool.image}`,
        publisher: { '@id': `${SITE_URL}/#org` },
        ...(live && tool.free ? { offers: { '@type': 'Offer', price: '0', priceCurrency: currency } } : {}),
        ...(live && !tool.free ? { offers: Object.entries(tool.prices).map(([c, a]) => ({ '@type': 'Offer', price: ((a as number) / 100).toFixed(2), priceCurrency: c, availability: 'https://schema.org/InStock', url: `${SITE_URL}${tool.makePath ?? `/tools/${tool.slug}`}` })) } : {}),
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Labs', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/tools` },
        { '@type': 'ListItem', position: 3, name: tool.name, item: url },
      ] },
      ...(videoId ? [{
        '@type': 'VideoObject', name: video?.title ?? `How to use the ${tool.name}`, description: video?.description ?? tool.lede,
        thumbnailUrl: ytThumb(videoId), embedUrl: `https://www.youtube.com/embed/${videoId}`, contentUrl: ytWatch(videoId),
        ...(video ? { uploadDate: video.uploadDate, duration: video.duration } : {}),
        publisher: { '@id': `${SITE_URL}/#org` },
      }] : []),
      ...(tool.faq.length ? [{ '@type': 'FAQPage', mainEntity: tool.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
    ],
  };

  return (
    <>
      <JsonLd data={ld} />
      <div className="wrap page-title">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/tools">Tools</Link><span>/</span><span>{tool.index}</span></nav>
        <h1>{tool.name}</h1>
        <p className="lede">{tool.lede}</p>
        <div className="actions">
          {live && tool.makePath ? (
            <>
              <Link href={tool.makePath} className="btn">{tool.noAccount ? 'Open the tool' : 'Open the maker'} <span className="arrow">→</span></Link>
              {tool.free ? <span className="mono muted" style={{ fontSize: 14 }}>{tool.noAccount ? 'Free · no account needed' : 'Free · sign in to download your files'}</span>
                : price != null && <span className="mono muted" style={{ fontSize: 14 }}>Free to try · {formatMoney(price, currency)} to download a design</span>}
            </>
          ) : (
            <>
              <span className="status">Coming soon</span>
              {viewer?.role === 'admin' && tool.makePath && <Link href={tool.makePath} className="btn small ghost">Try it (admin preview)</Link>}
            </>
          )}
        </div>
      </div>
      <div className="tool-banner">
        <Image src={tool.image} alt={`${tool.name}`} fill priority sizes="100vw" />
        <span className="chip">{live ? 'Rendered from files made with this tool' : 'A first look: rendered concept'}</span>
      </div>

      {live ? (
        <>
          <section className="section">
            <div className="wrap">
              <div className="steps3">
                {tool.steps.map((s, i) => (
                  <div key={s.title}>
                    <span className="n">{['i.', 'ii.', 'iii.'][i]}</span>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          {videoId && (
            <section className="section" id="video">
              <div className="wrap tool-video">
                <YouTubeEmbed id={videoId} title={video?.title ?? `How to use the ${tool.name}`} where="tool-page" />
                <div>
                  <p className="eyebrow">Video tutorial · 2:35</p>
                  <h2>Watch how to make a shadow lamp</h2>
                  <p>Which pictures make a sharp shadow, how to remove a background or turn a drawing into an SVG, and what every setting does, up to downloading the STL files.</p>
                  <ol>{([
                    ['0:00', 'Introduction'],
                    ['0:14', 'Which pictures work best'],
                    ['0:26', 'Remove the background'],
                    ['0:39', 'Turn a drawing into an SVG'],
                    ['0:58', 'How to read your picture'],
                    ['1:11', 'Darkness, smoothing and swap'],
                    ['1:33', 'Size, position and loose pieces'],
                    ['1:59', 'Check it in 3D and lit'],
                    ['2:10', 'Cover plate and the STL files']
                  ] as const).map(([t, n]) => { const [m, sec] = t.split(':').map(Number); return <li key={t}><a href={`${ytWatch(videoId)}&t=${m * 60 + sec}s`} target="_blank" rel="noopener"><span className="mono">{t}</span> {n}</a></li>; })}</ol>
                  {tool.makePath && <p><Link href={tool.makePath} className="btn small">Make yours now <span className="arrow">→</span></Link></p>}
                </div>
              </div>
            </section>
          )}
          {tool.slug === 'shadow-lamp' && (
            <section className="section" id="gallery">
              <div className="wrap">
                <div className="section-head">
                  <h2>Designs, not just deities</h2>
                  <p>Animals, places, plants, symbols, names and portraits. Each shadow here was worked out by the maker from one picture; the lamp pictures are rendered from the files it generated. Tap a design to open it in the maker and make it yours.</p>
                </div>
                <div className="mosaic">
                  {LAMP_GALLERY.map((g, i) => {
                    const fig = (
                      <figure className={`tile${i % 5 === 0 ? ' wide' : ''}`}>
                        <Image src={g.src} alt={`${g.title} shadow lamp`} fill sizes="(max-width: 820px) 50vw, 25vw" />
                        <figcaption><b>{g.title}</b><span>{g.note} · {KIND_LABEL[g.kind]}</span></figcaption>
                      </figure>
                    );
                    return g.example ? <Link key={g.src} href={`/tools/shadow-lamp/make?example=${g.example}`} style={{ display: 'contents' }}>{fig}</Link> : <div key={g.src} style={{ display: 'contents' }}>{fig}</div>;
                  })}
                </div>
              </div>
            </section>
          )}
          <section className="section">
            <div className="wrap split">
              <div>
                <p className="eyebrow">{tool.specsTitle ?? 'At a glance'}</p>
                <table className="specs" style={{ marginTop: 18 }}>
                  <tbody>{tool.specs.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody>
                </table>
              </div>
              {tool.free ? (
              <div className="price-card">
                <p className="eyebrow">Free tool</p>
                <div className="amount">Free</div>
                <p className="per">{tool.noAccount ? 'no account, no payment · works in your browser' : 'no payment · sign in to save and download your files'}</p>
                <ul>{tool.youGet.map((x) => <li key={x}>{x}</li>)}</ul>
                {tool.makePath && <Link href={tool.makePath} className="btn">{tool.noAccount ? 'Open the tool' : 'Open the maker'} <span className="arrow">→</span></Link>}
                <p className="per" style={{ marginTop: 14 }}>Want more? <Link href="/pricing">Our paid makers</Link> turn pictures into lamps, sculptures and more.</p>
              </div>
              ) : (
              <div className="price-card">
                <p className="eyebrow">One design, one price</p>
                <div className="amount">{price != null ? formatMoney(price, currency) : '—'}</div>
                <p className="per">per design · {currency === 'INR' ? 'incl. GST where applicable' : 'paid by card'} · download again any time</p>
                <ul>{tool.youGet.map((x) => <li key={x}>{x}</li>)}</ul>
                {tool.makePath && <Link href={tool.makePath} className="btn">Start designing <span className="arrow">→</span></Link>}
                {tool.slug === 'shadow-lamp' && <SampleLink where="tool-page" />}
                <p className="per" style={{ marginTop: 14 }}>Making these often? <Link href="/pricing">A monthly plan</Link> includes up to 10 designs a day, for every tool.</p>
              </div>
              )}
            </div>
          </section>
          {tool.files !== false && <section className="section band">
            <div className="wrap split license-band">
              <div>
                <p className="eyebrow" style={{ color: 'var(--light)' }}>Commercial license included</p>
                <h2 className="serif" style={{ fontSize: 'clamp(30px, 4vw, 44px)', lineHeight: 1.08, marginTop: 10 }}>Make it, sell it. The files are yours to use.</h2>
                <p style={{ marginTop: 14, opacity: .85 }}>Every download, bought on its own or with a plan, comes with a commercial license. A copy with your name and order number is saved as LICENSE.txt in the zip.</p>
                <Link href="/license" className="btn on-dark" style={{ marginTop: 22 }}>Read the license</Link>
              </div>
              <ul className="checks">{LICENSE_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          </section>}
          {tool.faq.length > 0 && (
            <section className="section">
              <div className="wrap split">
                <h2 className="serif" style={{ font: '500 clamp(34px,4.4vw,54px)/1.04 var(--serif)' }}>Questions people ask</h2>
                <div className="faq">
                  {tool.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="section">
          <div className="wrap split">
            <div>
              <p className="eyebrow">What it will do</p>
              <ul className="ticks" style={{ marginTop: 18 }}>{tool.youGet.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="price-card">
              <p className="eyebrow">Being built</p>
              <p className="serif" style={{ fontSize: 28, lineHeight: 1.2 }}>We are working on this one. Tell us what you would make with it and we will let you know when it opens.</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <a className="btn" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(tool.name + ' – let me know')}`}>Email us</a>
                <a className="btn ghost" href={INSTAGRAM_URL} rel="noopener">Follow on Instagram</a>
              </div>
              <Link href="/tools/shadow-lamp" className="linkish">Meanwhile, try the Shadow Lamp Maker</Link>
            </div>
          </div>
        </section>
      )}
      {tool.status === 'live' && <Reviews tool={tool.slug} />}
      <SocialBand />
    </>
  );
}
