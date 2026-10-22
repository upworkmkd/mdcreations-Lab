/* Catalogue entry for the Lithophane Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'lithophane',
  name: 'Lithophane Maker',
  short: 'A photo that appears in light: flat, curved, cylinder lamp, heart or moon.',
  lede: 'Upload a photo and get a lithophane: a print that looks plain until light shines through it, then shows the picture in soft shades. Flat or curved panels, a cylinder lamp with its base, a heart, or a moon lamp with a stand.',
  status: 'coming_soon',
  makePath: '/tools/lithophane/make',
  index: '05',
  image: '/images/hero-lithophane.jpg',
  slide: { title: 'A photo, glowing in light.', lede: 'Flat and curved panels, cylinder lamps, hearts and moon lamps from any photo, with a backlit preview before you print.' },
  youGet: [
    'The lithophane STL: flat, curved, cylinder, heart or moon',
    'A matching stand or round lamp base',
    'A backlit preview and print settings that work',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Upload a photo', text: 'Faces, pets, places and wedding photos all work. Zoom and move it into the frame, and lift the shadows if faces look dark.' },
    { title: 'Pick a shape', text: 'Flat or curved panel, cylinder lamp, heart or moon. Set the size and thickness and check the backlit preview.' },
    { title: 'Print in white', text: 'Print in white PLA with 100% infill and put a warm light behind it. The picture appears.' },
  ],
  specs: [
    ['Shapes', 'Flat, curved, cylinder lamp, heart, moon lamp'],
    ['Size', 'Panels 50–250 mm wide, lamps 50–180 mm across'],
    ['Thickness', '0.4–2 mm at the brightest, 1.5–6 mm at the darkest'],
    ['Extras', 'Slotted stand, round lamp base or moon stand'],
    ['Files', 'Binary STL in a single zip'],
  ],
  faq: [
    { q: 'What is a lithophane?', a: 'A thin print whose thickness follows the picture: dark parts are thick and block light, light parts are thin and let it through. With a light behind it, the photo appears in soft shades.' },
    { q: 'What filament should I use?', a: 'White or natural PLA works best. Print with 100% infill (or enough walls that the picture area is solid) at 0.12 to 0.16 mm layers.' },
    { q: 'How do I light a cylinder or moon lamp?', a: 'Both come with a base or stand that leaves room for a battery tea light or a small LED puck light underneath.' },
    { q: 'Can I sell the lithophanes I print?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Lithophane Maker – Photo to Lithophane STL: Flat, Curved, Cylinder Lamp, Heart & Moon',
  description: 'Make a 3D printable lithophane from any photo: flat or curved panel, cylinder lamp with base, heart or moon lamp with stand. Backlit preview and print-ready STL.',
  keywords: ['lithophane maker', 'lithophane generator', 'photo to lithophane', 'lithophane stl', 'cylinder lithophane', 'moon lamp stl', 'heart lithophane', 'lithophane lamp'],
};
