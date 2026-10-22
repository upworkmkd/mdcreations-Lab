/* Shared mesh helpers for the Labs tools. Plain JS, no DOM: runs in the browser (previews, free tools)
 * and on the server (paid files). Units are millimetres, z up. Every builder returns closed, outward-facing
 * triangle soups as Float32Array [ax,ay,az, bx,by,bz, cx,cy,cz, ...]. */
/* eslint-disable */
import earcut from 'earcut';
import { contours } from '@/lib/layers/core.js';

/* ------------------------------------------------------------------ triangle buffer */
export class Tris {
  constructor(cap = 4096) { this.a = new Float32Array(cap * 9); this.n = 0; }
  _grow() { const b = new Float32Array(this.a.length * 2); b.set(this.a); this.a = b; }
  tri(ax, ay, az, bx, by, bz, cx, cy, cz) {
    if ((this.n + 1) * 9 > this.a.length) this._grow();
    const a = this.a, o = this.n * 9;
    a[o] = ax; a[o + 1] = ay; a[o + 2] = az; a[o + 3] = bx; a[o + 4] = by; a[o + 5] = bz; a[o + 6] = cx; a[o + 7] = cy; a[o + 8] = cz;
    this.n++;
  }
  /** quad a-b-c-d counter-clockwise seen from outside */
  quad(a, b, c, d) { this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]); }
  add(t) { const src = t instanceof Tris ? t.done() : t; while ((this.n * 9 + src.length) > this.a.length) this._grow(); this.a.set(src, this.n * 9); this.n += src.length / 9; }
  done() { return this.a.subarray(0, this.n * 9); }
}

/** Moves / scales / maps every vertex. */
export function transform(tris, fn) {
  const out = new Float32Array(tris.length), p = [0, 0, 0];
  for (let i = 0; i < tris.length; i += 3) { p[0] = tris[i]; p[1] = tris[i + 1]; p[2] = tris[i + 2]; const q = fn(p); out[i] = q[0]; out[i + 1] = q[1]; out[i + 2] = q[2]; }
  return out;
}
export const translate = (tris, dx, dy, dz) => transform(tris, (p) => [p[0] + dx, p[1] + dy, p[2] + dz]);
/** Mirror in x (keeps faces pointing outwards). */
export function mirrorX(tris) {
  const out = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 9) {
    out[i] = -tris[i]; out[i + 1] = tris[i + 1]; out[i + 2] = tris[i + 2];
    out[i + 3] = -tris[i + 6]; out[i + 4] = tris[i + 7]; out[i + 5] = tris[i + 8];
    out[i + 6] = -tris[i + 3]; out[i + 7] = tris[i + 4]; out[i + 8] = tris[i + 5];
  }
  return out;
}
export function bounds(tris) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i += 3) for (let k = 0; k < 3; k++) { const v = tris[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  return { min: mn, max: mx, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
}

/* ------------------------------------------------------------------ STL */
export function stlBinary(tris, name = 'MD Creations Labs') {
  const n = tris.length / 9, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  const head = String(name).slice(0, 79);
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 0x7f);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let i = 0; i < n; i++) {
    const a = i * 9;
    const ux = tris[a + 3] - tris[a], uy = tris[a + 4] - tris[a + 1], uz = tris[a + 5] - tris[a + 2];
    const vx = tris[a + 6] - tris[a], vy = tris[a + 7] - tris[a + 1], vz = tris[a + 8] - tris[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
    for (let j = 0; j < 9; j++) { dv.setFloat32(o, tris[a + j], true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Uint8Array(buf);
}

/** Every directed edge must meet exactly one opposite edge. */
export function checkClosed(tris) {
  const m = new Map(), f = new Float32Array(3);
  const key = (i) => { f[0] = tris[i]; f[1] = tris[i + 1]; f[2] = tris[i + 2]; return f[0] + ',' + f[1] + ',' + f[2]; };
  for (let i = 0; i < tris.length; i += 9) {
    const k = [key(i), key(i + 3), key(i + 6)];
    for (let e = 0; e < 3; e++) { const a = k[e], b = k[(e + 1) % 3], bk = b + '|' + a; if (m.get(bk) > 0) m.set(bk, m.get(bk) - 1); else m.set(a + '|' + b, (m.get(a + '|' + b) || 0) + 1); }
  }
  let open = 0; for (const v of m.values()) open += v;
  return { open, tris: tris.length / 9 };
}

/* ------------------------------------------------------------------ zip (stored, no compression; used in the browser) */
let CRC = null;
function crc32(u8) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
}
export function storeZip(files) {
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = new TextEncoder().encode(f.name), data = f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  }
  let cs = 0; for (const c of central) cs += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
  const all = parts.concat(central, [new Uint8Array(end.buffer)]); let total = 0; for (const a of all) total += a.length;
  const out = new Uint8Array(total); let o = 0; for (const a of all) { out.set(a, o); o += a.length; }
  return out;
}

/* ------------------------------------------------------------------ boxes and prisms */
/** Axis-aligned box. */
export function box(t, x0, y0, z0, x1, y1, z1) {
  const P = (x, y, z) => [x, y, z];
  t.quad(P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0));   // bottom
  t.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1));   // top
  t.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1));   // front (y0)
  t.quad(P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1));   // back
  t.quad(P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1));   // left
  t.quad(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1));   // right
}

