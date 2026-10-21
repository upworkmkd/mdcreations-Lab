/* Layered Sculpture core: colours, layer masks, outlines and meshes. No DOM, so it runs in the browser and on the server.
 * Ported from the Layered Sculpture Studio. Units are millimetres, y up. */
/* eslint-disable */
import earcut from 'earcut';

// (contour:[Pt], holes:[[Pt]]) => [[a,b,c]] with indices into contour followed by each hole, like THREE.ShapeUtils.triangulateShape
let triangulate = (contour, holes) => {
  const flat = [], holeIdx = [];
  for (const p of contour) flat.push(p.x, p.y);
  for (const h of holes) { holeIdx.push(flat.length / 2); for (const p of h) flat.push(p.x, p.y); }
  const t = earcut(flat, holeIdx, 2), out = [];
  for (let i = 0; i < t.length; i += 3) out.push([t[i], t[i + 1], t[i + 2]]);
  return out;
};
function setTriangulator(fn) { triangulate = fn; }

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------- colour ---------- */
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function rgb2lab(r, g, b, out, o) {
  const lr = LIN[r], lg = LIN[g], lb = LIN[b];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
function lab2rgb(L, a, b) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const f = (c) => { c = clamp(c, 0, 1); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); };
  return [f(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), f(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), f(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
function hexToRgb(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(c) { return '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function labOf(rgb) { const o = [0, 0, 0]; rgb2lab(rgb[0], rgb[1], rgb[2], o, 0); return o; }

const FILAMENTS = [
  ['Black', '#161616'], ['White', '#f4f4f2'], ['Ivory', '#efe8d6'], ['Light grey', '#b9bcc0'], ['Dark grey', '#5a5f66'],
  ['Red', '#c8102e'], ['Maroon', '#7a1f2b'], ['Orange', '#f26a1b'], ['Gold', '#d4a11e'], ['Yellow', '#f6d21f'],
  ['Lime', '#9bd23c'], ['Green', '#1a9b47'], ['Dark green', '#0f5b38'], ['Teal', '#0b8a83'], ['Cyan', '#0aa5c9'],
  ['Sky blue', '#7ec4ee'], ['Blue', '#1557c0'], ['Navy', '#1b2a5c'], ['Purple', '#5e3aa8'], ['Magenta', '#d0368a'],
  ['Pink', '#f39ab8'], ['Peach', '#f0b890'], ['Beige', '#e3cfa8'], ['Brown', '#6b4226'],
  ['Indigo', '#3b3a8f'], ['Lavender', '#a99bd8'], ['Coral', '#ee6b5b'], ['Olive', '#6f7a2c'], ['Mint', '#a8e0c4'], ['Plum', '#7a3d7f'],
].map(([name, hex]) => ({ name, hex, rgb: hexToRgb(hex), lab: labOf(hexToRgb(hex)) }));
function nearestFilament(rgb) {
  const l = labOf(rgb); let best = FILAMENTS[0], bd = 1e9;
  for (const f of FILAMENTS) { const d = (f.lab[0] - l[0]) ** 2 + (f.lab[1] - l[1]) ** 2 + (f.lab[2] - l[2]) ** 2; if (d < bd) { bd = d; best = f; } }
  return best;
}
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- shapes: signed distance in mm, negative inside, y up ---------- */
const SHAPES = { square: 'Square', circle: 'Circle', hexagon: 'Hexagon', octagon: 'Octagon', arch: 'Arch', heart: 'Heart' };
function shapeSd(name, hw, hh, r) {
  const m = Math.min(hw, hh);
  if (name === 'circle') {
    if (Math.abs(hw - hh) < 1e-6) return (x, y) => Math.hypot(x, y) - hw;
    return (x, y) => { const k = Math.hypot(x / hw, y / hh); if (k < 1e-9) return -m; const g = Math.hypot(x / (hw * hw), y / (hh * hh)) / k; return (k - 1) / g; };
  }
  if (name === 'hexagon' || name === 'octagon') {
    const n = name === 'hexagon' ? 6 : 8, ap = m * Math.cos(Math.PI / n), rot = name === 'hexagon' ? 0 : Math.PI / 8;
    const ns = []; for (let i = 0; i < n; i++) { const a = rot + (i * 2 * Math.PI) / n; ns.push([Math.cos(a), Math.sin(a)]); }
    return (x, y) => { let d = -1e9; for (const q of ns) { const v = x * q[0] + y * q[1] - ap; if (v > d) d = v; } return d; };
  }
  if (name === 'arch') {
    const cy = hh - hw; // centre of the round top (only valid when hh >= hw)
    if (cy < 0) { return shapeSd('circle', hw, hh, 0); }
    return (x, y) => { if (y > cy) return Math.max(Math.hypot(x, y - cy) - hw, -1e9); const ax = Math.abs(x) - hw, ay = -hh - y; return Math.max(ax, ay) > 0 ? Math.hypot(Math.max(ax, 0), Math.max(ay, 0)) : Math.max(ax, ay); };
  }
  if (name === 'heart') {
    const sc = Math.min((2 * hw) / 1.2072, (2 * hh) / 1.1036);
    return (x, y) => {
      let px = Math.abs(x) / sc; const py = y / sc + 0.5518;
      if (py + px > 1) return (Math.hypot(px - 0.25, py - 0.75) - Math.SQRT2 / 4) * sc;
      const t = 0.5 * Math.max(px + py, 0);
      const d = Math.sqrt(Math.min(px * px + (py - 1) * (py - 1), (px - t) * (px - t) + (py - t) * (py - t)));
      return d * Math.sign(px - py) * sc;
    };
  }
  const rr = clamp(r || 0, 0, m);
  return (x, y) => { const qx = Math.abs(x) - (hw - rr), qy = Math.abs(y) - (hh - rr); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; };
}

const RATIOS = { '1:1': [1, 1], '4:5': [4, 5], '3:4': [3, 4], '2:3': [2, 3], '9:16': [9, 16], '5:4': [5, 4], '4:3': [4, 3], '3:2': [3, 2], '16:9': [16, 9] };

/* ---------- grid: physical size, pixel pitch, shape fields ---------- */
function buildGrid(p, imgAspect) {
  let rw = 1, rh = 1;
  if (p.ratio === 'image' && imgAspect) { rw = clamp(imgAspect, 0.4, 2.5); rh = 1; } else if (RATIOS[p.ratio]) [rw, rh] = RATIOS[p.ratio];
  const W = p.width, H = (W * rh) / rw;
  const s = Math.max(W, H) / p.res;
  const nx = Math.max(8, Math.round(W / s)), ny = Math.max(8, Math.round(H / s));
  const hw = W / 2, hh = H / 2;
  const border = clamp(p.border, 0, 0.42 * Math.min(W, H));
  const outer = shapeSd(p.outer, hw, hh, p.radius);
  let win, bw, bh;
  if (p.window === 'match') {
    win = border > 0.01 ? (x, y) => outer(x, y) + border : outer; bw = hw - border; bh = hh - border;
  } else {
    let sc = 1; const ibw = hw - border, ibh = hh - border;
    for (; sc > 0.3; sc -= 0.02) {
      const f = shapeSd(p.window, ibw * sc, ibh * sc, p.radius * sc); let ok = true;
      for (let j = 0; j < 72 && ok; j++) for (let i = 0; i < 72; i++) { const x = ((i + 0.5) / 72 - 0.5) * W, y = ((j + 0.5) / 72 - 0.5) * H; if (f(x, y) < 0 && outer(x, y) > -border + 0.02) { ok = false; break; } }
      if (ok) break;
    }
    bw = ibw * sc; bh = ibh * sc; win = shapeSd(p.window, bw, bh, p.radius * sc);
  }
  const PW = nx + 4, PH = ny + 4;
  const sdfO = new Float32Array(PW * PH), sdfW = new Float32Array(PW * PH);
  const region = new Uint8Array(nx * ny); let frameCount = 0, winCount = 0;
  for (let j = 0; j < PH; j++) {
    const y = hh - (j - 2 + 0.5) * s;
    for (let i = 0; i < PW; i++) {
      const x = (i - 2 + 0.5) * s - hw, o = -outer(x, y) / s, w = -win(x, y) / s;
      sdfO[j * PW + i] = o; sdfW[j * PW + i] = w;
      if (i >= 2 && j >= 2 && i < nx + 2 && j < ny + 2 && o > 0) { const r = w > 0 ? 2 : 1; region[(j - 2) * nx + (i - 2)] = r; if (r === 1) frameCount++; else winCount++; }
    }
  }
  // frame pixels within 3 px of the window copy their nearest window pixel, so smoothing a layer's edge never sees the frame
  const near = new Int32Array(nx * ny).fill(-1), extDst = [], extSrc = [];
  for (let i = 0; i < nx * ny; i++) if (region[i] === 2) near[i] = i;
  for (let pass = 0; pass < 3; pass++) {
    const add = [];
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x; if (region[i] !== 1 || near[i] >= 0) continue; let q = -1;
      if (x > 0 && near[i - 1] >= 0) q = near[i - 1]; else if (x < nx - 1 && near[i + 1] >= 0) q = near[i + 1]; else if (y > 0 && near[i - nx] >= 0) q = near[i - nx]; else if (y < ny - 1 && near[i + nx] >= 0) q = near[i + nx];
      else if (x > 0 && y > 0 && near[i - nx - 1] >= 0) q = near[i - nx - 1]; else if (x < nx - 1 && y > 0 && near[i - nx + 1] >= 0) q = near[i - nx + 1]; else if (x > 0 && y < ny - 1 && near[i + nx - 1] >= 0) q = near[i + nx - 1]; else if (x < nx - 1 && y < ny - 1 && near[i + nx + 1] >= 0) q = near[i + nx + 1];
      if (q >= 0) add.push(i, q);
    }
    for (let a = 0; a < add.length; a += 2) { near[add[a]] = add[a + 1]; extDst.push(add[a]); extSrc.push(add[a + 1]); }
  }
  return { W, H, s, nx, ny, PW, PH, hw, hh, border, outer, win, sdfO, sdfW, region, hasFrame: frameCount > 0, frameCount, winCount, box: { bw, bh }, extDst, extSrc };
}

function findPins(G, dia) {
  const pins = [], r = dia / 2, { hw, hh } = G; if (!G.hasFrame) return pins;
  for (const [dx, dy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    let best = -1e9, bx = 0, by = 0;
    for (let t = 0; t <= 1.0001; t += 0.002) { const x = dx * hw * t, y = dy * hh * t; const c = Math.min(-G.outer(x, y), G.win(x, y)); if (c > best) { best = c; bx = x; by = y; } }
    if (best >= r + 0.8) pins.push({ x: bx, y: by });
  }
  return pins;
}

/* ---------- image adjustments ---------- */
function boxBlurF(src, w, h, r, tmp) {
  // separable box blur, radius r (int), edge clamp; src modified in place
  if (r < 1) return;
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w; let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[o + clamp(k, 0, w - 1)];
    for (let x = 0; x < w; x++) { tmp[o + x] = acc / win; acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) { src[y * w + x] = acc / win; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
}
function adjust(rgba, nx, ny, p, s) {
  const n = nx * ny, out = new Uint8ClampedArray(rgba.length);
  const br = p.brightness / 100, ct = p.contrast >= 0 ? 1 + (p.contrast / 100) * 2 : 1 + p.contrast / 100, sat = 1 + p.saturation / 100, ig = 1 / clamp(p.gamma, 0.2, 4);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) { let v = i / 255; v = Math.pow(v, ig); v = (v - 0.5) * ct + 0.5 + br * 0.6; lut[i] = Math.round(clamp(v, 0, 1) * 255); }
  for (let i = 0; i < n; i++) {
    const o = i * 4; let r = lut[rgba[o]], g = lut[rgba[o + 1]], b = lut[rgba[o + 2]];
    if (sat !== 1) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
    if (p.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = rgba[o + 3];
  }
  const rad = Math.round((p.blur || 0) / s);
  if (rad >= 1) {
    const ch = new Float32Array(n), tmp = new Float32Array(n);
    for (let c = 0; c < 3; c++) { for (let i = 0; i < n; i++) ch[i] = out[i * 4 + c]; boxBlurF(ch, nx, ny, rad, tmp); boxBlurF(ch, nx, ny, rad, tmp); for (let i = 0; i < n; i++) out[i * 4 + c] = ch[i]; }
  }
  return out;
}

/* ---------- classification ---------- */
function kmeans(lab, idx, K, seed) {
  let best = null;
  for (let r = 0; r < 5; r++) { const c = kmeansOnce(lab, idx, K, seed + r * 7919); if (!best || c.sse < best.sse) best = c; }
  return best.cs;
}
function kmeansOnce(lab, idx, K, seed) {
  const rnd = mulberry(seed), m = idx.length, step = Math.max(1, Math.floor(m / 24000));
  const smp = []; for (let i = 0; i < m; i += step) smp.push(idx[i]);
  const S = smp.length; K = Math.min(K, S);
  const cen = new Float64Array(K * 3), d2 = new Float64Array(S).fill(1e9);
  let pick = smp[Math.floor(rnd() * S)];
  for (let k = 0; k < K; k++) {
    cen[k * 3] = lab[pick * 3]; cen[k * 3 + 1] = lab[pick * 3 + 1]; cen[k * 3 + 2] = lab[pick * 3 + 2];
    let tot = 0;
    for (let i = 0; i < S; i++) { const q = smp[i] * 3; const d = (lab[q] - cen[k * 3]) ** 2 + (lab[q + 1] - cen[k * 3 + 1]) ** 2 + (lab[q + 2] - cen[k * 3 + 2]) ** 2; if (d < d2[i]) d2[i] = d; tot += d2[i]; }
    let t = rnd() * tot, j = 0; for (; j < S - 1; j++) { t -= d2[j]; if (t <= 0) break; } pick = smp[j];
  }
  const sum = new Float64Array(K * 3), cnt = new Uint32Array(K); let sse = 0;
  for (let it = 0; it < 14; it++) {
    sum.fill(0); cnt.fill(0); sse = 0;
    for (let i = 0; i < S; i++) {
      const q = smp[i] * 3; let b = 0, bd = 1e9;
      for (let k = 0; k < K; k++) { const d = (lab[q] - cen[k * 3]) ** 2 + (lab[q + 1] - cen[k * 3 + 1]) ** 2 + (lab[q + 2] - cen[k * 3 + 2]) ** 2; if (d < bd) { bd = d; b = k; } }
      sum[b * 3] += lab[q]; sum[b * 3 + 1] += lab[q + 1]; sum[b * 3 + 2] += lab[q + 2]; cnt[b]++; sse += bd;
    }
    for (let k = 0; k < K; k++) if (cnt[k]) { cen[k * 3] = sum[k * 3] / cnt[k]; cen[k * 3 + 1] = sum[k * 3 + 1] / cnt[k]; cen[k * 3 + 2] = sum[k * 3 + 2] / cnt[k]; }
  }
  const cs = []; for (let k = 0; k < K; k++) cs.push([cen[k * 3], cen[k * 3 + 1], cen[k * 3 + 2]]);
  cs.sort((a, b) => a[0] - b[0]);
  return { cs, sse };
}

function labelComponents(solid, w, h) {
  // 4-connected labels over solid!=0 cells with equal value; returns labels (0 = none), sizes[], value[]
  const lab = new Int32Array(w * h), sizes = [0], vals = [0], stack = new Int32Array(w * h);
  let cur = 0;
  for (let i0 = 0; i0 < w * h; i0++) {
    if (!solid[i0] || lab[i0]) continue;
    const v = solid[i0]; cur++; let sp = 0, size = 0; stack[sp++] = i0; lab[i0] = cur;
    while (sp) {
      const i = stack[--sp]; size++; const x = i % w;
      if (x > 0 && !lab[i - 1] && solid[i - 1] === v) { lab[i - 1] = cur; stack[sp++] = i - 1; }
      if (x < w - 1 && !lab[i + 1] && solid[i + 1] === v) { lab[i + 1] = cur; stack[sp++] = i + 1; }
      if (i >= w && !lab[i - w] && solid[i - w] === v) { lab[i - w] = cur; stack[sp++] = i - w; }
      if (i < w * (h - 1) && !lab[i + w] && solid[i + w] === v) { lab[i + w] = cur; stack[sp++] = i + w; }
    }
    sizes.push(size); vals.push(v);
  }
  return { lab, sizes, vals, count: cur };
}

function classify(rgba, G, p) {
  const { nx, ny, region, s } = G, n = nx * ny;
  const cls = new Uint8Array(n).fill(255), lab = new Float32Array(n * 3);
  const idx = []; let bgCount = 0;
  const cut = p.transparent === 'cut';
  for (let i = 0; i < n; i++) {
    if (region[i] !== 2) continue;
    if (rgba[i * 4 + 3] < 128) { if (!cut) { cls[i] = 254; bgCount++; } continue; }
    rgb2lab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], lab, i * 3); idx.push(i);
  }
  let palette = [], K = 0;
  if (idx.length) {
    if (p.mode === 'tonal') {
      K = clamp(p.colors, 2, 12);
      const hist = new Uint32Array(1001); let lo = 1, hi = 0;
      for (const i of idx) { const L = clamp(lab[i * 3], 0, 1); hist[Math.round(L * 1000)]++; if (L < lo) lo = L; if (L > hi) hi = L; }
      if (hi - lo < 1e-4) hi = lo + 1e-4;
      const th = []; let acc = 0, q = 1;
      const quant = [];
      for (let b = 0; b <= 1000 && q < K; b++) { acc += hist[b]; while (q < K && acc >= (idx.length * q) / K) { quant.push(b / 1000); q++; } }
      while (quant.length < K - 1) quant.push(hi);
      for (let k = 1; k < K; k++) { const even = lo + ((hi - lo) * k) / K; th.push(even + (quant[k - 1] - even) * clamp(p.tonalBalance, 0, 1)); }
      for (const i of idx) { const L = lab[i * 3]; let c = 0; while (c < K - 1 && L > th[c]) c++; cls[i] = c; }
      const a = labOf(hexToRgb(p.shadow)), b = labOf(hexToRgb(p.highlight));
      for (let k = 0; k < K; k++) { const t = K === 1 ? 0 : k / (K - 1); palette.push(lab2rgb(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)); }
    } else {
      const cen = kmeans(lab, idx, clamp(p.colors, 2, 12), 12345); K = cen.length;
      for (const i of idx) {
        const q = i * 3; let bb = 0, bd = 1e9;
        for (let k = 0; k < K; k++) { const c = cen[k]; const d = (lab[q] - c[0]) ** 2 + (lab[q + 1] - c[1]) ** 2 + (lab[q + 2] - c[2]) ** 2; if (d < bd) { bd = d; bb = k; } }
        cls[i] = bb;
      }
      palette = cen.map((c) => lab2rgb(c[0], c[1], c[2]));
    }
  }
  let bgIndex = -1;
  if (bgCount) { bgIndex = K; palette.push(hexToRgb(p.bgColor)); for (let i = 0; i < n; i++) if (cls[i] === 254) cls[i] = K; K++; }
  // edge smoothing: argmax of blurred class indicators
  const rad = Math.round((p.smooth || 0) / s);
  if (rad >= 1 && K > 1) {
    const best = new Float32Array(n).fill(-1), bi = new Uint8Array(n), f = new Float32Array(n), tmp = new Float32Array(n);
    for (let k = 0; k < K; k++) {
      for (let i = 0; i < n; i++) f[i] = cls[i] === k ? 1 : 0;
      boxBlurF(f, nx, ny, rad, tmp); boxBlurF(f, nx, ny, rad, tmp);
      for (let i = 0; i < n; i++) if (f[i] > best[i]) { best[i] = f[i]; bi[i] = k; }
    }
    for (let i = 0; i < n; i++) if (cls[i] !== 255) cls[i] = bi[i];
  }
  // despeckle: merge tiny same-colour islands into their main neighbour
  const minPx = Math.round((p.despeckle || 0) / (s * s));
  if (minPx >= 1 && K > 1) {
    const sol = new Uint8Array(n); for (let i = 0; i < n; i++) sol[i] = cls[i] === 255 ? 0 : cls[i] + 1;
    const { lab: L, sizes, count } = labelComponents(sol, nx, ny);
    const votes = new Map();
    const vote = (c, v) => { let m = votes.get(c); if (!m) votes.set(c, (m = new Uint32Array(K))); m[v]++; };
    for (let i = 0; i < n; i++) {
      const c = L[i]; if (!c || sizes[c] >= minPx) continue; const x = i % nx;
      if (x > 0 && L[i - 1] !== c && cls[i - 1] !== 255) vote(c, cls[i - 1]);
      if (x < nx - 1 && L[i + 1] !== c && cls[i + 1] !== 255) vote(c, cls[i + 1]);
      if (i >= nx && L[i - nx] !== c && cls[i - nx] !== 255) vote(c, cls[i - nx]);
      if (i < n - nx && L[i + nx] !== c && cls[i + nx] !== 255) vote(c, cls[i + nx]);
    }
    const target = new Int16Array(count + 1).fill(-1);
    for (const [c, m] of votes) { let b = -1, bv = 0; for (let k = 0; k < K; k++) if (m[k] > bv) { bv = m[k]; b = k; } target[c] = b; }
    for (let i = 0; i < n; i++) { const c = L[i]; if (c && target[c] >= 0) cls[i] = target[c]; }
  }
  const areas = new Uint32Array(K); for (let i = 0; i < n; i++) if (cls[i] !== 255) areas[cls[i]]++;
  return { cls, K, palette, areas, bgIndex };
}

/* ---------- layer order ---------- */
function looseScore(combined, w, h) {
  const { sizes, count } = labelComponents(combined, w, h); if (count <= 1) return 0;
  let big = 0; for (let c = 1; c <= count; c++) if (sizes[c] > big) big = sizes[c];
  let sc = 0, seen = false; for (let c = 1; c <= count; c++) { if (sizes[c] === big && !seen) { seen = true; continue; } sc += 1 + sizes[c] * 0.002; }
  return sc;
}
function orderLayers(C, G, p) {
  const act = []; for (let k = 0; k < C.K; k++) if (C.areas[k] > 0) act.push(k);
  const lum = C.palette.map((c) => labOf(c)[0]);
  const m = p.order;
  if (m === 'manual' && Array.isArray(p.manual)) { const o = p.manual.filter((k) => act.includes(k)); for (const k of act) if (!o.includes(k)) o.push(k); return o; }
  if (m === 'dark') return act.sort((a, b) => lum[a] - lum[b]);
  if (m === 'light') return act.sort((a, b) => lum[b] - lum[a]);
  if (m === 'large') return act.sort((a, b) => C.areas[b] - C.areas[a]);
  if (m === 'loose') {
    const f = Math.max(1, Math.ceil(Math.max(G.nx, G.ny) / 360)), w = Math.floor(G.nx / f), h = Math.floor(G.ny / f);
    const sc = new Uint8Array(w * h), base = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * f * G.nx + x * f; sc[y * w + x] = C.cls[i]; base[y * w + x] = G.region[i] === 1 ? 1 : 0; }
    // loose pieces summed over every layer of a full front-to-back order
    const total = (o) => { const cur = base.slice(); let sum = 0; for (let k = 0; k < o.length - 1; k++) { const c = o[k]; for (let i = 0; i < cur.length; i++) if (sc[i] === c) cur[i] = 1; sum += looseScore(cur, w, h); } return sum; };
    // 1. greedy: at each step put in front the colour that leaves the fewest islands
    const rem = act.slice().sort((a, b) => C.areas[a] - C.areas[b]), greedy = [], cur = base.slice();
    while (rem.length > 1) {
      let bi = 0, bs = 1e18;
      for (let r = 0; r < rem.length; r++) { const t = cur.slice(); for (let i = 0; i < t.length; i++) if (sc[i] === rem[r]) t[i] = 1; const v = looseScore(t, w, h); if (v < bs - 1e-9) { bs = v; bi = r; } }
      const k = rem.splice(bi, 1)[0]; greedy.push(k); for (let i = 0; i < cur.length; i++) if (sc[i] === k) cur[i] = 1;
    }
    greedy.push(rem[0]);
    // 2. also try the simple orders (light or dark in front, small or large in front) and keep the best
    const cands = [greedy, act.slice().sort((a, b) => lum[b] - lum[a]), act.slice().sort((a, b) => lum[a] - lum[b]), act.slice().sort((a, b) => C.areas[a] - C.areas[b]), act.slice().sort((a, b) => C.areas[b] - C.areas[a])];
    let best = greedy, bestS = Infinity;
    for (const o of cands) { const v = total(o); if (v < bestS - 1e-9) { bestS = v; best = o; } }
    // 3. polish: swap neighbours while it helps
    for (let pass = 0; pass < 3; pass++) {
      let better = false;
      for (let i = 0; i < best.length - 1; i++) { const o = best.slice(); [o[i], o[i + 1]] = [o[i + 1], o[i]]; const v = total(o); if (v < bestS - 1e-9) { bestS = v; best = o; better = true; } }
      if (!better) break;
    }
    return best;
  }
  return act.sort((a, b) => C.areas[a] - C.areas[b]); // 'small'
}

/* ---------- cumulative masks + loose pieces ---------- */
function buildMasks(C, G, order, p) {
  const { nx, ny, region, s } = G, n = nx * ny, L = order.length;
  const rank = new Int16Array(256).fill(-1); order.forEach((k, r) => { rank[k] = r; });
  const masks = [], info = [];
  const lim = p.loose === 'all' ? Infinity : p.loose === 'small' ? (p.looseArea || 0) / (s * s) : 0;
  const keepMax = p.loose === 'limit' ? Math.max(0, Math.round(p.looseMax ?? 2)) : Infinity;   // 'limit': keep only the biggest few islands
  for (let k = 0; k < L; k++) {
    const m = new Uint8Array(n), comb = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const c = C.cls[i]; if (c !== 255 && rank[c] >= 0 && rank[c] <= k) { m[i] = 1; comb[i] = 1; } else if (region[i] === 1) comb[i] = 1; }
    const { lab, sizes, count } = labelComponents(comb, nx, ny);
    let main = 0; for (let c = 1; c <= count; c++) if (sizes[c] > (sizes[main] || 0)) main = c;
    let loose = 0, looseArea = 0, removed = 0; const kill = new Uint8Array(count + 1);
    const isl = []; for (let c = 1; c <= count; c++) if (c !== main) isl.push(c);
    if (keepMax !== Infinity) isl.sort((a, b) => sizes[b] - sizes[a]);
    isl.forEach((c, j) => { if (sizes[c] < lim || j >= keepMax) { kill[c] = 1; removed++; } else { loose++; looseArea += sizes[c]; } });
    let area = 0;
    for (let i = 0; i < n; i++) { if (kill[lab[i]]) m[i] = 0; if (m[i] || region[i] === 1) area++; }
    masks.push(m); info.push({ loose, looseArea: looseArea * s * s, removed, areaPx: area });
  }
  return { masks, info };
}

/* ---------- flat composite ---------- */
function composite(M, G, colors, frameColor, o) {
  // colors[k] rgb per content layer (front->back); o: {frameLayer, shade, from}
  const { nx, ny, region } = G, n = nx * ny, L = M.masks.length;
  const depth = new Int16Array(n).fill(32767);
  const from = o.from == null ? -1 : o.from, front = o.frameLayer && G.hasFrame ? -1 : 0;
  for (let i = 0; i < n; i++) {
    if (!region[i]) continue;
    let d = 32767;
    if (region[i] === 1) d = front; else for (let k = 0; k < L; k++) if (M.masks[k][i]) { d = k; break; }
    if (d !== 32767 && d < from) d = from;
    depth[i] = d;
  }
  const out = new Uint8ClampedArray(n * 4), sh = o.shade ? Math.max(1, Math.round(nx / 260)) : 0;
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x, d = depth[i]; if (d === 32767) continue;
    const c = d < 0 ? frameColor : colors[d]; let f = 1;
    if (sh) {
      for (let t = 1; t <= 2; t++) { const xx = x - sh * t, yy = y - sh * t; if (xx < 0 || yy < 0) break; const q = depth[yy * nx + xx]; if (q < d) { f -= (t === 1 ? 0.2 : 0.1) * Math.min(1, (d - q) / 2 + 0.5); } }
    }
    out[i * 4] = c[0] * f; out[i * 4 + 1] = c[1] * f; out[i * 4 + 2] = c[2] * f; out[i * 4 + 3] = 255;
  }
  return { depth, rgba: out };
}

