/* What the browser sends to save a Gridfinity bin or baseplate: just the settings. */
import { num, pick, cleanName } from '@/lib/kits/check';

export type GridParams = { mode: 'bin' | 'plate'; gx: number; gy: number; units: number; divX: number; divY: number; wall: number; floor: number; lip: boolean; magnets: boolean; label: boolean };
export type GridDesign = { name: string; p: GridParams };

export function parseGridDesign(x: unknown): GridDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number, n: string) => Math.round(num(v, lo, hi, n));
  const p: GridParams = {
    mode: pick(q.mode, ['bin', 'plate'] as const, 'type'), gx: int(q.gx, 1, 8, 'width'), gy: int(q.gy, 1, 8, 'depth'), units: int(q.units, 2, 20, 'height'),
    divX: int(q.divX, 0, 9, 'dividers'), divY: int(q.divY, 0, 9, 'dividers'), wall: num(q.wall, 0.8, 3, 'wall'), floor: num(q.floor, 0.6, 5, 'floor'),
    lip: Boolean(q.lip), magnets: Boolean(q.magnets), label: Boolean(q.label),
  };
  return { name: cleanName(d.name, 'Gridfinity'), p };
}
