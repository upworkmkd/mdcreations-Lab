import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getViewer } from '@/lib/auth.server';
import { getCurrency } from '@/lib/catalog.server';
import { productBySlug } from '@/lib/stl/shop.server';
import { downloadPrice, lines, paragraphs, publicImageUrl } from '@/lib/stl/product';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { formatMoney } from '@/lib/money';
import { PRODUCT_LICENSE_POINTS } from '@/lib/license';
import { JsonLd, pageMeta } from '@/lib/seo';
import { CANONICAL_URL as SITE_URL, SUPPORT_EMAIL } from '@/lib/env';
import { Gallery } from '@/components/stl/gallery';
import { StlBuy } from '@/components/stl/stl-buy';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/stl-files/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getViewer().catch(() => null);
  const p = await productBySlug(slug, viewer?.role === 'admin');
  if (!p) return {};
  return pageMeta({
    title: p.seo_title || `${p.title} – STL Files`, absoluteTitle: true,
    description: p.seo_description || p.subtitle, path: `/stl-files/${p.slug}`, keywords: p.keywords,
    image: p.images[0] ? publicImageUrl(p.images[0].path) : undefined, noindex: p.status !== 'live',
  });
}

const FAQ = (title: string, parts: number) => [
  { q: 'What do I get?', a: `A zip with ${parts ? `all ${parts} STL files` : 'the STL files'} for the ${title}, a README with the assembly steps, hardware list and print settings, a preview picture and your license.` },
  { q: 'When can I download it?', a: 'Straight after payment, on this page and in your account, where you can download it again any time.' },
  { q: 'Can I sell what I print?', a: 'Yes. Print as many as you like and sell the printed models anywhere. Please do not share or resell the STL files themselves.' },
  { q: 'Which printer do I need?', a: 'Any FDM printer, such as a Bambu Lab A1, Prusa or Ender. Check the bed size in the details above.' },
  { q: 'Can you print it for me?', a: 'Yes, where “Order it printed” is shown: we print it, put it together and post it to you within India.' },
];

