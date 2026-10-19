import type { Metadata } from 'next';
import { Legal } from '@/components/legal';
import { LICENSE_NAME, LICENSE_POINTS, LICENSE_SECTIONS, LICENSE_VERSION } from '@/lib/license';

export const metadata: Metadata = {
  title: 'Commercial license',
  description: 'Every file from MD Creations Labs comes with a commercial license: print it, sell the prints, and sell or share the files, changed or not.',
  alternates: { canonical: '/license' },
};

export default function Page() {
  return (
    <Legal title="Commercial license" updated="20 October 2026">
      <p><b>{LICENSE_NAME}, version {LICENSE_VERSION}.</b> Every design you download from MD Creations Labs, bought on its own or with a plan, comes with this license. A copy with your name and order number is saved as <code>LICENSE.txt</code> in each zip.</p>
      <h2>In short</h2>
      <ul>{LICENSE_POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
      {LICENSE_SECTIONS.map((s) => (
        <section key={s.h}>
          <h2>{s.h.replace(/^\d+\. /, '')}</h2>
          {s.p.map((p) => <p key={p.slice(0, 30)}>{p}</p>)}
        </section>
      ))}
    </Legal>
  );
}
