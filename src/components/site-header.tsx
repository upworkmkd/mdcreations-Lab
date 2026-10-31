import Link from 'next/link';
import { Swoosh } from '@/components/brand';
import { getViewer } from '@/lib/auth.server';
import { getCatalog, getCurrency } from '@/lib/catalog.server';
import { formatMoney } from '@/lib/money';
import { ToolsMenu, type MenuTool } from '@/components/tools-menu';

export async function SiteHeader() {
  const [viewer, catalog, currency] = await Promise.all([getViewer(), getCatalog(), getCurrency()]);
  // live tools first, then the ones coming soon, each in catalogue order
  const tools = [...catalog].sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live'));
  const entry = (t: (typeof catalog)[number]): MenuTool => ({
    slug: t.slug, name: t.name, short: t.short, image: t.image, live: t.status === 'live',
    price: t.free ? 'Free' : t.prices[currency] != null ? `${formatMoney(t.prices[currency] as number, currency)} per design` : null,
  });
  return (
    <header className="site-head">
      <div className="wrap">
        <Link href="/" className="lockup" aria-label="MD Creations Labs, home">
          <Swoosh className="swoosh" />
          <span className="words"><span className="md">MD Creations</span><span className="labs">Labs</span></span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <ToolsMenu paid={tools.filter((t) => !t.free).map(entry)} free={tools.filter((t) => t.free).map(entry)} />
          <Link href="/stl-files">STL files</Link>
          <Link href="/tools/shadow-lamp" className="hide-sm">Shadow lamps</Link>
          <Link href="/pricing">Pricing</Link>
          {viewer ? (
            <>
              {viewer.role === 'admin' && <Link href="/admin" className="hide-sm">Admin</Link>}
              <Link href="/account">Account</Link>
            </>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
