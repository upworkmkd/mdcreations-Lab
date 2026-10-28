/* Catalogue entry for the Filament Painting Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'filament-painting',
  name: 'Filament Painting Maker',
  short: 'Paint with filament: a picture in colour from a few filament swaps.',
  lede: 'Turn a picture into a filament painting: a thin relief whose height follows the light and dark of the picture. Change filament at the layers the guide gives you, and the light layers over dark ones blend into a full picture, on any single-nozzle printer.',
  status: 'coming_soon',
  makePath: '/tools/filament-painting/make',
  index: '09',
  image: '/images/hero-filament-painting.jpg',
  slide: { title: 'Paint with filament.', lede: 'Landscapes, portraits and art in colour from one STL and a few filament swaps, with a painted preview first.' },
  youGet: [
    'One STL relief, sized and layered for your slicer',
    'A colour-swap guide: the exact layer and height for every change',
    'A painted preview with your filaments and their TD values',
    'Palettes to start from, or your own 2–8 filaments',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Upload a picture', text: 'Landscapes, portraits, pets and artwork. Frame it and set the contrast.' },
    { title: 'Choose filaments', text: 'Pick 2 to 8 filaments from dark to light, set their TD, and move each colour change until the painted preview looks right.' },
    { title: 'Print and swap', text: 'Use the same layer heights in your slicer, add the colour changes from the guide, and print.' },
  ],
  specs: [
    ['Size', '60–250 mm wide, many proportions'],
    ['Layers', '0.04–0.2 mm, first layer 0.16–0.28 mm'],
    ['Filaments', '2 to 8, with transmission distance (TD)'],
    ['Printer', 'Any single-nozzle FDM printer; AMS and MMU optional'],
    ['Files', 'STL, swap guide and preview in a zip'],
  ],
  faq: [
    { q: 'What is a filament painting?', a: 'A flat print made of thin layers whose height follows the brightness of the picture. Dark filament goes first and lighter ones on top, so thin areas look dark and tall areas look light, and the colours blend in between.' },
    { q: 'Is this the same as HueForge?', a: 'It works the same way and makes the same kind of print: one STL and a list of filament changes. It runs in your browser, with no software to install.' },
    { q: 'What is TD?', a: 'Transmission distance: how thick a filament has to be before you cannot see through it. Lower numbers are more opaque. Many filament makers and the HueForge library list TD values.' },
    { q: 'Can I sell the paintings?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Filament Painting Maker – HueForge-Style Prints Online',
  description: 'Make a filament painting from any picture in your browser: one STL plus the layer for every filament change, with a painted preview. For any single-nozzle printer.',
  keywords: ['filament painting', 'hueforge online', 'hueforge alternative', 'filament swap art', 'color change 3d print', 'lithophane color', '3d printed painting'],
};
