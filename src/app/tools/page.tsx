import Link from 'next/link';
import { getCatalog, getCurrency } from '@/lib/catalog.server';
import { ToolCard, splitTools } from '@/components/tool-card';
import { JsonLd, pageMeta } from '@/lib/seo';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';

export const metadata = pageMeta({
  title: 'All 3D Printing Tools – Online STL Makers & Free Utilities',
  absoluteTitle: true,
  description: 'Every MD Creations Labs tool: shadow lamps, lithophanes, name keychains, rangoli stencils, vases and more, plus free utilities like the print cost calculator.',
  path: '/tools',
  keywords: ['3D printing tools', 'online STL generator', 'STL maker online', 'free 3D printing tools', 'custom STL maker', 'photo to STL', 'image to STL', 'shadow lamp maker', 'lithophane maker', 'name keychain STL', 'rangoli stencil STL', 'QR code to STL', '3D print cost calculator', 'MD Creations Labs'],
});

export default async function AllTools() {
  const [tools, currency] = await Promise.all([getCatalog(), getCurrency()]);
  const { design, free } = splitTools(tools);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'All tools', url: `${SITE_URL}/tools`, isPartOf: { '@id': `${SITE_URL}/#site` } },
      { '@type': 'ItemList', itemListElement: [...design, ...free].map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE_URL}/tools/${t.slug}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Labs', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/tools` },
      ] },
    ],
  };
  return (
    <>
      <JsonLd data={ld} />
      <div className="wrap tools-hero">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Labs</Link><span>/</span><span>Tools</span></nav>
          <h1>All 3D printing tools</h1>
          <p className="lede">Design it in your browser with a live 3D preview, then download the print-ready files, or order it printed and posted to you in India.</p>
        </div>
        <nav className="tools-jump" aria-label="Jump to">
          <a href="#design-tools"><b>{design.length}</b><span>Design tools<small>Free to preview, pay per design or a plan</small></span><i aria-hidden>↓</i></a>
          {free.length > 0 && <a href="#free-tools"><b>{free.length}</b><span>Free tools<small>No account, nothing to pay</small></span><i aria-hidden>↓</i></a>}
          <Link href="/stl-files"><b aria-hidden><svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 8.5 12 4l9 4.5-9 4.5L3 8.5Zm0 0V16l9 4.5m0-7.5v7.5m9-12V16l-9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg></b><span>STL files<small>Ready-made models and kits</small></span><i aria-hidden>→</i></Link>
        </nav>
      </div>

      <section className="section tools-sec" id="design-tools">
        <div className="wrap">
          <div className="tools-sec-head">
            <h2>Design tools</h2>
            <p>Free to design and preview. Pay once per design for the files, or choose a plan. Most can also be ordered printed.</p>
          </div>
          <ul className={`toolgrid${design.length < 4 ? ' few' : ''}`}>{design.map((t) => <ToolCard key={t.slug} t={t} currency={currency} />)}</ul>
        </div>
      </section>

      {free.length > 0 && (
        <section className="section soft tools-sec" id="free-tools">
          <div className="wrap">
            <div className="tools-sec-head">
              <h2>Free tools</h2>
              <p>Handy tools for the jobs around printing. Free, no account, made in your browser.</p>
            </div>
            <ul className={`toolgrid${free.length < 4 ? ' few' : ''}`}>{free.map((t) => <ToolCard key={t.slug} t={t} currency={currency} />)}</ul>
          </div>
        </section>
      )}
    </>
  );
}
