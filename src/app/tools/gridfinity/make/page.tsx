import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { GridMaker } from '@/components/gridfinity/grid-maker';

export const metadata: Metadata = pageMeta({
  title: 'Gridfinity Bin Generator – Custom Bins and Baseplates (STL)',
  absoluteTitle: true,
  description: 'Make Gridfinity bins of any size with dividers, stacking lip, label shelves and magnet holes, or matching baseplates. Print-ready STL to the Gridfinity standard.',
  path: '/tools/gridfinity/make',
  keywords: ['gridfinity generator', 'gridfinity bin stl', 'gridfinity baseplate', 'custom gridfinity bins', 'drawer organizer 3d print'],
});

export default async function MakeGrid() {
  const c = await makerContext('gridfinity');
  return (
    <KitPage slug="gridfinity" name="Gridfinity Bin Maker" title="Make Gridfinity bins" note={previewNote(c.live, 'Free to try. Size your bins with the sliders; the printable file is built when you download.')}>
      <GridMaker {...c.buy} />
    </KitPage>
  );
}
