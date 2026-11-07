/* 360° Shadow Lantern: a cylinder whose wall is a picture wrapped all the way round. Dark parts of the picture are
 * solid, light parts are cut through, and a small LED on a post in the middle throws the picture onto every wall of
 * the room. A second part, the base, holds the shell and the LED post.
 *
 * The wall pattern arrives as a mask (1 = solid), as the picture should look on the walls, one row per pixel from the
 * top, wrapping round from the left edge to the right. Floating solid bits get thin bridges to the rest; the mask is
 * then smoothed and meshed with marching squares straight onto the cylinder (no seam where the wrap closes).
 * Shared by the preview and the server build. Units: mm, z up. */
import { extrude, flip, Tris } from '@/lib/mesh/mesh.js';

export const PXMM = 3;   // mask pixels per mm of wall

/** Lantern size from its settings: wall length round the outside and the picture band between the rims. */
export function lanternSize(p) {
  const C = Math.PI * p.diameter, band = p.height - p.rimTop - p.rimBottom;
  return { C, band, w: Math.round(C * PXMM), h: Math.round(p.height * PXMM), top: Math.round(p.rimTop * PXMM), bottom: Math.round(p.rimBottom * PXMM) };
}

/* ------------------------------------------------------------------ the wall pattern */
/**
 * The full wall mask: the picture band between solid rims, with every floating solid bit either bridged to the rest
 * (bridge mm wide) or dropped when it is too small to matter. Returns { mask, bridges, dropped }.
 */
export function wallMask(band, w, bh, top, bottom, bridge = 1.2) {
  const h = top + bh + bottom, m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = y < top || y >= top + bh ? 1 : band[(y - top) * w + x] ? 1 : 0;
  // solid pieces (8-connected, wrapping round left to right)
  const lab = new Int32Array(w * h).fill(-1), sizes = [];
  const nb = (q, f) => { const x = q % w, y = (q / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const yy = y + dy; if (yy < 0 || yy >= h) continue; f(yy * w + ((x + dx + w) % w)); } };
  for (let q0 = 0; q0 < w * h; q0++) {
    if (!m[q0] || lab[q0] >= 0) continue;
    const id = sizes.length, st = [q0]; lab[q0] = id; let n = 0;
    while (st.length) { const q = st.pop(); n++; nb(q, (r) => { if (m[r] && lab[r] < 0) { lab[r] = id; st.push(r); } }); }
    sizes.push(n);
  }
  const main = lab[0], minArea = PXMM * PXMM * 1.0;   // the rims are one piece; bits under 1 mm² are dropped
  let dropped = 0, bridges = 0;
  const joined = new Uint8Array(sizes.length); joined[main] = 1;
  for (let q = 0; q < w * h; q++) if (m[q] && lab[q] !== main && sizes[lab[q]] < minArea) { m[q] = 0; lab[q] = -1; }
  for (let i = 0; i < sizes.length; i++) if (i !== main && sizes[i] < minArea) { joined[i] = 1; dropped++; }
  // join the nearest floating piece to what is already joined, one at a time
  const r = Math.max(1, Math.round((bridge * PXMM) / 2)), dist = new Int32Array(w * h), from = new Int32Array(w * h);
  for (let guard = 0; guard < 400; guard++) {
    if (joined.every(Boolean)) break;
    dist.fill(-1); const qu = new Int32Array(w * h); let qh = 0, qt = 0;
    for (let q = 0; q < w * h; q++) if (m[q] && lab[q] >= 0 && joined[lab[q]]) { dist[q] = 0; from[q] = -1; qu[qt++] = q; }
    let hit = -1;
    while (qh < qt && hit < 0) {
      const q = qu[qh++], x = q % w, y = (q / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue; const s = yy * w + ((x + dx + w) % w);
        if (dist[s] >= 0) continue; dist[s] = dist[q] + 1; from[s] = q;
        if (m[s] && lab[s] >= 0 && !joined[lab[s]]) { hit = s; break; }
        qu[qt++] = s;
      }
    }
    if (hit < 0) break;
    const id = lab[hit]; joined[id] = 1; bridges++;
    for (let q = from[hit]; q >= 0 && dist[q] > 0; q = from[q]) {
      const x = q % w, y = (q / w) | 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 1) { const yy = y + dy; if (yy < 0 || yy >= h) continue; const s = yy * w + ((x + dx + w) % w); m[s] = 1; if (lab[s] < 0) lab[s] = main; }
    }
  }
  // pieces still floating (only when there are very many of them): they would fall out of the print
  const left = joined.reduce((n, j) => n + (j ? 0 : 1), 0);
  return { mask: m, bridges, dropped, left };
}