const signedArea = (r) => { let a = 0; for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; };
/** Drops repeated and exactly collinear points (earcut skips them, which would open the mesh). */
export function cleanRing(r) {
  let pts = r.filter((p, i) => { const q = r[(i + r.length - 1) % r.length]; return Math.abs(p[0] - q[0]) > 1e-7 || Math.abs(p[1] - q[1]) > 1e-7; });
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length > 3; i++) {
      const n = pts.length, a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-9) { pts.splice(i, 1); i--; changed = true; }
    }
  }
  return pts;
}

/**
 * Straight prism from polygons. polys: [{ outer: [[x,y],...], holes: [[[x,y],...], ...] }].
 * Orientation is fixed here (outer CCW, holes CW), so callers need not care.
 */
export function extrude(t, polys, z0, z1) {
  for (const P of polys) {
    let outer = cleanRing(P.outer); if (outer.length < 3) continue;
    if (signedArea(outer) < 0) outer = outer.slice().reverse();
    const holes = (P.holes || []).map(cleanRing).filter((h) => h.length >= 3).map((h) => (signedArea(h) > 0 ? h.slice().reverse() : h));
    const rings = [outer, ...holes], flat = [], holeIdx = [];
    for (let r = 0; r < rings.length; r++) { if (r) holeIdx.push(flat.length / 2); for (const p of rings[r]) flat.push(p[0], p[1]); }
    const ids = earcut(flat, holeIdx, 2);
    const X = (i) => flat[2 * i], Y = (i) => flat[2 * i + 1];
    for (let i = 0; i < ids.length; i += 3) {
      let a = ids[i], b = ids[i + 1], c = ids[i + 2];
      if ((X(b) - X(a)) * (Y(c) - Y(a)) - (Y(b) - Y(a)) * (X(c) - X(a)) < 0) { const q = b; b = c; c = q; }
      t.tri(X(a), Y(a), z1, X(b), Y(b), z1, X(c), Y(c), z1);
      t.tri(X(a), Y(a), z0, X(c), Y(c), z0, X(b), Y(b), z0);
    }
    for (const r of rings) for (let i = 0, n = r.length; i < n; i++) {
      const p = r[i], q = r[(i + 1) % n];
      t.quad([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]);
    }
  }
}

/** Rounded rectangle centred on (cx,cy), counter-clockwise, `seg` points per corner. */
export function roundRect(cx, cy, w, h, r, seg = 8) {
  r = Math.max(0, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
  const pts = [], c = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]];
  for (const [x, y, q] of c) for (let i = 0; i <= seg; i++) { const a = (q + i / seg) * Math.PI / 2; pts.push([cx + x + r * Math.cos(a), cy + y + r * Math.sin(a)]); }
  return pts;
}
export function circle(cx, cy, r, n = 48) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }

