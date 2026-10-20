/* What the browser sends to save a layered sculpture: the finished colour map plus the settings that shape the files.
 * The picture itself never leaves the browser. */
import { RATIOS, SHAPES } from './core.js';

export type LayerParams = {
  width: number; ratio: string; outer: string; radius: number; window: string; border: number;
  frameLayer: boolean; frameColor: string; thickness: number; backThickness: number; frameThickness: number;
  pins: 'off' | 'hidden' | 'through'; pinDia: number; res: number; tol: number;
  loose: 'keep' | 'small' | 'all' | 'limit'; looseMax: number; looseArea: number; mirror: boolean; incRef: boolean;
};
export type LayerDesign = {
  name: string; p: LayerParams; aspect: number; nx: number; ny: number;
  K: number; cls: string;            // base64 run-length class map, nx*ny bytes
  order: number[];                   // class indices, front to back
  colors: string[];                  // print colour (hex) for every class index
};

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, lo: number, hi: number, name: string) => {
  const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`Setting “${name}” is out of range.`); return n;
};
const pick = <T extends string>(v: unknown, opts: readonly T[], name: string): T => {
  if (!opts.includes(v as T)) throw new Error(`Setting “${name}” is not valid.`); return v as T;
};

/** Checks every field; throws a readable error for anything a real studio would never send. */
export function parseLayerDesign(x: unknown): LayerDesign {
  const d = (x ?? {}) as Record<string, unknown>, p = (d.p ?? {}) as Record<string, unknown>;
  const shapes = Object.keys(SHAPES);
  const params: LayerParams = {
    width: num(p.width, 40, 400, 'width'),
    ratio: pick(p.ratio, [...Object.keys(RATIOS), 'image'], 'proportions'),
    outer: pick(p.outer, shapes, 'outer shape'),
    radius: num(p.radius, 0, 100, 'corner radius'),
    window: pick(p.window, ['match', ...shapes], 'picture window'),
    border: num(p.border, 0, 60, 'frame width'),
    frameLayer: Boolean(p.frameLayer),
    frameColor: HEX.test(String(p.frameColor)) ? String(p.frameColor) : '#161616',
    thickness: num(p.thickness, 0.2, 5, 'layer thickness'),
    backThickness: num(p.backThickness, 0.2, 5, 'back plate'),
    frameThickness: num(p.frameThickness, 0.2, 8, 'frame layer'),
    pins: pick(p.pins, ['off', 'hidden', 'through'] as const, 'pin holes'),
    pinDia: num(p.pinDia, 1, 6, 'hole diameter'),
    res: num(p.res, 120, 1100, 'detail'),
    tol: num(p.tol, 0.005, 0.5, 'simplification'),
    loose: pick(p.loose, ['keep', 'small', 'all', 'limit'] as const, 'loose pieces'),
    looseMax: p.looseMax == null ? 2 : num(p.looseMax, 0, 20, 'most loose pieces'),
    looseArea: num(p.looseArea, 0, 500, 'small pieces'),
    mirror: Boolean(p.mirror), incRef: Boolean(p.incRef),
  };
  const nx = Math.round(num(d.nx, 8, 1200, 'grid')), ny = Math.round(num(d.ny, 8, 1200, 'grid'));
  const K = Math.round(num(d.K, 1, 14, 'colours'));
  if (typeof d.cls !== 'string' || d.cls.length > 4_000_000) throw new Error('The layer data is missing.');
  const order = Array.isArray(d.order) ? d.order.map((v) => Math.round(Number(v))) : [];
  if (!order.length || order.length > K || order.some((v) => !(v >= 0 && v < K)) || new Set(order).size !== order.length) throw new Error('The layer order is not valid.');
  const colors = Array.isArray(d.colors) ? d.colors.map(String) : [];
  if (colors.length !== K || colors.some((c) => !HEX.test(c))) throw new Error('The layer colours are not valid.');
  const name = String(d.name ?? 'Sculpture').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'Sculpture';
  return { name, p: params, aspect: num(d.aspect ?? 1, 0.1, 10, 'aspect'), nx, ny, K, cls: d.cls, order, colors };
}