/* ------------------------------------------------------------------ the shell */
/**
 * Meshes the wall: marching squares on the smoothed mask, wrapped onto a cylinder (outer radius R, wall t thick,
 * height Hz), with grid cells about `cell` mm. Returns a closed solid.
 */
export function shellMesh(mask, w, h, R, t, Hz, cell, smooth = 0.6) {
  // smoothed field at the grid nodes (positive = solid), with an empty row above and below so the rims close
  const nu = Math.max(24, Math.round((2 * Math.PI * R) / cell)), nv = Math.max(4, Math.round(Hz / cell)) + 1, cu = (2 * Math.PI * R) / nu, cv = Hz / (nv - 1);
  const s = Math.max(0.5, smooth * PXMM), rad = Math.ceil(s * 2), ker = []; let ks = 0;
  for (let k = -rad; k <= rad; k++) { const v = Math.exp(-(k * k) / (2 * s * s)); ker.push(v); ks += v; }
  const tmp = new Float32Array(w * h), sm = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let k = -rad; k <= rad; k++) a += ker[k + rad] * mask[y * w + ((x + k + w) % w)]; tmp[y * w + x] = a / ks; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let k = -rad; k <= rad; k++) { const yy = Math.max(0, Math.min(h - 1, y + k)); a += ker[k + rad] * tmp[yy * w + x]; } sm[y * w + x] = a / ks; }
  const NV = nv + 2, F = new Float32Array(nu * NV);
  for (let j = 0; j < NV; j++) for (let i = 0; i < nu; i++) {
    if (j === 0 || j === NV - 1) { F[j * nu + i] = -0.5; continue; }
    const z = (j - 1) * cv, y = Math.min(h - 1, Math.max(0, (Hz - z) / Hz * h - 0.5)), x = ((i * cu) / (2 * Math.PI * R)) * w;
    const x0 = Math.floor(x) % w, x1 = (x0 + 1) % w, fx = x - Math.floor(x), y0 = Math.floor(y), y1 = Math.min(h - 1, y0 + 1), fy = y - y0;
    F[j * nu + i] = (sm[y0 * w + x0] * (1 - fx) + sm[y0 * w + x1] * fx) * (1 - fy) + (sm[y1 * w + x0] * (1 - fx) + sm[y1 * w + x1] * fx) * fy - 0.5;
  }
  const val = (i, j) => F[j * nu + (i % nu)];
  // a (u, v) point on the cylinder; u runs the other way round, so the picture reads correctly on the walls
  const P = (u, v, r) => { const a = -u / R; return [r * Math.cos(a), r * Math.sin(a), v]; };
  const zOf = (j) => (j - 1) * cv;
  // edge crossings, cached so neighbouring cells share them
  const hx = new Map(), vy = new Map();
  const ex = (i, j) => { const k = j * nu + (i % nu); let p = hx.get(k); if (!p) { const a = val(i, j), b = val(i + 1, j); p = [(i + a / (a - b)) * cu, zOf(j)]; hx.set(k, p); } return p; };
  const ey = (i, j) => { const k = j * nu + (i % nu); let p = vy.get(k); if (!p) { const a = val(i, j), b = val(i, j + 1); p = [(i % nu) * cu, zOf(j + (a / (a - b)))]; vy.set(k, p); } return p; };
  const t3 = new Tris(65536), Ri = R - t;
  for (let j = 0; j < NV - 1; j++) for (let i = 0; i < nu; i++) {
    const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], v = c.map(([a, b]) => val(a, b)), ins = v.map((x) => x > 0);
    const n = ins.filter(Boolean).length; if (!n) continue;
    // node nu is node 0 (the wrap): every point comes from one place, so the seam closes exactly
    const corner = (k) => ({ p: [(c[k][0] % nu) * cu, zOf(c[k][1])], e: false });
    const edge = (k) => ({ p: k === 0 ? ex(i, j) : k === 1 ? ey(i + 1, j) : k === 2 ? ex(i, j + 1) : ey(i, j), e: true, k });
    let polys;
    const saddle = n === 2 && ins[0] === ins[2];
    if (saddle && (v[0] + v[1] + v[2] + v[3]) / 4 <= 0) polys = [0, 1, 2, 3].filter((k) => ins[k]).map((k) => [edge((k + 3) % 4), corner(k), edge(k)]);
    else { const pl = []; for (let k = 0; k < 4; k++) { if (ins[k]) pl.push(corner(k)); if (ins[k] !== ins[(k + 1) % 4]) pl.push(edge(k)); } polys = [pl]; }
    for (const pl of polys) {
      for (let q = 1; q < pl.length - 1; q++) {
        const a = pl[0].p, b = pl[q].p, d = pl[q + 1].p;
        const A = P(a[0], a[1], R), B = P(b[0], b[1], R), D = P(d[0], d[1], R); t3.tri(A[0], A[1], A[2], B[0], B[1], B[2], D[0], D[1], D[2]);
        const Ai = P(a[0], a[1], Ri), Bi = P(b[0], b[1], Ri), Di = P(d[0], d[1], Ri); t3.tri(Ai[0], Ai[1], Ai[2], Di[0], Di[1], Di[2], Bi[0], Bi[1], Bi[2]);
      }
      for (let q = 0; q < pl.length; q++) {
        const a = pl[q], b = pl[(q + 1) % pl.length];
        if (!a.e || !b.e || a.k === b.k) continue;
        // the cut edge, from a to b with the solid on its left: a wall facing the hole
        t3.quad(P(a.p[0], a.p[1], R), P(a.p[0], a.p[1], Ri), P(b.p[0], b.p[1], Ri), P(b.p[0], b.p[1], R));
      }
    }
  }
  // the wrap runs the other way round (see P), which turns every face inside out: turn them back
  return flip(t3.done());
}

