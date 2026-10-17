/* The shadow-lamp design as it is stored and sent to the server. Shared by the browser and the server. */

export type PictureMask = { w: number; h: number; sigma: number; mask: string };
export type View = { cx: number; cy: number; mmPerPx: number; mirror: boolean };
export type WallOpts = { Vmax: number; minSolid: number; apex: number; struts: boolean; backing: boolean; cornerWrap: boolean; ribs: boolean; leftCutouts: boolean };
export type PlateOpts = { style: 'solid' | 'outline'; lineW: number; gap: number };

export type LampDesign = {
  v: 1;
  name: string;
  shadow: PictureMask & { view: View };
  opts: WallOpts;
  plate: null | { own: PictureMask | null; view: View; opts: PlateOpts };
  withBase: boolean;
};

export const WALL_DEFAULTS: WallOpts = { Vmax: 67.5, minSolid: 0.35, apex: 75, struts: true, backing: false, cornerWrap: true, ribs: true, leftCutouts: true };
export const PLATE_DEFAULTS: PlateOpts = { style: 'solid', lineW: 1.6, gap: 0.15 };

const MAX_SIDE = 1400;
const MAX_MASK_CHARS = 3_000_000;

const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
};
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

function picture(raw: unknown): PictureMask {
  const r = (raw ?? {}) as Record<string, unknown>;
  const w = Math.round(num(r.w, 8, MAX_SIDE, 0)), h = Math.round(num(r.h, 8, MAX_SIDE, 0));
  if (!w || !h) throw new Error('Picture size is missing.');
  if (typeof r.mask !== 'string' || !r.mask || r.mask.length > MAX_MASK_CHARS || !/^[A-Za-z0-9+/=]+$/.test(r.mask)) throw new Error('Picture data is missing or too large.');
  return { w, h, sigma: num(r.sigma, 0.3, 20, 1), mask: r.mask };
}
function view(raw: unknown, pic: { w: number; h: number }): View {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    cx: num(r.cx, -pic.w, 2 * pic.w, pic.w / 2),
    cy: num(r.cy, -pic.h, 2 * pic.h, pic.h / 2),
    mmPerPx: num(r.mmPerPx, 0.005, 50, 1),
    mirror: bool(r.mirror, false),
  };
}

/** Checks and clamps everything that came from the browser. Throws with a readable message. */
export function parseDesign(raw: unknown): LampDesign {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.v !== 1) throw new Error('Unknown design version.');
  const shadowPic = picture(r.shadow);
  const shadow = { ...shadowPic, view: view((r.shadow as Record<string, unknown>).view, shadowPic) };
  const o = (r.opts ?? {}) as Record<string, unknown>;
  const opts: WallOpts = {
    Vmax: num(o.Vmax, 45, 69, WALL_DEFAULTS.Vmax),
    minSolid: num(o.minSolid, 0.2, 1.2, WALL_DEFAULTS.minSolid),
    apex: num(o.apex, 70, 80, WALL_DEFAULTS.apex),
    struts: bool(o.struts, true), backing: bool(o.backing, false), cornerWrap: bool(o.cornerWrap, true), ribs: bool(o.ribs, true), leftCutouts: bool(o.leftCutouts, true),
  };
  let plate: LampDesign['plate'] = null;
  if (r.plate) {
    const p = r.plate as Record<string, unknown>;
    const own = p.own ? picture(p.own) : null;
    const po = (p.opts ?? {}) as Record<string, unknown>;
    plate = {
      own,
      view: view(p.view, own ?? shadowPic),
      opts: { style: po.style === 'outline' ? 'outline' : 'solid', lineW: num(po.lineW, 1, 3, 1.6), gap: num(po.gap, 0.05, 0.3, 0.15) },
    };
  }
  const name = (typeof r.name === 'string' ? r.name : '').replace(/[^A-Za-z0-9 _-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Design';
  return { v: 1, name, shadow, opts, plate, withBase: bool(r.withBase, true) };
}
