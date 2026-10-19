import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth.server';
import { Swoosh } from '@/components/brand';
import { AdminNav } from './nav';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <div className="adm">
      <aside className="adm-side">
        <Link href="/admin" className="adm-brand"><Swoosh className="swoosh" /><span><b>MD Creations</b><small>Labs admin</small></span></Link>
        <AdminNav />
        <div className="adm-me">
          <span title={me.email}>{me.email}</span>
          <div><Link href="/">View site ↗</Link><form action="/auth/signout" method="post"><button className="linkish">Sign out</button></form></div>
        </div>
      </aside>
      <div className="adm-main">{children}</div>
    </div>
  );
}