/* ------------------------------------------------------------------ the base */
const ring = (r, n = 96) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return [r * Math.cos(a), r * Math.sin(a)]; });

/**
 * Base sizes (mm). The base is a plate the shell stands in (a groove keeps it centred) on an open skirt: the battery,
 * the charging module and the wires are glued under the plate, inside the skirt, open from below. The skirt has a
 * hole for the USB Type-C port of the charging module and, if wanted, one for a small rocker switch.
 */
export const BASE = {
  skirt: 22, plate: 4, groove: 2.2, wall: 2, rim: 4,
  port: { w: 9.6, h: 4, r: 2, below: 3.4 },    // Type-C: centred 3.4 mm under the plate, where a module glued under it has its port
  rocker: { w: 13.2, h: 9.2, r: 0.6, gap: 22 }, // KCD11 mini rocker (13 × 9 mm cut-out), 22 mm round from the port
  post: 5, hole: 2.9,                            // LED post: 10 mm tube, 5.8 mm bore for a 5 mm LED and its wires
};

/** Half the width of a rounded-rectangle hole at height dz from its centre (0 outside it). */
function holeHalf(o, dz) {
  const r = Math.min(o.r, o.h / 2, o.w / 2), a = Math.abs(dz), s = o.h / 2 - r;
  if (a > o.h / 2) return 0;
  return a <= s ? o.w / 2 : o.w / 2 - r + Math.sqrt(Math.max(0, r * r - (a - s) ** 2));
}

/** One band of the skirt (z0..z1): a ring between Ri and Ro, minus the angular gaps [a0, a1] (radians) of the holes. */
function skirtBand(t, Ri, Ro, z0, z1, gaps) {
  if (!gaps.length) { extrude(t, [{ outer: ring(Ro), holes: [ring(Ri)] }], z0, z1); return; }
  gaps.sort((a, b) => a[0] - b[0]);
  const polys = [];
  for (let g = 0; g < gaps.length; g++) {
    const a0 = gaps[g][1], a1 = gaps[(g + 1) % gaps.length][0] + (g + 1 === gaps.length ? Math.PI * 2 : 0);
    const k = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 96)), outer = [], inner = [];
    for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; outer.push([Ro * Math.cos(a), Ro * Math.sin(a)]); inner.push([Ri * Math.cos(a), Ri * Math.sin(a)]); }
    polys.push({ outer: [...outer, ...inner.reverse()] });
  }
  extrude(t, polys, z0, z1);
}

/**
 * The base, as it stands under the lantern (plate on top). R: shell radius, t: shell wall. Returns its triangles and the
 * height of the plate's top. Printed upside down (plate on the bed), it needs no supports.
 */
