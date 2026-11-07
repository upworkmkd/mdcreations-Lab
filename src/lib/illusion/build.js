/* Two-Name Illusion: one sculpture that reads one name from the front and another from the side.
 *
 * Every pair of letters (letter i of name 1, letter i of name 2) becomes one block: name 1's letter pushed straight
 * back (along y) intersected with name 2's letter pushed sideways (along x). From the front (looking along +y) the
 * block shows letter A; from the right (looking along -x) it shows letter B. The blocks stand on a diagonal so that
 * neither view hides a letter behind another, on a base that holds them together.
 *
 * Letters arrive as pixel masks (drawn in the browser), the same height for every letter. The solid is the zero set
 * of max(distance to A, distance to B), meshed with surface nets. Shared by the preview and the server build.
 * Units: mm, z up. */
import { distanceOutside, extrude, Tris } from '@/lib/mesh/mesh.js';

/** Signed distance (mm) of a mask (row 0 = top), negative inside. */
function signedField(mask, w, h, pxmm) {
  const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = mask[i] ? 0 : 1;
  const dOut = distanceOutside(mask, w, h), dIn = distanceOutside(inv, w, h), f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = (mask[i] ? -(dIn[i] - 0.5) : dOut[i] - 0.5) / pxmm;
  return f;
}
/** Bilinear sample of a letter field at (u mm across, z mm up); outside the mask it keeps growing. */
function sampler(L, H) {
  const f = signedField(L.mask, L.w, L.h, L.pxmm), W = L.w / L.pxmm, sz = L.h / H;   // rows per mm (the letter fills H)
  return (u, z) => {
    const px = u * L.pxmm - 0.5, py = (H - z) * sz - 0.5;
    const cx = Math.max(0, Math.min(L.w - 1.001, px)), cy = Math.max(0, Math.min(L.h - 1.001, py));
    const i = Math.floor(cx), j = Math.floor(cy), a = cx - i, b = cy - j, k = j * L.w + i;
    const v = (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + L.w] * (1 - a) + f[k + L.w + 1] * a) * b;
    return v + Math.hypot(px - cx, py - cy) / L.pxmm + (u < 0 || u > W ? 0 : 0);
  };
}

/* ------------------------------------------------------------------ surface nets */
// cube corners and the 12 edges between them
const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

/**
 * Meshes the inside (f < 0) of a sampled field. f: nx × ny × nz samples (x fastest), spacing c, origin o.
 * The border samples must be outside, so the surface is closed.
 */
function surfaceNets(f, nx, ny, nz, c, o, t) {
  const idx = new Int32Array(nx * ny * nz).fill(-1), vx = [], at = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0; const v = new Array(8);
    for (let q = 0; q < 8; q++) { const C = CORNERS[q]; v[q] = f[at(i + C[0], j + C[1], k + C[2])]; if (v[q] < 0) m |= 1 << q; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const tt = v[a] / (v[a] - v[b]), A = CORNERS[a], B = CORNERS[b];
      sx += A[0] + (B[0] - A[0]) * tt; sy += A[1] + (B[1] - A[1]) * tt; sz += A[2] + (B[2] - A[2]) * tt; n++;
    }
    idx[at(i, j, k)] = vx.length / 3;
    vx.push(o[0] + (i + sx / n) * c, o[1] + (j + sy / n) * c, o[2] + (k + sz / n) * c);
  }
  const V = (q) => [vx[3 * q], vx[3 * q + 1], vx[3 * q + 2]];
  const quad = (a, b, cc, d, flip) => { if (a < 0 || b < 0 || cc < 0 || d < 0) return; if (flip) t.quad(V(a), V(d), V(cc), V(b)); else t.quad(V(a), V(b), V(cc), V(d)); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {   // edges along x
    const a = f[at(i, j, k)] < 0, b = f[at(i + 1, j, k)] < 0; if (a === b) continue;
    quad(idx[at(i, j - 1, k - 1)], idx[at(i, j, k - 1)], idx[at(i, j, k)], idx[at(i, j - 1, k)], !a);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {   // along y
    const a = f[at(i, j, k)] < 0, b = f[at(i, j + 1, k)] < 0; if (a === b) continue;
    quad(idx[at(i - 1, j, k - 1)], idx[at(i - 1, j, k)], idx[at(i, j, k)], idx[at(i, j, k - 1)], !a);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {   // along z
    const a = f[at(i, j, k)] < 0, b = f[at(i, j, k + 1)] < 0; if (a === b) continue;
    quad(idx[at(i - 1, j - 1, k)], idx[at(i, j - 1, k)], idx[at(i, j, k)], idx[at(i - 1, j, k)], !a);
  }
}

/** Keeps only the parts of a sampled solid that reach the bottom layers (floating bits would fall off the print). */
function dropFloating(f, nx, ny, nz, kmax) {
  const seen = new Uint8Array(nx * ny * nz), stack = [], at = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k <= kmax; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const q = at(i, j, k); if (f[q] < 0 && !seen[q]) { seen[q] = 1; stack.push(q); } }
  while (stack.length) {
    const q = stack.pop(), i = q % nx, j = Math.floor(q / nx) % ny, k = Math.floor(q / (nx * ny));
    for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const a = i + di, b = j + dj, cc = k + dk; if (a < 0 || b < 0 || cc < 0 || a >= nx || b >= ny || cc >= nz) continue;
      const r = at(a, b, cc); if (!seen[r] && f[r] < 0) { seen[r] = 1; stack.push(r); }
    }
  }
  let dropped = 0;
  for (let q = 0; q < f.length; q++) if (f[q] < 0 && !seen[q]) { f[q] = 0.01; dropped++; }
  return dropped;
}

