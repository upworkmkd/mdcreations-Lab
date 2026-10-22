import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { CookieMaker } from '@/components/cookie/cookie-maker';

export const metadata: Metadata = pageMeta({
  title: 'Rangoli Stencil Maker for Diwali – 3D Printed Rangoli Stencils, Cookie Cutters & Stamps (STL)',
  absoluteTitle: true,
  description: 'Turn any rangoli, mandala or kolam design into a 3D printable rangoli stencil for Diwali, with loose parts joined automatically. Also cookie cutters with matching stamps and fondant stamps.',
  path: '/tools/cookie-cutter/make',
  keywords: ['rangoli stencil maker', '3d printed rangoli', 'diwali rangoli stencil', 'rangoli stencil stl', 'mandala stencil', 'kolam stencil', 'cookie cutter stl generator', 'cookie stamp stl'],
});

export default async function MakeCookie() {
  const c = await makerContext('cookie-cutter');
  return (
    <KitPage slug="cookie-cutter" name="Rangoli Stencil & Cookie Cutter Maker" title="Make a rangoli stencil or cookie cutter" note={previewNote(c.live, 'Free to try. Your picture stays in your browser; the printable files are built when you download.')}>
      <CookieMaker {...c.buy} />
    </KitPage>
  );
}
