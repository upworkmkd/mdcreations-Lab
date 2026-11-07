/* What the browser sends to save a 360° Shadow Lantern: the size and the picture band round the lantern (1 = solid). */
import { num, cleanName } from '@/lib/kits/check';
import { lanternSize } from './build.js';

/** rocker: a hole for an on/off rocker switch in the base, next to the Type-C port (on unless switched off). */
export type LanternParams = { diameter: number; height: number; wall: number; rimTop: number; rimBottom: number; rocker?: boolean };
export type LanternDesign = { name: string; p: LanternParams; w: number; h: number; band: string };

export function parseLanternDesign(x: unknown): LanternDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: LanternParams = {
    diameter: num(q.diameter, 60, 140, 'diameter'), height: num(q.height, 70, 200, 'height'), wall: num(q.wall, 1, 3, 'wall'),
    rimTop: num(q.rimTop ?? 5, 3, 15, 'top rim'), rimBottom: num(q.rimBottom ?? 7, 4, 20, 'bottom rim'),
    rocker: q.rocker !== false,
  };
  const S = lanternSize(p), w = Math.round(num(d.w, 16, 4000, 'picture width')), h = Math.round(num(d.h, 16, 4000, 'picture height'));
  if (w !== S.w || h !== S.h - S.top - S.bottom) throw new Error('The picture does not match the lantern size. Please try again.');
  if (typeof d.band !== 'string' || d.band.length > 3_000_000) throw new Error('The picture is missing.');
  return { name: cleanName(d.name, 'Shadow lantern'), p, w, h, band: d.band };
}
