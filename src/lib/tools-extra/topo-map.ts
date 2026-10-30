/* Catalogue entry for the 3D Map Maker (slug topo-map: the address stays the same). */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'topo-map',
  name: '3D Map Maker',
  short: 'Any place on Earth as a 3D printed map, in satellite colours or by height.',
  lede: 'Find any place on the satellite map, from Everest and Kedarnath to your home valley, and get a 3D printable map built from real elevation data. Print it in the colours of the real place with an AMS, in green-to-snow bands by height, or in one colour.',
  status: 'coming_soon',
  makePath: '/tools/topo-map/make',
  index: '10',
  image: '/images/hero-topo-map.jpg',
  slide: { title: 'Any place on Earth, in your hands.', lede: 'Pick an area on the satellite map and print its mountains, valleys and lakes in their real colours.' },
  youGet: [
    'A 3D map of the area you choose, from real elevation data',
    'Satellite colours: a 2-4 colour 3MF ready for the AMS',
    'Square, 3:2, round or hexagonal (tiles side by side)',
    'Height exaggeration, terraces and sea depths',
    'Or colour by height (green, brown, snow) on any printer',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Find the place', text: 'Search for it or pick a famous peak, then move and zoom the satellite (or simple) map until the frame holds what you want.' },
    { title: 'Shape the model', text: 'Choose the size and shape, exaggerate the heights, add terraces, and check it in 3D.' },
    { title: 'Print it', text: 'Open the colour 3MF in Bambu Studio and print with the AMS, or change filament at the heights in the guide.' },
  ],
  specs: [
    ['Area', 'From a few hundred metres to hundreds of kilometres'],
    ['Model', '60–250 mm wide, square, 3:2, round or hexagon'],
    ['Data', 'Terrain Tiles (SRTM, GMTED, ETOPO1), about 30 m detail in most places'],
    ['Options', 'Height exaggeration, terraces, base, sea floor'],
    ['Colours', 'Satellite colours (2-4 filaments), by height, or one colour'],
    ['Files', 'Colour 3MF for Bambu Studio / OrcaSlicer, and STL parts, in one zip'],
  ],
  faq: [
    { q: 'Where does the elevation data come from?', a: 'The open Terrain Tiles dataset, which combines SRTM, GMTED, ETOPO1 and national surveys. Most land has about 30 m detail.' },
    { q: 'Why exaggerate the height?', a: 'Real terrain is flatter than it looks. At model scale, hills almost disappear, so a factor of 1.5 to 3 makes the shape readable. Big mountains need less.' },
    { q: 'Can I print it in colours?', a: 'Yes, two ways. With an AMS, choose satellite colours and open the 3MF: forests, fields, water and snow come out in the colours of the real place. On any printer, choose by height and change filament at the heights in the guide for green valleys and white peaks.' },
    { q: 'Where do the satellite colours come from?', a: 'Sentinel-2 cloudless by EOX, a cloud-free picture of the whole Earth from the European Copernicus satellites, about 10 m per pixel.' },
    { q: 'Can I sell the maps?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: '3D Map Maker – 3D Printed Map of Any Place, in Satellite Colours',
  description: 'Make a 3D printed map of any place: pick it on the satellite map and download a terrain STL or a multi-colour 3MF in the real colours. Mountains, valleys and lakes from real elevation data.',
  keywords: ['3d printed map', '3d map maker', '3d map stl', 'terrain stl', 'map to stl', 'multicolor 3d printed map', 'topographic map stl', 'everest 3d print', 'terrain2stl alternative'],
};
