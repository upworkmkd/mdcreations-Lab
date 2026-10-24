/* The catalogue. Words and pictures live here; status and prices live in the database
 * so they can be changed from the admin page without a deploy. */

import { EXTRA_TOOLS } from '@/lib/tools-extra';

export type ToolStatus = 'live' | 'coming_soon' | 'hidden';
export type Tool = {
  slug: string;
  name: string;
  short: string;
  lede: string;
  status: ToolStatus;           // fallback when the database cannot be reached
  makePath?: string;
  index: string;                // catalogue number shown on the cards
  image: string;                // hero picture (16:9) in /public/images
  slide: { title: string; lede: string };
  youGet: string[];
  steps: { title: string; text: string }[];
  specs: [string, string][];
  faq: { q: string; a: string }[];
  free?: boolean;               // a free tool: no account, no payment
  files?: boolean;              // false for tools that make no files (calculators)
  specsTitle?: string;          // heading over the specs table
};
export type ToolSeo = { title: string; description: string; keywords: string[] };

export const TOOLS: Tool[] = [
  {
    slug: 'shadow-lamp',
    name: 'Shadow Lamp Maker',
    short: 'Turn any picture into a printable lamp that throws it on the wall.',
    lede: 'Any picture can become a lamp: an animal, a temple, a skyline, a name, a logo, a portrait cut-out. Upload it, place the shadow on the wall, and get print-ready walls, a matching base and a cover plate with your picture inlaid.',
    status: 'live',
    makePath: '/tools/shadow-lamp/make',
    index: '01',
    image: '/images/hero-shadow-lamp.jpg',
    slide: { title: 'Any picture, cast in light.', lede: 'Owls, temples, elephants, skylines, names. Upload a picture, place the shadow, and download the walls, base and cover plate of a lamp that throws it across your wall.' },
    youGet: [
      'Four shaped walls (STL) that cast your picture on the wall',
      'A cover plate with your picture: a press-in picture, or one flat plate in two colours as a 3MF for AMS printers',
      'The lamp base, battery cover and an LED post sized so the light sits exactly where your design needs it',
      'A shadow preview and short print and assembly notes',
      'A commercial license: sell the lamps and the files, changed or not',
    ],
    steps: [
      { title: 'Upload a picture', text: 'PNG, JPG or WebP. Dark shapes on a light background work best; transparent PNGs are read automatically.' },
      { title: 'Place the shadow', text: 'Drag and resize on the wall preview. The preview shows the real shadow the printed walls will cast, and you can turn the assembled lamp in 3D or see it lit on a wall.' },
      { title: 'Pay once, download', text: 'Sign in, pay for that design, and the files are built for you. They stay in your account to download again whenever you need them.' },
    ],
    specsTitle: 'The lamp',
    specs: [
      ['Lamp footprint', '120 × 150 mm'],
      ['Wall thickness', '3 mm, prints flat with no supports'],
      ['Light', 'One LED on a 70 mm post, 2 × AA (rechargeable works)'],
      ['Shadow size', 'Roughly 60 cm to 1.8 m tall, depending on the distance to the wall'],
      ['Files', 'Binary STL in a single zip'],
    ],
    faq: [
      { q: 'How does a shadow lamp work?', a: 'A small LED sits in the middle of four 3D printed walls. Each wall is shaped so that its top edge blocks the light in exactly the right places, and together they throw your picture onto the wall around the lamp, up to about 1.8 m tall.' },
      { q: 'Can I make a shadow lamp from my own photo?', a: 'Yes. Upload any photo, drawing or logo. The maker picks out the main shape, lets you place it on the wall and shows the exact shadow the printed walls will cast before you pay.' },
      { q: 'Is the Shadow Lamp Maker free?', a: 'Designing and previewing is free and needs no account. You pay once per design when you download the STL files, and you can download them again any time from your account.' },
      { q: 'What pictures work best?', a: 'Bold shapes with a clear outline: silhouettes, logos, line art and photos of a figure against a plain wall. Very thin lines are thickened to the thinnest wall your printer can make, and the preview shows exactly what changes.' },
      { q: 'Can I sell the lamps I print, or the files?', a: 'Yes, both. Every download comes with a commercial license: print and sell as many lamps as you like, and sell or share the STL files themselves, as they are or modified. A copy of the license is in every zip.' },
      { q: 'Is there a monthly plan?', a: 'Yes. The Starter plan gives you up to 10 designs a day across every tool, and the Standard plan is unlimited. See the pricing page.' },
      { q: 'Which printer and filament?', a: 'Any FDM printer with a bed of at least 160 × 160 mm. Use opaque filament for the walls; a second colour for the plate picture looks best but is optional.' },
      { q: 'Do I pay again to download again?', a: 'No. Every design you buy stays in your account under Files, and you can download it as often as you like.' },
      { q: 'What about refunds?', a: 'Each download is made for your picture, so we cannot take it back. If a file does not print or fit, write to us and we will fix it or refund you.' },
    ],
  },
  {
    slug: 'statue',
    name: 'Statue Maker',
    short: 'A clean, printable bust or figurine from a few photos.',
    lede: 'Turn a set of photos into a solid, watertight figure that is ready to slice, with a flat base and sensible wall thickness.',
    status: 'coming_soon',
    index: '02',
    image: '/images/hero-statue.jpg',
    slide: { title: 'From photos to a figure on your shelf.', lede: 'Busts, figurines, vases and keepsakes as solid, watertight models with a flat base, sized for your printer.' },
    youGet: ['A watertight STL sized for your printer', 'A flat, stable base', 'An optional hollowed version for resin printers'],
    steps: [], specs: [], faq: [],
  },
  {
    slug: 'layered-sculpture',
    name: 'Layered Sculpture Maker',
    short: 'Turn a picture into a stack of colour layers that print flat and build real depth.',
    lede: 'Upload a picture and the maker splits it into colour layers, front to back, inside a frame of your choice. Print one colour per layer, stack them, and the picture appears with real depth and shadow.',
    status: 'coming_soon',
    makePath: '/tools/layered-sculpture/make',
    index: '03',
    image: '/images/hero-layered.jpg',
    slide: { title: 'One picture, many layers, real depth.', lede: 'Upload a picture and get one printable layer per colour, framed and keyed, that stack into a piece of layered wall art.' },
    youGet: [
      'One STL per colour layer, plus the frame and the back plate',
      'Optional alignment pin holes and an assembled colour reference',
      'A preview picture and an assembly guide with filament colours and weights',
      'A commercial license: sell the prints and the files, changed or not',
    ],
    steps: [
      { title: 'Upload a picture', text: 'Artwork, a logo, a photo or an illustration. PNGs with a transparent background can become a silhouette. Your picture stays in your browser unless you choose to share it.' },
      { title: 'Shape the layers', text: 'Choose how many colours, the order they stack in, the frame shape and size, and clean up specks and loose pieces, with a live 3D preview of the stack.' },
      { title: 'Download and print', text: 'Get one STL per colour. Print each flat in its colour, then stack and glue them back to front.' },
    ],
    specs: [
      ['Size', '60 to 300 mm wide, many proportions'],
      ['Shapes', 'Square, circle, hexagon, octagon, arch or heart, with a window of its own shape'],
      ['Colours', '2 to 12 layers, from the picture or light to dark'],
      ['Layers', 'Colour layers 0.4–3 mm, frame up to 5 mm'],
      ['Files', 'Binary STL in a single zip'],
    ],
    faq: [
      { q: 'What is a layered sculpture?', a: 'A picture built from flat layers of colour, each printed separately. The front layers have the most cut away, so stacking them gives the picture real depth and soft shadows, like a paper-cut shadow box.' },
      { q: 'Do I need a multi-colour printer?', a: 'No. Every layer is one colour, so any printer works: print each layer in its filament and stack them.' },
      { q: 'What pictures work best?', a: 'Pictures with clear areas of colour: illustrations, posters, logos and landscapes. Photos work too; fewer colours give a bolder result.' },
      { q: 'Can I sell what I make?', a: 'Yes. Every download comes with a commercial license: sell the printed pieces and the STL files, as they are or modified.' },
    ],
  },
  {
    slug: 'stl-repair',
    name: 'STL Repair',
    short: 'Find and fix the mesh errors that make slicers complain.',
    lede: 'Close holes, fix flipped faces, remove duplicate shells and make a model watertight, with a report of what was changed.',
    status: 'coming_soon',
    index: '04',
    image: '/images/hero-stl-repair.jpg',
    slide: { title: 'Broken mesh in, clean print out.', lede: 'Holes, flipped faces and loose shells found and fixed, with a report of every change, so your slicer stops complaining.' },
    youGet: ['A repaired, watertight STL', 'A report of every fix', 'Before and after previews'],
    steps: [], specs: [], faq: [],
  },
];

TOOLS.push(...EXTRA_TOOLS);

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
