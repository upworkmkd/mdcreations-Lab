/* Catalogue entry for the 360° Shadow Lantern. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'shadow-lantern',
  name: '360° Shadow Lantern',
  short: 'A lantern that throws a scene all the way round the room: stars, a forest or your own picture.',
  lede: 'The shadow lamp, all the way round. Pick a starry night, a forest or festival lights, or upload your own picture or panorama, and get a 3D printable lantern that fills every wall of the room with it when the lights go out. Kids’ rooms, Diwali, parties and gifts.',
  status: 'coming_soon',
  makePath: '/tools/shadow-lantern/make',
  index: '18',
  image: '/images/hero-shadow-lantern.jpg',
  slide: { title: 'The whole room, in shadow.', lede: 'A lantern that throws stars, a forest or your own picture onto every wall at once.' },
  youGet: [
    'The lantern shell: your picture cut all the way round a cylinder',
    'A base with a collar for the shell and an LED post at the right height',
    'Ready-made scenes (starry night, forest, festival lights) or your own picture, repeated 1 to 6 times',
    'Floating parts of the picture get thin bridges automatically, so nothing falls out',
    'A commercial license: sell the lanterns and the files',
  ],
  steps: [
    { title: 'Pick a scene or a picture', text: 'A starry night, a forest, festival lights, or your own picture or panorama. Choose how many times it repeats round the lantern.' },
    { title: 'See it on the walls', text: 'Turn the lantern in 3D, and switch to “On the walls” to see the picture all the way round the room.' },
    { title: 'Print and light it', text: 'Print the shell standing up in a dark filament, add a bare 5 mm LED on the post, and switch off the lights.' },
  ],
  specsTitle: 'The lantern',
  specs: [
    ['Size', '70 to 130 mm across, 80 to 180 mm tall'],
    ['Wall', '1.2 to 2.4 mm, solid rims top and bottom'],
    ['Picture', 'Built-in scenes or your picture, repeated 1 to 6 times round'],
    ['Light', 'A bare 5 mm LED on the post (2 × AA holder or USB)'],
    ['Print', 'Shell standing up, base flat; no supports'],
    ['Files', 'Shell and base STL files, in a zip'],
  ],
  faq: [
    { q: 'How big is the picture on the walls?', a: 'It fills the room from about the floor to the ceiling: the further the wall, the bigger the picture. Walls one to two metres away work best, in a dark room.' },
    { q: 'Which light should I use?', a: 'A bare 5 mm warm white LED: the smaller and brighter the light, the sharper the shadows. Diffused LED tea lights work but make soft, blurry shadows.' },
    { q: 'Which pictures work best?', a: 'Bold silhouettes: stars, trees, skylines, animals, deities, names. Dark parts of the picture block the light; light parts let it through. A wide panorama goes round once; a single picture looks good repeated three or four times.' },
    { q: 'What filament should I use?', a: 'A dark, opaque one (black, dark grey or brown) for the shell, so light only comes through the cut-outs. The base can be any colour.' },
    { q: 'Can I sell the lanterns?', a: 'Yes. Every download includes a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: '360° Shadow Lantern Maker – Stars and Scenes All Around (STL)',
  description: 'Make a 3D printable lantern that throws stars, a forest or your own picture all the way round the room. Shell, base and LED post STL files.',
  keywords: [
    '360 shadow lamp', 'shadow lantern', 'shadow lantern stl', 'star projector lamp', 'star night light 3d print', 'night light projector stl', 'panorama lamp 3d print',
    'room projector lamp', 'kids night light 3d print', 'diwali lantern 3d print', 'shadow lamp maker', 'cylinder lamp stl', 'custom night light', 'forest shadow lamp',
  ],
};
