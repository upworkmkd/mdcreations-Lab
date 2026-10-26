/* Name signs, keychains and cake toppers from a text mask (drawn in the browser, any script).
 * Shared by the preview and the server build. Units: mm; the mask is PX pixels per mm. */
import { Tris, extrude, maskPolys, grow } from '@/lib/mesh/mesh.js';

export const PX = 8;
export const MODES = ['keychain', 'sign', 'topper'];

/** Fills enclosed gaps (the inside of o, a, 8 …) so a backing is one solid piece. */
function fillHoles(m, w, h) {
  const seen = new Uint8Array(w * h), st = [];
  const push = (i) => { if (!seen[i] && !m[i]) { seen[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
  const out = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) out[i] = m[i] || !seen[i] ? 1 : 0; return out;
}
const disc = (m, w, h, cx, cy, r, v) => {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) m[y * w + x] = v;
};
const rect = (m, w, x0, y0, x1, y1, v) => { for (let y = Math.max(0, y0); y < y1; y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) m[y * w + x] = v; };

/** 4-connected pieces: label per pixel, and per piece its pixel count and box. */
function pieces(m, w, h) {
  const lab = new Int32Array(w * h), info = [null], st = [];
  for (let i0 = 0; i0 < w * h; i0++) {
    if (!m[i0] || lab[i0]) continue;
    const id = info.length, q = { n: 0, x0: w, x1: -1, y0: h, y1: -1 }; info.push(q);
    lab[i0] = id; st.push(i0);
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0; q.n++;
      if (x < q.x0) q.x0 = x; if (x > q.x1) q.x1 = x; if (y < q.y0) q.y0 = y; if (y > q.y1) q.y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && m[j] && !lab[j]) { lab[j] = id; st.push(j); }
    }
  }
  return { lab, info };
}
/** Fills enclosed gaps smaller than `minArea` pixels (slivers too small to print), keeps the bigger ones open. */
function fillSmallHoles(m, w, h, minArea) {
  const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = m[i] ? 0 : 1;
  const { lab, info } = pieces(inv, w, h), out = m.slice();
  for (let i = 0; i < w * h; i++) { const q = info[lab[i]]; if (q && q.n < minArea && q.x0 > 0 && q.y0 > 0 && q.x1 < w - 1 && q.y1 < h - 1) out[i] = 1; }
  return out;
}
/**
 * Cake topper shape: the letters themselves with a thin outline, so the word reads letter by letter (the inside of
 * a, o, e stays open). Letters that do not touch are joined by a bar along the foot of the word, and anything still
 * loose (the dot of an i, an accent) by a short upright to the piece below it.
 */
