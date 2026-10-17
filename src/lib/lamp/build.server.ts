import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { bytesToMask, fieldFromMask, makeSampler } from './raster.js';
import { generate, generatePlate, stlBinary, zipFiles } from './mesh.server.js';
import type { LampDesign, PictureMask } from './design';

function field(p: PictureMask) {
  const bytes = new Uint8Array(Buffer.from(p.mask, 'base64'));
  return fieldFromMask(bytesToMask(bytes, p.w * p.h), p.w, p.h, p.sigma);
}

const README = (name: string, plate: boolean, base: boolean, backing = false) => [
  `${name} - shadow lamp`,
  'Made with MD Creations Labs - lab.themdcreations.com',
  '',
  'Seen from the front, with the lamp on the wall:',
  '  1 = top wall, 2 = right wall, 3 = left wall (switch side), 4 = bottom wall.',
  '',
  'Print: flat, as oriented in the files (outer face on the bed), opaque filament, no supports.',
  'Pieces that stand up from a wall belong to the corner and print with it.',
  ...(backing ? ['',
    'CLEAR LAYER: these walls carry loose pieces (dots) on a 0.6 mm clear sheet on their outer face.',
    'Start each wall in clear/transparent PLA or PETG. In the slicer add a pause / filament change at 0.6 mm',
    '(Bambu Studio / Orca: right-click the layer slider at 0.6 mm > Add pause or Change filament), then',
    'continue in an opaque colour. With an AMS, paint the first 0.6 mm in the clear filament instead.'] : []),
  '',
  'Assemble: long walls (2 and 3) first, then the short ones (1 and 4). Screw each wall to the base (M2.5 x 8 self-tapping).',
  ...(plate ? ['',
    'Cover plate: lies on the rim of the base between the walls, with the post through its hole.',
    'Print the plate with the sunk side up. Print the plate picture flat in a second colour and press each piece into its place.'] : []),
  ...(base ? ['',
    'Base and battery cover: the same for every design. Print the base with its back on the bed, no supports;',
    'print the cover with its wider face down. It takes a 2 x AA holder, a small rocker switch and a 70 mm LED post.'] : []),
  '',
  'These files are licensed for your personal use and for selling printed lamps you make yourself.',
  'Please do not share or resell the files.',
  '',
].join('\r\n');

/** Builds the paid download. Takes about 2-6 s for a typical design. */
export async function buildLampZip(d: LampDesign, preview?: Uint8Array | null) {
  const shadowField = field(d.shadow);
  const sampler = makeSampler(shadowField, d.shadow.w, d.shadow.h, d.shadow.view);
  const walls = generate(sampler, d.opts);
  const files: { name: string; data: Uint8Array }[] = [];
  const base = d.name;
  for (const q of walls.panels) files.push({ name: `${base} ${q.def.n} ${q.def.id}.stl`, data: stlBinary(q.mesh.tris, q.def.id) });
  let plateInfo: { pieces: number } | null = null;
  if (d.plate) {
    const pf = d.plate.own ? field(d.plate.own) : shadowField;
    const pw = d.plate.own ? d.plate.own.w : d.shadow.w, ph = d.plate.own ? d.plate.own.h : d.shadow.h;
    const g = generatePlate(makeSampler(pf, pw, ph, d.plate.view), d.plate.opts);
    files.push({ name: `${base} plate.stl`, data: stlBinary(g.plateTris, 'plate') });
    if (g.pieces) files.push({ name: `${base} plate picture.stl`, data: stlBinary(g.inlayTris, 'inlay') });
    plateInfo = { pieces: g.pieces };
  }
  if (d.withBase) {
    const dir = path.join(process.cwd(), 'private', 'lamp');
    files.push({ name: 'Lamp base.stl', data: new Uint8Array(await readFile(path.join(dir, 'base.stl'))) });
    files.push({ name: 'Battery cover.stl', data: new Uint8Array(await readFile(path.join(dir, 'battery_cover.stl'))) });
  }
  files.push({ name: 'README.txt', data: new TextEncoder().encode(README(base, !!d.plate, d.withBase, d.opts.backing)) });
  if (preview && preview.length) files.push({ name: `${base} shadow preview.jpg`, data: preview });
  const zip = zipFiles(files);
  return { zip, fileName: `${base.replace(/ +/g, '_')}_shadow_lamp.zip`, panels: walls.panels.length, plate: plateInfo };
}
