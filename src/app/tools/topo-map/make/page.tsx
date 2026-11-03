import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { TopoMaker } from '@/components/topo/topo-maker';

export const metadata: Metadata = pageMeta({
  title: 'Make a 3D Printed Map of Any Place – Satellite Colours, Terrain STL & 3MF',
  absoluteTitle: true,
  description: 'Pick any place on the satellite map and get a 3D printable map: mountains, valleys and lakes as an STL, or a 2-4 colour 3MF in the real colours for the AMS.',
  path: '/tools/topo-map/make',
  keywords: ['3d printed map', '3d map stl', 'terrain stl generator', 'map to stl', 'multicolor map 3mf', 'himalaya 3d print'],
});

export default async function MakeTopo() {
  const c = await makerContext('topo-map');
  return (
    <KitPage slug="topo-map" name="3D Map Maker" title="Print any place on Earth" note={previewNote(c.live, 'Free to try. Choose an area on the satellite map; the printable files are built when you download.')}>
      <TopoMaker {...c.buy} />
    </KitPage>
  );
}
