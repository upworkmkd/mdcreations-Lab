/* Catalogue entry for the Name Sign & Keychain Maker. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'name-sign',
  name: 'Name Sign & Keychain Maker',
  short: 'Names in Hindi, Punjabi, Tamil or English as keychains, signs and cake toppers.',
  lede: 'Type a name in English or any Indian language and get a printable keychain, a desk or wall name sign, or a cake topper with stakes. Raised letters in a second colour, a backing that follows the letters or a rounded plate.',
  status: 'coming_soon',
  makePath: '/tools/name-sign/make',
  index: '06',
  image: '/images/hero-name-sign.jpg',
  slide: { title: 'Every name, every script.', lede: 'Keychains, name signs and cake toppers in Hindi, Punjabi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Urdu and English.' },
  youGet: [
    'Keychain, name sign or cake topper STL files',
    'Raised letters as a separate file for a second colour',
    'Fonts for 11 scripts: Devanagari, Gurmukhi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Odia, Urdu and Latin',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Type the name', text: 'In English or any Indian language, up to three lines. Pick the script and a font that suits it.' },
    { title: 'Choose the piece', text: 'Keychain with a ring hole, a name sign with hanging holes, or a cake topper with stakes. Set sizes and colours.' },
    { title: 'Print in two colours', text: 'Print the backing and the letters in different colours, or change filament once at the height shown.' },
  ],
  specs: [
    ['Pieces', 'Keychain, name sign, cake topper'],
    ['Scripts', 'Latin, Devanagari, Gurmukhi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Odia, Urdu'],
    ['Letters', '5–80 mm tall, up to three lines, thicken thin fonts'],
    ['Colours', 'Backing and raised letters as separate STLs'],
    ['Files', 'Binary STL in a single zip'],
  ],
  faq: [
    { q: 'Can I make a name keychain in Hindi or Punjabi?', a: 'Yes. Choose the language, type the name with your phone or computer keyboard, and pick a font made for that script. Matras and conjuncts are drawn correctly because your browser lays out the text.' },
    { q: 'How do I print two colours on one nozzle?', a: 'Print both files together and add a filament change at the backing thickness shown under the preview. The letters then print in the second colour.' },
    { q: 'Are cake toppers food safe?', a: 'Standard PLA is not certified food safe. Use a filament sold as food-safe or wrap the stakes in food film before putting them in a cake.' },
    { q: 'Can I sell the keychains I print?', a: 'Yes. Every download comes with a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Name Keychain & Name Sign STL Maker – Hindi, Punjabi, Tamil, Bengali & English',
  description: 'Make 3D printable name keychains, name signs and cake toppers in English and 10 Indian scripts. Two-colour STL files with raised letters.',
  keywords: ['name keychain stl', 'name keychain generator', 'hindi name keychain', 'punjabi name 3d print', 'name sign stl', 'cake topper stl generator', '3d printed name plate', 'custom keychain stl'],
};
