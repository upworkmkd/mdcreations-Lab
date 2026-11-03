/* Image to STL: turns a picture into a printable model, in the browser.
 *   raised  the shape in the picture (a logo, a silhouette, a drawing) raised as a solid, on an optional base
 *   relief  brightness becomes height (a heightmap), on a rectangle or cut to the picture's shape
 * Units: mm, z up. Pictures come in as RGBA grids (row 0 = top). */
import { Tris, extrude, maskPolys, grow, heightField, bounds } from '@/lib/mesh/mesh.js';

export const MAX_RAISED_PX = 1400;   // longest side of the working mask for raised shapes
const MAX_RELIEF = 220_000;          // samples in a relief

const lum = (d, i) => 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];

/* ------------------------------------------------------------------ reading the picture */
/** Share of pixels that are see-through. */
export function transparentShare(d, w, h) {
  let n = 0; for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] < 128) n++;
  return n / (w * h);
}

/** The colour around the edge of the picture, and how even it is (0 = one flat colour). */
export function edgeColour(d, w, h) {
  const px = [];
  const add = (x, y) => { const i = (y * w + x) * 4; if (d[i + 3] >= 128) px.push([d[i], d[i + 1], d[i + 2]]); };
  for (let x = 0; x < w; x += Math.max(1, (w / 200) | 0)) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y += Math.max(1, (h / 200) | 0)) { add(0, y); add(w - 1, y); }
  if (!px.length) return { rgb: [255, 255, 255], spread: 0 };
  const med = [0, 1, 2].map((k) => px.map((p) => p[k]).sort((a, b) => a - b)[px.length >> 1]);
  const dist = px.map((p) => Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2])).sort((a, b) => a - b);
  return { rgb: med, spread: dist[Math.floor(dist.length * 0.8)] };
}

/** Which way to read a picture when nothing is chosen yet. */
export function guessRead(d, w, h) {
  if (transparentShare(d, w, h) > 0.03) return 'alpha';
  const e = edgeColour(d, w, h), L = 0.2126 * e.rgb[0] + 0.7152 * e.rgb[1] + 0.0722 * e.rgb[2];
  if (e.spread < 40 && L > 200) return 'dark';           // dark shape on white: the classic logo
  if (e.spread < 40 && L < 60) return 'light';           // light shape on black
  if (e.spread < 40) return 'background';                // any plain background colour
  return 'dark';
}

/**
 * Solid pixels of the picture (1 = part of the shape).
 * read: 'dark' | 'light' (brightness below / above `level`), 'background' (differs from the edge colour by more
 * than `tol`), 'alpha' (not see-through). See-through pixels never count.
 */
export function pictureMask(d, w, h, { read, level = 128, tol = 60 }) {
  const m = new Uint8Array(w * h);
  const bg = read === 'background' ? edgeColour(d, w, h).rgb : null;
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] < 128) continue;
    if (read === 'alpha') m[i] = 1;
    else if (read === 'dark') m[i] = lum(d, i) < level ? 1 : 0;
    else if (read === 'light') m[i] = lum(d, i) >= level ? 1 : 0;
    else m[i] = Math.hypot(d[i * 4] - bg[0], d[i * 4 + 1] - bg[1], d[i * 4 + 2] - bg[2]) > tol ? 1 : 0;
  }
  return m;
}

/** Brightness grid 0–255 (see-through counts as white). */
export function grayOf(d, w, h) {
  const g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const a = d[i * 4 + 3] / 255; g[i] = Math.round(lum(d, i) * a + 255 * (1 - a)); }
  return g;
}

