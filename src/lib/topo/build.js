/* Terrain models: an elevation grid (metres) becomes a printable block, square, round or hexagonal,
 * with optional terraces. Shared by the preview and the server build. Units: mm. */
import { heightField } from '@/lib/mesh/mesh.js';

export const SHAPES = ['square', 'rect', 'circle', 'hexagon'];

/** Model height (mm) at every sample, and the relief span. elev: Int16Array (metres), w × h, row 0 = north. */
export function terrain(p, elev, w, h) {
  let lo = Infinity, hi = -Infinity;
  const e = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { let v = elev[i]; if (p.seaFloor === 'flat' && v < 0) v = 0; e[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const mmPerM = p.width / p.metres, k = mmPerM * p.exaggeration, out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let z = (e[i] - lo) * k;
    if (p.terrace > 0) z = Math.floor(z / p.terrace) * p.terrace;
    out[i] = p.base + z;
  }
  return { z: out, relief: (hi - lo) * k, lo, hi };
}

export function buildTerrain(p, elev, w, h) {
  const t = terrain(p, elev, w, h), pitch = p.width / (w - 1), H = (h - 1) * pitch, W = p.width;
  let keep;
  if (p.shape !== 'square' && p.shape !== 'rect') {
    const cw = w - 1, ch = h - 1, R = Math.min(W, H) / 2; keep = new Uint8Array(cw * ch);
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const x = (i + 0.5) * pitch - W / 2, y = H / 2 - (j + 0.5) * pitch;
      let ok;
      if (p.shape === 'circle') ok = x * x + y * y <= R * R;
      else { const ax = Math.abs(x), ay = Math.abs(y); ok = ay <= R * 0.866 && ax * 0.866 + ay * 0.5 <= R * 0.866; }
      keep[j * cw + i] = ok ? 1 : 0;
    }
  }
  return { tris: heightField(t.z, w, h, pitch, keep), size: [W, H, p.base + t.relief], relief: t.relief, lo: t.lo, hi: t.hi };
}
