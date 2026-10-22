/* What the browser sends to save a cutter, stamp or stencil: the settings and the two masks. */
import { MODES, pxFor } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type CookieMode = 'cutter' | 'stamp' | 'stencil';
export type CookieParams = {
  mode: CookieMode; size: number; height: number; wall: number; edge: number; flange: number; flangeT: number;
  plateT: number; reliefT: number; clearance: number; handle: boolean; stampToo: boolean;
  stencilT: number; rim: number; islands: 'keep' | 'remove' | 'join'; bridge: number;
};
export type CookieDesign = { name: string; p: CookieParams; px: number; w: number; h: number; shape: string; detail: string | null };

export function parseCookieDesign(x: unknown): CookieDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: CookieParams = {
    mode: pick(q.mode, MODES as CookieMode[], 'type'), size: num(q.size, 20, 300, 'size'),
    height: num(q.height, 6, 40, 'height'), wall: num(q.wall, 0.6, 3, 'wall'), edge: num(q.edge, 0.4, 3, 'edge'),
    flange: num(q.flange, 0, 10, 'flange'), flangeT: num(q.flangeT, 0.6, 4, 'flange thickness'),
    plateT: num(q.plateT, 1, 6, 'stamp plate'), reliefT: num(q.reliefT, 0.4, 5, 'relief'), clearance: num(q.clearance, 0.2, 3, 'clearance'),
    handle: Boolean(q.handle), stampToo: Boolean(q.stampToo),
    stencilT: num(q.stencilT, 0.4, 4, 'stencil thickness'), rim: num(q.rim, 0, 20, 'rim'), islands: pick(q.islands, ['keep', 'remove', 'join'] as const, 'islands'), bridge: q.bridge == null ? 1.2 : num(q.bridge, 0.6, 4, 'bridge width'),
  };
  const px = Number(d.px);
  if (px !== pxFor(p.size)) throw new Error('This design was saved with different settings. Please open it in the maker again.');
  const w = Math.round(num(d.w, 16, 380 * px, 'width')), h = Math.round(num(d.h, 16, 380 * px, 'height'));
  if (typeof d.shape !== 'string' || d.shape.length > 4_000_000) throw new Error('The shape is missing.');
  const detail = typeof d.detail === 'string' && d.detail.length < 4_000_000 ? d.detail : null;
  return { name: cleanName(d.name, 'Cookie cutter'), p, px, w, h, shape: d.shape, detail };
}
