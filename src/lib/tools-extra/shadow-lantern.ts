/* Catalogue entry for the 360° Shadow Lantern. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'shadow-lantern',
  name: '360° Shadow Lantern',
  short: 'A lantern that throws a scene all the way round the room: stars, hearts with names or your own picture.',
  lede: 'The shadow lamp, all the way round. Pick a starry night, hearts with your names or festival lights, or upload your own picture or panorama, and get a 3D printable lantern that fills every wall of the room with it when the lights go out. It runs on a small rechargeable battery with a USB Type-C port in the base. Kids’ rooms, anniversaries, Diwali, parties and gifts.',
  status: 'coming_soon',
  makePath: '/tools/shadow-lantern/make',
  index: '18',
  image: '/images/hero-shadow-lantern.jpg',
  slide: { title: 'The whole room, in shadow.', lede: 'A lantern that throws stars, hearts with your names or your own picture onto every wall at once.' },
  youGet: [
    'The lantern shell: your picture cut all the way round a cylinder',
    'A rechargeable base: a USB Type-C port hole, a switch hole, room underneath for the battery and charger and a bottom cover, plus a top cover and an LED post at the right height',
    'Ready-made scenes (starry night, hearts with names, festival lights) with a density slider, or your own picture: move and zoom it, and repeat it 1 to 6 times',
    'Floating parts of the picture get thin bridges automatically, so nothing falls out',
    'A commercial license: sell the lanterns and the files',
  ],
  steps: [
    { title: 'Pick a scene or a picture', text: 'A starry night, hearts with your names, festival lights, or your own picture or panorama. Move and zoom your picture and choose how many times it repeats round the lantern.' },
    { title: 'See it on the walls', text: 'Turn the lantern in 3D, and switch to “On the walls” to see the picture all the way round the room.' },
    { title: 'Print and light it', text: 'Print the shell standing up in a dark filament, add a bare 5 mm LED on the post, and switch off the lights.' },
  ],
  specsTitle: 'The lantern',
  specs: [
    ['Size', '70 to 130 mm across, 80 to 180 mm tall'],
    ['Wall', '1.2 to 2.4 mm, solid rims top and bottom'],
    ['Picture', 'Built-in scenes or your picture, repeated 1 to 6 times round'],
    ['Light', 'A bare 5 mm LED on the post, a small LiPo battery and a TP4056 Type-C charging module'],
    ['Print', 'Shell standing up, base upside down, LED post standing; no supports'],
    ['Files', 'Shell, base, bottom and top covers and LED post STL files, in a zip'],
  ],
  faq: [
    { q: 'How big is the picture on the walls?', a: 'It fills the room from about the floor to the ceiling: the further the wall, the bigger the picture. Walls one to two metres away work best, in a dark room.' },
    { q: 'Which light should I use?', a: 'A bare 5 mm warm white LED: the smaller and brighter the light, the sharper the shadows. Diffused LED tea lights work but make soft, blurry shadows.' },
    { q: 'Which pictures work best?', a: 'Bold silhouettes: stars, trees, skylines, animals, deities, names. Dark parts of the picture block the light; light parts let it through. A wide panorama goes round once; a single picture looks good repeated three or four times.' },
    { q: 'How is it powered?', a: 'From a small rechargeable battery. A TP4056 Type-C charging module, the battery and an on/off switch are glued under the base, which is open underneath; its port lines up with a hole in the base, so you charge it with any USB-C phone charger. The README shows the wiring.' },
    { q: 'What filament should I use?', a: 'A dark, opaque one (black, dark grey or brown) for the shell, so light only comes through the cut-outs. The base can be any colour.' },
    { q: 'Can I sell the lanterns?', a: 'Yes. Every download includes a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: '360° Shadow Lantern Maker – Stars and Scenes All Around (STL)',
  description: 'Make a 3D printable lantern that throws stars, hearts with your names or your own picture all round the room. Rechargeable base. Shell, base and LED post STL.',
  keywords: [
    '360 shadow lamp', 'shadow lantern', 'shadow lantern stl', 'star projector lamp', 'star night light 3d print', 'night light projector stl', 'panorama lamp 3d print',
    'room projector lamp', 'kids night light 3d print', 'diwali lantern 3d print', 'shadow lamp maker', 'cylinder lamp stl', 'custom night light', 'name heart lantern', 'love lantern 3d print', 'rechargeable night light stl',
  ],
};
