/* Shadow-lamp engine, part 1: the raster side.
 * Safe to ship to the browser: it reads a picture, decides what each wall keeps and predicts the shadow,
 * but it never builds a printable mesh. The meshing lives in mesh.server.js and only runs after payment.
 *
 * Geometry convention (mm): wall plane z = 0, LED axis through the origin, X right, Y up (seen from the room).
 * The base is 2*baseX by 2*baseY; panels stand on a ledge `ledge` above the wall and the light source is
 * `apex` above the ledge. Panel coordinates: s along the panel, v up from the ledge, t depth (0 = outer face).
 */

const DEFAULTS = {
  baseX: 60, baseY: 75,      // half footprint of the base
  T: 3,                      // panel thickness
  ledge: 10,                 // height of the ledge the panels stand on
  apex: 75,                  // light source height above the ledge
  V0: 12.5,                  // below this the panel is a plain straight slab (screw holes live here)
  V1: 15,                    // band is solid up to here; the picture starts above
  Vmax: 67.5,                  // tallest the panels may get
  res: 0.1,                  // raster step on the panel
  minSolid: 0.35,             // thinnest wall kept
  minGap: 0.35,              // thinnest slit kept
  struts: true, strutW: 1.0, minIsland: 2.0,
  backing: false, backingT: 0.6, minDot: 0.3,   // clear backing layer: keeps loose pieces (dots) without support bars
  cornerWrap: true, maxWrap: 28,
  simplify: 0.02,
  holeD: 2.9, holeV: 9.25,
  ribs: true, ribW: 1.8, ribH: 1.2, ribLen: 13,
  switchNotch: [17.86, 32.06, 12.1],   // left panel: s0, s1, height
  portHole: [59.96, 6.78, 10.5],       // left panel: s, v, diameter
  leftCutouts: true
};

function panelDefs(p) {
  const lam = (u) => (p.apex + p.ledge) / u;
  return [
    { id: 'top', n: 1, d: p.baseY, Lo: 2 * p.baseX, Lb: 2 * p.baseX - 2 * p.T, holeS: 30, ribS: 40,
      wall: (s, u) => { const l = lam(u); return [l * s, l * p.baseY]; } },
    { id: 'right', n: 2, d: p.baseX, Lo: 2 * p.baseY, Lb: 2 * p.baseY, holeS: 40, ribS: 50,
      wall: (s, u) => { const l = lam(u); return [l * p.baseX, -l * s]; } },
    { id: 'left', n: 3, d: p.baseX, Lo: 2 * p.baseY, Lb: 2 * p.baseY, holeS: 40, ribS: 50, cutouts: true,
      wall: (s, u) => { const l = lam(u); return [-l * p.baseX, l * s]; } },
    { id: 'bottom', n: 4, d: p.baseY, Lo: 2 * p.baseX, Lb: 2 * p.baseX - 2 * p.T, holeS: 30, ribS: 40,
      wall: (s, u) => { const l = lam(u); return [-l * s, -l * p.baseY]; } }
  ];
}

