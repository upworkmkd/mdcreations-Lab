/* What the browser sends to save a lithophane: the settings and the brightness grid (not the photo itself). */
import { SHAPES, RATIOS, BASES, gridFor } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type LithoShape = 'flat' | 'curved' | 'cylinder' | 'heart' | 'moon';
export type LithoParams = {
  shape: LithoShape; width: number; ratio: string; diameter: number; height: number; angle: number;
  minT: number; maxT: number; border: number; detail: 'standard' | 'fine'; stand: boolean;
  base: string; baseLen: number;   // base style for the shape (see BASES) and the stand's own length in mm
};
export type LithoDesign = { name: string; p: LithoParams; w: number; h: number; gray: string };

export function parseLithoDesign(x: unknown): LithoDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: LithoParams = {
    shape: pick(q.shape, SHAPES as LithoShape[], 'shape'),
    width: num(q.width, 40, 300, 'width'),
    ratio: pick(q.ratio, [...Object.keys(RATIOS), 'custom'], 'proportions'),
    diameter: num(q.diameter, 50, 200, 'diameter'),
    height: num(q.height, 40, 250, 'height'),
    angle: num(q.angle, 30, 220, 'curve'),
    minT: num(q.minT, 0.4, 3, 'thinnest'),
    maxT: num(q.maxT, 1, 8, 'thickest'),
    border: num(q.border, 0, 15, 'border'),
    detail: pick(q.detail, ['standard', 'fine'] as const, 'detail'),
    stand: Boolean(q.stand),
    base: '', baseLen: q.baseLen == null ? 0 : num(q.baseLen, 30, 260, 'base length'),
  };
  const bases = BASES[p.shape] as string[];
  // designs saved before base styles only said whether there was a stand
  p.base = q.base == null ? (p.stand ? bases[0] : 'none') : pick(q.base, bases, 'base');
  p.stand = p.base !== 'none';
  if (p.maxT <= p.minT + 0.2) throw new Error('The thickest part must be thicker than the thinnest.');
  const G = gridFor(p);
  if (Number(d.w) !== G.w || Number(d.h) !== G.h) throw new Error('This lithophane was saved with different settings. Please open it in the maker again.');
  if (typeof d.gray !== 'string' || Math.abs(d.gray.length - Math.ceil((G.w * G.h) / 3) * 4) > 4) throw new Error('The picture data is missing.');
  return { name: cleanName(d.name, 'Lithophane'), p, w: G.w, h: G.h, gray: d.gray };
}
