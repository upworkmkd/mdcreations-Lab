/* Catalogue entry for the Cookie Cutter & Stamp Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'cookie-cutter',
  name: 'Cookie Cutter & Stamp Maker',
  short: 'Cutters, matching stamps and rangoli stencils from any picture or shape.',
  lede: 'Turn a drawing, a logo, a letter or a ready shape into a cookie cutter with a sharp edge and a comfortable flange, plus a matching stamp that presses the inner lines. Or make a fondant and clay stamp, or a rangoli stencil for Diwali.',
  status: 'coming_soon',
  makePath: '/tools/cookie-cutter/make',
  index: '07',
  image: '/images/hero-cookie-cutter.jpg',
  slide: { title: 'Any shape, cut and stamped.', lede: 'Cookie cutters with matching stamps, fondant stamps and rangoli stencils from your own pictures.' },
  youGet: [
    'A cookie cutter STL with a thin cutting edge and a flange',
    'A matching stamp (mirrored details) and a handle',
    'Rangoli stencils with the design cut through and loose islands handled',
    'A commercial license: sell the cutters and the files',
  ],
  steps: [
    { title: 'Pick a shape', text: 'Upload a picture or line drawing, choose a ready shape, or type a letter or number.' },
    { title: 'Tune the cutter', text: 'Size, height, wall and flange, and whether to add a stamp for the inner lines. Or switch to a stamp or a rangoli stencil.' },
    { title: 'Print and bake', text: 'Print flange-down with no supports, in PLA or PETG. Dust the stamp with flour and press.' },
  ],
  specs: [
    ['Makes', 'Cookie cutters, stamps, rangoli stencils'],
    ['Size', 'Cutters 30–160 mm, stencils 80–280 mm'],
    ['Cutter', '8–30 mm tall, thin top edge, 0–8 mm flange'],
    ['Shapes', 'Your picture, letters and numbers, or ready shapes'],
    ['Files', 'Binary STL in a single zip'],
  ],
  faq: [
    { q: 'What pictures make good cookie cutters?', a: 'A clear silhouette or a line drawing on a plain background. The outside line becomes the cutter; the lines inside can become a matching stamp that presses details into the dough.' },
    { q: 'Are 3D printed cookie cutters food safe?', a: 'Use a filament sold as food-safe, keep the cutter for short contact only, and wash it by hand. Many bakers put a sheet of cling film between cutter and dough.' },
    { q: 'How does the rangoli stencil work?', a: 'The dark parts of the design are cut through a thin plate. Lay it down, fill the openings with rangoli powder, and lift it straight up. Small islands that would fall out are removed or listed for you.' },
    { q: 'Can I sell the cutters?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Cookie Cutter STL Generator – Custom Cutters, Stamps & Rangoli Stencils',
  description: 'Make a custom 3D printable cookie cutter from any picture, letter or shape, with a matching stamp. Also fondant stamps and rangoli stencils.',
  keywords: ['cookie cutter stl generator', 'custom cookie cutter 3d print', 'cookie stamp stl', 'fondant stamp', 'rangoli stencil', 'diwali rangoli stencil 3d print', 'picture to cookie cutter'],
};