/* ---------- small raster toolbox ---------- */
// exact squared Euclidean distance to the nearest zero pixel (Felzenszwalb)
function edt(mask, w, h) {
  const INF = 1e12, n = Math.max(w, h);
  const f = new Float64Array(n), dd = new Float64Array(n), vv = new Int32Array(n), zz = new Float64Array(n + 1);
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = mask[i] ? INF : 0;
  const pass = (len, get, set) => {
    for (let i = 0; i < len; i++) f[i] = get(i);
    let k = 0; vv[0] = 0; zz[0] = -INF; zz[1] = INF;
    for (let q = 1; q < len; q++) {
      let s;
      do { const r = vv[k]; s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r); } while (s <= zz[k] && --k >= 0);
      k++; vv[k] = q; zz[k] = s; zz[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (zz[k + 1] < q) k++; const r = vv[k]; dd[q] = (q - r) * (q - r) + f[r]; }
    for (let i = 0; i < len; i++) set(i, dd[i]);
  };
  for (let x = 0; x < w; x++) pass(h, (i) => out[i * w + x], (i, val) => { out[i * w + x] = val; });
  for (let y = 0; y < h; y++) pass(w, (i) => out[y * w + i], (i, val) => { out[y * w + i] = val; });
  return out;
}
function erode(mask, w, h, r) {
  if (r <= 0) return mask.slice();
  const d = edt(mask, w, h), r2 = r * r, o = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) o[i] = d[i] > r2 ? 1 : 0;
  return o;
}
function dilate(mask, w, h, r) {
  if (r <= 0) return mask.slice();
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inv[i] = mask[i] ? 0 : 1;
  const d = edt(inv, w, h), r2 = r * r, o = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) o[i] = d[i] <= r2 ? 1 : 0;
  return o;
}
function label(mask, w, h) {
  const lab = new Int32Array(w * h), stack = new Int32Array(w * h);
  let n = 0;
  for (let i0 = 0; i0 < w * h; i0++) {
    if (!mask[i0] || lab[i0]) continue;
    n++; let sp = 0; stack[sp++] = i0; lab[i0] = n;
    while (sp) {
      const i = stack[--sp], x = i % w;
      if (x > 0 && mask[i - 1] && !lab[i - 1]) { lab[i - 1] = n; stack[sp++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && !lab[i + 1]) { lab[i + 1] = n; stack[sp++] = i + 1; }
      if (i >= w && mask[i - w] && !lab[i - w]) { lab[i - w] = n; stack[sp++] = i - w; }
      if (i < w * (h - 1) && mask[i + w] && !lab[i + w]) { lab[i + w] = n; stack[sp++] = i + w; }
    }
  }
  return { lab, n };
}
function gaussBlur(src, w, h, sigma) {
  const rad = Math.max(1, Math.ceil(sigma * 3)), k = new Float32Array(2 * rad + 1);
  let sum = 0;
  for (let i = -rad; i <= rad; i++) { k[i + rad] = Math.exp(-i * i / (2 * sigma * sigma)); sum += k[i + rad]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -rad; i <= rad; i++) { const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i; a += src[y * w + xx] * k[i + rad]; }
    tmp[y * w + x] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -rad; i <= rad; i++) { const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i; a += tmp[yy * w + x] * k[i + rad]; }
    out[y * w + x] = a;
  }
  return out;
}

/* ---------- silhouette sampler ----------
 * field: Float32Array (w*h) in [0,1], 1 = shadow. view: {cx, cy, mmPerPx, mirror}: the image pixel (cx, cy)
 * sits on the lamp axis and one pixel covers mmPerPx on the wall. */
function makeSampler(field, w, h, view) {
  const inv = 1 / view.mmPerPx, sx = view.mirror ? -inv : inv;
  return function (X, Y) {
    const fx = view.cx + X * sx - 0.5, fy = view.cy - Y * inv - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    if (x0 < -1 || y0 < -1 || x0 >= w || y0 >= h) return 0;
    const ax = fx - x0, ay = fy - y0;
    const g = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : field[y * w + x];
    return (g(x0, y0) * (1 - ax) + g(x0 + 1, y0) * ax) * (1 - ay) + (g(x0, y0 + 1) * (1 - ax) + g(x0 + 1, y0 + 1) * ax) * ay;
  };
}

/* ---------- panel raster ---------- */
// Grid nodes: s = sMin + (i + 0.5) * res, v = V0 + (j + 0.5) * res, padded by PAD nodes on every side.
const PAD = 8;
function rasterPanel(def, sampler, p) {
  const res = p.res, ns = Math.round(def.Lo / res), nv = Math.round((p.Vmax - p.V0) / res);
  const w = ns + 2 * PAD, h = nv + 2 * PAD, mask = new Uint8Array(w * h);
  const jBand = Math.ceil((p.V1 - p.V0) / res);
  for (let j = 0; j < nv; j++) {
    const v = p.V0 + (j + 0.5) * res, u = p.apex - v;
    for (let i = 0; i < ns; i++) {
      let on;
      if (j < jBand) on = 1;
      else { const s = -def.Lo / 2 + (i + 0.5) * res, xy = def.wall(s, u); on = sampler(xy[0], xy[1]) > 0.5 ? 1 : 0; }
      mask[(j + PAD) * w + i + PAD] = on;
    }
  }
  return { mask, w, h, ns, nv, jBand, res };
}

