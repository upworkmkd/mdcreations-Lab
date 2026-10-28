/* Catalogue entry for the Vase & Lamp Shade Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'vase',
  name: 'Vase & Lamp Shade Maker',
  short: 'Twisted, rippled and faceted vases, planters and lamp shades from sliders.',
  lede: 'Shape a vase, a planter or a lamp shade with a few sliders: the profile, sides, twist, ripples and rings. Get a solid shape for fast vase-mode printing, or real walls with a floor, a drain hole, or a ring for an E27 or E14 lamp holder.',
  status: 'coming_soon',
  makePath: '/tools/vase/make',
  index: '11',
  image: '/images/hero-vase.jpg',
  slide: { title: 'Shape it, spiral it, light it.', lede: 'Vases, planters and lamp shades designed with sliders and printed in vase mode or with real walls.' },
  youGet: [
    'A vase-mode STL, or a vase or planter with real walls and floor',
    'Lamp shades with an E27, E14 or B22 holder ring',
    'Twist, sides, soft corners, ripples, waves and rings',
    'Seven styles to start from',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Pick a style', text: 'Start from a twisted hexagon, a ripple bottle, a ribbed bowl or a shade, or from scratch.' },
    { title: 'Shape it', text: 'Widths at four heights, the number of sides, twist, ripples and rings, with a live 3D preview.' },
    { title: 'Print', text: 'Turn on vase mode for a fast seamless spiral, or print the walled version for planters and shades.' },
  ],
  specs: [
    ['Makes', 'Vase-mode vases, walled vases, planters, lamp shades'],
    ['Size', 'Up to 300 mm tall and 260 mm wide'],
    ['Texture', 'Sides, twist, ripples, waves, rings'],
    ['Lamp fittings', 'E27, E14, B22 rings at the top or bottom'],
    ['Files', 'Binary STL in a single zip'],
  ],
  faq: [
    { q: 'What is vase mode?', a: 'A slicer setting (often called spiralize outer contour) that prints only the outside wall in one continuous spiral. It is fast and has no seam. This tool gives you a solid shape made for it.' },
    { q: 'Can the lamp shade take a normal bulb?', a: 'Use LED bulbs only: they stay cool. The shade can include a ring for E27, E14 or B22 lamp holders at the top or bottom.' },
    { q: 'Will a vase hold water?', a: 'Walled vases printed in PETG usually hold water. Vase-mode prints are thin, so put a glass inside for fresh flowers.' },
    { q: 'Can I sell the vases?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Vase & Lamp Shade Generator – Vase Mode STL Online',
  description: 'Design twisted, rippled and faceted vases, planters and lamp shades in your browser. Vase-mode STL or real walls, with E27 and E14 lamp holder rings.',
  keywords: ['vase generator', 'vase mode stl', 'parametric vase', 'lamp shade stl', 'planter generator stl', 'twisted vase stl', 'e27 lamp shade 3d print'],
};
