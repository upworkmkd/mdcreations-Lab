/* Server kit for the Two-Name Illusion: rebuilds the letter blocks and the base from the saved letter masks. */
import 'server-only';
import type { Kit } from './types';
import { packKit, fileSlug } from './pack.server';
import { coloured3mf } from '@/lib/mesh/threemf.js';
import { decodeRle } from '@/lib/layers/rle.js';
import { buildIllusion } from '@/lib/illusion/build.js';
import { PX, parseIllusionDesign, type IllusionDesign } from '@/lib/illusion/design';

async function build(d: IllusionDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const L = (l: { w: number; h: number; mask: string }) => ({ w: l.w, h: l.h, pxmm: PX, mask: decodeRle(l.mask, l.w * l.h) });
  const r = buildIllusion(d.pairs.map((p) => ({ a: L(p.a), b: L(p.b) })), { H: d.H, base: d.base, gap: d.gap, cell: 0.3 });
  const [letters, base] = r.parts as { name: string; tris: Float32Array }[];
  const mf = coloured3mf([{ name: 'Letters', tris: letters.tris, color: d.colors.letters }, { name: 'Base', tris: base.tris, color: d.colors.base }], { title: d.name });
  const readme = [
    `Reads "${d.nameA}" from the front and "${d.nameB}" from the right-hand side.`,
    `Size: ${r.size.map((v: number) => v.toFixed(0)).join(' x ')} mm (letters ${d.H} mm tall, base ${d.base} mm).`, '',
    'FILES',
    '  *_colour.3mf     letters and base in their colours, as one object (Bambu Studio, OrcaSlicer)',
    '  *_letters.stl    the letter blocks',
    '  *_base.stl       the base',
    '',
    'PRINTING',
    '  - Print standing up, as it is in the file: base down, no supports.',
    `  - Two colours with one nozzle: start with the base colour and change filament at ${d.base.toFixed(1)} mm.`,
    '  - PLA or PETG, 0.12-0.16 mm layers for crisp letters, 3 walls. A brim helps narrow letters stay put.',
    '',
    'HOW TO SHOW IT',
    '  Put it on a shelf corner so people see it from two sides: straight from the front it reads the first name,',
    '  from the right-hand side the second. Photos and videos turning from one view to the other look great.',
    r.dropped ? `\nNote: ${r.dropped > 400 ? 'some' : 'a few'} tiny floating bits of the letters were left out because they would not print.` : '',
  ];
  return packKit({ name: d.name, kind: 'name illusion', parts: [{ file: 'letters', tris: letters.tris }, { file: 'base', tris: base.tris }], extra: [{ name: `${fileSlug(d.name) || 'illusion'}_colour.3mf`, data: mf }], readme, preview, license });
}

export const kit: Kit = { parse: parseIllusionDesign, build: build as Kit['build'] };