function inDomainFn(R) { return (i, j) => i >= PAD && i < PAD + R.ns && j >= PAD && j < PAD + R.nv; }
function forceBand(R, mm) {
  const { w, h, ns, nv, jBand } = R;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i;
    if (!(i >= PAD && i < PAD + ns && j >= PAD && j < PAD + nv)) mm[k] = 0; else if (j < PAD + jBand) mm[k] = 1;
  }
}

// Close slits and drop walls that are too thin to print.
function morphPanel(R, p) {
  const { w, h, ns, nv, res } = R, m = R.mask;
  // work on a copy whose padding continues the panel, so nothing is nibbled at the panel ends
  const padded = (mm) => {
    const t = mm.slice();
    for (let j = PAD; j < PAD + nv; j++) {
      const a = t[j * w + PAD], b = t[j * w + PAD + ns - 1];
      for (let i = 0; i < PAD; i++) { t[j * w + i] = a; t[j * w + PAD + ns + i] = b; }
    }
    for (let j = 0; j < PAD; j++) for (let i = 0; i < w; i++) { t[j * w + i] = 1; t[(PAD + nv + j) * w + i] = t[(PAD + nv - 1) * w + i]; }
    return t;
  };
  const rc = Math.min(PAD - 1, p.minGap / 2 / res), ro = Math.min(PAD - 1, p.minSolid / 2 / res);
  if (rc > 0.5) { const c = erode(dilate(padded(m), w, h, rc), w, h, rc); for (let k = 0; k < w * h; k++) if (c[k]) m[k] = 1; forceBand(R, m); }
  if (ro > 0.5) { const o = dilate(erode(padded(m), w, h, ro), w, h, ro); for (let k = 0; k < w * h; k++) if (!o[k]) m[k] = 0; forceBand(R, m); }
  forceBand(R, m);
}

// Split the solid into the piece that hangs on the band and the loose pieces ("islands").
function findIslands(R, p) {
  const { w, h, ns, res } = R, m = R.mask;
  const { lab, n } = label(m, w, h), main = lab[PAD * w + PAD];
  const isl = [];
  const info = new Array(n + 1);
  for (let l = 1; l <= n; l++) info[l] = { l, area: 0, i0: w, i1: -1, j0: h, j1: -1 };
  for (let k = 0; k < w * h; k++) { const l = lab[k]; if (!l) continue; const q = info[l], i = k % w, j = (k / w) | 0; q.area++; if (i < q.i0) q.i0 = i; if (i > q.i1) q.i1 = i; if (j < q.j0) q.j0 = j; if (j > q.j1) q.j1 = j; }
  let removed = 0;
  for (let l = 1; l <= n; l++) {
    if (l === main) continue;
    if (info[l].area * res * res < (p.backing ? p.minDot : p.minIsland)) { for (let k = 0; k < w * h; k++) if (lab[k] === l) { m[k] = 0; lab[k] = 0; } removed++; }
    else isl.push(info[l]);
  }
  R.lab = lab; R.main = main; R.islands = isl; R.stats = { removedIslands: removed, struts: 0, wrapped: 0, floating: 0 };
}

