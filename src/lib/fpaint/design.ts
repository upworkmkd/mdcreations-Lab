/* What the browser sends to save a filament painting: settings, the filament list and the brightness grid. */
import { RATIOS, gridFor, layerCount } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type Filament = { name: string; hex: string; td: number; start: number };
export type PaintParams = { width: number; ratio: string; detail: 'standard' | 'fine'; firstLayer: number; layer: number; minH: number; maxH: number; curve: number; frame: number };
export type PaintDesign = { name: string; p: PaintParams; colours: Filament[]; w: number; h: number; gray: string };

export function parsePaintDesign(x: unknown): PaintDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: PaintParams = {
    width: num(q.width, 40, 300, 'width'), ratio: pick(q.ratio, Object.keys(RATIOS), 'proportions'), detail: pick(q.detail, ['standard', 'fine'] as const, 'detail'),
    firstLayer: num(q.firstLayer, 0.08, 0.4, 'first layer'), layer: num(q.layer, 0.04, 0.32, 'layer height'),
    minH: num(q.minH, 0.2, 5, 'base'), maxH: num(q.maxH, 0.6, 8, 'height'), curve: num(q.curve, 0.3, 3, 'curve'), frame: num(q.frame, 0, 15, 'frame'),
  };
  if (p.maxH <= p.minH + p.layer) throw new Error('The tallest part must be taller than the base.');
  const n1 = layerCount(p);
  const cs = Array.isArray(d.colours) ? d.colours : [];
  if (cs.length < 2 || cs.length > 8) throw new Error('Choose between 2 and 8 filaments.');
  const colours: Filament[] = cs.map((c: Record<string, unknown>, k: number) => {
    const hex = String(c.hex ?? ''); if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('A filament colour is not valid.');
    return { name: String(c.name ?? `Filament ${k + 1}`).replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 30) || `Filament ${k + 1}`, hex, td: num(c.td, 0.05, 20, 'TD'), start: k === 0 ? 1 : Math.round(num(c.start, 2, n1, 'swap layer')) };
  });
  for (let k = 2; k < colours.length; k++) if (colours[k].start <= colours[k - 1].start) throw new Error('Each filament change must come after the one before it.');
  const G = gridFor(p);
  if (Number(d.w) !== G.w || Number(d.h) !== G.h) throw new Error('This painting was saved with different settings. Please open it in the maker again.');
  if (typeof d.gray !== 'string' || Math.abs(d.gray.length - Math.ceil((G.w * G.h) / 3) * 4) > 4) throw new Error('The picture data is missing.');
  return { name: cleanName(d.name, 'Filament painting'), p, colours, w: G.w, h: G.h, gray: d.gray };
}