/**
 * Loft between rings of equal length stacked at heights zs (rings[k] at zs[k]).
 * Builds the side walls only; `capBottom` / `capTop` add flat caps (with optional holes).
 */
export function loftWalls(t, rings, zs, inward = false) {
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1], n = A.length, z0 = zs[k], z1 = zs[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = [A[i][0], A[i][1], z0], b = [A[j][0], A[j][1], z0], c = [B[j][0], B[j][1], z1], d = [B[i][0], B[i][1], z1];
      if (inward) t.quad(b, a, d, c); else t.quad(a, b, c, d);
    }
  }
}
export function cap(t, outer, holes, z, up) {
  const rings = [outer, ...(holes || [])], flat = [], hi = [];
  for (let r = 0; r < rings.length; r++) { if (r) hi.push(flat.length / 2); for (const p of rings[r]) flat.push(p[0], p[1]); }
  const ids = earcut(flat, hi, 2), X = (i) => flat[2 * i], Y = (i) => flat[2 * i + 1];
  for (let i = 0; i < ids.length; i += 3) {
    let a = ids[i], b = ids[i + 1], c = ids[i + 2];
    const ccw = (X(b) - X(a)) * (Y(c) - Y(a)) - (Y(b) - Y(a)) * (X(c) - X(a)) > 0;
    if (ccw !== up) { const q = b; b = c; c = q; }
    t.tri(X(a), Y(a), z, X(b), Y(b), z, X(c), Y(c), z);
  }
}

/* ------------------------------------------------------------------ height fields */
/**
 * Closed solid from a height grid: the top follows `hgt` (w × h samples, row 0 = back / +y),
 * the bottom is flat at z = 0, sides are vertical. `pitch` mm between samples.
 * `keep` (optional, (w-1)×(h-1) cells) clips the shape; without it the outline is the full rectangle.
 */
export function heightField(hgt, w, h, pitch, keep) {
  const t = new Tris(Math.max(4096, (w - 1) * (h - 1) * 2.2));
  const X = (i) => (i - (w - 1) / 2) * pitch, Y = (j) => ((h - 1) / 2 - j) * pitch, Z = (i, j) => hgt[j * w + i];
  const cw = w - 1, ch = h - 1, inC = (i, j) => i >= 0 && j >= 0 && i < cw && j < ch && (!keep || keep[j * cw + i]);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    if (!inC(i, j)) continue;
    const a = [X(i), Y(j + 1), Z(i, j + 1)], b = [X(i + 1), Y(j + 1), Z(i + 1, j + 1)], c = [X(i + 1), Y(j), Z(i + 1, j)], d = [X(i), Y(j), Z(i, j)];
    t.quad(a, b, c, d);                                                        // top (CCW from above: y grows up the rows)
    if (keep) t.quad([a[0], a[1], 0], [d[0], d[1], 0], [c[0], c[1], 0], [b[0], b[1], 0]);   // bottom, per cell
    // walls on the outline
    if (!inC(i, j - 1)) t.quad([c[0], c[1], 0], [d[0], d[1], 0], d, c);       // back edge (row j, y larger), faces +y
    if (!inC(i, j + 1)) t.quad([a[0], a[1], 0], [b[0], b[1], 0], b, a);       // front edge, faces -y
    if (!inC(i - 1, j)) t.quad([d[0], d[1], 0], [a[0], a[1], 0], a, d);       // left, faces -x
    if (!inC(i + 1, j)) t.quad([b[0], b[1], 0], [c[0], c[1], 0], c, b);       // right, faces +x
  }
  if (!keep) {
    // a rectangle: fan the bottom from its centre through every outline point, so it shares the walls' vertices
    const ring = [];
    for (let i = 0; i < cw; i++) ring.push([X(i), Y(ch)]);
    for (let j = ch; j > 0; j--) ring.push([X(cw), Y(j)]);
    for (let i = cw; i > 0; i--) ring.push([X(i), Y(0)]);
    for (let j = 0; j < ch; j++) ring.push([X(0), Y(j)]);
    for (let k = 0; k < ring.length; k++) { const p = ring[k], q = ring[(k + 1) % ring.length]; t.tri(0, 0, 0, q[0], q[1], 0, p[0], p[1], 0); }
  }
  return t.done();
}

