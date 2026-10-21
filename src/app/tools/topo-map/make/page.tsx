import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { TopoMaker } from '@/components/topo/topo-maker';

export const metadata: Metadata = pageMeta({
  title: 'Topographic Map Maker – 3D Printable Terrain STL of Any Place (Mountains, Valleys, Lakes)',
  absoluteTitle: true,
  description: 'Pick any place on the map and get a 3D printable terrain model: mountains, valleys and coastlines as an STL, square, round or hexagonal, with height exaggeration and terraces.',
  path: '/tools/topo-map/make',
  keywords: ['terrain stl generator', 'topographic map 3d print', '3d printed map', 'mountain stl', 'elevation map stl', 'himalaya 3d print'],
});

export default async function MakeTopo() {
  const c = await makerContext('topo-map');
  return (
    <KitPage slug="topo-map" name="Topographic Map Maker" title="Print any place on Earth" note={previewNote(c.live, 'Free to try. Choose an area on the map; the printable files are built when you download.')}>
      <TopoMaker {...c.buy} />
    </KitPage>
  );
}