/* ---------- contours ---------- */
function Pt(x, y) { this.x = x; this.y = y; }
Pt.prototype.equals = function (o) { return o.x === this.x && o.y === this.y; };

function simplifyRing(xs, ys, tol) {
  const n = xs.length; if (n < 6 || tol <= 0) return [xs, ys];
  let b = 0, bd = -1; for (let i = 1; i < n; i++) { const d = (xs[i] - xs[0]) ** 2 + (ys[i] - ys[0]) ** 2; if (d > bd) { bd = d; b = i; } }
  const keep = new Uint8Array(n); keep[0] = 1; keep[b] = 1; const t2 = tol * tol, st = [0, b, b, n];
  while (st.length) {
    const j = st.pop(), i = st.pop(); if (j - i < 2) continue;
    const ax = xs[i], ay = ys[i], bx = xs[j % n], by = ys[j % n], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    let md = -1, mi = -1;
    for (let k = i + 1; k < j; k++) {
      let d; if (len < 1e-18) d = (xs[k] - ax) ** 2 + (ys[k] - ay) ** 2; else { const t = clamp(((xs[k] - ax) * dx + (ys[k] - ay) * dy) / len, 0, 1); d = (xs[k] - ax - t * dx) ** 2 + (ys[k] - ay - t * dy) ** 2; }
      if (d > md) { md = d; mi = k; }
    }
    if (md > t2) { keep[mi] = 1; st.push(i, mi, mi, j); }
  }
  const ox = [], oy = []; for (let i = 0; i < n; i++) if (keep[i]) { ox.push(xs[i]); oy.push(ys[i]); }
  return [ox, oy];
}
function ringArea(xs, ys) { let a = 0; for (let i = 0, n = xs.length, j = n - 1; i < n; j = i++) a += xs[j] * ys[i] - xs[i] * ys[j]; return a / 2; }
function pointIn(px, py, xs, ys) { let inside = false; for (let i = 0, n = xs.length, j = n - 1; i < n; j = i++) { if (ys[i] > py !== ys[j] > py && px < ((xs[j] - xs[i]) * (py - ys[i])) / (ys[j] - ys[i]) + xs[i]) inside = !inside; } return inside; }

