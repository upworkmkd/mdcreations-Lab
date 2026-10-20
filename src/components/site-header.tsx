import Link from 'next/link';
import { Swoosh } from '@/components/brand';
import { getViewer } from '@/lib/auth.server';

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="site-head">
      <div className="wrap">
        <Link href="/" className="lockup" aria-label="MD Creations Labs, home">
          <Swoosh className="swoosh" />
          <span className="words"><span className="md">MD Creations</span><span className="labs">Labs</span></span>
        </Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/#tools" className="hide-sm">Tools</Link>
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
