/* Server kit for the Name Sign & Keychain Maker: rebuilds the parts from the saved text mask. */
import 'server-only';
import type { Kit } from './types';
import { packKit, fileSlug } from './pack.server';
import { coloured3mf } from '@/lib/mesh/threemf.js';
import { parseNameDesign, type NameDesign } from '@/lib/name/design';
import { buildName } from '@/lib/name/build.js';
import { decodeRle } from '@/lib/layers/rle.js';

const KIND: Record<string, string> = { keychain: 'keychain', sign: 'name sign', topper: 'cake topper' };

async function build(d: NameDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const mask = decodeRle(d.mask, d.w * d.h);
  const r = buildName(d.p, { mask, w: d.w, h: d.h });
  const p = d.p, two = p.letterT > 0;
  const readme = [
    `Text: ${d.text}${d.font ? `   Font: ${d.font}` : ''}`,
    `Size: ${r.size.map((v: number) => v.toFixed(1)).join(' x ')} mm`, '',
    'FILES',
    ...(two ? ['  *_2-colours.3mf  base and letters as one object in two parts, each with its colour'] : []),
    '  *_base.stl      the backing' + (p.mode === 'keychain' ? ' with the key ring hole' : p.mode === 'topper' ? ' with the cake stakes' : ''), ...(two ? ['  *_letters.stl   the raised letters'] : []), '',
    'PRINTING',
    ...(two ? [
      '  Bambu Studio / OrcaSlicer: open the .3mf. It is one object in two parts, already coloured',
      `  (backing ${d.colors.base}, letters ${d.colors.letters}). Bambu Studio asks which filament to use for each colour.`,
      '  With an AMS: pick the two slots and print.',
      `  Without an AMS (one nozzle, manual change): set both parts to the same filament, slice, then add a pause or`,
      `  "Change filament" on the layer slider at ${p.baseT.toFixed(2)} mm (the first layer of the letters) and swap colours there.`,
      '  Other slicers: import both STLs together as one object with two parts (answer "Yes" when asked), or use the',
      `  same filament change at ${p.baseT.toFixed(2)} mm.`,
    ] : ['  One colour: print base.stl.']),
    '  No supports needed. 0.2 mm layers, 3 walls.',
    p.mode === 'topper' ? '  Cake toppers: use food-safe filament (PLA from a food-safe supplier), or wrap the stakes in food film.' : '',
  ].filter((l) => l !== '');
  const parts = [{ file: 'base', tris: r.base }, ...(two ? [{ file: 'letters', tris: r.letters }] : [])];
  const extra = two ? [{
    name: `${fileSlug(d.name) || fileSlug(KIND[p.mode])}_2-colours.3mf`,
    data: coloured3mf([{ name: 'base', tris: r.base, color: d.colors.base }, { name: 'letters', tris: r.letters, color: d.colors.letters }], { title: d.name }),
  }] : [];
  return packKit({ name: d.name, kind: KIND[p.mode], parts, extra, readme, preview, license });
}

export const kit: Kit | null = { parse: parseNameDesign, build: build as Kit['build'] };
