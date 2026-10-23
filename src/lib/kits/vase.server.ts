/* Server kit for the Vase & Lamp Shade Maker: rebuilds the shape from its settings. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parseVaseDesign, type VaseDesign } from '@/lib/vase/design';
import { buildVase } from '@/lib/vase/build.js';

const KIND: Record<string, string> = { spiral: 'vase', vase: 'vase', planter: 'planter', shade: 'lamp shade' };

async function build(d: VaseDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const p = d.p, r = buildVase({ ...p, segments: Math.max(p.segments, 240), step: Math.min(p.step, 0.5) });
  const readme = [`Size: about ${r.size[0].toFixed(0)} mm wide, ${p.height} mm tall`, '', 'PRINTING'];
  if (p.mode === 'spiral') readme.push('  This is a solid shape for VASE MODE (spiral vase / "spiralize outer contour").', '  Turn vase mode on in your slicer, set 2-4 bottom layers, and use a 0.6 mm nozzle or 0.5+ mm line width for strength.', '  Not watertight for water unless you use PETG and slightly wider lines. For flowers, use a glass inside.');
  if (p.mode === 'vase' || p.mode === 'planter') readme.push(`  Normal printing: ${p.wall} mm walls, ${p.floor} mm floor. 2-3 walls, 10-15% infill, no supports.`, p.mode === 'planter' && p.drain > 0 ? `  The ${p.drain} mm drain hole is in the floor. Print a saucer or stand it on a tray.` : '  PETG holds water better than PLA.');
  if (p.mode === 'shade') readme.push(`  ${p.wall} mm walls. White or translucent PLA/PETG spreads the light nicely.`, p.fitting !== 'none' ? `  The ${p.hole} mm hole in the ${p.fitting} ring fits the lamp holder (E27 rings are usually 40-42 mm, E14 about 29 mm).` : '  No fitting ring: sit it over a battery tea light or an LED puck.', '  Use LED bulbs only (they stay cool). Keep incandescent and halogen bulbs away from plastic.');
  return packKit({ name: d.name, kind: KIND[p.mode], parts: r.parts.map((q: { file: string; tris: Float32Array }) => ({ file: q.file, tris: q.tris })), readme, preview, license });
}

export const kit: Kit | null = { parse: parseVaseDesign, build: build as Kit['build'] };
