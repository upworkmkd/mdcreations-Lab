/* What the browser sends to save a photo relief: the settings and the brightness grid (not the photo). */
import { PLAQUES, RATIOS, gridFor } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type Plaque = 'rect' | 'rounded' | 'circle' | 'oval' | 'heart' | 'arch';
export type ReliefParams = { shape: Plaque; width: number; ratio: string; height: number; corner: number; base: number; relief: number; frame: number; frameUp: number; raise: 'light' | 'dark'; detail: 'standard' | 'fine'; hole: number };
export type ReliefDesign = { name: string; p: ReliefParams; w: number; h: number; gray: string };

export function parseReliefDesign(x: unknown): ReliefDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: ReliefParams = {
    shape: pick(q.shape, PLAQUES as Plaque[], 'shape'), width: num(q.width, 40, 300, 'width'), ratio: pick(q.ratio, [...Object.keys(RATIOS), 'custom'], 'proportions'),
    height: q.height == null ? 100 : num(q.height, 40, 300, 'height'),   // only used with custom proportions
    corner: num(q.corner, 0, 60, 'corners'), base: num(q.base, 0.8, 10, 'base'), relief: num(q.relief, 0.4, 15, 'relief depth'),
    frame: num(q.frame, 0, 25, 'frame'), frameUp: num(q.frameUp, 0, 8, 'frame height'), raise: pick(q.raise, ['light', 'dark'] as const, 'raised parts'),
    detail: pick(q.detail, ['standard', 'fine'] as const, 'detail'), hole: num(q.hole, 0, 10, 'hanging hole'),
  };
  const G = gridFor(p);
  if (Number(d.w) !== G.w || Number(d.h) !== G.h) throw new Error('This relief was saved with different settings. Please open it in the maker again.');
  if (typeof d.gray !== 'string' || Math.abs(d.gray.length - Math.ceil((G.w * G.h) / 3) * 4) > 4) throw new Error('The picture data is missing.');
  return { name: cleanName(d.name, 'Photo relief'), p, w: G.w, h: G.h, gray: d.gray };
}