/* ------------------------------------------------------------------ mask helpers */
/** 4-connected pieces: label per pixel and the size of each piece (index 0 unused). */
function pieces(m, w, h) {
  const lab = new Int32Array(w * h), size = [0], st = [];
  for (let i0 = 0; i0 < w * h; i0++) {
    if (!m[i0] || lab[i0]) continue;
    const id = size.length; let n = 0; lab[i0] = id; st.push(i0);
    while (st.length) {
      const i = st.pop(), x = i % w; n++;
      if (x > 0 && m[i - 1] && !lab[i - 1]) { lab[i - 1] = id; st.push(i - 1); }
      if (x < w - 1 && m[i + 1] && !lab[i + 1]) { lab[i + 1] = id; st.push(i + 1); }
      if (i >= w && m[i - w] && !lab[i - w]) { lab[i - w] = id; st.push(i - w); }
      if (i < w * (h - 1) && m[i + w] && !lab[i + w]) { lab[i + w] = id; st.push(i + w); }
    }
    size.push(n);
  }
  return { lab, size };
}
/** Drops solid specks smaller than minPx pixels and fills holes smaller than minPx. */
function despeckle(m, w, h, minPx) {
  if (minPx < 1) return m;
  const out = m.slice();
  let p = pieces(out, w, h);
  for (let i = 0; i < w * h; i++) if (out[i] && p.size[p.lab[i]] < minPx) out[i] = 0;
  const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = out[i] ? 0 : 1;
  p = pieces(inv, w, h);
  // a hole touches no edge of the picture; the outside does
  const edge = new Set(); for (let x = 0; x < w; x++) { edge.add(p.lab[x]); edge.add(p.lab[(h - 1) * w + x]); } for (let y = 0; y < h; y++) { edge.add(p.lab[y * w]); edge.add(p.lab[y * w + w - 1]); }
  for (let i = 0; i < w * h; i++) if (inv[i] && !edge.has(p.lab[i]) && p.size[p.lab[i]] < minPx) out[i] = 1;
  return out;
}
/** Fills every enclosed gap, so a base is one solid piece. */
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
function bbox(m, w, h) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, x1, y0, y1 };
}
/** Copies a mask into a bigger one with `pad` empty pixels all round (and mirrors it if asked). */
function padMask(m, w, h, pad, mirror) {
  const W = w + 2 * pad, H = h + 2 * pad, o = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) o[(y + pad) * W + (mirror ? w - 1 - x : x) + pad] = 1;
  return { m: o, W, H };
}

/** Working grid for a raised shape: pixels per mm and the grid size for a picture of aspect (h / w). */
export function raisedGrid(widthMm, aspect, detail = 1) {
  const heightMm = widthMm * aspect, long = Math.max(widthMm, heightMm);
  const pxmm = Math.min(10 * detail, MAX_RAISED_PX * detail / long);
  return { pxmm, w: Math.max(8, Math.round(widthMm * pxmm)), h: Math.max(8, Math.round(heightMm * pxmm)), widthMm, heightMm };
}

/**
 * The raised shape. mask: solid pixels at `pxmm` pixels per mm.
 * o: { height, base: 'none'|'outline'|'plate'|'circle', baseT, border, corner, hole, mirror, thicken, speck }
 * Returns { base, top, size, pieces, topZ } (base is empty without a base).
 */
