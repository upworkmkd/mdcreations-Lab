/* Server kit for the Photo Relief Maker: rebuilds the plaque from the saved brightness grid. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parseReliefDesign, type ReliefDesign } from '@/lib/relief/design';
import { buildRelief, gridFor } from '@/lib/relief/build.js';
import { b64ToBytes } from '@/lib/mesh/b64.js';

async function build(d: ReliefDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const G = gridFor(d.p), v = b64ToBytes(d.gray);
  if (v.length !== G.w * G.h) throw new Error('The picture data does not match the settings.');
  const r = buildRelief(d.p, v, G), p = d.p;
  const readme = [
    `Plaque: ${r.size.map((x: number) => x.toFixed(0)).join(' x ')} mm, base ${p.base} mm, relief ${p.relief} mm, ${G.pitch} mm detail`, '',
    'PRINTING',
    '  - Print flat on its back, picture up, with no supports. 0.12 to 0.16 mm layers show the most detail.',
    '  - Stone, wood-fill or silk filaments look great. A light dry-brush of paint on the raised parts brings out the picture.',
    p.hole ? '  - Hang it on a small nail through the hole at the top.' : '  - Stand it on a small easel or glue a picture hanger to the back.',
  ];
  return packKit({ name: d.name, kind: 'photo relief', parts: [{ file: 'relief', tris: r.tris }], readme, preview, license });
}

export const kit: Kit | null = { parse: parseReliefDesign, build: build as Kit['build'] };
