/* Jigsaw pieces for the 3D Map Maker: the terrain block cut into 4-16 interlocking pieces.
 *
 * Every piece is a closed solid: its outline is a smooth jigsaw curve (knobs on the inner edges, straight outer
 * edges), shrunk by half the fitting gap on the inner edges so neighbours slide together; the top follows the terrain.
 * Inside the outline the top is the elevation grid itself (whole grid cells); between those cells and the curved
 * outline a thin strip is triangulated, with heights read from the grid at the outline points.
 * Shared by the preview and the server build. Units: mm, z up, rows of the grid run north (+y) to south. */
import earcut from 'earcut';
import { Tris } from '@/lib/mesh/mesh.js';
import { terrain } from './build.js';

/** Piece counts offered, and how they are laid out (columns × rows, for a square or a 3:2 map). */
export const PIECE_COUNTS = [1, 4, 9, 12, 16];
export function pieceGrid(n, aspect) {
  if (n === 4) return [2, 2];
  if (n === 9) return [3, 3];
  if (n === 16) return [4, 4];
  if (n === 12) return aspect >= 1.2 ? [4, 3] : [4, 3];
  return [1, 1];
}

/* ------------------------------------------------------------------ the jigsaw edges */
// a fixed seed, so the preview and the paid files cut the same pieces
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

/**
 * One inner edge from (0,0) to (L,0), as [u, v] points: straight, then a knob of size `s` bulging to +v (or -v when
 * flip), then straight again. Straight runs are split every `step` mm so the top of the wall follows the terrain.
 */
function edgeProfile(L, s, flip, shift, step) {
  const a = 0.075 * s, r = 0.135 * s, c = 0.19 * s, f = 0.05 * s, uc = L / 2 + shift * L;
  const v0 = c - Math.sqrt(r * r - a * a), fv = Math.min(f, v0 * 0.6), pts = [];
  const line = (u0, v0_, u1, v1) => { const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0_) / step)); for (let k = 1; k <= n; k++) pts.push([u0 + (u1 - u0) * k / n, v0_ + (v1 - v0_) * k / n]); };
  const quad = (p0, q, p1, n = 6) => { for (let k = 1; k <= n; k++) { const t = k / n, m = 1 - t; pts.push([m * m * p0[0] + 2 * m * t * q[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * q[1] + t * t * p1[1]]); } };
  pts.push([0, 0]);
  line(0, 0, uc - a - f, 0);
  quad([uc - a - f, 0], [uc - a, 0], [uc - a, fv]);
  line(uc - a, fv, uc - a, v0);
  // the head: round over the top, from the lower left to the lower right of the circle
  const t1 = Math.atan2(v0 - c, -a), t2 = Math.atan2(v0 - c, a) - 2 * Math.PI, n = Math.max(24, Math.ceil(Math.abs(t2 - t1) * r / Math.min(step, 0.6)));
  for (let k = 1; k <= n; k++) { const t = t1 + (t2 - t1) * k / n; pts.push([uc + r * Math.cos(t), c + r * Math.sin(t)]); }
  line(uc + a, v0, uc + a, fv);
  quad([uc + a, fv], [uc + a, 0], [uc + a + f, 0]);
  line(uc + a + f, 0, L, 0);
  return flip ? pts.map(([u, v]) => [u, -v]) : pts;
}

/**
 * The outline of every piece (counter-clockwise, in mm, centred on the model), shrunk by `gap/2` on its inner edges.
 * cols × rows pieces over a W × H rectangle.
 */