// Tie a loose piece to the body below it with a thin vertical bar (a thin radial line in the shadow).
function strutIsland(R, own, connected, isl, p) {
  const { w, h, lab, res } = R, hw = Math.max(1, Math.round(p.strutW / res / 2)), inD = inDomainFn(R);
  let best = null;
  for (let i = isl.i0; i <= isl.i1; i++) {
    let j = isl.j0; while (j <= isl.j1 && lab[j * w + i] !== isl.l) j++;
    if (j > isl.j1) continue;
    let jj = j - 1; while (jj >= 0 && !connected[jj * w + i]) jj--;
    if (jj < 0) continue;
    const edge = Math.min(i - isl.i0, isl.i1 - i), score = (j - jj) - Math.min(edge, hw * 2) * 0.5;
    if (!best || score < best.score) best = { score, i, j, jj };
  }
  if (!best) return pathStrut(R, own, connected, isl, hw, inD);
  for (let j = best.jj - hw; j <= best.j + hw; j++) for (let i = best.i - hw; i <= best.i + hw; i++) {
    if (!inD(i, j)) continue; const k = j * w + i;
    if (!R.mask[k]) R.strutMask[k] = 1;
    R.mask[k] = 1; own[k] = 1;
  }
  return true;
}

// No solid wall straight below the piece (it hangs over a gap or sits in a pocket): tie it on by the shortest way
// to the part that is already held, in any direction, so no wall ever has a loose piece.
function pathStrut(R, own, connected, isl, hw, inD) {
  const { w, h, lab } = R, n = w * h, prev = new Int32Array(n).fill(-2), q = new Int32Array(n);
  let qh = 0, qt = 0;
  for (let k = 0; k < n; k++) if (connected[k]) { prev[k] = -1; q[qt++] = k; }
  if (!qt) return false;
  let hit = -1;
  while (qh < qt && hit < 0) {
    const k = q[qh++], i = k % w, j = (k / w) | 0;
    for (let d = 0; d < 8; d++) {
      const ii = i + (d === 0 ? 1 : d === 1 ? -1 : d === 4 || d === 6 ? 1 : d === 5 || d === 7 ? -1 : 0), jj = j + (d === 2 ? 1 : d === 3 ? -1 : d === 4 || d === 5 ? 1 : d === 6 || d === 7 ? -1 : 0);
      if (!inD(ii, jj)) continue;
      const kk = jj * w + ii; if (prev[kk] !== -2) continue;
      prev[kk] = k;
      if (lab[kk] === isl.l) { hit = kk; break; }
      q[qt++] = kk;
    }
  }
  if (hit < 0) return false;
  for (let k = prev[hit]; k >= 0 && !connected[k]; k = prev[k]) {
    const i = k % w, j = (k / w) | 0;
    for (let y = j - hw; y <= j + hw; y++) for (let x = i - hw; x <= i + hw; x++) {
      if (!inD(x, y)) continue; const kk = y * w + x;
      if (!R.mask[kk]) R.strutMask[kk] = 1;
      R.mask[kk] = 1; own[kk] = 1;
    }
  }
  return true;
}

// which panel end meets which: [panel, end] -> [neighbour, neighbour end]; end 0 = low s, 1 = high s
const CORNERS = { 'top1': ['right', 0], 'top0': ['left', 1], 'bottom1': ['left', 0], 'bottom0': ['right', 1],
                  'right0': ['top', 1], 'left1': ['top', 0], 'left0': ['bottom', 1], 'right1': ['bottom', 0] };


