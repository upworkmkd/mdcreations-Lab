/* Catalogue entry for the free Print Cost Calculator. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'print-cost',
  name: 'Print Cost Calculator',
  short: 'The real cost of a print, including printer wear, and the price to charge.',
  lede: 'Work out what a 3D print really costs: filament, electricity, printer depreciation, maintenance, failed prints, your time and packaging. Then add your margin, marketplace fees and GST to get a selling price you can trust.',
  status: 'live',
  makePath: '/tools/print-cost/calculator',
  index: '13',
  image: '/images/hero-print-cost.jpg',
  free: true,
  files: false,
  slide: { title: 'Price your prints with confidence.', lede: 'Filament, power, printer wear, failures and your time, added up into the price to charge. Free, no account.' },
  youGet: [
    'Filament cost for one or many colours',
    'Printer depreciation: printer price ÷ lifetime hours × print hours',
    'Electricity, maintenance and failed-print allowance',
    'Labour, packaging, margin, marketplace fees and GST',
    'Reads the time and grams from a G-code or sliced 3MF file',
    'A link to share or bookmark every quote',
  ],
  steps: [
    { title: 'Enter the print', text: 'Type the print time and grams, or drop in the G-code or sliced 3MF from Bambu Studio, OrcaSlicer, PrusaSlicer or Cura.' },
    { title: 'Describe your setup', text: 'Printer price and expected life, power draw, electricity rate and how often prints fail. Your settings are remembered.' },
    { title: 'Get the price', text: 'See the cost of one piece, where the money goes, and the price to charge after margin, fees and tax.' },
  ],
  specsTitle: 'What it counts',
  specs: [
    ['Printer depreciation', 'Price ÷ lifetime hours × print hours (10,000 h by default)'],
    ['Running costs', 'Electricity (W × hours × rate), maintenance per hour'],
    ['Failures', 'Wasted filament and machine time, spread over the good prints'],
    ['Selling', 'Margin, marketplace fee and GST or sales tax'],
    ['Files it reads', 'G-code (Bambu, Orca, Prusa, Cura) and sliced .gcode.3mf'],
  ],
  faq: [
    { q: 'How do I work out printer depreciation?', a: 'Divide what the printer cost by the printing hours you expect from it, then multiply by the print time. A ₹35,000 printer expected to last 10,000 hours costs ₹3.50 for every hour it prints, so a 10 hour print carries ₹35 of printer wear.' },
    { q: 'How much electricity does a 3D printer use?', a: 'Most desktop FDM printers average 80 to 150 W while printing PLA, more with a hot bed for ABS or an enclosure heater. A 100 W printer running for 10 hours uses 1 kWh. A plug-in power meter tells you your exact number.' },
    { q: 'How much should I charge for a 3D print?', a: 'Add up filament, machine time (depreciation, maintenance, electricity), an allowance for failed prints and your own time, then add a profit margin and any marketplace fees and tax. The calculator does exactly this and shows each part.' },
    { q: 'Can it read my slicer file?', a: 'Yes. Drop in the G-code from Bambu Studio, OrcaSlicer, PrusaSlicer or Cura, or a sliced .gcode.3mf from Bambu Studio or Orca. The print time and grams are read in your browser; the file is never uploaded.' },
    { q: 'Is it free?', a: 'Yes, completely free with no account. Your settings are saved in your browser, and you can copy a link to share a quote.' },
  ],
};

export const seo: ToolSeo | null = {
  title: '3D Print Cost Calculator (Free) – Filament, Power & GST',
  description: 'Free 3D printing cost and price calculator: filament, electricity, printer wear, failed prints, labour, margin, marketplace fees and GST. Reads G-code and 3MF.',
  keywords: ['3d print cost calculator', '3d printing cost calculator', 'filament cost calculator', '3d print price calculator', 'printer depreciation', '3d printing cost per hour', '3d printing pricing india', 'how much to charge for 3d printing'],
};