function contours(f, PW, PH, G, tol, minArea) {
  const next = new Int32Array(2 * PW * PH).fill(-1);
  const T = (x, y) => 2 * (y * PW + x), Lf = (x, y) => 2 * (y * PW + x) + 1;
  for (let y = 0; y < PH - 1; y++) for (let x = 0; x < PW - 1; x++) {
    const i = y * PW + x, a = f[i] > 0, b = f[i + 1] > 0, c = f[i + PW + 1] > 0, d = f[i + PW] > 0;
    const idx = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0); if (idx === 0 || idx === 15) continue;
    const t = T(x, y), bt = T(x, y + 1), l = Lf(x, y), r = Lf(x + 1, y);
    switch (idx) {
      case 1: next[l] = bt; break; case 2: next[bt] = r; break; case 4: next[r] = t; break; case 8: next[t] = l; break;
      case 3: next[l] = r; break; case 6: next[bt] = t; break; case 12: next[r] = l; break; case 9: next[t] = bt; break;
      case 14: next[bt] = l; break; case 13: next[r] = bt; break; case 11: next[t] = r; break; case 7: next[l] = t; break;
      case 5: if (f[i] + f[i + 1] + f[i + PW] + f[i + PW + 1] > 0) { next[l] = t; next[r] = bt; } else { next[r] = t; next[l] = bt; } break;
      case 10: if (f[i] + f[i + 1] + f[i + PW] + f[i + PW + 1] > 0) { next[t] = r; next[bt] = l; } else { next[t] = l; next[bt] = r; } break;
    }
  }
  const { s, hw, hh } = G, rings = [];
  for (let e0 = 0; e0 < next.length; e0++) {
    if (next[e0] < 0) continue;
    let xs = [], ys = [], cur = e0;
    while (next[cur] >= 0) {
      const cell = cur >> 1, x = cell % PW, y = (cell / PW) | 0; let gx, gy;
      if (cur & 1) { const f0 = f[cell], f1 = f[cell + PW]; gx = x; gy = y + f0 / (f0 - f1); } else { const f0 = f[cell], f1 = f[cell + 1]; gx = x + f0 / (f0 - f1); gy = y; }
      // tiny deterministic jitter keeps far-apart vertices from being exactly collinear (clean triangulation)
      const h1 = ((cur * 2654435761) >>> 0) / 4294967296 - 0.5, h2 = ((cur * 40503 + 977) * 2246822519 >>> 0) / 4294967296 - 0.5;
      const X = (gx - 1.5) * s - hw + h1 * 2e-4, Y = hh - (gy - 1.5) * s + h2 * 2e-4;
      const m = xs.length; if (!m || Math.abs(xs[m - 1] - X) > 1e-6 || Math.abs(ys[m - 1] - Y) > 1e-6) { xs.push(X); ys.push(Y); }
      const nx_ = next[cur]; next[cur] = -1; cur = nx_;
    }
    if (xs.length > 1 && Math.abs(xs[0] - xs[xs.length - 1]) < 1e-6 && Math.abs(ys[0] - ys[ys.length - 1]) < 1e-6) { xs.pop(); ys.pop(); }
    [xs, ys] = simplifyRing(xs, ys, tol);
    // drop exactly collinear / duplicate points so caps and walls share every vertex
    let changed = true;
    while (changed && xs.length >= 3) { changed = false; for (let i = 0; i < xs.length && xs.length >= 3; i++) { const n = xs.length, pi = (i + n - 1) % n, ni = (i + 1) % n; const cr = (xs[i] - xs[pi]) * (ys[ni] - ys[pi]) - (ys[i] - ys[pi]) * (xs[ni] - xs[pi]); if (Math.abs(cr) < 1e-10) { xs.splice(i, 1); ys.splice(i, 1); i--; changed = true; } } }
    if (xs.length < 3) continue;
    xs.reverse(); ys.reverse(); // solid on the left: outers CCW, holes CW
    const A = ringArea(xs, ys); if (Math.abs(A) < minArea) continue;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < xs.length; i++) { if (xs[i] < x0) x0 = xs[i]; if (xs[i] > x1) x1 = xs[i]; if (ys[i] < y0) y0 = ys[i]; if (ys[i] > y1) y1 = ys[i]; }
    rings.push({ xs, ys, A, x0, x1, y0, y1, holes: [] });
  }
  const outers = rings.filter((r) => r.A > 0).sort((a, b) => a.A - b.A);
  for (const h of rings) {
    if (h.A > 0) continue; const px = h.xs[0], py = h.ys[0];
    for (const o of outers) { if (o.A <= -h.A || px < o.x0 || px > o.x1 || py < o.y0 || py > o.y1) continue; if (pointIn(px, py, o.xs, o.ys)) { o.holes.push(h); break; } }
  }
  return outers;
}