export function pieceOutlines(W, H, cols, rows, gap, step) {
  const cw = W / cols, ch = H / rows, s = Math.min(cw, ch), R = rng(cols * 131 + rows * 17 + 7);
  const x0 = -W / 2, y0 = -H / 2;   // bottom-left corner; row 0 of the pieces is at the top (north)
  // horizontal inner edges hE[r][c]: between piece rows r-1 and r (r = 1..rows-1), canonical left → right
  // vertical inner edges vE[r][c]: between piece columns c-1 and c (c = 1..cols-1), canonical bottom → top
  const hE = [], vE = [];
  for (let r = 1; r < rows; r++) { hE[r] = []; for (let c = 0; c < cols; c++) hE[r][c] = { flip: R() < 0.5, shift: (R() - 0.5) * 0.08 }; }
  for (let r = 0; r < rows; r++) { vE[r] = []; for (let c = 1; c < cols; c++) vE[r][c] = { flip: R() < 0.5, shift: (R() - 0.5) * 0.08 }; }
  const straight = (ax, ay, bx, by) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)), p = []; for (let k = 0; k <= n; k++) p.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); return p; };
  const pieces = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const L = x0 + c * cw, Rr = L + cw, T = y0 + (rows - r) * ch, B = T - ch;
    const segs = [];   // [points from → to, inner?]
    // bottom: left → right (edge below this piece, between rows r and r+1)
    if (r === rows - 1) segs.push([straight(L, B, Rr, B), false]);
    else { const e = hE[r + 1][c]; segs.push([edgeProfile(cw, s, e.flip, e.shift, step).map(([u, v]) => [L + u, B + v]), true]); }
    // right: bottom → top (edge between columns c and c+1)
    if (c === cols - 1) segs.push([straight(Rr, B, Rr, T), false]);
    else { const e = vE[r][c + 1]; segs.push([edgeProfile(ch, s, e.flip, e.shift, step).map(([u, v]) => [Rr - v, B + u]), true]); }
    // top: right → left (edge between rows r-1 and r), the canonical edge reversed
    if (r === 0) segs.push([straight(Rr, T, L, T), false]);
    else { const e = hE[r][c]; segs.push([edgeProfile(cw, s, e.flip, e.shift, step).map(([u, v]) => [L + u, T + v]).reverse(), true]); }
    // left: top → bottom (edge between columns c-1 and c), the canonical edge reversed
    if (c === 0) segs.push([straight(L, T, L, B), false]);
    else { const e = vE[r][c]; segs.push([edgeProfile(ch, s, e.flip, e.shift, step).map(([u, v]) => [L - v, B + u]).reverse(), true]); }
    // one ring, each point carrying how far the segment that starts there moves inwards
    const ring = [], inset = [];
    for (const [pts, inner] of segs) for (let k = 0; k < pts.length - 1; k++) { ring.push(pts[k]); inset.push(inner ? gap / 2 : 0); }
    pieces.push({ row: r, col: c, outline: offsetRing(ring, inset) });
  }
  return pieces;
}

/** Moves every edge of a counter-clockwise ring inwards by its own distance (mitred at the corners). */
function offsetRing(ring, d) {
  const n = ring.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i + n - 1) % n], q = ring[i], r = ring[(i + 1) % n];
    const d0 = d[(i + n - 1) % n], d1 = d[i];
    // inward (left) normals of the edges p→q and q→r
    let ax = q[0] - p[0], ay = q[1] - p[1], la = Math.hypot(ax, ay) || 1; ax /= la; ay /= la;
    let bx = r[0] - q[0], by = r[1] - q[1], lb = Math.hypot(bx, by) || 1; bx /= lb; by /= lb;
    const na = [-ay, ax], nb = [-by, bx];
    if (!d0 && !d1) { out.push([q[0], q[1]]); continue; }
    // where the two moved lines cross: q + na*d0 + ta*a  ==  q + nb*d1 + tb*b
    const cr = ax * by - ay * bx;
    if (Math.abs(cr) < 1e-3) { const m = (d0 + d1) / 2; out.push([q[0] + (na[0] + nb[0]) / 2 * m, q[1] + (na[1] + nb[1]) / 2 * m]); continue; }
    const px = nb[0] * d1 - na[0] * d0, py = nb[1] * d1 - na[1] * d0, ta = (px * by - py * bx) / cr;
    out.push([q[0] + na[0] * d0 + ax * ta, q[1] + na[1] * d0 + ay * ta]);
  }
  return out;
}

/* ------------------------------------------------------------------ one piece as a solid */
function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function distToRing(poly, x, y) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i], dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
    let t = l ? ((x - a[0]) * dx + (y - a[1]) * dy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = a[0] + t * dx - x, ey = a[1] + t * dy - y, d = ex * ex + ey * ey; if (d < m) m = d;
  }
  return Math.sqrt(m);
}

