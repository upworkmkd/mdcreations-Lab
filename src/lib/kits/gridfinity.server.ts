/* Server kit for the Gridfinity Bin Maker: rebuilds the bin or baseplate from its settings. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parseGridDesign, type GridDesign } from '@/lib/gridfinity/design';
import { buildGrid } from '@/lib/gridfinity/build.js';

async function build(d: GridDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const p = d.p, r = buildGrid(p);
  const readme = p.mode === 'plate'
    ? [`Baseplate: ${p.gx} x ${p.gy} cells (${r.size[0]} x ${r.size[1]} mm), light style (open bottom).`, '', 'PRINTING', '  Print flat, no supports, 0.2 mm layers. Several baseplates sit side by side to fill a drawer.']
    : [`Bin: ${p.gx} x ${p.gy} x ${p.units} (${r.size.map((v: number) => v.toFixed(1)).join(' x ')} mm), ${(p.divX + 1) * (p.divY + 1)} compartment(s)`,
      `Walls ${p.wall} mm, floor ${p.floor} mm${p.lip ? ', stacking lip' : ''}${p.magnets ? ', 6 x 2 mm magnet holes' : ''}${p.label ? ', label shelves' : ''}`, '',
      'PRINTING', '  Print upright, no supports. 0.2 mm layers, 2-3 walls, 10-15% infill.',
      p.magnets ? '  Magnet holes: press in 6 x 2 mm round magnets after printing (a drop of glue keeps them in).' : '',
      p.label ? '  Label shelves are sloped underneath, so they print without supports.' : ''].filter(Boolean);
  readme.push('', 'Gridfinity is an open standard by Zack Freedman (MIT). These files follow its dimensions.');
  return packKit({ name: d.name, kind: p.mode === 'plate' ? 'gridfinity baseplate' : 'gridfinity bin', parts: r.parts.map((q: { file: string; tris: Float32Array }) => ({ file: q.file, tris: q.tris })), readme, preview, license });
}

export const kit: Kit | null = { parse: parseGridDesign, build: build as Kit['build'] };