/* ---------- one layer -> triangles ---------- */
function layerMesh(G, mask, o) {
  // mask: Uint8Array(nx*ny) content solid, or null for the frame-only layer; o: {t, tol, pins:[{x,y}], pinR}
  const { nx, ny, PW, PH, sdfO, sdfW, region, s, hw, hh } = G, N = PW * PH;
  const f = new Float32Array(N);
  if (!mask) { for (let i = 0; i < N; i++) f[i] = Math.min(sdfO[i], -sdfW[i]); } else {
    const e = new Float32Array(N).fill(1), b = new Float32Array(N);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const i = y * nx + x; if (region[i] === 2 && !mask[i]) e[(y + 2) * PW + x + 2] = 0; }
    for (let a = 0; a < G.extDst.length; a++) if (!mask[G.extSrc[a]]) { const d = G.extDst[a]; e[(((d / nx) | 0) + 2) * PW + (d % nx) + 2] = 0; }
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = y * PW + x; b[i] = (e[y * PW + Math.max(0, x - 1)] + 2 * e[i] + e[y * PW + Math.min(PW - 1, x + 1)]) / 4; }
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = y * PW + x; const v = (b[Math.max(0, y - 1) * PW + x] + 2 * b[i] + b[Math.min(PH - 1, y + 1) * PW + x]) / 4; f[i] = Math.min(sdfO[i], Math.max(-sdfW[i], v - 0.5)); }
  }
  if (o.pins && o.pins.length) {
    const rp = o.pinR / s;
    for (const pin of o.pins) {
      const cx = (pin.x + hw) / s + 1.5, cy = (hh - pin.y) / s + 1.5, R = Math.ceil(rp) + 3;
      for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(PH - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(PW - 1, Math.ceil(cx + R)); x++) { const d = Math.hypot(x - cx, y - cy) - rp, i = y * PW + x; if (d < f[i]) f[i] = d; }
    }
  }
  for (let i = 0; i < N; i++) if (f[i] === 0) f[i] = -1e-6;
  const polys = contours(f, PW, PH, G, o.tol, 0.04);
  let cap = 1024, buf = new Float32Array(cap), len = 0;
  const tri = (ax, ay, az, bx, by, bz, cx, cy, cz) => { if (len + 9 > cap) { cap *= 2; const nb = new Float32Array(cap); nb.set(buf); buf = nb; } buf[len++] = ax; buf[len++] = ay; buf[len++] = az; buf[len++] = bx; buf[len++] = by; buf[len++] = bz; buf[len++] = cx; buf[len++] = cy; buf[len++] = cz; };
  const t = o.t; let area = 0, verts = 0;
  for (const P of polys) {
    const all = [P, ...P.holes], X = [], Y = []; area += P.A; for (const h of P.holes) area += h.A;
    const cont = [], holes = [];
    for (let r = 0; r < all.length; r++) { const pts = []; for (let i = 0; i < all[r].xs.length; i++) { pts.push(new Pt(all[r].xs[i], all[r].ys[i])); X.push(all[r].xs[i]); Y.push(all[r].ys[i]); } if (r === 0) cont.push(...pts); else holes.push(pts); }
    verts += X.length;
    const faces = triangulate(cont, holes);
    for (const fc of faces) {
      let a = fc[0], b = fc[1], c = fc[2];
      if ((X[b] - X[a]) * (Y[c] - Y[a]) - (Y[b] - Y[a]) * (X[c] - X[a]) < 0) { const q = b; b = c; c = q; }
      tri(X[a], Y[a], t, X[b], Y[b], t, X[c], Y[c], t); tri(X[a], Y[a], 0, X[c], Y[c], 0, X[b], Y[b], 0);
    }
    for (const r of all) for (let i = 0, n = r.xs.length; i < n; i++) { const j = (i + 1) % n, ax = r.xs[i], ay = r.ys[i], bx = r.xs[j], by = r.ys[j]; tri(ax, ay, 0, bx, by, 0, bx, by, t); tri(ax, ay, 0, bx, by, t, ax, ay, t); }
  }
  return { tris: buf.slice(0, len), area, pieces: polys.length, verts, polys };
}

