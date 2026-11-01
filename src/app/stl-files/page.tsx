import Link from 'next/link';
import { getCurrency } from '@/lib/catalog.server';
import { liveProducts } from '@/lib/stl/shop.server';
import { priceLabel, publicImageUrl } from '@/lib/stl/product';
import { JsonLd, pageMeta } from '@/lib/seo';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';

export const revalidate = 300;

export const metadata = pageMeta({
  title: 'STL Files for 3D Printing – Scale Models & Kits by MD Creations',
  absoluteTitle: true,
  description: 'Print-ready STL files designed and test-printed by MD Creations: scale models and build kits with assembly guides, hardware lists and a commercial license to sell your prints.',
  path: '/stl-files',
  keywords: ['stl files', '3d print stl files', 'stl files for 3d printing', 'scale model stl', '3d printable model kits', 'buy stl files india'],
});

export default async function StlShop() {
  const [items, currency] = await Promise.all([liveProducts(), getCurrency()]);
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: 'STL files', url: `${SITE_URL}/stl-files`, isPartOf: { '@id': `${SITE_URL}/#site` } },
      { '@type': 'ItemList', itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.title, url: `${SITE_URL}/stl-files/${p.slug}` })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Labs', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'STL files', item: `${SITE_URL}/stl-files` },
      ] },
    ],
  };
  return (
    <>
      <JsonLd data={ld} />
      <div className="wrap page-title">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Labs</Link><span>/</span><span>STL files</span></nav>
        <h1>STL files</h1>
        <p className="lede">Our own designs, test-printed in our workshop. Each one comes with the STL parts, an assembly guide, the hardware list and print settings, and a commercial license to sell what you print. No printer? Order it printed and we post it to you.</p>
      </div>
      <section className="section">
        <div className="wrap">
          {items.length ? (
            <ul className={`toolgrid stl-grid${items.length < 3 ? ' few' : ''}`}>
              {items.map((p) => {
                const price = priceLabel(p, currency), img = p.images[0];
                return (
                  <li key={p.id} className="tcard live">
                    <Link href={`/stl-files/${p.slug}`}>
                      <span className="pic">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {img ? <img src={publicImageUrl(img.path)} alt={img.alt || `${p.title}, 3D printed model`} width={1400} height={1050} loading="lazy" decoding="async" /> : null}
                        {price && <span className="chip live">{price}</span>}
                      </span>
                      <span className="body">
                        <span className="head"><span className="name">{p.title}</span><span className="go" aria-hidden>→</span></span>
                        <span className="desc">{p.subtitle}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted">New designs are on their way. Follow us on Instagram to hear first.</p>}
        </div>
      </section>
    </>
  );
}
