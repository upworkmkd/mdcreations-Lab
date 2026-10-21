/* Catalogue entry for the Topographic Map Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'topo-map',
  name: 'Topographic Map Maker',
  short: 'Mountains, valleys and coastlines of any place as a printable terrain model.',
  lede: 'Choose any place on the map, from Everest and Kedarnath to your home valley, and get a 3D printable terrain model built from real elevation data. Square, round or hexagonal, with height exaggeration and contour-like terraces.',
  status: 'coming_soon',
  makePath: '/tools/topo-map/make',
  index: '10',
  image: '/images/hero-topo-map.jpg',
  slide: { title: 'Any place on Earth, in your hands.', lede: 'Pick an area on the map and print its mountains and valleys from real elevation data.' },
  youGet: [
    'A terrain STL of the area you choose, from real elevation data',
    'Square, 3:2, round or hexagonal (tiles side by side)',
    'Height exaggeration, terraces and sea depths',
    'Heights for colour changes (green, brown, snow)',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Find the place', text: 'Search for it or pick a famous peak, then move and zoom the map until the frame holds what you want.' },
    { title: 'Shape the model', text: 'Choose the size and shape, exaggerate the heights, add terraces, and check it in 3D.' },
    { title: 'Print it', text: 'Print flat with adaptive layers. Change filament at the heights in the guide for green valleys and snowy peaks.' },
  ],
  specs: [
    ['Area', 'From a few hundred metres to hundreds of kilometres'],
    ['Model', '60–250 mm wide, square, 3:2, round or hexagon'],
    ['Data', 'Terrain Tiles (SRTM, GMTED, ETOPO1), about 30 m detail in most places'],
    ['Options', 'Height exaggeration, terraces, base, sea floor'],
    ['Files', 'Binary STL in a single zip'],
  ],
  faq: [
    { q: 'Where does the elevation data come from?', a: 'The open Terrain Tiles dataset, which combines SRTM, GMTED, ETOPO1 and national surveys. Most land has about 30 m detail.' },
    { q: 'Why exaggerate the height?', a: 'Real terrain is flatter than it looks. At model scale, hills almost disappear, so a factor of 1.5 to 3 makes the shape readable. Big mountains need less.' },
    { q: 'Can I print it in colours?', a: 'Yes. The README gives heights for filament changes, like green valleys, brown slopes and white peaks. Terraces make the bands crisp.' },
    { q: 'Can I sell the maps?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Topographic Map Maker – 3D Printable Terrain STL of Any Place',
  description: 'Choose any place on the map and download a 3D printable terrain model from real elevation data. Mountains, valleys and lakes as STL, with height exaggeration and terraces.',
  keywords: ['terrain stl generator', 'topographic map stl', '3d printed topographic map', 'mountain 3d model stl', 'elevation to stl', 'everest 3d print', 'terrain2stl alternative'],
};
