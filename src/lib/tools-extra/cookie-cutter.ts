/* Catalogue entry for the Rangoli Stencil, Cookie Cutter & Stamp Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'cookie-cutter',
  name: 'Rangoli Stencil & Cookie Cutter Maker',
  short: 'Rangoli stencils for Diwali, cookie cutters and stamps from any picture or shape.',
  lede: 'Turn any rangoli design, mandala, drawing, logo or letter into a 3D printed rangoli stencil, a cookie cutter with a matching stamp, or a fondant and clay stamp. Upload your own picture or start from ready mandalas and shapes; loose parts are joined with thin bridges so every stencil prints in one piece.',
  status: 'coming_soon',
  makePath: '/tools/cookie-cutter/make',
  index: '07',
  image: '/images/hero-cookie-cutter.jpg',
  slide: { title: 'Rangoli for Diwali, cutters for every day.', lede: 'Print rangoli stencils from any design, and cookie cutters with matching stamps from your own pictures.' },
  youGet: [
    'Rangoli stencils from your own design or a ready mandala, in round, square or rounded plates',
    'Loose parts joined with thin bridges, so the stencil is one piece',
    'Cookie cutters with a thin cutting edge, a flange and a matching stamp',
    'Fondant, clay and soap stamps with mirrored details and a handle',
    'Letters and numbers, plus ready shapes: heart, star, flower, lotus and more',
    'A commercial license: sell the stencils, cutters and the files',
  ],
  steps: [
    { title: 'Choose a design', text: 'Upload a rangoli, mandala, kolam or line drawing (a transparent PNG works best), pick a ready shape, or type letters.' },
    { title: 'Make it printable', text: 'Choose a rangoli stencil, a cookie cutter or a stamp. Set the size, plate shape, thickness and bridges, and check it in 3D.' },
    { title: 'Print and use', text: 'Print flat with no supports. Fill the stencil with rangoli powder, or bake with the cutter and stamp.' },
  ],
  specs: [
    ['Makes', 'Rangoli stencils, cookie cutters, cookie and fondant stamps'],
    ['Stencils', '80–280 mm, round, square or rounded plates, 0.6–3 mm thick'],
    ['Designs', 'Your picture or PNG, ready rangoli mandalas, shapes, letters and numbers'],
    ['Cutters', '30–160 mm, 8–30 mm tall, thin top edge, 0–8 mm flange'],
    ['Files', 'Binary STL in a single zip'],
  ],
  faq: [
    { q: 'How do I make a 3D printed rangoli stencil?', a: 'Upload your rangoli or mandala design (a PNG with a transparent background works best) or choose the ready mandala. The lines of the design become the plastic and the spaces between them are cut through, so the powder falls into the pattern. Print it flat in PLA or PETG.' },
    { q: 'Will small parts of my rangoli fall out?', a: 'No. Pieces that would be loose, like dots and inner petals, are joined to the stencil with thin bridges you can make wider or narrower. The stencil prints as one piece.' },
    { q: 'Can I use it for Diwali, Pongal or Onam kolam designs?', a: 'Yes. Any design works: rangoli, kolam, alpana, mandala or a name. Make it as big as your printer allows, up to 280 mm, or print several and place them side by side.' },
    { q: 'What pictures make good cookie cutters?', a: 'A clear silhouette or a line drawing on a plain background. The outside line becomes the cutter; the lines inside can become a matching stamp that presses details into the dough.' },
    { q: 'Are 3D printed cookie cutters food safe?', a: 'Use a filament sold as food-safe, keep the cutter for short contact only, and wash it by hand. Many bakers put a sheet of cling film between cutter and dough.' },
    { q: 'Can I sell the stencils and cutters?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Rangoli Stencil Maker – 3D Printed Rangoli Stencils for Diwali, Cookie Cutters & Stamps (STL)',
  description: 'Make 3D printed rangoli stencils for Diwali from any design or mandala, plus custom cookie cutters with matching stamps. Loose parts joined automatically. Print-ready STL.',
  keywords: [
    'rangoli stencil maker', '3d printed rangoli', '3d printed rangoli stencil', 'rangoli stencil stl', 'diwali rangoli stencil', 'rangoli maker online',
    'rangoli design stencil', 'mandala stencil stl', 'kolam stencil', 'diwali 3d print', 'rangoli stencil generator', 'custom rangoli stencil',
    'cookie cutter stl generator', 'custom cookie cutter 3d print', 'cookie stamp stl', 'fondant stamp', 'picture to cookie cutter',
  ],
};
