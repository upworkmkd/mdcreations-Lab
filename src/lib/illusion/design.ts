/* What the browser sends to save a Two-Name Illusion: the two names, the settings and one pair of letter masks per
 * block (the browser draws the letters, so any font and script works). */
import { num, cleanName } from '@/lib/kits/check';

export const PX = 8;   // mask pixels per mm
export type Letter = { w: number; h: number; mask: string };   // mask: run-length coded (encodeRle), row 0 = top
export type IllusionDesign = {
  name: string; nameA: string; nameB: string; font: string; H: number; base: number; gap: number;
  colors: { letters: string; base: string }; pairs: { a: Letter; b: Letter }[];
};

const hex = (v: unknown, def: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : def);

export function parseIllusionDesign(x: unknown): IllusionDesign {
  const d = (x ?? {}) as Record<string, unknown>;
  const H = num(d.H, 15, 80, 'letter height'), base = num(d.base, 2, 8, 'base'), gap = num(d.gap, 1, 20, 'spacing');
  const raw = Array.isArray(d.pairs) ? d.pairs : [];
  if (raw.length < 1 || raw.length > 12) throw new Error('Use 1 to 12 letters per name.');
  const letter = (v: unknown): Letter => {
    const l = (v ?? {}) as Record<string, unknown>;
    const w = Math.round(num(l.w, 4, H * PX * 2.5, 'letter width')), h = Math.round(num(l.h, 4, H * PX + 4, 'letter height'));
    if (typeof l.mask !== 'string' || l.mask.length > 400_000) throw new Error('A letter is missing.');
    return { w, h, mask: l.mask };
  };
  const pairs = raw.map((p) => { const q = (p ?? {}) as Record<string, unknown>; return { a: letter(q.a), b: letter(q.b) }; });
  const c = (d.colors ?? {}) as Record<string, unknown>;
  return {
    name: cleanName(d.name, 'Name illusion'), nameA: String(d.nameA ?? '').slice(0, 24), nameB: String(d.nameB ?? '').slice(0, 24),
    font: String(d.font ?? '').replace(/[^\w ]/g, '').slice(0, 40), H, base, gap, pairs,
    colors: { letters: hex(c.letters, '#d9a441'), base: hex(c.base, '#2c2e21') },
  };
}
