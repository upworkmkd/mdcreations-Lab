/* Catalogue entry for the Flip Picture (a lenticular print). */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'flip-picture',
  name: 'Flip Picture',
  short: 'Two pictures in one print: one from the left, the other from the right. Made for the AMS.',
  lede: 'A lenticular print you make yourself: choose words or a picture for each side, and every ridge carries the first on its left face and the second on its right. Walk past it and the picture flips: before and after, a question and its answer, a baby photo and today. A colour 3MF ready for Bambu Studio and the AMS.',
  status: 'coming_soon',
  makePath: '/tools/flip-picture/make',
  index: '19',
  image: '/images/hero-flip-picture.jpg',
  slide: { title: 'Walk past. It flips.', lede: 'Two pictures in one multi-colour print: one from the left, the other from the right.' },
  youGet: [
    'A colour 3MF with every colour set, ready for the AMS in Bambu Studio and OrcaSlicer',
    'One STL per colour, the plate and a stand that holds it upright',
    'Words or pictures on each side, in 2 colours or 3–4 picture colours',
    'Fine, standard or bold ridges, 80 to 220 mm wide',
    'A commercial license: sell the prints and the files',
  ],
  steps: [
    { title: 'Set both sides', text: 'Type words or upload a picture for the left view and for the right view.' },
    { title: 'Pick colours and size', text: 'Two filament colours you choose, or 3–4 colours found in the pictures. Set the width, shape and ridge size.' },
    { title: 'Print in colour', text: 'Open the 3MF in Bambu Studio, match the colours to your AMS and print it flat. Stand it up and walk past.' },
  ],
  specsTitle: 'The print',
  specs: [
    ['Sides', 'Words or a picture each'],
    ['Colours', '2 you choose, or 3–4 from the pictures'],
    ['Size', '80 to 220 mm wide; 4:3, 3:2, square or portrait'],
    ['Ridges', '2, 2.5 or 3.5 mm apart'],
    ['Print', 'Flat, no supports; needs an AMS or other multi-colour printer'],
    ['Files', 'Colour 3MF, STL per part and a stand, in a zip'],
  ],
  faq: [
    { q: 'How does it work?', a: 'The plate is covered in small ridges. Each ridge has a left face and a right face; the left faces carry the first picture and the right faces the second, so you see one or the other depending on where you stand.' },
    { q: 'Do I need an AMS?', a: 'Yes, or another multi-colour printer: the colours sit side by side on the same layers, so one nozzle with filament changes cannot print it.' },
    { q: 'Which pictures work best?', a: 'Bold, simple pictures and short words with strong contrast: names, a heart, a logo, silhouettes. The ridges are a few millimetres wide, so fine detail is lost.' },
    { q: 'Which ridge size should I choose?', a: 'Standard suits most pictures. Fine gives more detail on bigger prints; bold is easiest to print and reads from further away.' },
    { q: 'Can I sell what I make?', a: 'Yes. Every download includes a commercial license for the prints and the files.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Flip Picture Maker – Lenticular 3D Print, Two Pictures (3MF)',
  description: 'Make a 3D printed flip picture: one picture from the left, another from the right. Words or photos, a colour 3MF for the AMS, STL files and a stand.',
  keywords: [
    'lenticular 3d print', 'lenticular stl generator', 'flip picture', 'two images one print', 'changing picture 3d print', 'lenticular photo 3d print',
    'ams print ideas', 'bambu lab multicolor print', 'multicolor 3mf generator', 'lenticular gift', 'before and after print', 'flip image maker',
  ],
};
