/* What the browser sends to save a Design Studio piece: the colour grid (run-length coded) and the settings. */
import { BASES, MAX_COLOURS, TEMPLATES } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type StudioTemplate = 'sign' | 'keychain' | 'coaster' | 'pixel' | 'free';
export type StudioBase = { kind: 'plate' | 'circle' | 'outline' | 'none'; thickness: number; color: string; border: number; corner: number };
export type StudioColour = { color: string; height: number };
export type StudioDesign = { name: string; template: StudioTemplate; w: number; h: number; pxmm: number; labels: string; colours: StudioColour[]; base: StudioBase; hole: number; square: boolean };

const hex = (v: unknown, def: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : def);

export function parseStudioDesign(x: unknown): StudioDesign {
  const d = (x ?? {}) as Record<string, unknown>, b = (d.base ?? {}) as Record<string, unknown>;
  const pxmm = num(d.pxmm, 0.05, 8, 'detail');
  const w = Math.round(num(d.w, 4, 2400, 'width')), h = Math.round(num(d.h, 4, 2400, 'height'));
  if (w / pxmm > 300 || h / pxmm > 300) throw new Error('The design is bigger than 300 mm.');
  if (typeof d.labels !== 'string' || d.labels.length > 4_000_000) throw new Error('The drawing is missing.');
  const colours = (Array.isArray(d.colours) ? d.colours : []).slice(0, MAX_COLOURS).map((c, i) => {
    const q = (c ?? {}) as Record<string, unknown>;
    return { color: hex(q.color, '#161616'), height: num(q.height, 0.2, 20, `colour ${i + 1} height`) };
  });
  const base: StudioBase = {
    kind: pick(b.kind, BASES as StudioBase['kind'][], 'base'), thickness: num(b.thickness, 0.4, 10, 'base thickness'),
    color: hex(b.color, '#f4f1e8'), border: num(b.border, 0, 20, 'border'), corner: num(b.corner, 0, 60, 'corners'),
  };
  return {
    name: cleanName(d.name, 'My design'), template: pick(d.template, TEMPLATES as StudioTemplate[], 'template'),
    w, h, pxmm, labels: d.labels, colours, base, hole: num(d.hole ?? 0, 0, 12, 'ring hole'), square: Boolean(d.square),
  };
}
