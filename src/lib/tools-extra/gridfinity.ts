/* Catalogue entry for the Gridfinity Bin Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'gridfinity',
  name: 'Gridfinity Bin Maker',
  short: 'Drawer bins and baseplates to the Gridfinity standard, any size.',
  lede: 'Make Gridfinity bins exactly the size your drawer needs: width, depth and height in grid units, dividers both ways, a stacking lip, label shelves and magnet holes. Or a matching baseplate to lock them in place.',
  status: 'coming_soon',
  makePath: '/tools/gridfinity/make',
  index: '12',
  image: '/images/hero-gridfinity.jpg',
  slide: { title: 'A place for every screw.', lede: 'Gridfinity bins and baseplates in any size, with dividers, labels and magnets.' },
  youGet: [
    'A bin STL from 1 × 1 up to 6 × 6 cells and 15 units tall',
    'Dividers across and front to back, label shelves, stacking lip',
    'Magnet holes for 6 × 2 mm magnets',
    'Matching light baseplates',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Size the bin', text: 'Width and depth in 42 mm cells and height in 7 mm units, to fit your drawer.' },
    { title: 'Add the inside', text: 'Dividers, label shelves, a stacking lip and magnet holes. Check it in 3D.' },
    { title: 'Print', text: 'Upright with no supports. Print a baseplate too, and everything clicks into place.' },
  ],
  specs: [
    ['Grid', '42 mm cells, 7 mm height units (Gridfinity standard)'],
    ['Bins', '1–6 × 1–6 cells, 2–15 units tall'],
    ['Inside', 'Up to 9 × 7 compartments, label shelves'],
    ['Extras', 'Stacking lip, 6 × 2 mm magnet holes, baseplates'],
    ['Files', 'Binary STL in a single zip'],
  ],
  faq: [
    { q: 'What is Gridfinity?', a: 'An open modular storage system by Zack Freedman: bins on a 42 mm grid that click into baseplates and stack on each other. Bins from any Gridfinity maker work together.' },
    { q: 'Do the bins fit other Gridfinity baseplates?', a: 'Yes. The feet, lip and grid follow the standard dimensions, so they fit standard baseplates and bins.' },
    { q: 'Do I need magnets?', a: 'No. Magnets hold bins firmly in a baseplate, which helps in drawers that slam. Without them the bins still sit securely.' },
    { q: 'Can I sell the bins?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Gridfinity Bin Generator – Custom Gridfinity Bins & Baseplates STL',
  description: 'Generate Gridfinity bins of any size with dividers, label shelves, stacking lip and magnet holes, plus matching baseplates. Print-ready STL in your browser.',
  keywords: ['gridfinity generator', 'gridfinity bin generator', 'gridfinity stl', 'custom gridfinity', 'gridfinity baseplate generator', 'drawer organizer stl'],
};
