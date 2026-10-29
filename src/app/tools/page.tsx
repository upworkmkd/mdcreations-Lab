import Link from 'next/link';
import { getCatalog, getCurrency } from '@/lib/catalog.server';
import { ToolCard, splitTools } from '@/components/tool-card';
import { JsonLd, pageMeta } from '@/lib/seo';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';

export const metadata = pageMeta({
  title: 'All 3D Printing Tools – Design Makers & Free Utilities | MD Creations Labs',
  absoluteTitle: true,
  description: 'Every MD Creations Labs tool in one place: shadow lamps, lithophanes, name signs, rangoli stencils, vases and more, plus free utilities like the print cost calculator.',
  path: '/tools',
  keywords: ['3D printing tools', 'STL generator online', 'free 3D printing tools', 'custom STL maker', 'MD Creations Labs'],
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
      <div className="wrap page-title">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Labs</Link><span>/</span><span>Tools</span></nav>
        <h1>All tools</h1>
        <p className="lede">Design it in your browser with a live 3D preview, then download the print-ready files. {design.length} design {design.length === 1 ? 'tool' : 'tools'}{free.length ? ` and ${free.length} free ${free.length === 1 ? 'one' : 'ones'}` : ''}, with more every month.</p>
      </div>

      <section className="section" id="design-tools">
        <div className="wrap">
          <div className="center-head">
            <p className="eyebrow">The workbench</p>
            <h2>Design tools</h2>
            <p>Free to design and preview. Pay once per design for the files, or choose a plan.</p>
          </div>
          <ul className={`toolgrid${design.length < 4 ? ' few' : ''}`}>{design.map((t) => <ToolCard key={t.slug} t={t} currency={currency} />)}</ul>
        </div>
      </section>

      {free.length > 0 && (
        <section className="section soft" id="free-tools">
          <div className="wrap">
            <div className="center-head">
              <p className="eyebrow">Nothing to pay</p>
              <h2>Free tools</h2>
              <p>Handy tools for the jobs around printing, free to use.</p>
            </div>
            <ul className={`toolgrid${free.length < 4 ? ' few' : ''}`}>{free.map((t) => <ToolCard key={t.slug} t={t} currency={currency} />)}</ul>
          </div>
        </section>
      )}
    </>
  );
}
