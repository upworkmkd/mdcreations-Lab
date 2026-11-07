/* Server kit for the Flip Picture: rebuilds the ridge faces in every colour, the plate and the stand. */
import 'server-only';
import type { Kit } from './types';
import { packKit, fileSlug } from './pack.server';
import { coloured3mf } from '@/lib/mesh/threemf.js';
import { decodeRle } from '@/lib/layers/rle.js';
import { buildFlip } from '@/lib/flip/build.js';
import { colourName } from '@/lib/topo/build.js';
import { parseFlipDesign, type FlipDesign } from '@/lib/flip/design';

async function build(d: FlipDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const cells = d.cols * d.rows, a = decodeRle(d.a, cells), b = decodeRle(d.b, cells);
  if (a.some((v: number) => v >= d.palette.length) || b.some((v: number) => v >= d.palette.length)) throw new Error('The colours do not match the pictures.');
  const r = buildFlip(a, b, d.cols, d.rows, d.palette, { pitch: d.p.pitch, cell: d.p.cell, base: 1.6, stand: d.p.stand });
  const parts = r.parts as { name: string; color: string; tris: Float32Array }[];
  const printed = parts.filter((p) => p.name !== 'stand');
  const mf = coloured3mf(printed.map((p) => ({ name: p.name, tris: p.tris, color: p.color })), { title: d.name });
  const readme = [
    `Size: ${r.size[0].toFixed(0)} x ${r.size[1].toFixed(0)} mm, ${d.cols} ridges ${d.p.pitch} mm apart.`, '',
    'COLOURS',
    ...d.palette.map((h, i) => `  ${i + 1}. ${h} (${colourName(h)})${i === 0 ? ' - also the plate' : ''}`), '',
    'PRINTING (Bambu Studio / OrcaSlicer with an AMS)',
    '  - Open the .3mf: the plate and every colour are already set. Match each colour to a filament slot.',
    '  - Flat on the bed, ridges up, no supports. 0.12-0.16 mm layers keep the ridges sharp; 0.4 mm nozzle.',
    '  - The colours sit side by side on the same layers, so an AMS (or another multi-colour printer) is needed.',
    d.p.stand ? '  - Print the stand separately (stand.stl), in any colour, and slide the plate into its slot.' : '',
    '',
    'SHOWING IT',
    '  Stand it upright with the ridges running up and down. From the left you see one picture, from the right the',
    '  other; walking past, the picture flips. Straight on you see a mix of both.',
  ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '');
  return packKit({ name: d.name, kind: 'flip picture', parts: parts.map((p) => ({ file: p.name, tris: p.tris })), extra: [{ name: `${fileSlug(d.name) || 'flip'}_colour.3mf`, data: mf }], readme, preview, license });
}

export const kit: Kit = { parse: parseFlipDesign, build: build as Kit['build'] };
