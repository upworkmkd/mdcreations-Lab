/* What the browser sends to save a terrain model: the place, the settings and the elevation grid (metres). */
import { SHAPES } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type TopoShape = 'square' | 'rect' | 'circle' | 'hexagon';
export type TopoParams = { shape: TopoShape; width: number; metres: number; exaggeration: number; base: number; terrace: number; seaFloor: 'flat' | 'keep' };
export type TopoDesign = { name: string; p: TopoParams; lat: number; lon: number; w: number; h: number; elev: string };

export function parseTopoDesign(x: unknown): TopoDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: TopoParams = {
    shape: pick(q.shape, SHAPES as TopoShape[], 'shape'), width: num(q.width, 40, 300, 'width'), metres: num(q.metres, 100, 2_000_000, 'area'),
    exaggeration: num(q.exaggeration, 0.2, 30, 'height exaggeration'), base: num(q.base, 1, 30, 'base'), terrace: num(q.terrace, 0, 10, 'terraces'),
    seaFloor: pick(q.seaFloor, ['flat', 'keep'] as const, 'sea floor'),
  };
  const w = Math.round(num(d.w, 32, 400, 'grid')), h = Math.round(num(d.h, 32, 400, 'grid'));
  if (typeof d.elev !== 'string' || Math.abs(d.elev.length - Math.ceil((w * h * 2) / 3) * 4) > 4) throw new Error('The elevation data is missing.');
  return { name: cleanName(d.name, 'Terrain'), p, lat: num(d.lat, -85, 85, 'latitude'), lon: num(d.lon, -180, 180, 'longitude'), w, h, elev: d.elev };
}
