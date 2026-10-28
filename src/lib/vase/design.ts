/* What the browser sends to save a vase or shade: just the settings. */
import { MODES } from './build.js';
import { num, pick, cleanName } from '@/lib/kits/check';

export type VaseMode = 'spiral' | 'vase' | 'planter' | 'shade';
export type VaseParams = {
  mode: VaseMode; height: number; r0: number; r1: number; r2: number; r3: number; sides: number; soft: number; twist: number;
  ripples: number; rippleDepth: number; wave: number; bands: number; bandDepth: number; wall: number; floor: number; drain: number;
  segments: number; step: number; fitting: 'none' | 'top' | 'bottom'; hole: number;
};
export type VaseDesign = { name: string; p: VaseParams };

export function parseVaseDesign(x: unknown): VaseDesign {
  const d = (x ?? {}) as Record<string, unknown>, q = (d.p ?? {}) as Record<string, unknown>;
  const p: VaseParams = {
    mode: pick(q.mode, MODES as VaseMode[], 'type'), height: num(q.height, 30, 350, 'height'),
    r0: num(q.r0, 10, 150, 'bottom'), r1: num(q.r1, 10, 150, 'lower'), r2: num(q.r2, 10, 150, 'upper'), r3: num(q.r3, 10, 150, 'top'),
    sides: Math.round(num(q.sides, 0, 16, 'sides')), soft: num(q.soft, 0, 1, 'soft corners'), twist: num(q.twist, -720, 720, 'twist'),
    ripples: Math.round(num(q.ripples, 0, 60, 'ripples')), rippleDepth: num(q.rippleDepth, 0, 10, 'ripple depth'), wave: num(q.wave, -6, 6, 'wave'),
    bands: num(q.bands, 0, 30, 'bands'), bandDepth: num(q.bandDepth, 0, 10, 'band depth'),
    wall: num(q.wall, 0.8, 6, 'wall'), floor: num(q.floor, 0.8, 15, 'floor'), drain: num(q.drain, 0, 30, 'drain hole'),
    segments: Math.round(num(q.segments, 48, 360, 'smoothness')), step: num(q.step, 0.3, 3, 'smoothness'),
    fitting: pick(q.fitting, ['none', 'top', 'bottom'] as const, 'fitting'), hole: num(q.hole, 20, 80, 'fitting hole'),
  };
  return { name: cleanName(d.name, 'Vase'), p };
}