function topperShape(letters, w, h, b, PX) {
  let B = fillSmallHoles(grow(letters, w, h, Math.max(1, b)), w, h, Math.round((1.6 * PX) ** 2));
  let { lab, info } = pieces(B, w, h);
  if (info.length <= 2) return B;
  // the baseline: the row where most letters end (descenders and swash tails go on below it)
  const rows = new Int32Array(h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (letters[y * w + x]) rows[y]++;
  let base = 0, drop = -1; for (let y = 0; y < h - 1; y++) { const d = rows[y] - rows[y + 1]; if (d > drop) { drop = d; base = y; } }
  const foot = base + b, barH = Math.round(Math.max(2.5 * PX, 1.6 * b));
  const onLine = info.slice(1).filter((q) => q.y0 <= foot && q.y1 >= foot - barH);
  if (onLine.length > 1) {
    const bx0 = Math.min(...onLine.map((q) => q.x0)), bx1 = Math.max(...onLine.map((q) => q.x1)), r = barH / 2;
    rect(B, w, bx0, foot - barH + 1, bx1 + 1, foot + 1, 1);
    disc(B, w, h, bx0, foot - r + 1, r, 1); disc(B, w, h, bx1, foot - r + 1, r, 1);
  }
  const half = Math.max(1, Math.round(0.8 * PX));
  for (let pass = 0; pass < 12; pass++) {
    ({ lab, info } = pieces(B, w, h));
    if (info.length <= 2) break;
    let main = 1; for (let k = 2; k < info.length; k++) if (info[k].n > info[main].n) main = k;
    for (let k = 1; k < info.length; k++) {
      if (k === main) continue;
      const q = info[k], cx = Math.round((q.x0 + q.x1) / 2);
      // straight down from the middle of the loose piece to the first pixel of the main piece, else straight up
      let hit = -1; for (let y = q.y1 + 1; y < h; y++) if (lab[y * w + cx] === main) { hit = y; break; }
      if (hit >= 0) { rect(B, w, cx - half, q.y1 - half, cx + half + 1, hit + half, 1); continue; }
      for (let y = q.y0 - 1; y >= 0; y--) if (lab[y * w + cx] === main) { hit = y; break; }
      if (hit >= 0) rect(B, w, cx - half, hit - half, cx + half + 1, q.y0 + half, 1);
    }
  }
  return B;
}

/**
 * text: { mask, w, h } at PX px/mm.  p: { mode, backing: 'outline'|'plate', border, bold, baseT, letterT, hole, holes, stake, corner }
 * Returns { base, letters, size: [x, y, z] } as closed meshes.
 */
export function buildName(p, text) {
  const mm = 1 / PX, b = Math.round(p.border * PX), bold = Math.round(p.bold * PX);
  const ringR = p.mode === 'keychain' ? Math.round((p.hole / 2 + 2.6) * PX) : 0;
  const stake = p.mode === 'topper' ? Math.round(p.stake * PX) : 0;
  const padL = b + bold + 2 * ringR + 4, pad = b + bold + 4;
  const W = text.w + padL + pad, H = text.h + 2 * pad + stake;
  const L = new Uint8Array(W * H);
  for (let y = 0; y < text.h; y++) for (let x = 0; x < text.w; x++) if (text.mask[y * text.w + x]) L[(y + pad) * W + x + padL] = 1;
  const letters = bold > 0 ? grow(L, W, H, bold) : L;

  // the backing
  let B;
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (letters[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) throw new Error('There is no text to print.');
  if (p.backing === 'plate') {
    B = new Uint8Array(W * H);
    const r = Math.round(p.corner * PX), bx0 = x0 - b, bx1 = x1 + b + 1, by0 = y0 - b, by1 = y1 + b + 1;
    for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
      const dx = Math.max(bx0 + r - x - 0.5, x + 0.5 - (bx1 - r), 0), dy = Math.max(by0 + r - y - 0.5, y + 0.5 - (by1 - r), 0);
      if (dx * dx + dy * dy <= r * r) B[y * W + x] = 1;
    }
    if (p.mode === 'sign' && p.holes) { const hr = 1.9 * PX, inset = Math.max(hr + 2, b / 2); disc(B, W, H, bx0 + inset + hr, by0 + inset, hr, 0); disc(B, W, H, bx1 - inset - hr, by0 + inset, hr, 0); }
  } else if (p.mode === 'topper') {
    B = topperShape(letters, W, H, b, PX);
  } else {
    B = fillHoles(grow(letters, W, H, Math.max(1, b)), W, H);
  }

  if (p.mode === 'keychain') {
    // ring on the left, level with the middle of the backing's left edge
    let lx = W, sy = 0, n = 0;
    for (let x = 0; x < W && lx === W; x++) for (let y = 0; y < H; y++) if (B[y * W + x]) { lx = x; break; }
    for (let x = lx; x < lx + 3 * PX; x++) for (let y = 0; y < H; y++) if (B[y * W + x]) { sy += y; n++; }
    const cy = n ? sy / n : H / 2, cx = lx + ringR * 0.35;
    disc(B, W, H, cx - ringR * 0.6, cy, ringR, 1); rect(B, W, Math.round(cx - ringR * 0.6), Math.round(cy - ringR * 0.8), Math.round(cx + ringR * 0.6), Math.round(cy + ringR * 0.8), 1);
    disc(B, W, H, cx - ringR * 0.6, cy, (p.hole / 2) * PX, 0);
  }
  if (p.mode === 'topper') {
    const sw = Math.round(4 * PX), tip = Math.round(8 * PX);
    for (const f of [0.28, 0.72]) {
      let cx = Math.round(x0 + (x1 - x0) * f), low = -1;
      for (let k = 0; k < W && low < 0; k++) for (const s of [1, -1]) { const x = cx + s * k; if (x < 0 || x >= W) continue; for (let y = H - 1; y >= 0; y--) if (B[y * W + x]) { low = y; cx = x; break; } if (low >= 0) break; }
      if (low < 0) continue;
      const top = low - Math.round(5 * PX), bot = Math.min(H - 2, low + stake);
      for (let y = top; y < bot; y++) {
        const k = y > bot - tip ? (bot - y) / tip : 1, half = Math.max(1, Math.round((sw / 2) * k));
        rect(B, W, cx - half, y, cx + half, y + 1, 1);
      }
    }
  }

  for (let i = 0; i < W * H; i++) if (!B[i]) letters[i] = 0;   // nothing hangs over a hole or the edge
  const base = new Tris(), top = new Tris();
  extrude(base, maskPolys(B, W, H, mm, 0.03, 1), 0, p.baseT);
  if (p.letterT > 0) extrude(top, maskPolys(letters, W, H, mm, 0.03, 1), p.baseT, p.baseT + p.letterT);
  let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (B[y * W + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  return { base: base.done(), letters: top.done(), size: [(bx1 - bx0 + 1) * mm, (by1 - by0 + 1) * mm, p.baseT + p.letterT] };
}
