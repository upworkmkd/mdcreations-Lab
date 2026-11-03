/* The commercial license that comes with every file download. Shown on /license and saved as LICENSE.txt in each zip. */

export const LICENSE_NAME = 'MD Creations Labs Commercial License';
export const LICENSE_VERSION = '1.0';

export const LICENSE_POINTS: string[] = [
  'Print the files as often as you like, for yourself or for customers.',
  'Sell the printed objects anywhere: your shop, Etsy, Amazon, Instagram, fairs.',
  'Sell or share the files themselves, as they are or changed in any way.',
  'Change, remix and combine the files with your own work.',
  'No royalties, no attribution required, and the license never expires.',
];

export const LICENSE_SECTIONS: { h: string; p: string[] }[] = [
  {
    h: '1. What you may do',
    p: [
      'MD Creations grants you a worldwide, non-exclusive, perpetual, irrevocable and royalty-free license to use the files in this download for personal and commercial purposes.',
      'You may print the files any number of times; sell, give away or display the printed objects; modify, remix or combine the files with other work; and sell, license or distribute the files, either unchanged or modified, as part of your own products or on their own.',
      'You do not need to credit MD Creations, although a mention is always appreciated.',
    ],
  },
  {
    h: '2. Your picture and other people\'s rights',
    p: [
      'The files are made from the picture you supplied. This license covers the work MD Creations Labs added (the 3D geometry, the lamp design, the base and the plate). It cannot give you rights in the picture itself.',
      'You are responsible for having the right to use the picture you uploaded, including any logos, trademarks, characters, artwork or photographs of people in it, for the way you use the files.',
    ],
  },
  {
    h: '3. What stays with MD Creations',
    p: [
      'MD Creations keeps the rights in the MD Creations Labs software, website, tools and brand. You may not present your products as made or endorsed by MD Creations, and you may not use the files to build a competing design tool or a training data set for one.',
    ],
  },
  {
    h: '4. No warranty',
    p: [
      'The files are provided as they are. MD Creations checks that the parts fit together as described but does not guarantee that a print will succeed on every printer, material or setting, and is not responsible for how printed objects are used. Use electrical parts (LEDs, batteries, switches) safely and follow their makers\' instructions.',
    ],
  },
  {
    h: '5. Transfer',
    p: [
      'If you sell or give the files to someone else, they receive the same rights as you under this license.',
    ],
  },
];

/** Plain-text license for the zip, with the details of this purchase. */
export function licenseText(o: { design: string; owner?: string; orderId?: string; date?: Date }) {
  const date = (o.date ?? new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const lines = [
    `${LICENSE_NAME} (version ${LICENSE_VERSION})`,
    '='.repeat(60),
    '',
    `Design:     ${o.design}`,
    ...(o.owner ? [`Licensed to: ${o.owner}`] : []),
    ...(o.orderId ? [`Order:      ${o.orderId}`] : []),
    `Date:       ${date}`,
    'Issued by:  MD Creations, India  ·  https://labs.themdcreations.com',
    '',
    'IN SHORT',
    ...LICENSE_POINTS.map((p) => `  - ${p}`),
    '',
  ];
  for (const s of LICENSE_SECTIONS) lines.push(s.h.toUpperCase(), ...s.p.flatMap((p) => [wrap(p), '']));
  lines.push('The current version of this license is at https://labs.themdcreations.com/license');
  return lines.join('\n');
}

function wrap(s: string, w = 76) {
  const out: string[] = []; let line = '';
  for (const word of s.split(' ')) { if ((line + ' ' + word).trim().length > w) { out.push(line); line = word; } else line = (line + ' ' + word).trim(); }
  if (line) out.push(line);
  return out.join('\n');
}

/* ------------------------------------------------------------------ STL shop designs (our own designs, sold as files)
 * Same commercial freedom for the printed objects, but the files themselves stay ours: a buyer may not pass them on.
 * Otherwise the first buyer could share the files with everyone. */
export const PRODUCT_LICENSE_NAME = 'MD Creations STL Commercial License';
export const PRODUCT_LICENSE_POINTS: string[] = [
  'Print the files as often as you like, for yourself or for customers.',
  'Sell the printed models anywhere: your shop, Etsy, Amazon, Instagram, fairs.',
  'Change and remix the files for your own prints.',
  'The STL files are for you: please do not share, upload or resell them, changed or not.',
  'No royalties, no attribution required, and the license never expires.',
];
const PRODUCT_SECTIONS: { h: string; p: string[] }[] = [
  { h: '1. What you may do', p: [
    'MD Creations grants you a worldwide, non-exclusive, perpetual and royalty-free license to print the files in this download for personal and commercial purposes.',
    'You may print them any number of times; sell, give away or display the printed models; and modify or remix the files to make your own prints.',
    'You do not need to credit MD Creations, although a mention is always appreciated.',
  ] },
  { h: '2. What you may not do', p: [
    'You may not share, upload, sell, license or give away the STL files themselves, or files made from them, whether unchanged or modified. This includes file-sharing sites, model libraries and marketplaces. Each person who wants the files can buy them from MD Creations.',
  ] },
  { h: '3. What stays with MD Creations', p: [
    'MD Creations keeps the copyright in the design and the files. You may not present your products as made or endorsed by MD Creations.',
  ] },
  { h: '4. No warranty', p: [
    'The files are provided as they are. MD Creations checks that the parts fit together as described but does not guarantee that a print will succeed on every printer, material or setting, and is not responsible for how printed objects are used. Small parts are not suitable for young children.',
  ] },
];

/** Plain-text license for an STL shop download. */
export function productLicenseText(o: { design: string; owner?: string; orderId?: string; date?: Date }) {
  const date = (o.date ?? new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const out = [`${PRODUCT_LICENSE_NAME} (version 1.0)`, '='.repeat(60), '', `Design:     ${o.design}`,
    ...(o.owner ? [`Licensed to: ${o.owner}`] : ['Licensed to: the person who bought these files from MD Creations']),
    ...(o.orderId ? [`Order:      ${o.orderId}`] : []), `Date:       ${date}`, 'Issued by:  MD Creations, India  ·  https://labs.themdcreations.com', '',
    'IN SHORT', ...PRODUCT_LICENSE_POINTS.map((p) => `  - ${p}`), ''];
  for (const s of PRODUCT_SECTIONS) out.push(s.h.toUpperCase(), ...s.p.flatMap((p) => [wrap(p), '']));
  out.push('Questions: hello@themdcreations.com');
  return out.join('\n');
}
