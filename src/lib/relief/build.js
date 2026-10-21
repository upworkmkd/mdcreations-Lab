/* Photo reliefs: a brightness grid becomes raised detail on a plaque (rectangle, rounded, circle, oval, heart or arch)
 * with a raised frame. Shared by the preview and the server build. Units: mm. */
import { heightField } from '@/lib/mesh/mesh.js';

export const PLAQUES = ['rect', 'rounded', 'circle', 'oval', 'heart', 'arch'];
export const RATIOS = { '4:3': 4 / 3, '3:2': 3 / 2, '1:1': 1, '3:4': 3 / 4, '2:3': 2 / 3, '16:9': 16 / 9 };
const MAX = 160_000;

/** Plaque size in mm and the sample grid (the picture fills the whole plaque; the frame is drawn over it). */
export function gridFor(p) {
  const r = p.shape === 'circle' ? 1 : p.shape === 'heart' ? 1.08 : RATIOS[p.ratio] ?? 4 / 3;
  const wmm = p.width, hmm = p.width / r;
  let pitch = p.detail === 'fine' ? 0.3 : 0.4;
  while ((Math.round(wmm / pitch) + 1) * (Math.round(hmm / pitch) + 1) > MAX) pitch += 0.02;
  pitch = +pitch.toFixed(2);
  return { w: Math.round(wmm / pitch) + 1, h: Math.round(hmm / pitch) + 1, pitch, wmm, hmm };
}

/** Signed distance (mm, negative inside) to the plaque outline, for a point measured from the centre (y up). */
function outline(shape, x, y, W, H, corner) {
  const hw = W / 2, hh = H / 2;
  if (shape === 'circle' || shape === 'oval') { const k = Math.hypot(x / hw, y / hh); return (k - 1) * Math.min(hw, hh); }
  if (shape === 'heart') {
    const X = (x / hw) * 1.18, Y = (y / hh + 0.12) * 1.25, f = (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3;
    return f <= 0 ? -Math.min(hw, hh) * Math.min(1, Math.cbrt(-f)) * 0.5 : Math.min(hw, hh) * Math.min(1, Math.cbrt(f)) * 0.5;
  }
  if (shape === 'arch') { if (y > hh - hw) return Math.hypot(x, y - (hh - hw)) - hw; return Math.max(Math.abs(x) - hw, -hh - y); }
  const r = shape === 'rounded' ? Math.min(corner, hw, hh) : 0, qx = Math.abs(x) - (hw - r), qy = Math.abs(y) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** v: brightness grid 0–255 (already adjusted). Returns { tris, size }. */
export function buildRelief(p, v, G) {
  const { w, h, pitch } = G, W = (w - 1) * pitch, H = (h - 1) * pitch, top = p.base + p.relief;
  const hg = new Float32Array(w * h);
  const at = (i, j) => [i * pitch - W / 2, H / 2 - j * pitch];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [x, y] = at(i, j), d = outline(p.shape, x, y, W, H, p.corner);
    let z = p.base + p.relief * ((p.raise === 'dark' ? 255 - v[j * w + i] : v[j * w + i]) / 255);
    if (p.frame > 0 && d > -p.frame) z = top + p.frameUp;                                  // the raised frame
    hg[j * w + i] = z;
  }
  const cw = w - 1, ch = h - 1, keep = new Uint8Array(cw * ch);
  const hole = p.hole ? { x: 0, y: H / 2 - Math.max(p.frame, 3) - p.hole / 2 - 3, r: p.hole / 2 } : null;
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = (i + 0.5) * pitch - W / 2, y = H / 2 - (j + 0.5) * pitch;
    let k = outline(p.shape, x, y, W, H, p.corner) <= 0;
    if (k && hole && Math.hypot(x - hole.x, y - hole.y) < hole.r) k = false;
    keep[j * cw + i] = k ? 1 : 0;
  }
  // around the hanging hole, keep the surface at frame height so the hole has a solid ring
  if (hole) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const [x, y] = at(i, j); if (Math.hypot(x - hole.x, y - hole.y) < hole.r + 2.5) hg[j * w + i] = Math.max(hg[j * w + i], p.frame > 0 ? top + p.frameUp : top); }
  return { tris: heightField(hg, w, h, pitch, keep), size: [W, H, top + (p.frame > 0 ? p.frameUp : 0)] };
}
