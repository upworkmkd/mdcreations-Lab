/* Design Studio: a drawing on a colour grid becomes a printable piece. Every painted colour is raised to its own
 * height on a base (a plate, a round coaster, a base that follows the drawing, or none). Shared by the preview in
 * the browser and the download built on the server. Units: mm; the grid is `pxmm` cells per mm, row 0 = top.
 * labels: one byte per cell, 0 = empty, 1..4 = the colour painted there. */
import { Tris, extrude, maskPolys, grow, heightField } from '@/lib/mesh/mesh.js';

export const TEMPLATES = ['sign', 'keychain', 'coaster', 'pixel', 'free'];
export const BASES = ['plate', 'circle', 'outline', 'none'];
export const MAX_COLOURS = 4;

/** Fills enclosed gaps so a base is one solid piece. */
function fillHoles(m, w, h) {
  const seen = new Uint8Array(w * h), st = [];
  const push = (i) => { if (!seen[i] && !m[i]) { seen[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const i = st.pop(), x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * (h - 1)) push(i + w); }
  const out = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) out[i] = m[i] || !seen[i] ? 1 : 0; return out;
}
const disc = (m, w, h, cx, cy, r, v) => {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) m[y * w + x] = v;
};
function pieces(m, w, h) {
  const lab = new Int32Array(w * h), st = []; let n = 0;
  for (let i0 = 0; i0 < w * h; i0++) {
    if (!m[i0] || lab[i0]) continue; n++; lab[i0] = n; st.push(i0);
    while (st.length) { const i = st.pop(), x = i % w; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1]) if (j >= 0 && m[j] && !lab[j]) { lab[j] = n; st.push(j); } }
  }
  return n;
}

/** Pixel art: a solid with exactly square cells (outlines traced from a grid round off the corners). */
function squareSolid(m, w, h, mm, z0, z1) {
  const hg = new Float32Array((w + 1) * (h + 1)).fill(z1 - z0);
  const t = heightField(hg, w + 1, h + 1, mm, m);
  if (z0) for (let i = 2; i < t.length; i += 3) t[i] += z0;
  // heightField centres the grid on the origin, like maskPolys
  return t;
}

/** The base shape in grid cells for the drawing (null without a base). The canvas is the plate or the coaster. */
export function baseMask(d) {
  const { w, h, pxmm, labels, base } = d;
  if (base.kind === 'none') return null;
  const B = new Uint8Array(w * h);
  if (base.kind === 'plate') {
    const r = Math.min(base.corner * pxmm, w / 2, h / 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = Math.max(r - x - 0.5, x + 0.5 - (w - r), 0), dy = Math.max(r - y - 0.5, y + 0.5 - (h - r), 0);
      if (dx * dx + dy * dy <= r * r) B[y * w + x] = 1;
    }
  } else if (base.kind === 'circle') {
    disc(B, w, h, w / 2, h / 2, Math.min(w, h) / 2, 1);
  } else {
    const U = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) U[i] = labels[i] ? 1 : 0;
    const g = grow(U, w, h, Math.max(1, base.border * pxmm));
    const f = fillHoles(g, w, h); B.set(f);
  }
  return B;
}

/** Where the keychain ring goes: centred over the top of the piece. Returns { x, y, r, hole } in cells, or null. */
export function ringAt(d, B) {
  if (!(d.hole > 0)) return null;
  const { w, h, pxmm, labels } = d, T = B || labels;
  let top = -1, mid = w / 2;
  for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (T[y * w + x]) { top = y; break; }
  if (top < 0) return null;
  let best = -1; for (let x = 0; x < w; x++) if (T[top * w + x] && (best < 0 || Math.abs(x - mid) < Math.abs(best - mid))) best = x;
  const R = (d.hole / 2 + 2.4) * pxmm;
  return { x: best + 0.5, y: top - R * 0.3, r: R, hole: (d.hole / 2) * pxmm, colour: labels[top * w + best] || 1 };
}

/**
 * d: { w, h, pxmm, labels, colours: [{ color, height }] (index 0 = colour 1), base: { kind, thickness, color, border, corner }, hole, square }
 * Returns { parts: [{ name, color, tris, z0, z1 }], size: [x, y, z], pieces, warnings }.
 */
export function buildStudio(d) {
  const { pxmm } = d, mm = 1 / pxmm;
  // room for a ring above the drawing: pad the grid at the top
  const padTop = d.hole > 0 ? Math.ceil((d.hole + 6) * pxmm) : 0;
  const w = d.w, h = d.h + padTop, src = d.labels;
  const labels = new Uint8Array(w * h); labels.set(src, padTop * w);
  const g = { ...d, h, labels };
  let B = baseMask(g);
  if (B && padTop && g.base.kind !== 'outline') { const b2 = new Uint8Array(w * h); b2.set(baseMask({ ...d, labels: src }), padTop * w); B = b2; }
  const ring = ringAt(g, B);
  if (ring) {
    const T = B || labels;
    disc(T, w, h, ring.x, ring.y, ring.r, B ? 1 : ring.colour);
    disc(T, w, h, ring.x, ring.y, ring.hole, 0);
    if (B) disc(labels, w, h, ring.x, ring.y, ring.r + 0.8 * pxmm, 0);
  }
  if (B) for (let i = 0; i < w * h; i++) if (!B[i]) labels[i] = 0;
  const z0 = B ? d.base.thickness : 0, smooth = d.square ? 0 : 1, tol = d.square ? 0.001 : 0.03;
  const parts = [], warnings = [];
  const solid = (m, a, b) => { if (d.square) return squareSolid(m, w, h, mm, a, b); const t = new Tris(); extrude(t, maskPolys(m, w, h, mm, tol, smooth), a, b); return t.done(); };
  if (B) parts.push({ name: 'Base', color: d.base.color, tris: solid(B, 0, z0), z0: 0, z1: z0 });
  for (let k = 1; k <= MAX_COLOURS; k++) {
    const c = d.colours[k - 1]; if (!c) continue;
    const m = new Uint8Array(w * h); let any = false;
    for (let i = 0; i < w * h; i++) if (labels[i] === k) { m[i] = 1; any = true; }
    if (!any) continue;
    const tris = solid(m, z0, z0 + c.height);
    if (tris.length) parts.push({ name: `Colour ${k}`, color: c.color, tris, z0, z1: z0 + c.height });
    else warnings.push(`Colour ${k} is too thin to print.`);
  }
  if (!parts.length) throw new Error('Draw something first.');
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) for (let i = 0; i < p.tris.length; i += 3) for (let k = 0; k < 3; k++) { const v = p.tris[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  const U = B || (() => { const u = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) u[i] = labels[i] ? 1 : 0; return u; })();
  return { parts, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], pieces: pieces(U, w, h), warnings };
}
