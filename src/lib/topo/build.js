/* Terrain models: an elevation grid (metres) becomes a printable block, square, round or hexagonal,
 * with optional terraces, in one colour or in 2-4 colours (by height, or taken from the satellite picture).
 * Shared by the preview and the server build. Units: mm. */
import { heightField, Tris } from '@/lib/mesh/mesh.js';

export const SHAPES = ['square', 'rect', 'circle', 'hexagon'];
export const COLOUR_MODES = ['one', 'height', 'satellite'];

/** Filament colours for "by height", low to high, and where each band starts (share of the relief). */
export const HEIGHT_PALETTES = {
  2: { colours: ['#4f7a3a', '#f1f0ea'], from: [0, 0.6] },
  3: { colours: ['#4f7a3a', '#8a6a45', '#f1f0ea'], from: [0, 0.35, 0.75] },
  4: { colours: ['#4f7a3a', '#8a6a45', '#8f918a', '#f1f0ea'], from: [0, 0.25, 0.55, 0.8] },
};
/** How deep the coloured top layer is (mm): 4-5 layers, enough to hide the base colour underneath. */
export const capDepth = (base) => Math.max(0.4, Math.min(1, base - 0.4));

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

/** Which grid cells are inside the round or hexagonal outline (null for square and 3:2: all of them). */
function shapeMask(shape, w, h, pitch) {
  if (shape === 'square' || shape === 'rect') return null;
  const W = (w - 1) * pitch, H = (h - 1) * pitch, cw = w - 1, ch = h - 1, R = Math.min(W, H) / 2, keep = new Uint8Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = (i + 0.5) * pitch - W / 2, y = H / 2 - (j + 0.5) * pitch;
    let ok;
    if (shape === 'circle') ok = x * x + y * y <= R * R;
    else { const ax = Math.abs(x), ay = Math.abs(y); ok = ay <= R * 0.866 && ax * 0.866 + ay * 0.5 <= R * 0.866; }
    keep[j * cw + i] = ok ? 1 : 0;
  }
  return keep;
}

export function buildTerrain(p, elev, w, h) {
  const t = terrain(p, elev, w, h), pitch = p.width / (w - 1), H = (h - 1) * pitch, W = p.width;
  const keep = shapeMask(p.shape, w, h, pitch);
  return { tris: heightField(t.z, w, h, pitch, keep ?? undefined), size: [W, H, p.base + t.relief], relief: t.relief, lo: t.lo, hi: t.hi };
}

/** A closed solid between two surfaces (top above bot, per sample) over the kept cells. */
function slab(top, bot, w, h, pitch, keep) {
  const t = new Tris(4096);
  const X = (i) => (i - (w - 1) / 2) * pitch, Y = (j) => ((h - 1) / 2 - j) * pitch;
  const cw = w - 1, ch = h - 1, inC = (i, j) => i >= 0 && j >= 0 && i < cw && j < ch && keep[j * cw + i];
  const T = (i, j) => [X(i), Y(j), top[j * w + i]], B = (i, j) => [X(i), Y(j), bot[j * w + i]];
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    if (!inC(i, j)) continue;
    const a = T(i, j + 1), b = T(i + 1, j + 1), c = T(i + 1, j), d = T(i, j);
    const A = B(i, j + 1), Bb = B(i + 1, j + 1), C = B(i + 1, j), D = B(i, j);
    t.quad(a, b, c, d);
    t.quad(A, D, C, Bb);
    if (!inC(i, j - 1)) t.quad(C, D, d, c);
    if (!inC(i, j + 1)) t.quad(A, Bb, b, a);
    if (!inC(i - 1, j)) t.quad(D, A, a, d);
    if (!inC(i + 1, j)) t.quad(Bb, C, c, b);
  }
  return t.done();
}

/** "By height": the colour band of every cell, from its average height. */
export function heightClasses(z, w, h, base, relief, n) {
  const from = HEIGHT_PALETTES[n].from, cw = w - 1, ch = h - 1, out = new Uint8Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const avg = (z[j * w + i] + z[j * w + i + 1] + z[(j + 1) * w + i] + z[(j + 1) * w + i + 1]) / 4;
    const f = relief > 0 ? (avg - base) / relief : 0;
    let c = 0; for (let k = 1; k < n; k++) if (f >= from[k]) c = k;
    out[j * cw + i] = c;
  }
  return out;
}

