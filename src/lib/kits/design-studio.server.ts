/* Server kit for the Design Studio: rebuilds every colour and the base from the saved colour grid. */
import 'server-only';
import type { Kit } from './types';
import { packKit, fileSlug } from './pack.server';
import { coloured3mf } from '@/lib/mesh/threemf.js';
import { parseStudioDesign, type StudioDesign } from '@/lib/studio/design';
import { buildStudio } from '@/lib/studio/build.js';
import { decodeRle } from '@/lib/layers/rle.js';

const KIND: Record<string, string> = { sign: 'sign', keychain: 'keychain', coaster: 'coaster', pixel: 'pixel art', free: 'design' };

async function build(d: StudioDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const labels = decodeRle(d.labels, d.w * d.h);
  const r = buildStudio({ ...d, labels });
  const parts = r.parts as { name: string; color: string; tris: Float32Array; z0: number; z1: number }[];
  const coloured = parts.length > 1;
  const heights = [...new Set(parts.filter((p) => p.name !== 'Base').map((p) => p.z0))];
  const readme = [
    `Size: ${r.size.map((v: number) => v.toFixed(1)).join(' x ')} mm`, '',
    'FILES',
    ...(coloured ? ['  *_colours.3mf   every part in its colour, as one object (Bambu Studio, OrcaSlicer)'] : []),
    ...parts.map((p) => `  *_${fileSlug(p.name)}.stl   ${p.name}${p.name === 'Base' ? '' : ` (${p.color})`}: ${p.z0.toFixed(1)} to ${p.z1.toFixed(1)} mm`),
    '',
    'PRINTING',
    ...(coloured ? [
      '  With an AMS (Bambu Studio / OrcaSlicer): open the .3mf and pick a filament slot for each colour.',
      ...(parts.length === 2 && parts[0].name === 'Base'
        ? [`  One nozzle, no AMS: print in the base colour and change filament at ${heights[0]?.toFixed(2) ?? '0'} mm.`]
        : ['  One nozzle, no AMS: colours that sit side by side on the same layer need an AMS (or print each colour', '  separately and glue them on).']),
    ] : ['  One colour: print the STL.']),
    '  Flat on the bed, no supports, 0.2 mm layers.',
    d.hole ? `  The ${d.hole} mm ring hole is at the top.` : '',
  ].filter((l) => l !== '');
  const extra = coloured ? [{ name: `${fileSlug(d.name) || 'design'}_colours.3mf`, data: coloured3mf(parts.map((p) => ({ name: p.name, tris: p.tris, color: p.color })), { title: d.name }) }] : [];
  return packKit({ name: d.name, kind: KIND[d.template], parts: parts.map((p) => ({ file: fileSlug(p.name), tris: p.tris })), extra, readme, preview, license });
}

export const kit: Kit = { parse: parseStudioDesign, build: build as Kit['build'] };
