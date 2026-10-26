import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { PaintMaker } from '@/components/fpaint/paint-maker';

export const metadata: Metadata = pageMeta({
  title: 'Filament Painting Maker – HueForge-Style Colour Prints with a Swap Guide (STL)',
  absoluteTitle: true,
  description: 'Turn a picture into a filament painting: one relief STL plus the exact layers to change filament, with a painted preview. Works with any single-nozzle printer.',
  path: '/tools/filament-painting/make',
  keywords: ['filament painting', 'hueforge alternative', 'filament swap painting stl', 'colour change 3d print picture', 'hueforge online'],
});

export default async function MakePainting() {
  const c = await makerContext('filament-painting');
  return (
    <KitPage slug="filament-painting" name="Filament Painting Maker" title="Make a filament painting" note={previewNote(c.live, 'Free to try. Your picture stays in your browser; the printable files are built when you download.')}>
      <PaintMaker {...c.buy} />
    </KitPage>
  );
}