/** Heights (mm) where the filament changes for "by height": the first layer of each band above the lowest. */
export function bandHeights(base, relief, n) { return HEIGHT_PALETTES[n].from.slice(1).map((f) => base + relief * f); }

/**
 * A coloured model: a base block in the most used colour, and a thin coloured skin on top in each colour.
 * cls: the colour of every cell ((w-1) × (h-1)); palette: #rrggbb per colour.
 */
export function buildColoured(p, elev, w, h, cls, palette) {
  const t = terrain(p, elev, w, h), pitch = p.width / (w - 1), cw = w - 1, ch = h - 1;
  const keep = shapeMask(p.shape, w, h, pitch), cap = capDepth(p.base);
  const under = new Float32Array(w * h); for (let i = 0; i < w * h; i++) under[i] = t.z[i] - cap;
  const count = new Array(palette.length).fill(0);
  for (let i = 0; i < cw * ch; i++) if (!keep || keep[i]) count[cls[i]]++;
  const main = count.indexOf(Math.max(...count));
  const parts = [{ name: 'base', tris: heightField(under, w, h, pitch, keep ?? undefined), color: palette[main] }];
  for (let c = 0; c < palette.length; c++) {
    if (!count[c]) continue;
    const kc = new Uint8Array(cw * ch); for (let i = 0; i < cw * ch; i++) kc[i] = (!keep || keep[i]) && cls[i] === c ? 1 : 0;
    parts.push({ name: `colour-${c + 1}`, tris: slab(t.z, under, w, h, pitch, kc), color: palette[c] });
  }
  return { parts, size: [p.width, ch * pitch, p.base + t.relief], relief: t.relief, lo: t.lo, hi: t.hi, main };
}

/* ------------------------------------------------------------------ colours from the satellite picture */
const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/**
 * Groups the satellite colour of every cell into n colours (k-means), cleans up specks that would be too small to print,
 * merges colours that are nearly the same (so the palette can be shorter than n), and orders them dark to light. rgb: n × m samples (3 bytes each) on the same grid as the elevation.
 */
