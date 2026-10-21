import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { CookieMaker } from '@/components/cookie/cookie-maker';

export const metadata: Metadata = pageMeta({
  title: 'Cookie Cutter & Stamp STL Maker – Plus Rangoli Stencils',
  absoluteTitle: true,
  description: 'Turn any picture, shape or letter into a 3D printable cookie cutter with a matching stamp, a fondant or clay stamp, or a rangoli stencil. Print-ready STL files.',
  path: '/tools/cookie-cutter/make',
  keywords: ['cookie cutter stl generator', 'custom cookie cutter', 'cookie stamp stl', 'rangoli stencil 3d print', 'fondant stamp stl', 'picture to cookie cutter'],
});

export default async function MakeCookie() {
  const c = await makerContext('cookie-cutter');
  return (
    <KitPage slug="cookie-cutter" name="Cookie Cutter & Stamp Maker" title="Make a cookie cutter or stencil" note={previewNote(c.live, 'Free to try. Your picture stays in your browser; the printable files are built when you download.')}>
      <CookieMaker {...c.buy} />
    </KitPage>
  );
}
