/* Catalogue entry for the Photo Relief Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'photo-relief',
  name: 'Photo Relief Maker',
  short: 'A photo raised into an embossed plaque, framed and ready to hang.',
  lede: 'Turn a photo, a logo or a drawing into a bas-relief plaque: the picture rises from the surface in fine detail, on a rectangle, circle, oval, heart or arch, with a raised frame and a hanging hole.',
  status: 'coming_soon',
  makePath: '/tools/photo-relief/make',
  index: '08',
  image: '/images/hero-photo-relief.jpg',
  slide: { title: 'Pictures you can touch.', lede: 'Photos, logos and drawings as embossed plaques with a frame and a hanging hole.' },
  youGet: [
    'A plaque STL with your picture in relief',
    'Rectangle, rounded, circle, oval, heart or arch, with a raised frame',
    'Smoothing, depth and contrast controls with a live 3D preview',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Upload a picture', text: 'A portrait, a pet, a temple, a logo or a drawing. Zoom and move it into the plaque.' },
    { title: 'Shape the relief', text: 'Choose the plaque shape and size, how deep the relief is, whether light or dark parts rise, and the frame.' },
    { title: 'Print and finish', text: 'Print flat, picture up. Stone, wood or silk filaments and a light dry-brush of paint make the detail pop.' },
  ],
  specs: [
    ['Shapes', 'Rectangle, rounded, circle, oval, heart, arch'],
    ['Size', '50–250 mm wide'],
    ['Relief', '0.6–10 mm deep on a 1–6 mm base'],
    ['Extras', 'Raised frame, hanging hole'],
    ['Files', 'Binary STL in a single zip'],
  ],
  faq: [
    { q: 'How is a photo relief different from a lithophane?', a: 'A lithophane shows the picture when light shines through it. A relief shows it in daylight, as raised shapes that catch light and shadow, like a carved plaque.' },
    { q: 'Which pictures work best?', a: 'Pictures with clear light and shade: portraits with side light, logos, line drawings and architecture. Smoothing removes grain so the surface prints cleanly.' },
    { q: 'Can I sell the plaques?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Photo Relief Maker – Photo to Embossed Plaque STL',
  description: 'Make a 3D printable embossed plaque from a photo: bas-relief on a rectangle, circle, oval, heart or arch, with a frame and hanging hole.',
  keywords: ['photo relief stl', 'photo to bas relief', 'embossed plaque 3d print', 'image to relief stl', 'photo plaque generator', 'logo relief stl'],
};
