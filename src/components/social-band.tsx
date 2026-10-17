import { SOCIALS } from '@/lib/env';

export function SocialBand() {
  return (
    <section className="social-band">
      <div className="wrap">
        <div>
          <p className="eyebrow">Follow the workshop</p>
          <h2>New tools, prints and how they are made.</h2>
          <p className="muted">Build videos, finished lamps, customer designs and early looks at the tools that are coming next.</p>
        </div>
        <ul>
          {SOCIALS.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                <span className="net">{s.name}</span>
                <span className="handle">{s.handle}</span>
                <span className="arrow" aria-hidden>↗</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