/**
 * The terrain inside `outline` as a closed solid. z: model heights (mm) at the w × h grid samples (row 0 = north),
 * `pitch` mm apart, centred on the origin. The bottom is flat at z = 0.
 */
export function pieceSolid(z, w, h, pitch, outline) {
  const X = (i) => (i - (w - 1) / 2) * pitch, Y = (j) => ((h - 1) / 2 - j) * pitch;
  const Zg = (i, j) => z[j * w + i];
  const zAt = (x, y) => {   // bilinear, clamped to the grid
    let fx = x / pitch + (w - 1) / 2, fy = (h - 1) / 2 - y / pitch;
    fx = Math.max(0, Math.min(w - 1.000001, fx)); fy = Math.max(0, Math.min(h - 1.000001, fy));
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    return (Zg(i, j) * (1 - u) + Zg(i + 1, j) * u) * (1 - v) + (Zg(i, j + 1) * (1 - u) + Zg(i + 1, j + 1) * u) * v;
  };
  // grid cells wholly inside the outline, with room to spare for the strip
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of outline) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  const cw = w - 1, ch = h - 1;
  const i0 = Math.max(0, Math.floor(minx / pitch + (w - 1) / 2) - 1), i1 = Math.min(cw - 1, Math.ceil(maxx / pitch + (w - 1) / 2) + 1);
  const j0 = Math.max(0, Math.floor((h - 1) / 2 - maxy / pitch) - 1), j1 = Math.min(ch - 1, Math.ceil((h - 1) / 2 - miny / pitch) + 1);
  const keep = new Uint8Array(cw * ch), need = pitch * 0.7072 + pitch * 0.35;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx = X(i) + pitch / 2, cy = Y(j) - pitch / 2;
    if (inside(outline, cx, cy) && distToRing(outline, cx, cy) > need) keep[j * cw + i] = 1;
  }
  const K = (i, j) => i >= 0 && j >= 0 && i < cw && j < ch && keep[j * cw + i] === 1;
  // no cells touching only at a corner (the strip around them would pinch to a point)
  for (let pass = 0, changed = true; changed && pass < 8; pass++) {
    changed = false;
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const a = K(i, j), b = K(i + 1, j), c = K(i, j + 1), d = K(i + 1, j + 1);
      if (a && d && !b && !c) { keep[(j + 1) * cw + i + 1] = 0; changed = true; }
      else if (b && c && !a && !d) { keep[(j + 1) * cw + i] = 0; changed = true; }
    }
  }
  const t = new Tris(4096);
  // the top over the whole cells
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!K(i, j)) continue;
    t.quad([X(i), Y(j + 1), Zg(i, j + 1)], [X(i + 1), Y(j + 1), Zg(i + 1, j + 1)], [X(i + 1), Y(j), Zg(i + 1, j)], [X(i), Y(j), Zg(i, j)]);
  }
  // the outline of those cells (grid points, every one along the way), as loops
  const next = new Map(), key = (i, j) => j * (w + 1) + i;
  const edge = (ai, aj, bi, bj) => { const k = key(ai, aj); if (!next.has(k)) next.set(k, []); next.get(k).push([bi, bj]); };
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!K(i, j)) continue;
    if (!K(i, j - 1)) edge(i + 1, j, i, j);          // north side, walked west
    if (!K(i, j + 1)) edge(i, j + 1, i + 1, j + 1);  // south side, walked east
    if (!K(i - 1, j)) edge(i, j, i, j + 1);          // west side, walked south
    if (!K(i + 1, j)) edge(i + 1, j + 1, i + 1, j);  // east side, walked north
  }
  const holes = [], used = new Set();
  for (const [k0, outs] of next) for (let o = 0; o < outs.length; o++) {
    const id0 = `${k0}:${o}`; if (used.has(id0)) continue;
    const loop = []; let ci = k0 % (w + 1), cj = Math.floor(k0 / (w + 1)), ok = true;
    let [ni, nj] = outs[o]; used.add(id0); loop.push([ci, cj]);
    for (let guard = 0; guard < 1e6; guard++) {
      ci = ni; cj = nj; const k = key(ci, cj);
      if (k === k0) break;
      loop.push([ci, cj]);
      const cand = next.get(k); if (!cand) { ok = false; break; }
      let pick = -1; for (let q = 0; q < cand.length; q++) if (!used.has(`${k}:${q}`)) { pick = q; break; }
      if (pick < 0) { ok = false; break; }
      used.add(`${k}:${pick}`); [ni, nj] = cand[pick];
    }
    if (ok && loop.length >= 4) holes.push(loop);
  }
  // the strip between the outline and those cells
  const flat = [], zs = [], holeIdx = [];
  for (const p of outline) { flat.push(p[0], p[1]); zs.push(zAt(p[0], p[1])); }
  for (const hl of holes) { holeIdx.push(flat.length / 2); for (const [i, j] of hl) { flat.push(X(i), Y(j)); zs.push(Zg(i, j)); } }
  const ids = earcut(flat, holeIdx, 2), V = (q) => [flat[2 * q], flat[2 * q + 1], zs[q]];
  for (let q = 0; q < ids.length; q += 3) {
    let a = ids[q], b = ids[q + 1], c = ids[q + 2];
    if ((flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) - (flat[2 * b + 1] - flat[2 * a + 1]) * (flat[2 * c] - flat[2 * a]) < 0) { const s = b; b = c; c = s; }
    const A = V(a), B = V(b), C = V(c); t.tri(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
  }
  // the bottom, and the walls round the outline
  const bf = []; for (const p of outline) bf.push(p[0], p[1]);
  const bids = earcut(bf, null, 2);
  for (let q = 0; q < bids.length; q += 3) {
    let a = bids[q], b = bids[q + 1], c = bids[q + 2];
    if ((bf[2 * b] - bf[2 * a]) * (bf[2 * c + 1] - bf[2 * a + 1]) - (bf[2 * b + 1] - bf[2 * a + 1]) * (bf[2 * c] - bf[2 * a]) > 0) { const s = b; b = c; c = s; }
    t.tri(bf[2 * a], bf[2 * a + 1], 0, bf[2 * b], bf[2 * b + 1], 0, bf[2 * c], bf[2 * c + 1], 0);
  }
  for (let k = 0, n = outline.length; k < n; k++) {
    const p = outline[k], q = outline[(k + 1) % n], zp = zs[k], zq = zs[(k + 1) % n];
    t.quad([p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], zq], [p[0], p[1], zp]);
  }
  return t.done();
}