export function buildRaised(mask, w, h, pxmm, o) {
  const mm = 1 / pxmm, ringR = o.hole > 0 ? o.hole / 2 + 2.4 : 0;
  const pad = Math.ceil((Math.max(o.border, 0) + 2 * ringR + 2) * pxmm) + 4;
  let { m: S, W, H } = padMask(mask, w, h, pad, o.mirror);
  if (o.thicken > 0) S = grow(S, W, H, o.thicken * pxmm);
  S = despeckle(S, W, H, Math.round((o.speck || 0) * pxmm * pxmm));
  const box = bbox(S, W, H);
  if (!box) throw new Error('Nothing in the picture to raise. Change how the picture is read, or the darkness cut-off.');

  let B = null;
  const b = o.border * pxmm;
  if (o.base === 'outline') B = fillHoles(grow(S, W, H, Math.max(1, b)), W, H);
  else if (o.base === 'plate') {
    B = new Uint8Array(W * H);
    const bx0 = box.x0 - b, bx1 = box.x1 + 1 + b, by0 = box.y0 - b, by1 = box.y1 + 1 + b, r = Math.min(o.corner * pxmm, (bx1 - bx0) / 2, (by1 - by0) / 2);
    for (let y = Math.max(0, Math.floor(by0)); y < Math.min(H, Math.ceil(by1)); y++) for (let x = Math.max(0, Math.floor(bx0)); x < Math.min(W, Math.ceil(bx1)); x++) {
      const dx = Math.max(bx0 + r - x - 0.5, x + 0.5 - (bx1 - r), 0), dy = Math.max(by0 + r - y - 0.5, y + 0.5 - (by1 - r), 0);
      if (dx * dx + dy * dy <= r * r) B[y * W + x] = 1;
    }
  } else if (o.base === 'circle') {
    B = new Uint8Array(W * H);
    // the smallest circle round the shape's pixels (centre of the box, radius to the farthest pixel)
    const cx = (box.x0 + box.x1 + 1) / 2, cy = (box.y0 + box.y1 + 1) / 2; let r2 = 0;
    for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) if (S[y * W + x]) r2 = Math.max(r2, (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
    const R = Math.sqrt(r2) + b + 1;
    // the circle can be bigger than the padded grid: grow the grid to fit
    const need = Math.ceil(R - Math.min(cx, cy, W - cx, H - cy)) + 2;
    if (need > 0) { const p = padMask(S, W, H, need, false); S = p.m; W = p.W; H = p.H; B = new Uint8Array(W * H); disc(B, W, H, cx + need, cy + need, R, 1); }
    else disc(B, W, H, cx, cy, R, 1);
  }

  // keychain ring above the top of the piece (the base, or the shape itself without one)
  if (ringR > 0) {
    const T = B || S, bb = bbox(T, W, H), mid = (bb.x0 + bb.x1) / 2;
    let hx = mid, hy = bb.y1;
    for (let y = bb.y0; y <= bb.y1 && hy === bb.y1; y++) { let best = -1; for (let x = bb.x0; x <= bb.x1; x++) if (T[y * W + x] && (best < 0 || Math.abs(x - mid) < Math.abs(best - mid))) best = x; if (best >= 0) { hx = best + 0.5; hy = y; } }
    const R = ringR * pxmm, cy = Math.max(R + 1, hy - R * 0.45);
    disc(T, W, H, hx, cy, R, 1);
    disc(T, W, H, hx, cy, (o.hole / 2) * pxmm, 0);
    if (B) disc(S, W, H, hx, cy, R + 0.8 * pxmm, 0);   // keep the raised shape off the ring
  }
  if (B) for (let i = 0; i < W * H; i++) if (!B[i]) S[i] = 0;   // nothing hangs over the edge of the base

  const z0 = B ? o.baseT : 0;
  const base = new Tris(), top = new Tris();
  if (B) extrude(base, maskPolys(B, W, H, mm, 0.03, 1), 0, o.baseT);
  extrude(top, maskPolys(S, W, H, mm, 0.03, 1), z0, z0 + o.height);
  const bt = base.done(), tt = top.done();
  const all = new Float32Array(bt.length + tt.length); all.set(bt); all.set(tt, bt.length);
  if (!tt.length) throw new Error('The shape is too thin to print at this size. Make it bigger or thicken the lines.');
  const bb = bounds(all);
  const piecesN = pieces(B || S, W, H).size.length - 1;
  return { base: bt, top: tt, size: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]], pieces: piecesN, topZ: z0 };
}

/* ------------------------------------------------------------------ relief (heightmap) */
/** Sample grid for a relief: pitch in mm (made coarser on big sizes so the file stays reasonable). */
export function reliefGrid(widthMm, aspect, pitch) {
  const heightMm = widthMm * aspect;
  while ((Math.round(widthMm / pitch) + 1) * (Math.round(heightMm / pitch) + 1) > MAX_RELIEF) pitch += 0.02;
  pitch = +pitch.toFixed(2);
  return { w: Math.round(widthMm / pitch) + 1, h: Math.round(heightMm / pitch) + 1, pitch, widthMm, heightMm };
}

/** Box blur on a byte grid (radius in samples), twice. */
export function blur(src, w, h, r) {
  if (r < 1) return src;
  const a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { b[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; } }
  }
  const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = Math.round(a[i]); return o;
}

/**
 * gray: brightness 0–255 per sample (w × h); keep: optional solid-sample mask that cuts the outline to the picture.
 * o: { baseT, depth, raise: 'dark'|'light', mirror }
 */
export function buildRelief(gray, keep, w, h, pitch, o) {
  const hg = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const s = j * w + (o.mirror ? w - 1 - i : i), v = gray[s] / 255;
    hg[j * w + i] = o.baseT + o.depth * (o.raise === 'dark' ? 1 - v : v);
  }
  let cells = null;
  if (keep) {
    const cw = w - 1, ch = h - 1; cells = new Uint8Array(cw * ch); let any = 0;
    const K = (i, j) => keep[j * w + (o.mirror ? w - 1 - i : i)];
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) if (K(i, j) + K(i + 1, j) + K(i, j + 1) + K(i + 1, j + 1) >= 2) { cells[j * cw + i] = 1; any++; }
    if (!any) throw new Error('Nothing left after cutting out the background. Choose “Whole rectangle”.');
    cells = despeckle(cells, cw, ch, 4);
  }
  const tris = heightField(hg, w, h, pitch, cells);
  const bb = bounds(tris);
  return { tris, size: [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]] };
}
