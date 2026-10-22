import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { bytesToMask, fieldFromMask, makeSampler } from './raster.js';
import { generate, generatePlate, generateRaisedPlate, ledPost, stlBinary, zipFiles } from './mesh.server.js';
import type { LampDesign, PictureMask } from './design';
import { licenseText } from '@/lib/license';

function field(p: PictureMask) {
  const bytes = new Uint8Array(Buffer.from(p.mask, 'base64'));
  return fieldFromMask(bytesToMask(bytes, p.w * p.h), p.w, p.h, p.sigma);
}

const README = (name: string, plate: false | 'separate' | 'combined', base: boolean, backing = false, post?: { height: number; top: number }, colours?: { plate: string; art: string }) => [
  `${name} - shadow lamp`,
  'Made with MD Creations Labs - labs.themdcreations.com',
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
  ...(plate === 'separate' ? ['',
    'Cover plate: lies on the rim of the base between the walls, with the post through its hole.',
    'Print the plate with the sunk side up. Print the plate picture flat in a second colour and press each piece into its place.'] : []),
  ...(plate === 'combined' ? ['',
    `Cover plate (one piece, two colours): "${name} plate.stl" is a 2 mm plate with the picture raised 0.8 mm on top.`,
    'It lies on the rim of the base between the walls, with the post through its hole. Print it flat, picture up, no supports.',
    'For the two colours, add a filament change at 2.0 mm (the first layer of the picture):',
    'Bambu Studio / OrcaSlicer: slice, drag the layer slider to 2.0 mm, right-click the + and choose "Change filament" (or "Add pause").',
    colours ? `Start with the plate colour (${colours.plate}) and change to the picture colour (${colours.art}).` : 'Start with the plate colour and change to the picture colour.'] : []),
  ...(base ? ['',
    'Base and battery cover: the same for every design. Print the base with its back on the bed, no supports;',
    'print the cover with its wider face down. It takes a 2 x AA holder and a small rocker switch.'] : []),
  ...(post ? ['',
    `LED post: print it standing on its notched end with a brim, no supports. It is ${post.height.toFixed(0)} mm long and puts the LED`,
    `${post.top.toFixed(0)} mm out from the wall, where this design expects the light. Push the narrow end into the socket in the middle of the base`,
    'until the collar sits on top, turning it so the notch at its foot lines up with the slot at the foot of the socket.',
    'Use a 5 mm LED (warm white looks best): feed its wires down the hole in the post; they come out through the notch and the slot',
    'to the battery holder and switch. The LED rim rests on the top of the post.'] : []),
  '',
  'COMMERCIAL LICENSE: you may print, sell the printed lamps, and sell or share these files,',
  'as they are or modified. The full terms are in LICENSE.txt in this zip.',
  '',
].join('\r\n');

/** Builds the paid download. Takes about 2-6 s for a typical design. */
export async function buildLampZip(d: LampDesign, preview?: Uint8Array | null, license?: { owner?: string; orderId?: string }) {
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
    const smp = makeSampler(pf, pw, ph, d.plate.view);
    if (d.plate.opts.combined) {
      // one piece: the picture is raised on top of the plate and coloured by a filament change
      const g = generateRaisedPlate(smp, d.plate.opts);
      files.push({ name: `${base} plate.stl`, data: stlBinary(g.tris, 'plate') });
      plateInfo = { pieces: g.pieces };
    } else {
      const g = generatePlate(smp, d.plate.opts);
      files.push({ name: `${base} plate.stl`, data: stlBinary(g.plateTris, 'plate') });
      if (g.pieces) files.push({ name: `${base} plate picture.stl`, data: stlBinary(g.inlayTris, 'inlay') });
      plateInfo = { pieces: g.pieces };
    }
  }
  if (d.withBase) {
    const dir = path.join(process.cwd(), 'private', 'lamp');
    files.push({ name: 'Lamp base.stl', data: new Uint8Array(await readFile(path.join(dir, 'base.stl'))) });
    files.push({ name: 'Battery cover.stl', data: new Uint8Array(await readFile(path.join(dir, 'battery_cover.stl'))) });
  }
  // the LED post depends on where this design puts the light, so it is made for each design
  const post = ledPost({ apex: d.opts.apex });
  const onBed = post.tris.slice(); for (let i = 2; i < onBed.length; i += 3) onBed[i] -= 3;   // notched end on z = 0
  files.push({ name: 'LED post.stl', data: stlBinary(onBed, 'LED post') });
  files.push({ name: 'README.txt', data: new TextEncoder().encode(README(base, d.plate ? (d.plate.opts.combined ? 'combined' : 'separate') : false, d.withBase, d.opts.backing, post, d.plate?.opts.combined ? { plate: d.plate.opts.plateColor, art: d.plate.opts.artColor } : undefined)) });
  files.push({ name: 'LICENSE.txt', data: new TextEncoder().encode(licenseText({ design: base, ...license }).replace(/\n/g, '\r\n')) });
  if (preview && preview.length) files.push({ name: `${base} shadow preview.jpg`, data: preview });
  const zip = zipFiles(files);
  return { zip, fileName: `${base.replace(/ +/g, '_')}_shadow_lamp.zip`, panels: walls.panels.length, plate: plateInfo };
}