/**
 * The whole map as jigsaw pieces. z: model heights from terrain(); cols × rows pieces; gap: the fitting gap (mm).
 * `spread` moves the pieces apart (mm) so they print without touching. Returns [{ name, row, col, tris }].
 */
export function puzzlePieces(z, w, h, pitch, cols, rows, gap = 0.25, spread = 0) {
  const W = (w - 1) * pitch, H = (h - 1) * pitch;
  const outlines = pieceOutlines(W, H, cols, rows, gap, Math.max(pitch, 0.5));
  return outlines.map((pc) => {
    let tris = pieceSolid(z, w, h, pitch, pc.outline);
    if (spread) {
      const dx = (pc.col - (cols - 1) / 2) * spread, dy = ((rows - 1) / 2 - pc.row) * spread, o = new Float32Array(tris.length);
      for (let i = 0; i < tris.length; i += 3) { o[i] = tris[i] + dx; o[i + 1] = tris[i + 1] + dy; o[i + 2] = tris[i + 2]; }
      tris = o;
    }
    return { name: `piece-${String.fromCharCode(65 + pc.row)}${pc.col + 1}`, row: pc.row, col: pc.col, tris };
  });
}

/** The map as a jigsaw: p.pieces pieces with a p.gap fitting gap, spread apart by `spread` mm. */
export function buildPuzzle(p, elev, w, h, spread = 0) {
  const t = terrain(p, elev, w, h), pitch = p.width / (w - 1), H = (h - 1) * pitch;
  const [cols, rows] = pieceGrid(p.pieces, p.width / H);
  const pieces = puzzlePieces(t.z, w, h, pitch, cols, rows, p.gap ?? 0.25, spread);
  return { pieces, cols, rows, size: [p.width, H, p.base + t.relief], relief: t.relief, lo: t.lo, hi: t.hi };
}
