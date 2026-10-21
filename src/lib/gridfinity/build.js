/* Gridfinity bins and baseplates (42 mm grid, 7 mm height units). Shared by the preview and the server build.
 * Dimensions follow the open Gridfinity spec by Zack Freedman. Units: mm. */
import { Tris, cap, extrude, roundRect, transform, outward } from '@/lib/mesh/mesh.js';

export const PITCH = 42, UNIT = 7, BASE_H = 4.75, LIP_H = 4.4;
const SEG = 8;   // points per rounded corner

const rr = (cx, cy, w, h, r) => roundRect(cx, cy, w, h, Math.max(0.05, r), SEG);
const area = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; };
const ccw = (r) => (area(r) < 0 ? r.slice().reverse() : r);
const cw = (r) => (area(r) > 0 ? r.slice().reverse() : r);
const lift = (r, z) => r.map(([x, y]) => [x, y, z]);

/** Side walls between stacked rings of equal length (outer: faces out; inner: faces in). */
function walls(t, rings, zs, inner) {
  for (let k = 0; k < rings.length - 1; k++) {
    const A = lift(rings[k], zs[k]), B = lift(rings[k + 1], zs[k + 1]), n = A.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (inner) t.quad(A[j], A[i], B[i], B[j]); else t.quad(A[i], A[j], B[j], B[i]); }
  }
}

/** One foot under a grid cell: the stepped profile, with optional magnet holes in its underside. */
function foot(t, cx, cy, magnets) {
  const prof = [[0, 35.6, 0.8], [0.8, 37.2, 1.6], [2.6, 37.2, 1.6], [BASE_H, 41.5, 3.75]];
  const rings = prof.map(([, s, r]) => ccw(rr(cx, cy, s, s, r))), zs = prof.map(([z]) => z);
  walls(t, rings, zs, false);
  cap(t, rings[rings.length - 1], [], BASE_H, true);
  if (!magnets) { cap(t, rings[0], [], 0, false); return; }
  const holes = [];
  for (const [dx, dy] of [[-13, -13], [13, -13], [13, 13], [-13, 13]]) {
    const c = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.push([cx + dx + 3.25 * Math.cos(a), cy + dy + 3.25 * Math.sin(a)]); }
    holes.push(cw(c));
  }
  cap(t, rings[0], holes, 0, false);
  for (const h of holes) { walls(t, [h, h], [0, 2.4], false); cap(t, ccw(h), [], 2.4, false); }
}

/**
 * A block with pockets: solid from z0, pockets (holes, any orientation) open at the top and floored at zf.
 */
function pocketed(t, outer, pockets, z0, zf, z1) {
  const O = ccw(outer), P = pockets.map(cw);
  walls(t, [O, O], [z0, z1], false);
  cap(t, O, [], z0, false);
  cap(t, O, P, z1, true);
  for (const p of P) { walls(t, [p, p], [zf, z1], false); cap(t, ccw(p), [], zf, true); }
}

/**
 * p: { mode: 'bin'|'plate', gx, gy, units, divX, divY, wall, floor, lip, magnets, label }
 * Returns { parts: [{ file, label, tris }], size }.
 */
export function buildGrid(p) {
  const W = PITCH * p.gx - 0.5, D = PITCH * p.gy - 0.5;
  if (p.mode === 'plate') {
    const t = new Tris(), T = 4.65, prof = [[0, 35.8, 0.8], [2.15, 40.1, 3.05], [3.95, 40.1, 3.05], [T, 41.6, 3.8]];
    const outer = ccw(rr(0, 0, PITCH * p.gx, PITCH * p.gy, 4)), socks = [];
    for (let i = 0; i < p.gx; i++) for (let j = 0; j < p.gy; j++) {
      const cx = (i - (p.gx - 1) / 2) * PITCH, cy = (j - (p.gy - 1) / 2) * PITCH;
      const rings = prof.map(([, s, r]) => cw(rr(cx, cy, s, s, r)));
      walls(t, rings, prof.map(([z]) => z), false);   // clockwise rings: these walls face into the socket
      socks.push(rings);
    }
    walls(t, [outer, outer], [0, T], false);
    cap(t, outer, socks.map((r) => r[0]), 0, false);
    cap(t, outer, socks.map((r) => r[r.length - 1]), T, true);
    return { parts: [{ file: 'baseplate', label: 'Baseplate', tris: outward(t.done()) }], size: [PITCH * p.gx, PITCH * p.gy, T] };
  }

  const t = new Tris();
  for (let i = 0; i < p.gx; i++) for (let j = 0; j < p.gy; j++) foot(t, (i - (p.gx - 1) / 2) * PITCH, (j - (p.gy - 1) / 2) * PITCH, p.magnets);
  const zt = UNIT * p.units, zb = p.lip ? zt - 1.9 : zt, fz = BASE_H + p.floor;
  // compartments
  const iw = W - 2 * p.wall, id = D - 2 * p.wall, nx = p.divX + 1, ny = p.divY + 1, d = 1.2;
  const cwid = (iw - p.divX * d) / nx, cdep = (id - p.divY * d) / ny, pockets = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const cx = -iw / 2 + cwid / 2 + i * (cwid + d), cy = -id / 2 + cdep / 2 + j * (cdep + d);
    pockets.push(rr(cx, cy, cwid, cdep, Math.min(2.5, cwid / 2 - 0.05, cdep / 2 - 0.05)));
  }
  pocketed(t, rr(0, 0, W, D, 3.75), pockets, BASE_H, fz, zb);
  if (p.lip) {
    // stacking lip: the next bin's feet drop into it
    const prof = [[zt - 1.9, p.wall], [zt, 2.6], [zt + 1.9, 0.7], [zt + 3.7, 0.7], [zt + LIP_H, 0.25]];
    const O = ccw(rr(0, 0, W, D, 3.75)), rings = prof.map(([, ins]) => ccw(rr(0, 0, W - 2 * ins, D - 2 * ins, Math.max(0.5, 3.75 - ins))));
    walls(t, [O, O], [zt - 1.9, zt + LIP_H], false);
    walls(t, rings, prof.map(([z]) => z), true);
    cap(t, O, [cw(rings[0])], zt - 1.9, false);
    cap(t, O, [cw(rings[rings.length - 1])], zt + LIP_H, true);
  }
  if (p.label) {
    // a sloped label shelf along the back wall of each row of compartments
    for (let j = 0; j < ny; j++) {
      const yb = -id / 2 + (j + 1) * cdep + j * d, top = zb - 0.6, deep = Math.min(12, cdep * 0.4);
      const s = new Tris();
      extrude(s, [{ outer: [[0, top], [-deep, top], [-deep, top - 1], [0, top - 1 - deep]], holes: [] }], -iw / 2, iw / 2);
      t.add(outward(transform(s.done(), ([a, b, z]) => [z, yb + a + 0.4, b])));
    }
  }
  return { parts: [{ file: `bin_${p.gx}x${p.gy}x${p.units}`, label: 'Bin', tris: t.done() }], size: [W, D, zt + (p.lip ? LIP_H : 0)] };
}