/* ---------- STL ---------- */
function stlSize(n) { return 84 + n * 50; }
function writeSTL(dv, off, tris, o) {
  // writes triangles at byte offset; o: {mirror, dz}; returns new offset
  const mir = o && o.mirror, dz = (o && o.dz) || 0;
  for (let i = 0; i < tris.length; i += 9) {
    let ax = tris[i], ay = tris[i + 1], az = tris[i + 2] + dz, bx = tris[i + 3], by = tris[i + 4], bz = tris[i + 5] + dz, cx = tris[i + 6], cy = tris[i + 7], cz = tris[i + 8] + dz;
    if (mir) { ax = -ax; const tx = -cx, ty = cy, tz = cz; cx = -bx; cy = by; cz = bz; bx = tx; by = ty; bz = tz; }
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true);
    dv.setFloat32(off + 12, ax, true); dv.setFloat32(off + 16, ay, true); dv.setFloat32(off + 20, az, true);
    dv.setFloat32(off + 24, bx, true); dv.setFloat32(off + 28, by, true); dv.setFloat32(off + 32, bz, true);
    dv.setFloat32(off + 36, cx, true); dv.setFloat32(off + 40, cy, true); dv.setFloat32(off + 44, cz, true);
    dv.setUint16(off + 48, 0, true); off += 50;
  }
  return off;
}
function toSTL(parts, title) {
  // parts: [{tris, mirror, dz}] -> ArrayBuffer (binary STL)
  let n = 0; for (const p of parts) n += p.tris.length / 9;
  const buf = new ArrayBuffer(stlSize(n)), dv = new DataView(buf), hd = String(title || 'Layered Sculpture Studio').slice(0, 79);
  for (let i = 0; i < hd.length; i++) dv.setUint8(i, hd.charCodeAt(i) & 127);
  dv.setUint32(80, n, true); let off = 84; for (const p of parts) off = writeSTL(dv, off, p.tris, p);
  return buf;
}
function checkManifold(tris) {
  // every directed edge must be matched by exactly one opposite edge
  const m = new Map(), f32 = new Float32Array(3), key = (i) => { f32[0] = tris[i]; f32[1] = tris[i + 1]; f32[2] = tris[i + 2]; return f32[0] + ',' + f32[1] + ',' + f32[2]; };
  let degenerate = 0;
  for (let i = 0; i < tris.length; i += 9) {
    const k = [key(i), key(i + 3), key(i + 6)]; if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) degenerate++;
    for (let e = 0; e < 3; e++) { const a = k[e], b = k[(e + 1) % 3], fw = a + '|' + b, bk = b + '|' + a; if (m.get(bk) > 0) m.set(bk, m.get(bk) - 1); else m.set(fw, (m.get(fw) || 0) + 1); }
  }
  let open = 0; for (const v of m.values()) open += v;
  return { open, degenerate, tris: tris.length / 9 };
}


export { contours, Pt, setTriangulator, buildGrid, findPins, adjust, classify, orderLayers, buildMasks, composite, layerMesh, toSTL, checkManifold, nearestFilament, hexToRgb, rgbToHex, labOf, shapeSd, labelComponents, SHAPES, RATIOS, FILAMENTS, clamp };
