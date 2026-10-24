'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const GROUPS: { title: string; links: [string, string, string][] }[] = [
  { title: 'Insights', links: [['/admin', 'Overview', '▦'], ['/admin/activity', 'Live activity', '◉'], ['/admin/visitors', 'Visitors', '◎'], ['/admin/anonymous', 'Anonymous visits', '◌'], ['/admin/pictures', 'Pictures', '▣']] },
  { title: 'Customers', links: [['/admin/users', 'Users', '☺'], ['/admin/subscriptions', 'Subscriptions', '↻'], ['/admin/designs', 'Designs', '◆'], ['/admin/orders', 'Orders', '▤'], ['/admin/payments', 'Payments', '₹'], ['/admin/downloads', 'Downloads', '⬇'], ['/admin/reviews', 'Reviews', '❝']] },
  { title: 'Listening', links: [['/admin/feedback', 'Feedback', '✎']] },
  { title: 'Shop', links: [['/admin/tools', 'Tools and prices', '⚙'], ['/admin/plans', 'Plans', '★']] },
];

export function AdminNav() {
  const path = usePathname();
  const on = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));
  return (
    <nav className="adm-nav" aria-label="Admin">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <span className="adm-nav-h">{g.title}</span>
          {g.links.map(([href, label, icon]) => (
            <Link key={href} href={href} className={on(href) ? 'on' : ''} aria-current={on(href) ? 'page' : undefined}>
              <span className="ic" aria-hidden>{icon}</span>{label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