/* ------------------------------------------------------------------ the sculpture */
/**
 * pairs: [{ a, b }] with a / b = { mask, w, h, pxmm } (row 0 = top), every letter drawn H mm tall.
 * o: { H, base, gap, margin, cell }. Returns the letters and the base as separate solids, the size,
 * how many floating bits were dropped, and both silhouettes (what each side shows).
 */
export function buildIllusion(pairs, o) {
  const H = o.H, c = o.cell ?? 0.4, gap = o.gap ?? H * 0.12, base = o.base ?? 3, margin = o.margin ?? 2.5, sink = 0.6;
  const letters = new Tris(65536), blocks = [];
  let X = 0, Y = 0, dropped = 0;
  for (const pr of pairs) {
    const wA = pr.a.w / pr.a.pxmm, wB = pr.b.w / pr.b.pxmm, sA = sampler(pr.a, H), sB = sampler(pr.b, H);
    const nx = Math.ceil(wA / c) + 3, ny = Math.ceil(wB / c) + 3, nz = Math.ceil((H + sink) / c) + 3, ox = -c, oy = -c, oz = -sink - c;
    // the letters reach a little into the base so the two print as one
    const fA = new Float32Array(nx * nz), fB = new Float32Array(ny * nz);
    for (let k = 0; k < nz; k++) { const z = Math.max(0.01, oz + k * c); for (let i = 0; i < nx; i++) fA[k * nx + i] = sA(ox + i * c, z); for (let j = 0; j < ny; j++) fB[k * ny + j] = sB(oy + j * c, z); }
    const f = new Float32Array(nx * ny * nz);
    for (let k = 0; k < nz; k++) {
      const z = oz + k * c, lim = Math.max(-sink - z, z - H);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        let v = Math.max(fA[k * nx + i], fB[k * ny + j], lim);
        if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) v = Math.max(v, 0.01);
        f[(k * ny + j) * nx + i] = v;
      }
    }
    dropped += dropFloating(f, nx, ny, nz, Math.ceil(sink / c) + 1);
    // the silhouettes, from the samples that are inside
    const front = new Uint8Array(nx * nz), side = new Uint8Array(ny * nz);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (f[(k * ny + j) * nx + i] < 0) { front[k * nx + i] = 1; side[k * ny + j] = 1; }
    surfaceNets(f, nx, ny, nz, c, [X + ox, Y + oy, base + oz], letters);
    blocks.push({ X, Y, wA, wB, nx, ny, nz, front, side });
    X += wA + gap; Y += wB + gap;
  }
  // the base: the outline round every block's footprint, rounded
  const pts = [];
  for (const b of blocks) for (const [x, y] of [[b.X, b.Y], [b.X + b.wA, b.Y], [b.X + b.wA, b.Y + b.wB], [b.X, b.Y + b.wB]])
    for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; pts.push([x + margin * Math.cos(t), y + margin * Math.sin(t)]); }
  const hull = convexHull(pts), bt = new Tris(1024);
  extrude(bt, [{ outer: hull, holes: [] }], 0, base + 0.01);
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const [x, y] of hull) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  // everything centred on the origin
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, centre = (tr) => { for (let i = 0; i < tr.length; i += 3) { tr[i] -= cx; tr[i + 1] -= cy; } return tr; };
  return {
    parts: [{ name: 'letters', tris: centre(letters.done()) }, { name: 'base', tris: centre(bt.done()) }],
    size: [maxx - minx, maxy - miny, base + H], dropped, cell: c,
    views: { front: strip(blocks, 'front', gap, c), side: strip(blocks, 'side', gap, c) },
  };
}

/** One silhouette: the blocks side by side as they are seen (front: name 1, side: name 2). */
function strip(blocks, which, gap, c) {
  const gp = Math.round(gap / c), nz = Math.max(...blocks.map((b) => b.nz));
  const ws = blocks.map((b) => (which === 'front' ? b.nx : b.ny)), w = ws.reduce((s, x) => s + x, 0) + gp * (blocks.length - 1);
  const data = new Uint8Array(w * nz); let x0 = 0;
  blocks.forEach((b, n) => {
    const src = which === 'front' ? b.front : b.side, bw = ws[n];
    for (let k = 0; k < b.nz; k++) for (let i = 0; i < bw; i++) if (src[k * bw + i]) data[(nz - 1 - k) * w + x0 + i] = 1;
    x0 += bw + gp;
  });
  return { w, h: nz, data };
}

function convexHull(p) {
  const pts = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
