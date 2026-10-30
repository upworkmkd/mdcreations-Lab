/* Server kit for the 3D Map Maker: rebuilds the terrain from the saved elevation grid, in one colour or several. */
import 'server-only';
import type { Kit } from './types';
import { packKit, fileSlug } from './pack.server';
import { parseTopoDesign, type TopoDesign } from '@/lib/topo/design';
import { bandHeights, buildColoured, buildTerrain, capDepth, colourName, terrain } from '@/lib/topo/build.js';
import { coloured3mf } from '@/lib/mesh/threemf.js';
import { b64ToBytes } from '@/lib/mesh/b64.js';

async function build(d: TopoDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const bytes = b64ToBytes(d.elev);
  if (bytes.length !== d.w * d.h * 2) throw new Error('The elevation data does not match the grid.');
  const elev = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + d.w * d.h * 2));
  const p = d.p, c = d.colour, km = `${(p.metres / 1000).toFixed(p.metres < 10000 ? 1 : 0)} km`;
  const r = buildTerrain(p, elev, d.w, d.h), top = p.base + r.relief;
  const head = [
    `Place: ${d.name} (${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}), about ${km} across`,
    `Model: ${r.size[0].toFixed(0)} x ${r.size[1].toFixed(0)} mm, ${top.toFixed(1)} mm tall (base ${p.base} mm), heights x${p.exaggeration}`,
    `Elevation: ${Math.round(r.lo)} m to ${Math.round(r.hi)} m`, '',
  ];
  const credits = ['', 'Elevation data: Terrain Tiles on AWS (Mapzen terrarium; SRTM, GMTED, ETOPO1 and others).'];
  const general = ['  - Print flat, no supports. 0.12 to 0.2 mm layers; 10-15% infill is plenty.', '  - Variable layer height (adaptive layers) keeps gentle slopes smooth.'];

  if (c.mode === 'satellite') {
    const cls = b64ToBytes(c.cls!).slice(0, (d.w - 1) * (d.h - 1));
    if (cls.length !== (d.w - 1) * (d.h - 1) || cls.some((v) => v >= c.n)) throw new Error('The colour map does not match the grid.');
    const m = buildColoured(p, elev, d.w, d.h, cls, c.palette);
    const mf = coloured3mf(m.parts.map((x) => ({ name: x.name, tris: x.tris, color: x.color })), { title: d.name });
    const readme = [...head,
      `COLOURS (from the satellite picture, ${c.n} filaments)`,
      ...c.palette.map((h, i) => `  ${i + 1}. ${h} (${colourName(h)})${i === m.main ? ' - also the base' : ''}`), '',
      'PRINTING IN COLOUR (Bambu Studio / OrcaSlicer with an AMS)',
      `  - Open the .3mf file. It holds the base and a ${capDepth(p.base).toFixed(1)} mm coloured skin, each part already coloured.`,
      '  - Bambu Studio asks how to match the colours to your filaments: pick the closest filament for each.',
      '  - Colour changes happen on most layers, so expect a longer print and some purge. A purge tower or "flush into infill" helps.',
      '  - The STL files are the same parts, for other slicers: load them together as one object and give each part its filament.', '',
      'PRINTING', ...general, ...credits,
      'Satellite colours: Sentinel-2 cloudless - s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0.'];
    const prefix = fileSlug(d.name) || 'terrain';
    return packKit({ name: d.name, kind: '3d map', parts: m.parts.map((x) => ({ file: x.name, tris: x.tris })), extra: [{ name: `${prefix}_colour.3mf`, data: mf }], readme, preview, license });
  }

  let colourLines = [`  - Colour by height with filament changes, for example: green to ${(p.base + r.relief * 0.35).toFixed(1)} mm, brown to ${(p.base + r.relief * 0.75).toFixed(1)} mm, then white for snow.`];
  if (c.mode === 'height') {
    const t = terrain(p, elev, d.w, d.h), at = bandHeights(p.base, t.relief, c.n);
    colourLines = [`  - Start in ${colourName(c.palette[0])} (${c.palette[0]}).`, ...(at as number[]).map((z: number, i: number) => `  - At ${z.toFixed(1)} mm, change to ${colourName(c.palette[i + 1])} (${c.palette[i + 1]}).`),
      '    In Bambu Studio: right-click the layer slider at that height, "Add color change" (or pause for a manual swap).'];
  }
  const readme = [...head, 'PRINTING', ...general, ...colourLines, ...credits];
  return packKit({ name: d.name, kind: '3d map', parts: [{ file: 'terrain', tris: r.tris }], readme, preview, license });
}

export const kit: Kit | null = { parse: parseTopoDesign, build: build as Kit['build'] };
