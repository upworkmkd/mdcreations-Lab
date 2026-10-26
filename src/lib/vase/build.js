/* Vases, planters and lamp shades from a few numbers. Shared by the preview and the server build. Units: mm. */
import { Tris, box, transform, outward, revolve } from '@/lib/mesh/mesh.js';

export const MODES = ['spiral', 'vase', 'planter', 'shade'];

/** Radius profile through four control radii (bottom, lower, upper, top), smooth. */
function profile(p, t) {
  const r = [p.r0, p.r1, p.r2, p.r3], u = Math.min(0.9999, Math.max(0, t)) * 3, k = Math.floor(u), f = u - k;
  const P = (i) => r[Math.max(0, Math.min(3, i))];
  const p0 = P(k - 1), p1 = P(k), p2 = P(k + 1), p3 = P(k + 2);   // Catmull-Rom
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

/** Outer radius at height t (0–1) and angle a. */
export function radius(p, t, a) {
  let r = profile(p, t);
  const tw = ((p.twist * Math.PI) / 180) * t, aa = a - tw;
  if (p.sides >= 3) { const s = (2 * Math.PI) / p.sides, m = ((aa % s) + s) % s - s / 2, poly = Math.cos(s / 2) / Math.cos(m); r *= 1 + (poly - 1) * (1 - p.soft); }
  if (p.ripples > 0 && p.rippleDepth > 0) r += p.rippleDepth * Math.sin(p.ripples * aa + p.wave * 2 * Math.PI * t);
  if (p.bands > 0 && p.bandDepth > 0) r += p.bandDepth * Math.sin(p.bands * 2 * Math.PI * t);
  return Math.max(3, r);
}

export function buildVase(p) {
  const n = p.segments, H = p.height, rows = Math.max(8, Math.round(H / p.step)), t = new Tris(n * rows * 4.5);
  const ring = (z, off) => { const tt = z / H, out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, r = radius(p, tt, a) - off; out.push([r * Math.cos(a), r * Math.sin(a), z]); } return out; };
  const zs = Array.from({ length: rows + 1 }, (_, k) => (k / rows) * H);
  const O = zs.map((z) => ring(z, 0));
  const wallRings = (R) => { for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; t.quad(R[k][i], R[k][j], R[k + 1][j], R[k + 1][i]); } };
  const innerRings = (R) => { for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; t.quad(R[k][j], R[k][i], R[k + 1][i], R[k + 1][j]); } };
  const fan = (R, z, up) => { for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (up) t.tri(0, 0, z, R[i][0], R[i][1], z, R[j][0], R[j][1], z); else t.tri(0, 0, z, R[j][0], R[j][1], z, R[i][0], R[i][1], z); } };
  const annulus = (A, B, up) => { for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (up) t.quad(B[i], A[i], A[j], B[j]); else t.quad(A[i], B[i], B[j], A[j]); } };   // A outer, B inner ring at the same height
  wallRings(O);
  const parts = [];
  if (p.mode === 'spiral') { fan(O[0], 0, false); fan(O[rows], H, true); }
  else if (p.mode === 'shade') {
    const I = zs.map((z) => ring(z, p.wall)); innerRings(I); annulus(O[rows], I[rows], true); annulus(O[0], I[0], false);
  } else {
    const fz = Math.min(p.floor, H - 2), I = zs.filter((z) => z >= fz).map((z) => ring(z, p.wall));
    if (I[0][0][2] > fz + 1e-6) I.unshift(ring(fz, p.wall));
    innerRings(I); annulus(O[rows], I[I.length - 1], true);
    if (p.mode === 'planter' && p.drain > 0) {
      // floor and bottom with a drain hole: a short tube joins them
      const hr = p.drain / 2, C = (z) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [hr * Math.cos(a), hr * Math.sin(a), z]; });
      const c0 = C(0), c1 = C(fz);
      annulus(O[0], c0, false); annulus(I[0], c1, true);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; t.quad(c0[j], c0[i], c1[i], c1[j]); }
    } else { fan(O[0], 0, false); fan(I[0], fz, true); }
  }
  parts.push({ file: p.mode === 'shade' ? 'shade' : p.mode === 'planter' ? 'planter' : 'vase', label: p.mode === 'shade' ? 'Lamp shade' : p.mode === 'planter' ? 'Planter' : 'Vase', tris: outward(t.done()) });

  if (p.mode === 'shade' && p.fitting !== 'none') {
    // a hub for the lamp holder, held by three spokes that reach into the wall
    const z0 = p.fitting === 'top' ? H - 3 : 0, hole = p.hole / 2, hubR = hole + 6;
    const hub = revolve([[hole, z0], [hubR, z0], [hubR, z0 + 3], [hole, z0 + 3]], 96);
    const s = new Tris();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3, tz = (z0 + 1.5) / H; let rw = Infinity;
      for (let d = -0.08; d <= 0.08; d += 0.04) rw = Math.min(rw, radius(p, tz, a + d) - p.wall);
      const b = new Tris(); box(b, hubR - 1, -3, z0, rw + p.wall * 0.6, 3, z0 + 3);
      s.add(transform(b.done(), ([x, y, z]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z]));
    }
    const all = new Tris(); all.add(parts[0].tris); all.add(hub); all.add(s.done());
    parts[0] = { ...parts[0], label: 'Lamp shade with fitting ring', tris: all.done() };
  }
  return { parts, size: [2 * Math.max(p.r0, p.r1, p.r2, p.r3) + 2 * (p.rippleDepth + p.bandDepth), 2 * Math.max(p.r0, p.r1, p.r2, p.r3), H] };
}
