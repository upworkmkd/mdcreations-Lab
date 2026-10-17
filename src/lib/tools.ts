/* The catalogue. Words and pictures live here; status and prices live in the database
 * so they can be changed from the admin page without a deploy. */

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
};

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
      'A cover plate with the picture sunk in, plus the press-in picture pieces',
      'The lamp base and battery cover (the same for every design)',
      'A shadow preview and short print and assembly notes',
    ],
    steps: [
      { title: 'Upload a picture', text: 'PNG, JPG or WebP. Dark shapes on a light background work best; transparent PNGs are read automatically.' },
      { title: 'Place the shadow', text: 'Drag and resize on the wall preview. The preview shows the real shadow the printed walls will cast, including support bars and corner pieces.' },
      { title: 'Pay once, download', text: 'Sign in, pay for that design, and the files are built for you. They stay in your account to download again whenever you need them.' },
    ],
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
      { q: 'Can I sell the lamps I print?', a: 'Yes. You can print and sell lamps made from your files. Please do not share or resell the files themselves.' },
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
    short: 'Stacked-slice wall art and sculptures from any 3D model or picture.',
    lede: 'Slice a model into layers you can print flat or cut, numbered and keyed so they stack into a sculpture.',
    status: 'coming_soon',
    index: '03',
    image: '/images/hero-layered.jpg',
    slide: { title: 'Stacked slices, real depth.', lede: 'Turn a model or a picture into numbered layers that print flat and stack into a sculpture or a topographic wall piece.' },
    youGet: ['Numbered layers as STL, SVG or DXF', 'Alignment keys between layers', 'An assembly sheet'],
    steps: [], specs: [], faq: [],
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

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);