export function baseMesh(R, t, o = {}) {
  const B = BASE, tb = new Tris(16384), Ro = R + B.rim, Ri = Ro - B.wall, top = B.skirt + B.plate;
  // the holes in the skirt, at the front (-y)
  const front = -Math.PI / 2, holes = [{ ...B.port, ang: front, zc: B.skirt - B.port.below }];
  if (o.rocker !== false) holes.push({ ...B.rocker, ang: front + B.rocker.gap / Ri, zc: B.skirt / 2 + 1 });
  const zs = new Set([0, B.skirt]);
  for (const hl of holes) { const n = Math.ceil(hl.h / 0.4); for (let k = 0; k <= n; k++) zs.add(+(hl.zc - hl.h / 2 + (hl.h * k) / n).toFixed(4)); }
  const cuts = [...zs].filter((z) => z >= 0 && z <= B.skirt).sort((a, b) => a - b);
  for (let k = 0; k < cuts.length - 1; k++) {
    const z0 = cuts[k], z1 = cuts[k + 1], zm = (z0 + z1) / 2, gaps = [];
    for (const hl of holes) { const hw = holeHalf(hl, zm - hl.zc); if (hw > 0) gaps.push([hl.ang - hw / Ri, hl.ang + hw / Ri]); }
    skirtBand(tb, Ri, Ro, k ? z0 - 0.01 : z0, z1, gaps);
  }
  // the plate: a groove the shell stands in, and a hole for the LED post
  const gin = R - t - 0.3, gout = R + 0.3, post = ring(B.post + 0.15, 48);
  extrude(tb, [{ outer: ring(Ro), holes: [post] }], B.skirt - 0.01, top - B.groove);
  extrude(tb, [{ outer: ring(gin), holes: [post] }], top - B.groove - 0.01, top);
  extrude(tb, [{ outer: ring(Ro), holes: [ring(gout)] }], top - B.groove - 0.01, top);
  return { tris: tb.done(), top };
}

/**
 * The bottom cover: a plate under the base that hides the battery and the wiring, with a ring that pushes into the
 * skirt to hold it (a drop of glue keeps it, or leave it a push fit to open it again). Under the base: z from -thick to 0.
 */
export function coverMesh(R, thick = 2) {
  const t = new Tris(4096), Ro = R + BASE.rim, Ri = Ro - BASE.wall;
  extrude(t, [{ outer: ring(Ro) }], -thick, 0);
  extrude(t, [{ outer: ring(Ri - 0.25), holes: [ring(Ri - 1.85)] }], -0.01, 3);
  return t.done();
}

/**
 * The top cover: a lid on the shell (z0 = the top of the shell), with a ring that pushes into the shell to keep it
 * centred. Keeps dust out and the ceiling dark.
 */
export function lidMesh(R, wall, z0, thick = 2) {
  const t = new Tris(4096), ri = R - wall - 0.25;
  extrude(t, [{ outer: ring(R + 1.2) }], z0, z0 + thick);
  extrude(t, [{ outer: ring(ri), holes: [ring(ri - 1.6)] }], z0 - 3, z0 + 0.01);
  return t.done();
}

/** The LED post: a tube pushed into the plate (flush with its underside) that holds the LED at `led` mm. */
export function postMesh(top, led) {
  const t = new Tris(2048);
  extrude(t, [{ outer: ring(BASE.post, 48), holes: [ring(BASE.hole, 32)] }], top - BASE.plate, Math.max(top + 6, led - 1));
  return t.done();
}

/**
 * The whole lantern. mask: the wall (from wallMask), p: { diameter, height, wall, rimBottom, rimTop, rocker }, cell: mesh
 * size (mm). Returns the shell, the base, the LED post, the bottom cover and the lid (all where they sit when put together), the LED
 * height and the size.
 */
export function buildLantern(mask, w, h, p, cell = 0.8) {
  const R = p.diameter / 2, b = baseMesh(R, p.wall, { rocker: p.rocker }), z0 = b.top - BASE.groove;
  const led = z0 + p.rimBottom + (p.height - p.rimTop - p.rimBottom) / 2;
  const shell = shellMesh(mask, w, h, R, p.wall, p.height, cell);
  // the shell stands in the groove of the plate
  for (let i = 2; i < shell.length; i += 3) shell[i] += z0;
  return {
    shell, base: b.tris, post: postMesh(b.top, led), cover: coverMesh(R), lid: lidMesh(R, p.wall, z0 + p.height), led, top: b.top,
    size: [p.diameter + 2 * BASE.rim, p.diameter + 2 * BASE.rim, z0 + p.height + 4],
  };
}

/** A part turned over (180° about x) and stood on z = 0: the base prints with its plate on the bed. */
export function upsideDown(tris) {
  const o = new Float32Array(tris.length); let zMax = -Infinity;
  for (let i = 2; i < tris.length; i += 3) zMax = Math.max(zMax, tris[i]);
  for (let i = 0; i < tris.length; i += 3) { o[i] = tris[i]; o[i + 1] = -tris[i + 1]; o[i + 2] = zMax - tris[i + 2]; }
  return o;
}

/** A part stood on z = 0. */
export function onBed(tris) {
  const o = Float32Array.from(tris); let zMin = Infinity;
  for (let i = 2; i < o.length; i += 3) zMin = Math.min(zMin, o[i]);
  for (let i = 2; i < o.length; i += 3) o[i] -= zMin;
  return o;
}
