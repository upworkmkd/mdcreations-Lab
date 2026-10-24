import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { ReliefMaker } from '@/components/relief/relief-maker';

export const metadata: Metadata = pageMeta({
  title: 'Photo Relief Maker – Photo to Embossed Plaque STL (Bas-Relief)',
  absoluteTitle: true,
  description: 'Turn a photo into a 3D printable embossed plaque: bas-relief on a rectangle, circle, oval, heart or arch, with a raised frame and a hanging hole.',
  path: '/tools/photo-relief/make',
  keywords: ['photo to relief stl', 'embossed plaque stl', 'bas relief generator', 'photo plaque 3d print', 'image to 3d relief', 'memorial plaque stl'],
});

export default async function MakeRelief() {
  const c = await makerContext('photo-relief');
  return (
    <KitPage slug="photo-relief" name="Photo Relief Maker" title="Make a photo relief" note={previewNote(c.live, 'Free to try. We keep a copy of your photo for 10 days to improve the tool, unless you untick the box under the upload; the printable files are built when you download.')}>
      <ReliefMaker {...c.buy} />
    </KitPage>
  );
}
