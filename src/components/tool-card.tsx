import Link from 'next/link';
import Image from 'next/image';
import type { CatalogTool } from '@/lib/catalog.server';
import { formatMoney, type Currency } from '@/lib/money';

function chip(t: CatalogTool, currency: Currency) {
  const p = t.prices[currency];
  if (t.status !== 'live') return { text: 'Coming soon', cls: 'soon' };
  if (t.free) return { text: 'Free', cls: 'free' };
  return { text: p != null ? `from ${formatMoney(p, currency)}` : 'Live', cls: 'live' };
}

/** A tool in the grids on the home page and /tools: picture, price chip, name and one line. */
export function ToolCard({ t, currency }: { t: CatalogTool; currency: Currency }) {
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

/** Live tools first, then the ones that are coming; split into design tools and free tools. */
export function splitTools(tools: CatalogTool[]) {
  const order = (a: CatalogTool, b: CatalogTool) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1);
  return { design: tools.filter((t) => !t.free).sort(order), free: tools.filter((t) => t.free).sort(order) };
}