export default async function StlProduct({ params }: PageProps<'/stl-files/[slug]'>) {
  const { slug } = await params;
  const [viewer, currency] = await Promise.all([getViewer().catch(() => null), getCurrency()]);
  const admin = viewer?.role === 'admin';
  const p = await productBySlug(slug, admin);
  if (!p) notFound();
  const price = downloadPrice(p, currency);
  const url = `${SITE_URL}/stl-files/${p.slug}`;
  const pics = p.images.map((i) => ({ src: publicImageUrl(i.path), alt: i.alt || `${p.title} 3D printed model` }));
  // owns the files already: show "download again" instead of a second payment
  let ownedFile: string | null = null;
  if (viewer && supabaseConfigured()) {
    const { data } = await supabaseAdmin().from('files').select('id').eq('user_id', viewer.id).eq('product_id', p.id).limit(1).maybeSingle();
    ownedFile = data?.id ?? null;
  }
  const payConfigured = supabaseConfigured() && Boolean(process.env.RAZORPAY_KEY_ID);
  const hw = p.hardware.filter((h) => h.item), steps = lines(p.assembly), tips = lines(p.print_notes), parts = p.parts.length;
  const faq = FAQ(p.title, parts);

  const offers = [
    ...(p.price_inr != null ? [{ '@type': 'Offer', price: (p.price_inr / 100).toFixed(2), priceCurrency: 'INR', availability: 'https://schema.org/InStock', url, category: 'Digital download' }] : []),
    ...(p.price_usd != null ? [{ '@type': 'Offer', price: (p.price_usd / 100).toFixed(2), priceCurrency: 'USD', availability: 'https://schema.org/InStock', url, category: 'Digital download' }] : []),
  ];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product', '@id': `${url}#product`, name: p.title, description: p.seo_description || p.subtitle, sku: p.slug, url,
        image: pics.map((x) => x.src), brand: { '@type': 'Brand', name: 'MD Creations' }, category: '3D printing STL files',
        ...(offers.length ? { offers } : {}),
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Labs', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'STL files', item: `${SITE_URL}/stl-files` },
        { '@type': 'ListItem', position: 3, name: p.title, item: url },
      ] },
      { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ],
  };

  return (
    <>
      <JsonLd data={ld} />
      <div className="wrap stl-top">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/stl-files">STL files</Link><span>/</span><span>{p.title}</span></nav>
        {p.status !== 'live' && <p className="msg" style={{ marginTop: 12 }}>Admin preview: this design is {p.status}, so only you can see this page.</p>}
        <div className="stl-hero">
          <Gallery pics={pics} />
          <div className="stl-side">
            <h1>{p.title}</h1>
            <p className="lede">{p.subtitle}</p>
            <StlBuy productId={p.id} title={p.title} slug={p.slug} currency={currency} priceMinor={price}
              printPriceMinor={currency === 'INR' ? p.print_price_inr : null} signedIn={Boolean(viewer)} payConfigured={payConfigured || admin}
              ownedFileId={ownedFile} preview={pics[0]?.src ?? ''} />
            <ul className="stl-incl">
              <li>{parts ? `${parts} STL files` : 'STL files'}, ready to slice</li>
              <li>Assembly guide{hw.length ? ', hardware list' : ''} and print settings</li>
              <li>Commercial license: sell your prints</li>
              <li>Instant download, again any time from your account</li>
            </ul>
          </div>
        </div>
      </div>

      <section className="section stl-body">
        <div className="wrap stl-cols">
          <div className="stl-main">
            {p.description && <div className="stl-desc">{paragraphs(p.description).map((x, i) => <p key={i}>{x}</p>)}</div>}

            {steps.length > 0 && (
              <section aria-labelledby="assembly">
                <h2 id="assembly">Assembly</h2>
                <ol className="stl-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
              </section>
            )}

            <section aria-labelledby="hardware">
              <h2 id="hardware">Hardware you need</h2>
              {hw.length ? (
                <table className="specs stl-hw"><tbody>
                  {hw.map((h, i) => <tr key={i}><th scope="row">{h.item}{h.qty ? <span className="mono"> × {h.qty}</span> : null}</th><td>{h.note}</td></tr>)}
                </tbody></table>
              ) : <p>Nothing extra: every part is printed.</p>}
            </section>

            {tips.length > 0 && (
              <section aria-labelledby="printing">
                <h2 id="printing">Print settings</h2>
                <ul className="stl-tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </section>
            )}

            {parts > 0 && (
              <section aria-labelledby="parts">
                <h2 id="parts">The parts</h2>
                <details className="stl-parts"><summary>{parts} STL files in the download</summary>
                  <ul>{p.parts.map((n) => <li key={n}>{n.replace(/\.stl$/i, '')}</li>)}</ul>
                </details>
              </section>
            )}

            <section aria-labelledby="faq">
              <h2 id="faq">Questions</h2>
              <div className="stl-faq">{faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
              <p className="muted" style={{ marginTop: 14 }}>Something else? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
            </section>
          </div>

          <aside className="stl-aside">
            {p.specs.length > 0 && (
              <div>
                <p className="eyebrow">Details</p>
                <table className="specs" style={{ marginTop: 14 }}><tbody>{p.specs.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
              </div>
            )}
            <div className="stl-lic">
              <p className="eyebrow">Commercial license</p>
              <ul>{PRODUCT_LICENSE_POINTS.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            {price != null && price > 0 && <p className="mono muted" style={{ fontSize: 13 }}>{formatMoney(price, currency)} · {currency === 'INR' ? 'incl. GST where applicable' : 'paid by card'} · secure payment by Razorpay</p>}
          </aside>
        </div>
      </section>
    </>
  );
}
