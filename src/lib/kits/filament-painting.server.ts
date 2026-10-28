/* Server kit for the Filament Painting Maker: rebuilds the relief and writes the colour-swap guide. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parsePaintDesign, type PaintDesign } from '@/lib/fpaint/design';
import { buildPainting, gridFor, layerCount, layerTop, swapGuide } from '@/lib/fpaint/build.js';
import { b64ToBytes } from '@/lib/mesh/b64.js';

async function build(d: PaintDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const G = gridFor(d.p), v = b64ToBytes(d.gray);
  if (v.length !== G.w * G.h) throw new Error('The picture data does not match the settings.');
  const r = buildPainting(d.p, v, G), p = d.p, n1 = layerCount(p);
  const guide = swapGuide(p, d.colours);
  const readme = [
    `Size: ${r.size[0].toFixed(0)} x ${r.size[1].toFixed(0)} mm, ${layerTop(p, n1).toFixed(2)} mm tall, ${n1} layers`, '',
    'SLICER SETTINGS (these must match, or the colours land in the wrong place)',
    `  First layer height: ${p.firstLayer} mm`, `  Layer height:       ${p.layer} mm`,
    '  Infill: 100%. Walls: 1 or 2. Ironing: off. Print it flat, picture up.', '',
    'COLOUR CHANGES',
    ...guide, '',
    'HOW TO ADD THE CHANGES',
    '  Bambu Studio / OrcaSlicer: slice, open the Preview, drag the layer slider to each layer above,',
    '  right-click the + and choose "Add pause" or "Change filament".',
    '  PrusaSlicer: same, with the + on the layer slider ("Add color change").',
    '  With an AMS or MMU you can assign each change to a slot instead of pausing.', '',
    'Display it with light from the front or slightly from the side. A frame behind clear glass looks great.',
  ];
  const guideTxt = new TextEncoder().encode(['Filament painting - colour swaps', '', `First layer ${p.firstLayer} mm, then ${p.layer} mm layers`, '', ...guide, ''].join('\r\n'));
  return packKit({ name: d.name, kind: 'filament painting', parts: [{ file: 'painting', tris: r.tris }], extra: [{ name: 'COLOUR_SWAPS.txt', data: guideTxt }], readme, preview, license });
}

export const kit: Kit | null = { parse: parsePaintDesign, build: build as Kit['build'] };
