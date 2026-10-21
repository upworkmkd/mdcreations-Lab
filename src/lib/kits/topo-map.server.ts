/* Server kit for the Topographic Map Maker: rebuilds the terrain from the saved elevation grid. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parseTopoDesign, type TopoDesign } from '@/lib/topo/design';
import { buildTerrain } from '@/lib/topo/build.js';
import { b64ToBytes } from '@/lib/mesh/b64.js';

async function build(d: TopoDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const bytes = b64ToBytes(d.elev);
  if (bytes.length !== d.w * d.h * 2) throw new Error('The elevation data does not match the grid.');
  const elev = new Int16Array(bytes.buffer, bytes.byteOffset, d.w * d.h);
  const r = buildTerrain(d.p, elev, d.w, d.h), p = d.p, top = p.base + r.relief;
  const band = (f: number) => (p.base + r.relief * f).toFixed(1);
  const readme = [
    `Place: ${d.name} (${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}), about ${(p.metres / 1000).toFixed(p.metres < 10000 ? 1 : 0)} km across`,
    `Model: ${r.size[0].toFixed(0)} x ${r.size[1].toFixed(0)} mm, ${top.toFixed(1)} mm tall (base ${p.base} mm), heights x${p.exaggeration}`,
    `Elevation: ${Math.round(r.lo)} m to ${Math.round(r.hi)} m`, '',
    'PRINTING',
    '  - Print flat, no supports. 0.12 to 0.2 mm layers; 10-15% infill is plenty.',
    '  - Variable layer height (adaptive layers) keeps gentle slopes smooth.',
    `  - Colour by height with filament changes, for example: green to ${band(0.35)} mm, brown to ${band(0.75)} mm, then white for snow.`, '',
    'Elevation data: Terrain Tiles on AWS (Mapzen terrarium; SRTM, GMTED, ETOPO1 and others).',
  ];
  return packKit({ name: d.name, kind: 'terrain', parts: [{ file: 'terrain', tris: r.tris }], readme, preview, license });
}

export const kit: Kit | null = { parse: parseTopoDesign, build: build as Kit['build'] };
