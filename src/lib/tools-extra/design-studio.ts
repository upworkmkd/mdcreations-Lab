/* Catalogue entry for the Design Studio. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'design-studio',
  name: 'Design Studio',
  short: 'Draw a sign, keychain, coaster or pixel art in up to 4 colours and print it. No Blender needed.',
  lede: 'A simple drawing studio for 3D printing: pick a sign, keychain, coaster, pixel art or free shape, draw with shapes, text in any language, stickers and a mirror or mandala repeat, and every colour becomes a raised layer. Download a colour 3MF for Bambu Studio and the STL files, or order it printed.',
  status: 'coming_soon',
  makePath: '/tools/design-studio/make',
  index: '16',
  image: '/images/hero-design-studio.jpg',
  slide: { title: 'Draw it. Print it.', lede: 'Signs, keychains, coasters and pixel art in up to four colours, without Blender or Fusion 360.' },
  youGet: [
    'A colour 3MF with every colour set, ready for Bambu Studio and OrcaSlicer',
    'One STL per colour and the base, for any slicer',
    'Templates: sign, keychain, coaster, pixel art and free shape',
    'Brush, shapes, text in Hindi, English and more, stickers, mirror and mandala repeat',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Pick a template', text: 'A sign plate, a keychain, a round coaster, a pixel grid or a free shape. Set the size.' },
    { title: 'Draw in colours', text: 'Paint with up to four colours: brush, fill, boxes, circles, stars, hearts, text and stickers. Each colour has its own height.' },
    { title: 'Check it in 3D and print', text: 'See the raised piece, then download the colour 3MF and STL files, or order it printed.' },
  ],
  specsTitle: 'The studio',
  specs: [
    ['Templates', 'Sign, keychain, coaster, pixel art, free shape'],
    ['Colours', 'Up to 4 on a base, each with its own height'],
    ['Size', '20 to 250 mm; pixel art up to 64 × 64 squares'],
    ['Tools', 'Brush, eraser, fill, line, box, circle, star, heart, text, stickers'],
    ['Repeat', 'Mirror, or 4, 6 or 8 around the centre (mandalas)'],
    ['Files', 'Colour 3MF and one STL per part, in a zip'],
  ],
  faq: [
    { q: 'Do I need Blender or Fusion 360?', a: 'No. You draw in 2D like in a paint app; the studio turns each colour into a raised layer on the base and builds the 3D files for you.' },
    { q: 'How do I print several colours?', a: 'Open the 3MF in Bambu Studio or OrcaSlicer: each colour is already set, so with an AMS you just pick the slots. With one nozzle, a single colour on a base prints with one filament change at the height shown.' },
    { q: 'Can I write in Hindi or other languages?', a: 'Yes. The text tool has fonts for English and Hindi, and stickers like Om, a diya, a lotus and more.' },
    { q: 'Can I sell what I make?', a: 'Yes. Every download includes a commercial license for the prints and the files.' },
    { q: 'Is it included in the plans?', a: 'Yes. Pay per design, or use a monthly plan: Starter downloads count towards its daily limit, and the bigger plan is unlimited.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Design Studio – Draw Signs, Keychains & Pixel Art to STL',
  description: 'Draw a sign, keychain, coaster or pixel art in up to 4 colours in your browser and download a colour 3MF and STL files. No Blender or Fusion 360 needed.',
  keywords: [
    'online 3d design tool', 'draw to stl', '2d to stl', 'drawing to 3d print', 'pixel art stl', 'pixel art 3d print', 'multicolor 3mf generator',
    'custom sign stl', 'keychain designer', 'coaster stl maker', 'mandala coaster stl', 'blender alternative for 3d printing', 'easy 3d design for beginners',
    'bambu lab multicolor', 'ams print designer', 'name plate designer', 'hindi sign 3d print',
  ],
};