export function satelliteClasses(rgb, w, h, n, keep) {
  const cw = w - 1, ch = h - 1, N = cw * ch, col = new Float32Array(N * 3);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) for (let k = 0; k < 3; k++) {
    col[(j * cw + i) * 3 + k] = (rgb[(j * w + i) * 3 + k] + rgb[(j * w + i + 1) * 3 + k] + rgb[((j + 1) * w + i) * 3 + k] + rgb[((j + 1) * w + i + 1) * 3 + k]) / 4;
  }
  const use = []; for (let i = 0; i < N; i += 1) if (!keep || keep[i]) use.push(i);
  // k-means, started 6 times k-means++ style from a fixed seed (the same answer every time), keeping the tightest fit.
  // A single start can pick a blend colour from a border as a "colour" and merge two real areas.
  const d2 = (i, c) => (col[i * 3] - c[0]) ** 2 + (col[i * 3 + 1] - c[1]) ** 2 + (col[i * 3 + 2] - c[2]) ** 2;
  let seed = 0x2f6b9d1; const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const sample = use.filter((_, q) => q % Math.max(1, Math.floor(use.length / 6000)) === 0);
  let cs = [], best = Infinity, cls = new Uint8Array(N);
  for (let run = 0; run < 6; run++) {
    const c0 = sample[Math.floor(rnd() * sample.length)], cc = [[col[c0 * 3], col[c0 * 3 + 1], col[c0 * 3 + 2]]];
    while (cc.length < n) {
      const dist = sample.map((i) => Math.min(...cc.map((c) => d2(i, c)))), tot = dist.reduce((a, b) => a + b, 0);
      let r = rnd() * tot, pickI = sample[sample.length - 1];
      for (let q = 0; q < sample.length; q++) { r -= dist[q]; if (r <= 0) { pickI = sample[q]; break; } }
      cc.push([col[pickI * 3], col[pickI * 3 + 1], col[pickI * 3 + 2]]);
    }
    const lab = new Uint8Array(N); let sse = 0;
    for (let it = 0; it < 15; it++) {
      const sum = cc.map(() => [0, 0, 0, 0]); sse = 0;
      for (const i of use) { let b = 0, bd = Infinity; for (let c = 0; c < n; c++) { const d = d2(i, cc[c]); if (d < bd) { bd = d; b = c; } } lab[i] = b; sse += bd; const s2 = sum[b]; s2[0] += col[i * 3]; s2[1] += col[i * 3 + 1]; s2[2] += col[i * 3 + 2]; s2[3]++; }
      for (let c = 0; c < n; c++) if (sum[c][3]) cc[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
    if (sse < best) { best = sse; cs = cc; cls = lab; }
  }
  // specks: a cell takes the colour most of its neighbours have (twice)
  for (let pass = 0; pass < 2; pass++) {
    const prev = cls.slice();
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const votes = new Array(n).fill(0);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < cw && y < ch) votes[prev[y * cw + x]]++; }
      const top = votes.indexOf(Math.max(...votes)); if (votes[top] >= 5) cls[j * cw + i] = top;
    }
  }
  // colours that came out almost the same (a place that is mostly one colour) become one filament
  const used = new Array(n).fill(0); for (const i of use) used[cls[i]]++;
  const into = cs.map((c, k) => k), dc = (a, b) => Math.hypot(cs[a][0] - cs[b][0], cs[a][1] - cs[b][1], cs[a][2] - cs[b][2]);
  // a colour on under 1.5% of the map (border blends, a few roofs) joins the nearest real colour: specks do not print well
  const big = used.map((u) => u >= use.length * 0.015);
  // a smallish colour that sits between two others (the blend along a lake shore or a field edge) joins the nearer one
  const segD = (k, a, b) => { const A = cs[a], B = cs[b], P = cs[k], ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * ab[0] + (P[1] - A[1]) * ab[1] + (P[2] - A[2]) * ab[2]) / L)); return Math.hypot(P[0] - A[0] - t * ab[0], P[1] - A[1] - t * ab[1], P[2] - A[2] - t * ab[2]); };
  for (let k = 0; k < n; k++) {
    if (used[k] >= use.length * 0.08) continue;
    for (let a = 0; a < n && big[k]; a++) for (let b = a + 1; b < n && big[k]; b++) {
      if (a === k || b === k || used[a] <= used[k] || used[b] <= used[k]) continue;
      if (segD(k, a, b) < 14) big[k] = false;
    }
  }
  for (let k = 0; k < n; k++) if (!big[k] && big.some(Boolean)) { let nb = -1; for (let q = 0; q < n; q++) if (big[q] && (nb < 0 || dc(k, q) < dc(k, nb))) nb = q; into[k] = nb; }
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const ra = into[a], rb = into[b]; if (ra === rb) continue;
    if (!used[rb] || dc(ra, rb) < 22) for (let k = 0; k < n; k++) if (into[k] === rb) into[k] = ra;
  }
  const keepK = [...new Set(into)].filter((k) => used.some((u, q) => u && into[q] === k));
  const order = keepK.sort((a, b) => lum(cs[a]) - lum(cs[b])), rank = new Uint8Array(n);
  for (let k = 0; k < n; k++) rank[k] = Math.max(0, order.indexOf(into[k]));
  for (let i = 0; i < N; i++) cls[i] = rank[cls[i]];
  // satellite colours are dull at print scale: a little more saturation and light reads closer to the photo
  const palette = order.map((k) => { const c = cs[k], m = (c[0] + c[1] + c[2]) / 3; return '#' + c.map((v) => hex2((m + (v - m) * 1.35) * 1.08)).join(''); });
  return { cls, palette };
}

/** A plain name for a filament colour, for the print notes. */
export function colourName(hex) {
  const named = [['white', '#f2f2ee'], ['light grey', '#bdbdb8'], ['grey', '#8f918a'], ['dark grey', '#4a4a48'], ['black', '#1e1e1e'], ['green', '#4f7a3a'], ['dark green', '#2f4a25'], ['olive', '#7b7a45'],
    ['brown', '#8a6a45'], ['dark brown', '#5a412b'], ['tan', '#c2a77f'], ['sand', '#d9c9a3'], ['blue', '#3d7fb8'], ['dark blue', '#25476b'], ['teal', '#3f8f8a']];
  const v = (s) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16)), c = v(hex);
  let best = named[0][0], bd = Infinity;
  for (const [n, h] of named) { const q = v(h), d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}
