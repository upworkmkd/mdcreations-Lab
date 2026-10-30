/* What the browser sends to save a terrain model: the place, the settings and the elevation grid (metres). */
import { SHAPES, COLOUR_MODES, HEIGHT_PALETTES } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type TopoShape = 'square' | 'rect' | 'circle' | 'hexagon';
export type TopoParams = { shape: TopoShape; width: number; metres: number; exaggeration: number; base: number; terrace: number; seaFloor: 'flat' | 'keep' };
export type ColourMode = 'one' | 'height' | 'satellite';
/** satellite: the palette and the colour of every cell come from the browser (cls: base64, one byte per cell). */
export type TopoColour = { mode: ColourMode; n: number; palette: string[]; cls?: string };
export type TopoDesign = { name: string; p: TopoParams; lat: number; lon: number; w: number; h: number; elev: string; colour: TopoColour };

export function parseTopoDesign(x: unknown): TopoDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: TopoParams = {
    shape: pick(q.shape, SHAPES as TopoShape[], 'shape'), width: num(q.width, 40, 300, 'width'), metres: num(q.metres, 100, 2_000_000, 'area'),
    exaggeration: num(q.exaggeration, 0.2, 30, 'height exaggeration'), base: num(q.base, 1, 30, 'base'), terrace: num(q.terrace, 0, 10, 'terraces'),
    seaFloor: pick(q.seaFloor, ['flat', 'keep'] as const, 'sea floor'),
  };
  const w = Math.round(num(d.w, 32, 400, 'grid')), h = Math.round(num(d.h, 32, 400, 'grid'));
  if (typeof d.elev !== 'string' || Math.abs(d.elev.length - Math.ceil((w * h * 2) / 3) * 4) > 4) throw new Error('The elevation data is missing.');
  const c = (d.colour ?? {}) as Record<string, unknown>;
  const mode = c.mode == null ? 'one' : pick(c.mode, COLOUR_MODES as ColourMode[], 'colours');
  const n = mode === 'one' ? 1 : Math.round(num(c.n, 2, 4, 'number of colours'));
  let colour: TopoColour = { mode: 'one', n: 1, palette: [] };
  if (mode === 'height') colour = { mode, n, palette: HEIGHT_PALETTES[n as 2 | 3 | 4].colours };
  if (mode === 'satellite') {
    const pal = Array.isArray(c.palette) ? c.palette : [];
    if (pal.length !== n || !pal.every((x) => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x))) throw new Error('The colours are missing.');
    const cells = (w - 1) * (h - 1);
    if (typeof c.cls !== 'string' || Math.abs(c.cls.length - Math.ceil(cells / 3) * 4) > 4) throw new Error('The colour map is missing.');
    colour = { mode, n, palette: pal as string[], cls: c.cls };
  }
  return { name: cleanName(d.name, 'Terrain'), colour, p, lat: num(d.lat, -85, 85, 'latitude'), lon: num(d.lon, -180, 180, 'longitude'), w, h, elev: d.elev };
}
