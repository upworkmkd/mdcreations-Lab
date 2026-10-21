/* QR code to a two-colour plate. Runs in the browser. Units: mm. */
import { Tris, extrude, maskPolys } from '@/lib/mesh/mesh.js';

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
  const t = new Tris(), c = new Tris();
  extrude(t, maskPolys(base, GW, GH, mm, mm * 0.15, 1), 0, o.baseT);
  extrude(c, maskPolys(top, GW, GH, mm, mm * 0.1, 0), o.baseT, o.baseT + o.codeT);
  return { base: t.done(), code: c.done(), size: [W * mm, (H + tab) * mm] };
}
