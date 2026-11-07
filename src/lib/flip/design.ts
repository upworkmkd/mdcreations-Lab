/* What the browser sends to save a Flip Picture: the grid, the shared palette and the colour of every cell per side. */
import { num, cleanName } from '@/lib/kits/check';

export type FlipDesign = { name: string; p: { width: number; pitch: number; cell: number; stand: boolean }; cols: number; rows: number; palette: string[]; a: string; b: string };

export function parseFlipDesign(x: unknown): FlipDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p = { width: num(q.width, 60, 240, 'width'), pitch: num(q.pitch, 1.5, 5, 'ridges'), cell: num(q.cell, 0.4, 2, 'rows'), stand: Boolean(q.stand) };
  const cols = Math.round(num(d.cols, 8, 200, 'ridges')), rows = Math.round(num(d.rows, 8, 600, 'rows'));
  const pal = Array.isArray(d.palette) ? d.palette : [];
  if (pal.length < 2 || pal.length > 4 || !pal.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))) throw new Error('The colours are missing.');
  if (typeof d.a !== 'string' || typeof d.b !== 'string' || d.a.length > 2_000_000 || d.b.length > 2_000_000) throw new Error('The pictures are missing.');
  return { name: cleanName(d.name, 'Flip picture'), p, cols, rows, palette: pal as string[], a: d.a, b: d.b };
}
