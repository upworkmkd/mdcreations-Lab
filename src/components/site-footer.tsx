import Link from 'next/link';
import { Logo } from '@/components/brand';
import { SUPPORT_EMAIL, SOCIALS } from '@/lib/env';
import { CookieSettings } from '@/components/tracker';

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div className="brandcol">
          <Logo className="logo" />
          <p style={{ marginTop: 18, maxWidth: '34ch', fontSize: 14.5 }}>Tools for people who make things on a 3D printer: shadow lamps today, statues, layered sculptures and mesh repair next. Built in India by MD Creations.</p>
        </div>
        <div>
          <h4>Tools</h4>
          <ul>
            <li><Link href="/tools/shadow-lamp">Shadow Lamp Maker</Link></li>
            <li><Link href="/tools/statue">Statue Maker</Link></li>
            <li><Link href="/tools/layered-sculpture">Layered Sculpture Maker</Link></li>
            <li><Link href="/tools/stl-repair">STL Repair</Link></li>
          </ul>
        </div>
        <div>
          <h4>Help</h4>
          <ul>
            <li><Link href="/pricing">Pricing and plans</Link></li>
            <li><Link href="/license">Commercial license</Link></li>
            <li><Link href="/account">Your files</Link></li>
            <li><Link href="/contact">Contact</Link></li>
            <li><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
          </ul>
        </div>
        <div>
          <h4>Follow</h4>
          <ul>
            {SOCIALS.map((x) => <li key={x.name}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.name} ↗</a></li>)}
          </ul>
        </div>
        <div>
          <h4>Policies</h4>
          <ul>
            <li><Link href="/terms">Terms of use</Link></li>
            <li><Link href="/refunds">Refunds and cancellations</Link></li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/shipping">Delivery</Link></li>
            <li><CookieSettings /></li>
          </ul>
        </div>
        <div className="base">
          <span>© {new Date().getFullYear()} MD Creations. All rights reserved.</span>
          <span>Payments by Razorpay · Prices include applicable taxes</span>
        </div>
      </div>
    </footer>
  );
}
