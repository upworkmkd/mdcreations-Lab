/* QR code to a two-colour plate. Runs in the browser. Units: mm. */
import { Tris, extrude, maskPolys, cleanRing, cap } from '@/lib/mesh/mesh.js';

export const PX = 8;   // pixels per QR module on the working grid

const inRound = (x, y, cx, cy, w, h, r) => {
  const dx = Math.abs(x - cx) - (w / 2 - r), dy = Math.abs(y - cy) - (h / 2 - r);
  if (dx <= 0 || dy <= 0) return Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2;
  return dx * dx + dy * dy <= r * r;
};

/**
 * qr: { size, get(r,c) }   label: { mask, w, h } drawn at PX pixels per module, or null
 * o: { module, quiet, baseT, codeT, shape: 'square'|'rounded'|'keychain'|'circle', corner, labelGap, hole }
 * Returns closed meshes for the plate and the raised code (plus label).
 */
export function buildQrPlate(qr, label, o) {
  const n = qr.size, mm = o.module / PX;
  const q = Math.round(o.quiet * PX), codePx = n * PX;
  const gap = label ? Math.round(o.labelGap / mm) : 0;
  let W = codePx + 2 * q, H = codePx + 2 * q + (label ? label.h + gap : 0);
  if (label && label.w + 2 * q > W) W = label.w + 2 * q;
  if (o.shape === 'circle') { const d = Math.ceil(Math.hypot(codePx, codePx)) + 2 * q; W = H = Math.max(d, H); }
  const tab = o.shape === 'keychain' ? Math.round((o.hole + 4) / mm) : 0;
  const M = 3, GW = W + 2 * M, GH = H + tab + 2 * M;
  const ox = M + Math.round((W - codePx) / 2), oy = M + tab + (o.shape === 'circle' ? Math.round((H - codePx - (label ? label.h + gap : 0)) / 2) : q);

  const top = new Uint8Array(GW * GH);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.get(r, c))
    for (let y = 0; y < PX; y++) { const row = (oy + r * PX + y) * GW + ox + c * PX; top.fill(1, row, row + PX); }
  if (label) {
    const lx = M + Math.round((W - label.w) / 2), ly = oy + codePx + gap;
    for (let y = 0; y < label.h; y++) for (let x = 0; x < label.w; x++) if (label.mask[y * label.w + x]) top[(ly + y) * GW + lx + x] = 1;
  }

  const base = new Uint8Array(GW * GH), rr = o.shape === 'square' ? 0 : Math.round(o.corner / mm);
  const pcx = M + W / 2, pcy = M + tab + H / 2, hr = o.hole / 2 / mm, hcx = pcx, hcy = M + tab / 2 + 1 / mm;
  const tw = (o.hole + 7) / mm;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const px = x + 0.5, py = y + 0.5;
    let on = o.shape === 'circle' ? (px - pcx) ** 2 + (py - pcy) ** 2 <= (W / 2) ** 2 : inRound(px, py, pcx, pcy, W, H, Math.min(rr, W / 2, H / 2));
    if (!on && tab) on = inRound(px, py, hcx, M + (tab + rr) / 2, tw, tab + rr, Math.min(tw / 2, (tab + rr) / 2));
    if (on && tab && (px - hcx) ** 2 + (py - hcy) ** 2 <= hr * hr) on = false;
    base[y * GW + x] = on ? 1 : 0;
  }
  for (let i = 0; i < GW * GH; i++) if (!base[i]) top[i] = 0;   // the code never hangs past the plate
  const basePolys = maskPolys(base, GW, GH, mm, mm * 0.15, 1), codePolys = maskPolys(top, GW, GH, mm, mm * 0.1, 0);

  // what the preview shows in two colours
  const t = new Tris(), c = new Tris();
  extrude(t, basePolys, 0, o.baseT);
  extrude(c, codePolys, o.baseT, o.baseT + o.codeT);
  return { base: t.done(), code: c.done(), solid: oneSolid(basePolys, codePolys, o.baseT, o.baseT + o.codeT), size: [W * mm, (H + tab) * mm] };
}

const area = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; };
const orient = (r, ccw) => (area(r) > 0 === ccw ? r : r.slice().reverse());
const inside = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };

/**
 * The plate and the raised code as ONE closed solid: the code's side walls start on the plate's top face and share
 * its edges, so there are no separate pieces and no hidden faces inside. Prints as a single object; for two colours,
 * change filament at the plate thickness.
 */
function oneSolid(basePolys, codePolys, zb, zt) {
  const t = new Tris();
  const wall = (ring, z0, z1) => { for (let i = 0, n = ring.length; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n]; t.quad([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]); } };
  const code = codePolys.map((P) => ({ outer: orient(cleanRing(P.outer), true), holes: (P.holes || []).map(cleanRing).filter((h) => h.length >= 3).map((h) => orient(h, false)) })).filter((P) => P.outer.length >= 3);
  // which code pieces sit inside a hole of another code piece (the middle of a finder pattern, for example)
  const owner = code.map((P, k) => {
    let best = null, ba = Infinity;
    code.forEach((Q, m) => { if (m === k) return; Q.holes.forEach((h) => { const a = -area(h); if (a < ba && a > -area(P.outer) && inside(P.outer[0], h)) { best = h; ba = a; } }); });
    return best;
  });
  for (const B of basePolys) {
    const outer = orient(cleanRing(B.outer), true); if (outer.length < 3) continue;
    const bh = (B.holes || []).map(cleanRing).filter((h) => h.length >= 3).map((h) => orient(h, false));
    wall(outer, 0, zb); bh.forEach((h) => wall(h, 0, zb));
    cap(t, outer, bh, 0, false);
    // the plate's top face: everything not covered by code
    const topLevel = code.filter((P, k) => !owner[k] && inside(P.outer[0], outer));
    cap(t, outer, [...bh, ...topLevel.map((P) => orient(P.outer, false))], zb, true);
    // islands of plate showing through holes in the code
    for (const P of code) for (const h of P.holes) {
      const inner = code.filter((Q, k) => owner[k] === h).map((Q) => orient(Q.outer, false));
      cap(t, orient(h, true), inner, zb, true);
    }
  }
  for (const P of code) { wall(P.outer, zb, zt); P.holes.forEach((h) => wall(h, zb, zt)); cap(t, P.outer, P.holes, zt, true); }
  return t.done();
}