/* ---------- decisions: what every wall keeps ---------- */
export function analyse(sampler, opts, onProgress) {
  const p = Object.assign({}, DEFAULTS, opts || {});
  const defs = panelDefs(p), P = {};
  for (const def of defs) {
    const R = rasterPanel(def, sampler, p);
    morphPanel(R, p); findIslands(R, p);
    R.strutMask = new Uint8Array(R.w * R.h);
    P[def.id] = { def, raster: R, fins: [] };
  }
  if (onProgress) onProgress(0.5);
  // 1. a loose piece that touches a corner is carried by the neighbouring panel, if that one is solid there
  for (const def of defs) {
    const R = P[def.id].raster, { w, ns, res } = R;
    R.wrapped = [];
    for (const isl of R.islands) {
      const t0 = isl.i0 === PAD, t1 = isl.i1 === PAD + ns - 1;
      if (!p.cornerWrap || t0 === t1) continue;
      const end = t1 ? 1 : 0, nb = CORNERS[def.id + end], B = P[nb[0]].raster;
      if ((isl.i1 - isl.i0 + 1) * res > p.maxWrap) continue;
      const iA = end ? PAD + ns - 1 : PAD, iB = nb[1] ? PAD + B.ns - 1 : PAD;
      let overlap = 0;
      for (let j = isl.j0; j <= isl.j1; j++) if (R.lab[j * w + iA] === isl.l && B.lab[j * B.w + iB] === B.main) overlap++;
      if (overlap * res >= 1.5) { isl.wrapTo = nb[0]; R.wrapped.push(isl); R.stats.wrapped++; P[nb[0]].fins.push({ from: def.id, height: (isl.i1 - isl.i0 + 1) * res }); }
    }
  }
  // 2. everything else gets a strut (or is dropped)
  for (const def of defs) {
    const R = P[def.id].raster, { w, h, lab } = R;
    const own = new Uint8Array(w * h), connected = new Uint8Array(w * h);
    const wrappedIds = new Set(R.wrapped.map((q) => q.l));
    for (let k = 0; k < w * h; k++) { if (lab[k] && !wrappedIds.has(lab[k])) own[k] = 1; if (lab[k] === R.main) connected[k] = 1; }
    const rest = R.islands.filter((q) => !q.wrapTo).sort((a, b) => a.j0 - b.j0);
    for (const isl of rest) {
      if (p.backing) { R.stats.floating++; R.floating = (R.floating || []).concat([isl]); continue; }   // held by the clear layer
      let ok = false;
      if (p.struts) ok = strutIsland(R, own, connected, isl, p);
      if (ok) { R.stats.struts++; for (let k = 0; k < w * h; k++) if (lab[k] === isl.l || R.strutMask[k]) connected[k] = 1; }
      else { R.stats.removedIslands++; for (let k = 0; k < w * h; k++) if (lab[k] === isl.l) { own[k] = 0; R.mask[k] = 0; } }
    }
    R.own = own;
  }
  if (onProgress) onProgress(1);
  return { params: p, panels: defs.map((def) => P[def.id]) };
}

// What the finished panels will actually throw on the wall (1 = shadow, 2 = the lamp's own dark block, 3 = support bar).
export function predictShadow(result, W, Hh, mmPerPx) {
  const p = result.params, img = new Uint8Array(W * Hh), Hled = p.apex + p.ledge;
  const byId = {}; for (const q of result.panels) byId[q.def.id] = q;
  const fBase = Hled / p.apex;
  for (let y = 0; y < Hh; y++) {
    const Y = (Hh / 2 - y - 0.5) * mmPerPx;
    for (let x = 0; x < W; x++) {
      const X = (x + 0.5 - W / 2) * mmPerPx;
      let id, s, d;
      if (Math.abs(X) * p.baseY <= Math.abs(Y) * p.baseX) { d = p.baseY; id = Y > 0 ? 'top' : 'bottom'; s = X * d / Y; }
      else { d = p.baseX; id = X > 0 ? 'right' : 'left'; s = -Y * d / X; }
      const far = id === 'top' || id === 'bottom' ? Math.abs(Y) : Math.abs(X);
      if (far <= d * fBase) { img[y * W + x] = 2; continue; }
      const u = Hled * d / far, v = p.apex - u, q = byId[id], R = q.raster;
      const i = Math.floor((s + q.def.Lo / 2) / R.res), j = Math.floor((v - p.V0) / R.res);
      let on = 0;
      if (v < p.V0) on = 1;
      else if (i >= 0 && i < R.ns && j >= 0 && j < R.nv) { const k = (j + PAD) * R.w + i + PAD; on = R.strutMask[k] ? 3 : R.mask[k]; }
      img[y * W + x] = on;
    }
  }
  return img;
}

/* ---------- cover plate: which part of the picture is sunk into it ---------- */
export const PLATE = { W: 113.6, H: 143.4, hole: 10.8, ring: 1.2, floor: 1, depth: 1, inset: 1.5, gap: 0.15, minW: 0.8, minGap: 0.9, minPiece: 3,
                       style: 'solid', lineW: 1.6, res: 0.1, simplify: 0.02 };

