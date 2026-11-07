/* Catalogue entry for the Two-Name Illusion. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'name-illusion',
  name: 'Two-Name Illusion',
  short: 'One sculpture, two names: it reads one name from the front and the other from the side.',
  lede: 'Type two names, like a couple, two siblings or Mom and Dad, and get a single 3D printable sculpture: from the front it spells one name, turn it and it spells the other. A gift people pick up and turn in their hands, and a video that stops the scroll.',
  status: 'coming_soon',
  makePath: '/tools/name-illusion/make',
  index: '17',
  image: '/images/hero-name-illusion.jpg',
  slide: { title: 'Two names. One sculpture.', lede: 'From the front it reads one name, from the side the other. The gift people turn in their hands.' },
  youGet: [
    'A colour 3MF (letters and base), ready for Bambu Studio and OrcaSlicer',
    'STL files of the letter blocks and the base, for any slicer',
    'Names up to 12 letters; a shorter name is padded with hearts',
    'Fonts for English and Hindi, letters 20 to 60 mm tall',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Type two names', text: 'The name to read from the front, and the one to read from the side. Pick a bold font.' },
    { title: 'Turn the preview', text: 'See both views side by side and the 3D sculpture. Set the letter height, spacing and colours.' },
    { title: 'Print it standing up', text: 'Download the colour 3MF and STL files. It prints base down with no supports.' },
  ],
  specsTitle: 'The sculpture',
  specs: [
    ['Names', '1 to 12 letters each (spaces are dropped)'],
    ['Letters', '20 to 60 mm tall, Poppins, Archivo Black, Bebas Neue or Baloo (Hindi)'],
    ['Base', '2 to 6 mm, in a second colour'],
    ['Print', 'Standing up, no supports; one filament change for two colours'],
    ['Files', 'Colour 3MF and STL files, in a zip'],
  ],
  faq: [
    { q: 'How does it work?', a: 'Each block is two letters at once: one letter cut through the block from the front, the other from the side. Only the part that belongs to both is kept, so the block shows one letter from each direction.' },
    { q: 'What if the names have different lengths?', a: 'The shorter name gets hearts at both ends, so every block still has a letter for each side. Names of the same length look cleanest.' },
    { q: 'Can I use Hindi names?', a: 'Yes. Choose the Baloo font and type the names in Hindi. Capital Latin letters fill the height best, so English names are the safest choice.' },
    { q: 'Does it need supports?', a: 'No. It prints standing up with the base on the bed. A brim helps very thin letters stay put.' },
    { q: 'Can I sell what I make?', a: 'Yes. Every download includes a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Two-Name Illusion Maker – One Sculpture, Two Names (STL)',
  description: 'Type two names and download a 3D printable sculpture that reads one name from the front and the other from the side. Colour 3MF and STL files.',
  keywords: [
    'two name illusion', 'name illusion stl', 'dual name illusion 3d print', 'ambigram 3d print', 'ambigram generator stl', 'two names one sculpture',
    'couple name gift', 'name illusion generator', 'wedding gift 3d print', 'anniversary gift 3d print', 'mom dad illusion', 'name sculpture stl',
    'personalised gift india', 'valentine gift 3d print', 'raksha bandhan gift idea',
  ],
};