/* ------------------------------------------------------------------ outlines from a pixel mask */
/**
 * Traces the solid pixels of a mask (w × h, row 0 = top) into polygons in mm, centred on the origin.
 * `smooth` > 0 softens the stair steps; `tol` simplifies (mm).
 */
export function maskPolys(mask, w, h, pitch, tol = 0.05, smooth = 1) {
  const PW = w + 4, PH = h + 4, e = new Float32Array(PW * PH);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) e[(y + 2) * PW + x + 2] = 1;
  let f = e;
  if (smooth > 0) {
    const b = new Float32Array(PW * PH); f = new Float32Array(PW * PH);
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = y * PW + x; b[i] = (e[y * PW + Math.max(0, x - 1)] + 2 * e[i] + e[y * PW + Math.min(PW - 1, x + 1)]) / 4; }
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = y * PW + x; f[i] = (b[Math.max(0, y - 1) * PW + x] + 2 * b[i] + b[Math.min(PH - 1, y + 1) * PW + x]) / 4; }
  }
  const g = new Float32Array(PW * PH); for (let i = 0; i < g.length; i++) { g[i] = f[i] - 0.5; if (g[i] === 0) g[i] = -1e-6; }
  const polys = contours(g, PW, PH, { s: pitch, hw: (w * pitch) / 2, hh: (h * pitch) / 2 }, tol, pitch * pitch * 0.5);
  return polys.map((p) => ({ outer: p.xs.map((x, i) => [x, p.ys[i]]), holes: p.holes.map((hh) => hh.xs.map((x, i) => [x, hh.ys[i]])) }));
}

/** Grows (r > 0) or shrinks (r < 0) a mask by r pixels, round. */
export function dilate(mask, w, h, r) {
  if (!r) return mask.slice();
  const R = Math.abs(r), grow = r > 0, out = new Uint8Array(w * h), offs = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R + R * 0.5) offs.push(dy * w + dx, dx, dy);
  // distance transform would be faster; masks here are small enough
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (grow) {
      if (mask[i]) { out[i] = 1; continue; }
      for (let k = 0; k < offs.length; k += 3) { const xx = x + offs[k + 1], yy = y + offs[k + 2]; if (xx >= 0 && yy >= 0 && xx < w && yy < h && mask[i + offs[k]]) { out[i] = 1; break; } }
    } else {
      if (!mask[i]) continue; out[i] = 1;
      for (let k = 0; k < offs.length; k += 3) { const xx = x + offs[k + 1], yy = y + offs[k + 2]; if (xx < 0 || yy < 0 || xx >= w || yy >= h || !mask[i + offs[k]]) { out[i] = 0; break; } }
    }
  }
  return out;
}

/** Fast distance-based grow for big radii: chamfer distance transform. */
export function distanceOutside(mask, w, h) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : INF;
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; let v = d[i]; if (x > 0) v = Math.min(v, d[i - 1] + a); if (y > 0) { v = Math.min(v, d[i - w] + a); if (x > 0) v = Math.min(v, d[i - w - 1] + b); if (x < w - 1) v = Math.min(v, d[i - w + 1] + b); } d[i] = v; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; let v = d[i]; if (x < w - 1) v = Math.min(v, d[i + 1] + a); if (y < h - 1) { v = Math.min(v, d[i + w] + a); if (x < w - 1) v = Math.min(v, d[i + w + 1] + b); if (x > 0) v = Math.min(v, d[i + w - 1] + b); } d[i] = v; }
  return d;
}
export function grow(mask, w, h, r) { const d = distanceOutside(mask, w, h), o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = d[i] <= r ? 1 : 0; return o; }
export function shrink(mask, w, h, r) { const inv = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inv[i] = mask[i] ? 0 : 1; const g = grow(inv, w, h, r); const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = g[i] ? 0 : 1; return o; }