export function plateArt(sampler, opts) {
  const q = Object.assign({}, PLATE, opts || {});
  const res = q.res, ns = Math.round(q.W / res), nv = Math.round(q.H / res), w = ns + 2 * PAD, h = nv + 2 * PAD;
  const R = { w, h, ns, nv, res }, def = { Lo: ns * res, d: 1e9 }, pp = { V0: -nv * res / 2 };
  const X = (i) => -def.Lo / 2 + (i - PAD + 0.5) * res, Y = (j) => pp.V0 + (j - PAD + 0.5) * res;
  const rk = q.hole / 2 + q.ring, n = w * h;
  const allowed = new Uint8Array(n), raw = new Uint8Array(n);
  for (let j = PAD; j < PAD + nv; j++) for (let i = PAD; i < PAD + ns; i++) {
    const x = X(i), y = Y(j), k = j * w + i;
    allowed[k] = x * x + y * y > rk * rk && Math.abs(x) <= q.W / 2 - q.inset && Math.abs(y) <= q.H / 2 - q.inset ? 1 : 0;
    raw[k] = sampler(x, y) > 0.5 ? 1 : 0;
  }
  let art = raw;
  if (q.style === 'outline') {
    const inv = new Uint8Array(n); for (let k = 0; k < n; k++) inv[k] = raw[k] ? 0 : 1;
    const dIn = edt(raw, w, h), dOut = edt(inv, w, h), hw = q.lineW / 2 / res, hw2 = hw * hw;
    art = new Uint8Array(n);
    for (let k = 0; k < n; k++) art[k] = (raw[k] ? dIn[k] : dOut[k]) <= hw2 ? 1 : 0;
  }
  const clip = (m) => { for (let k = 0; k < n; k++) if (!allowed[k]) m[k] = 0; };
  art = art.slice(); clip(art);
  const rc = q.minGap / 2 / res, ro = q.minW / 2 / res;
  art = erode(dilate(art, w, h, rc), w, h, rc); clip(art);
  art = dilate(erode(art, w, h, ro), w, h, ro); clip(art);
  let pieces = 0;
  { const L = label(art, w, h), cnt = new Int32Array(L.n + 1); for (let k = 0; k < n; k++) cnt[L.lab[k]]++;
    for (let k = 0; k < n; k++) if (L.lab[k] && cnt[L.lab[k]] * res * res < q.minPiece) art[k] = 0;
    for (let l = 1; l <= L.n; l++) if (cnt[l] * res * res >= q.minPiece) pieces++; }
  let artPx = 0; for (let k = 0; k < n; k++) artPx += art[k];
  return { q, R, def, pp, art, pieces, areaMm2: artPx * res * res };
}

/* ---------- the design as it travels to the server ---------- */
// A design is the black-and-white picture (before smoothing), the smoothing radius and the placement.
// The server rebuilds the exact same field from it, so the preview and the paid files always agree.
export function maskToBytes(mask) {
  const out = []; let cur = 0, run = 0;
  const put = (v) => { while (v >= 128) { out.push((v & 127) | 128); v >>>= 7; } out.push(v); };
  for (let i = 0; i < mask.length; i++) { const b = mask[i] ? 1 : 0; if (b === cur) run++; else { put(run); cur = b; run = 1; } }
  put(run);
  return Uint8Array.from(out);
}
export function bytesToMask(bytes, n) {
  const m = new Uint8Array(n); let i = 0, at = 0, cur = 0;
  while (i < bytes.length && at <= n) {
    let v = 0, sh = 0, b;
    do { b = bytes[i++]; v |= (b & 127) << sh; sh += 7; } while (b & 128 && i < bytes.length);
    if (cur) m.fill(1, at, Math.min(n, at + v));
    at += v; cur ^= 1;
  }
  if (at !== n) throw new Error('mask size mismatch');
  return m;
}
export function fieldFromMask(mask, w, h, sigma) { return gaussBlur(Float32Array.from(mask), w, h, sigma); }

export { DEFAULTS, PAD, panelDefs, edt, erode, dilate, label, gaussBlur, makeSampler };
