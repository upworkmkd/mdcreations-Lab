/* What the browser sends to save a name sign: the settings and the text mask (the browser draws the letters). */
import { MODES, PX } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type NameMode = 'keychain' | 'sign' | 'topper';
export type NameParams = { mode: NameMode; backing: 'outline' | 'plate'; border: number; bold: number; baseT: number; letterT: number; hole: number; holes: boolean; stake: number; corner: number };
export type NameDesign = { name: string; text: string; font: string; p: NameParams; w: number; h: number; mask: string; colors: { base: string; letters: string } };

export function parseNameDesign(x: unknown): NameDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: NameParams = {
    mode: pick(q.mode, MODES as NameMode[], 'type'),
    backing: pick(q.backing, ['outline', 'plate'] as const, 'backing'),
    border: num(q.border, 0.5, 15, 'border'), bold: num(q.bold, 0, 2, 'thicken'),
    baseT: num(q.baseT, 0.6, 10, 'backing thickness'), letterT: num(q.letterT, 0, 10, 'letter height'),
    hole: num(q.hole, 2, 12, 'ring hole'), holes: Boolean(q.holes), stake: num(q.stake, 20, 120, 'stakes'), corner: num(q.corner, 0, 20, 'corners'),
  };
  const w = Math.round(num(d.w, 8, 340 * PX, 'text width')), h = Math.round(num(d.h, 8, 160 * PX, 'text height'));
  if (typeof d.mask !== 'string' || d.mask.length > 3_000_000) throw new Error('The letters are missing.');
  const text = String(d.text ?? '').slice(0, 120), font = String(d.font ?? '').replace(/[^\w ]/g, '').slice(0, 40);
  const c = (d.colors ?? {}) as Record<string, unknown>, hex = (v: unknown, def: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : def);
  const colors = { base: hex(c.base, '#161616'), letters: hex(c.letters, '#f2c14e') };
  return { name: cleanName(d.name, 'Name sign'), text, font, p, w, h, mask: d.mask, colors };
}