/** Signed volume (mm³): positive when every face points outwards. */
export function volume(tris) {
  let v = 0;
  for (let i = 0; i < tris.length; i += 9) {
    const ax = tris[i], ay = tris[i + 1], az = tris[i + 2], bx = tris[i + 3], by = tris[i + 4], bz = tris[i + 5], cx = tris[i + 6], cy = tris[i + 7], cz = tris[i + 8];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

/** Flips every triangle (turns a mesh inside out). */
export function flip(tris) {
  const o = tris.slice();
  for (let i = 0; i < o.length; i += 9) for (let k = 0; k < 3; k++) { const a = o[i + 3 + k]; o[i + 3 + k] = o[i + 6 + k]; o[i + 6 + k] = a; }
  return o;
}
/** Makes sure the faces point outwards (positive volume). */
export const outward = (tris) => (volume(tris) < 0 ? flip(tris) : tris);

/**
 * Solid of revolution around the z axis from a closed profile [[r, z], ...] (r > 0, any winding), `n` segments.
 * `rOf(r, z, angle)` may reshape each point (ripples, polygons, twist) as long as rings stay simple.
 */
export function revolve(profile, n = 96, rOf) {
  const t = new Tris(), m = profile.length, P = (k, i) => {
    const [r0, z] = profile[k], a = (i % n) / n * Math.PI * 2, r = rOf ? rOf(r0, z, a, k) : r0;
    return [r * Math.cos(a), r * Math.sin(a), z];
  };
  for (let k = 0; k < m; k++) { const k2 = (k + 1) % m; for (let i = 0; i < n; i++) t.quad(P(k, i), P(k2, i), P(k2, i + 1), P(k, i + 1)); }
  return outward(t.done());
}

/**
 * A thick sheet between an inner and an outer surface sampled on a nu × nv grid.
 * inner(i, j) / outer(i, j) return [x, y, z]. closedU joins column nu-1 back to column 0 (cylinders, spheres).
 * poleEnd: the last row (j = nv-1) collapses to one point on each surface (sphere tops).
 */
export function sheet(nu, nv, inner, outer, { closedU = false, poleEnd = false } = {}) {
  const t = new Tris(Math.max(4096, nu * nv * 4.4));
  const I = [], O = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { I.push(inner(i, j)); O.push(outer(i, j)); }
  const at = (A, i, j) => A[j * nu + ((i + nu) % nu)];
  const cu = closedU ? nu : nu - 1, lastRow = poleEnd ? nv - 2 : nv - 1;
  for (let j = 0; j < lastRow; j++) for (let i = 0; i < cu; i++) {
    t.quad(at(O, i, j), at(O, i + 1, j), at(O, i + 1, j + 1), at(O, i, j + 1));
    t.quad(at(I, i, j), at(I, i, j + 1), at(I, i + 1, j + 1), at(I, i + 1, j));
  }
  if (poleEnd) {
    const j = nv - 2, po = at(O, 0, nv - 1), pi = at(I, 0, nv - 1);
    for (let i = 0; i < cu; i++) {
      const a = at(O, i, j), b = at(O, i + 1, j); t.tri(a[0], a[1], a[2], b[0], b[1], b[2], po[0], po[1], po[2]);
      const c = at(I, i, j), d = at(I, i + 1, j); t.tri(c[0], c[1], c[2], pi[0], pi[1], pi[2], d[0], d[1], d[2]);
    }
  }
  // rims: bottom row, top row (unless a pole), and the two side columns of an open sheet
  for (let i = 0; i < cu; i++) {
    t.quad(at(I, i, 0), at(I, i + 1, 0), at(O, i + 1, 0), at(O, i, 0));
    if (!poleEnd) t.quad(at(O, i, nv - 1), at(O, i + 1, nv - 1), at(I, i + 1, nv - 1), at(I, i, nv - 1));
  }
  if (!closedU) for (let j = 0; j < nv - 1; j++) {
    t.quad(at(O, 0, j), at(O, 0, j + 1), at(I, 0, j + 1), at(I, 0, j));
    t.quad(at(I, nu - 1, j), at(I, nu - 1, j + 1), at(O, nu - 1, j + 1), at(O, nu - 1, j));
  }
  return outward(t.done());
}
