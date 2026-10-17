/* Shadow-lamp engine, part 2: printable meshes. Server only - this is what a customer pays for. */
import 'server-only';
import earcut from 'earcut';
import { deflateRawSync } from 'node:zlib';
import { analyse, plateArt, PAD, gaussBlur, dilate } from './raster.js';

/* ---------- contour (marching squares) ---------- */
function contours(R, mask, def, p) {
  const { w, h, ns, nv, res } = R;
  const blur = gaussBlur(Float32Array.from(mask), w, h, 0.8);
  const g = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    // signed distance (in nodes) to the panel rectangle, positive inside
    const dx = Math.min(i - (PAD - 0.5), (PAD + ns - 0.5) - i), dy = Math.min(j - (PAD - 0.5), (PAD + nv - 0.5) - j);
    const c = Math.max(-0.5, Math.min(0.5, 0.5 * Math.min(dx, dy)));
    g[j * w + i] = Math.min(blur[j * w + i] - 0.5, c);
  }
  const X = (i) => -def.Lo / 2 + (i - PAD + 0.5) * res, Y = (j) => p.V0 + (j - PAD + 0.5) * res;
  // each segment joins two grid-edge crossings; key = edge id
  const next = new Map(), pts = new Map();
  const hKey = (i, j) => (j * w + i) * 2, vKey = (i, j) => (j * w + i) * 2 + 1;
  const hPt = (i, j) => { const a = g[j * w + i], b = g[j * w + i + 1], t = a / (a - b); return [X(i) + t * res, Y(j)]; };
  const vPt = (i, j) => { const a = g[j * w + i], b = g[(j + 1) * w + i], t = a / (a - b); return [X(i), Y(j) + t * res]; };
  const add = (ka, pa, kb, pb) => { next.set(ka, kb); pts.set(ka, pa); pts.set(kb, pb); };
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = g[j * w + i] > 0, b = g[j * w + i + 1] > 0, c = g[(j + 1) * w + i + 1] > 0, d = g[(j + 1) * w + i] > 0;
    const code = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const B = () => [hKey(i, j), hPt(i, j)], Rr = () => [vKey(i + 1, j), vPt(i + 1, j)];
    const Tt = () => [hKey(i, j + 1), hPt(i, j + 1)], Ll = () => [vKey(i, j), vPt(i, j)];
    // segments are directed so that the solid lies on the left
    const seg = (from, to) => add(from[0], from[1], to[0], to[1]);
    switch (code) {
      case 1: seg(B(), Ll()); break;
      case 2: seg(Rr(), B()); break;
      case 3: seg(Rr(), Ll()); break;
      case 4: seg(Tt(), Rr()); break;
      case 6: seg(Tt(), B()); break;
      case 7: seg(Tt(), Ll()); break;
      case 8: seg(Ll(), Tt()); break;
      case 9: seg(B(), Tt()); break;
      case 11: seg(Rr(), Tt()); break;
      case 12: seg(Ll(), Rr()); break;
      case 13: seg(B(), Rr()); break;
      case 14: seg(Ll(), B()); break;
      case 5: case 10: {
        const centre = (g[j * w + i] + g[j * w + i + 1] + g[(j + 1) * w + i + 1] + g[(j + 1) * w + i]) / 4 > 0;
        if (code === 5) { if (centre) { seg(B(), Rr()); seg(Tt(), Ll()); } else { seg(B(), Ll()); seg(Tt(), Rr()); } }
        else { if (centre) { seg(Rr(), Tt()); seg(Ll(), B()); } else { seg(Rr(), B()); seg(Ll(), Tt()); } }
        break;
      }
    }
  }
  const loops = [], seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let k = start, guard = 0;
    while (k !== undefined && !seen.has(k) && guard++ < 5e6) { seen.add(k); loop.push(pts.get(k)); k = next.get(k); }
    if (k === start && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function area(loop) { let a = 0; for (let i = 0, n = loop.length; i < n; i++) { const p = loop[i], q = loop[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function inside(pt, loop) {
  let c = false;
  for (let i = 0, n = loop.length, j = n - 1; i < n; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// Douglas-Peucker on a closed loop
function simplify(loop, tol) {
  const n = loop.length; if (n < 8 || tol <= 0) return loop;
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) { const d = (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const keep = new Uint8Array(n); keep[0] = keep[far] = 1;
  const run = (a, b) => {
    const stack = [[a, b]];
    while (stack.length) {
      const [i0, i1] = stack.pop();
      const A = loop[i0 % n], Bp = loop[i1 % n], dx = Bp[0] - A[0], dy = Bp[1] - A[1], len = Math.hypot(dx, dy) || 1e-12;
      let md = -1, mi = -1;
      for (let i = i0 + 1; i < i1; i++) { const P = loop[i % n], d = Math.abs((P[0] - A[0]) * dy - (P[1] - A[1]) * dx) / len; if (d > md) { md = d; mi = i; } }
      if (md > tol) { keep[mi % n] = 1; stack.push([i0, mi], [mi, i1]); }
    }
  };
  run(0, far); run(far, n);
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(loop[i]);
  return out.length >= 3 ? out : loop;
}

/* ---------- polygon assembly ---------- */
// Each vertex is [s, v, mode]; mode 0 = straight (band), 1 = follows the light cone.
function circle(cx, cy, r, n) { const o = []; for (let i = 0; i < n; i++) { const a = -2 * Math.PI * i / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a), 0]); } return o; }

function snapper(def, p) {
  const Lo = def.Lo / 2;
  // Points on the band top all share one height, which invites slivers between separate runs; give each its own.
  const lift = (s) => { const r = Math.abs(Math.sin(s * 127.1) * 43758.5453); return p.V1 + 0.004 + 0.012 * (r - Math.floor(r)); };
  return (q) => {
    const atEnd = Math.abs(q[0]) > Lo - 0.06, low = q[1] < p.V1 + 0.08;
    if (atEnd && low) return [Math.sign(q[0]) * Lo, p.V1, 1];            // the corner itself
    return [atEnd ? Math.sign(q[0]) * Lo : q[0], low ? lift(q[0]) : q[1], 1];
  };
}
function dedupe(ring) { return ring.filter((q, i) => { const r = ring[(i + 1) % ring.length]; return Math.abs(q[0] - r[0]) > 1e-9 || Math.abs(q[1] - r[1]) > 1e-9 || q[2] !== r[2]; }); }

// Polygons (outer ring + windows) of loose pieces, all on the light cone.
function piecePolygons(R, mask, def, p) {
  const snap = snapper(def, p);
  const loops = contours(R, mask, def, p).map((l) => simplify(l, p.simplify)).filter((l) => Math.abs(area(l)) > 0.05);
  const outers = loops.filter((l) => area(l) > 0), out = [];
  for (const o of outers) {
    const holes = loops.filter((l) => area(l) < 0 && inside(l[0], o)).map((l) => dedupe(l.map(snap))).filter((l) => l.length >= 3);
    out.push({ outer: dedupe(o.map(snap)), holes });
  }
  return out;
}

function panelPolygon(R, mask, def, p) {
  let loops = contours(R, mask, def, p).map((l) => simplify(l, p.simplify)).filter((l) => Math.abs(area(l)) > 0.05);
  let main = null, ma = 0;
  for (const l of loops) { const a = area(l); if (a > ma) { ma = a; main = l; } }
  if (!main) throw new Error('empty panel ' + def.id);
  const holes = [];
  for (const l of loops) {
    if (l === main || area(l) >= 0) continue;
    // keep windows that sit directly in the main body
    if (inside(l[0], main)) holes.push(l.map((q) => [q[0], q[1], 1]));
  }
  // cut the bottom edge off the main loop and splice the straight band in
  const n = main.length, lim = p.V0 + 0.35, hi = main.map((q) => q[1] > lim);
  let startUp = -1;
  for (let i = 0; i < n; i++) if (hi[i] && !hi[(i - 1 + n) % n]) { startUp = i; break; }
  const chain = [];
  if (startUp >= 0) for (let c = 0, i = startUp; c < n && hi[i]; c++, i = (i + 1) % n) chain.push(main[i]);
  // chain runs counter-clockwise: up the right end, across the picture, down the left end
  const Lo = def.Lo / 2, Lb = def.Lb / 2;
  const snap = snapper(def, p);
  for (let i = 0; i < holes.length; i++) holes[i] = dedupe(holes[i].map(snap));
  let outer = [];
  outer.push([-Lb, 0, 0]);
  if (def.cutouts && p.leftCutouts) {
    const [a, b, hh] = p.switchNotch;
    outer.push([a, 0, 0], [a, hh, 0], [b, hh, 0], [b, 0, 0]);
  }
  outer.push([Lb, 0, 0], [Lb, p.V0, 0], [Lo, p.V0, 1], [Lo, p.V1, 1]);
  for (const q of chain) outer.push(snap(q));
  outer.push([-Lo, p.V1, 1], [-Lo, p.V0, 1], [-Lb, p.V0, 0]);
  // drop repeats, but keep the deliberate straight/cone pair that sits on one spot at the band shelf
  outer = dedupe(outer);
  const realHoles = holes.filter((hh) => hh.length >= 3 && Math.abs(area(hh)) > 0.02);
  holes.length = 0; for (const hh of realHoles) holes.push(hh);
  // screw holes (straight)
  holes.push(circle(def.holeS, p.holeV, p.holeD / 2, 28), circle(-def.holeS, p.holeV, p.holeD / 2, 28));
  if (def.cutouts && p.leftCutouts) holes.push(circle(p.portHole[0], p.portHole[1], p.portHole[2] / 2, 48));
  return { outer, holes };
}

/* ---------- mesh ---------- */
// earcut silently skips vertices that sit on a straight run; put them back so caps and walls share every vertex.
function reinsertSkipped(tri0, ringLens, n, f) {
  // 1. flat triangles (three points on one line): hand the middle point to the neighbour across the long side
  const cr = (a, b, c) => (f[2 * b] - f[2 * a]) * (f[2 * c + 1] - f[2 * a + 1]) - (f[2 * c] - f[2 * a]) * (f[2 * b + 1] - f[2 * a + 1]);
  const same = (a, b) => Math.abs(f[2 * a] - f[2 * b]) < 1e-9 && Math.abs(f[2 * a + 1] - f[2 * b + 1]) < 1e-9;
  const T = Array.from(tri0), dead = new Uint8Array(T.length / 3 + 4 * n);
  const em = new Map();
  const reg = (t) => { for (let e = 0; e < 3; e++) em.set(T[t + e] * n + T[t + (e + 1) % 3], t); };
  const unreg = (t) => { for (let e = 0; e < 3; e++) { const key = T[t + e] * n + T[t + (e + 1) % 3]; if (em.get(key) === t) em.delete(key); } };
  for (let t = 0; t < T.length; t += 3) reg(t);
  const queue = []; for (let t = 0; t < T.length; t += 3) if (Math.abs(cr(T[t], T[t + 1], T[t + 2])) < 1e-10) queue.push(t);
  let guard = 0;
  while (queue.length && guard++ < 200000) {
    const t = queue.pop(); if (dead[t / 3]) continue;
    const v = [T[t], T[t + 1], T[t + 2]];
    if (Math.abs(cr(v[0], v[1], v[2])) >= 1e-10) continue;
    unreg(t); dead[t / 3] = 1;
    if (same(v[0], v[1]) || same(v[1], v[2]) || same(v[2], v[0])) continue;       // needle with a doubled point
    // middle vertex = the one between the other two
    let mi = 0, best = -1;
    for (let q = 0; q < 3; q++) { const a = v[(q + 1) % 3], c = v[(q + 2) % 3], d = (f[2 * a] - f[2 * c]) ** 2 + (f[2 * a + 1] - f[2 * c + 1]) ** 2; if (d > best) { best = d; mi = q; } }
    const m = v[mi], x = v[(mi + 1) % 3], y = v[(mi + 2) % 3];           // long side runs x -> y inside this triangle
    const nb = em.get(y * n + x);
    if (nb === undefined || dead[nb / 3]) continue;
    const apex = T[nb] !== x && T[nb] !== y ? T[nb] : T[nb + 1] !== x && T[nb + 1] !== y ? T[nb + 1] : T[nb + 2];
    unreg(nb);
    T[nb] = y; T[nb + 1] = m; T[nb + 2] = apex; reg(nb);
    const t2 = T.length; T.push(m, x, apex); reg(t2);
    queue.push(nb, t2);
  }
  const tri = [];
  for (let t = 0; t < T.length; t += 3) if (!dead[t / 3]) tri.push(T[t], T[t + 1], T[t + 2]);
  // 2. vertices that were skipped altogether: fan them into the triangle that spans their run
  const used = new Uint8Array(n); for (let i = 0; i < tri.length; i++) used[tri[i]] = 1;
  const emap = new Map();
  for (let t = 0; t < tri.length; t += 3) for (let e = 0; e < 3; e++) emap.set(tri[t + e] * n + tri[t + (e + 1) % 3], t);
  const out = Array.from(tri);
  let start = 0;
  for (const len of ringLens) {
    let s0 = -1; for (let i = 0; i < len; i++) if (used[start + i]) { s0 = i; break; }
    if (s0 >= 0) {
      let i = s0;
      do {
        let j = (i + 1) % len; const run = [];
        while (!used[start + j]) { run.push(start + j); j = (j + 1) % len; }
        if (run.length) {
          const a = start + i, c = start + j;
          let t = emap.get(a * n + c), fwd = true; if (t === undefined) { t = emap.get(c * n + a); fwd = false; }
          if (t !== undefined) {
            const apex = out[t] !== a && out[t] !== c ? out[t] : out[t + 1] !== a && out[t + 1] !== c ? out[t + 1] : out[t + 2];
            const chain = [a].concat(run, [c]);
            emap.delete(a * n + c); emap.delete(c * n + a);
            for (let q = 0; q < chain.length - 1; q++) {
              const u = fwd ? chain[q] : chain[q + 1], v = fwd ? chain[q + 1] : chain[q];
              let slot = t;
              if (q === 0) { out[t] = u; out[t + 1] = v; out[t + 2] = apex; } else { slot = out.length; out.push(u, v, apex); }
              emap.set(u * n + v, slot); emap.set(v * n + apex, slot); emap.set(apex * n + u, slot);
            }
          }
        }
        i = j;
      } while (i !== s0);
    }
    start += len;
  }
  return out;
}

// Loft a polygon from the outer face (t = 0) to the inner face (t = T); cone vertices shrink towards the light.
function loft(poly, def, p) {
  const k = (def.d - p.T) / def.d, H = p.apex, T = p.T;
  const inner = (q) => {
    if (!q[2]) return [q[0], q[1]];
    const gq = Math.max(0, Math.min(1, (q[1] - p.V0) / (p.V1 - p.V0)));
    return [k * q[0], q[1] + gq * (H - q[1]) * (1 - k)];
  };
  const tris = [];
  const push = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-20) return;          // zero-area
    tris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  const rings = [poly.outer].concat(poly.holes), ringLens = rings.map((r) => r.length);
  const flatO = [], flatI = [], holeIdx = [];
  let count = 0;
  for (let r = 0; r < rings.length; r++) {
    if (r > 0) holeIdx.push(count);
    for (const q of rings[r]) { const qi = inner(q); flatO.push(q[0], q[1]); flatI.push(qi[0], qi[1]); count++; }
  }
  const tO = reinsertSkipped(earcut(flatO, holeIdx, 2), ringLens, count, flatO), tI = reinsertSkipped(earcut(flatI, holeIdx, 2), ringLens, count, flatI);
  const PO = (i) => [flatO[2 * i], flatO[2 * i + 1], 0], PI = (i) => [flatI[2 * i], flatI[2 * i + 1], T];
  const cross = (f, a, b, c) => (f[2 * b] - f[2 * a]) * (f[2 * c + 1] - f[2 * a + 1]) - (f[2 * c] - f[2 * a]) * (f[2 * b + 1] - f[2 * a + 1]);
  for (let i = 0; i < tO.length; i += 3) {       // outer face looks down (-t)
    const a = tO[i], b = tO[i + 1], c = tO[i + 2];
    if (cross(flatO, a, b, c) > 0) push(PO(a), PO(c), PO(b)); else push(PO(a), PO(b), PO(c));
  }
  for (let i = 0; i < tI.length; i += 3) {       // inner face looks up (+t)
    const a = tI[i], b = tI[i + 1], c = tI[i + 2];
    if (cross(flatI, a, b, c) > 0) push(PI(a), PI(b), PI(c)); else push(PI(a), PI(c), PI(b));
  }
  let base = 0;
  for (const ring of rings) {
    const m = ring.length;
    for (let i = 0; i < m; i++) {
      const a = base + i, b = base + (i + 1) % m;
      push(PO(a), PO(b), PI(b));
      push(PO(a), PI(b), PI(a));
    }
    base += m;
  }
  return { tris, nVerts: count };
}

function ribShells(def, p) {
  const out = [];
  for (const sgn of [-1, 1]) {
    const x0 = sgn * def.ribS - p.ribW / 2, x1 = sgn * def.ribS + p.ribW / 2, y0 = 0, y1 = p.ribLen, z0 = p.T - 0.4, z1 = p.T + p.ribH;
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
    const a = []; for (const t of f) for (const i of t) a.push(c[i][0], c[i][1], c[i][2]);
    out.push(a);
  }
  return out;
}

// panel frame (s, v, t) <-> lamp frame (x, y, z)
function toLamp(def, p, q) {
  const s = q[0], v = q[1], t = q[2], z = p.ledge + v;
  switch (def.id) {
    case 'top': return [s, p.baseY - t, z];
    case 'bottom': return [-s, -p.baseY + t, z];
    case 'right': return [p.baseX - t, -s, z];
    default: return [-p.baseX + t, s, z];
  }
}
function fromLamp(def, p, q) {
  const x = q[0], y = q[1], v = q[2] - p.ledge;
  switch (def.id) {
    case 'top': return [x, v, p.baseY - y];
    case 'bottom': return [-x, v, y + p.baseY];
    case 'right': return [-y, v, p.baseX - x];
    default: return [y, v, x + p.baseX];
  }
}

export function stlBinary(tris, name) {
  const n = tris.length / 9, buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  const head = ('shadow lamp panel ' + (name || '')).slice(0, 79);
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


/* ---------- zip (deflate) ---------- */
let CRC = null;
function crc32(u8) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
}
export function zipFiles(files) {
  const parts = [], central = []; let off = 0;
  const now = new Date(), dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1),
    dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const name = new TextEncoder().encode(f.name), crc = crc32(f.data), comp = new Uint8Array(deflateRawSync(f.data, { level: 6 }));
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 8, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true); lh.setUint32(22, f.data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, comp);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 8, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, f.data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + comp.length;
  }
  let csize = 0; for (const c of central) csize += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  const all = parts.concat(central, [new Uint8Array(end.buffer)]);
  let total = 0; for (const a of all) total += a.length;
  const out = new Uint8Array(total); let o = 0; for (const a of all) { out.set(a, o); o += a.length; }
  return out;
}

/* ---------- walls ---------- */
export function generate(sampler, opts) {
  const res = analyse(sampler, opts), p = res.params, P = {};
  for (const q of res.panels) { P[q.def.id] = q; q.fins = []; }
  for (const q of res.panels) {
    const R = q.raster, def = q.def;
    q.poly = panelPolygon(R, R.own, def, p);
    const main = loft(q.poly, def, p);
    q.shells = [main.tris]; q.nVerts = main.nVerts;
    if (p.ribs) for (const r of ribShells(def, p)) q.shells.push(r);
    if (p.backing) {
      // loose pieces stand on their own, in place ...
      for (const isl of R.floating || []) {
        const m = new Uint8Array(R.w * R.h);
        for (let k = 0; k < m.length; k++) if (R.lab[k] === isl.l) m[k] = 1;
        for (const poly of piecePolygons(R, m, def, p)) q.shells.push(loft(poly, def, p).tris);
      }
      // ... and a thin clear sheet on the outer face holds them all. Print it in clear filament, then change colour.
      let top = p.V1;
      for (let j = R.nv - 1; j >= 0 && top === p.V1; j--) for (let i = 0; i < R.ns; i++) if (R.own[(j + PAD) * R.w + i + PAD]) { top = p.V0 + (j + 1) * R.res; break; }
      top = Math.min(p.Vmax, top + 1.5);
      const L = def.Lo / 2, sheet = { outer: [[-L, p.V0, 0], [L, p.V0, 0], [L, top, 0], [-L, top, 0]], holes: [] };
      q.shells.push(loft(sheet, def, Object.assign({}, p, { T: p.backingT })).tris);
      q.backingTop = top;
    }
  }
  for (const q of res.panels) {
    const R = q.raster, def = q.def;
    for (const isl of R.wrapped) {
      const m = new Uint8Array(R.w * R.h);
      for (let k = 0; k < m.length; k++) if (R.lab[k] === isl.l) m[k] = 1;
      const target = P[isl.wrapTo];
      for (const poly of piecePolygons(R, m, def, p)) {
        const t = loft(poly, def, p).tris, o = new Array(t.length);
        for (let i = 0; i < t.length; i += 3) { const v = fromLamp(target.def, p, toLamp(def, p, [t[i], t[i + 1], t[i + 2]])); o[i] = v[0]; o[i + 1] = v[1]; o[i + 2] = v[2]; }
        target.shells.push(o); target.fins.push({ from: def.id, height: (isl.i1 - isl.i0 + 1) * R.res });
      }
    }
  }
  return {
    params: p,
    panels: res.panels.map((q) => {
      let total = 0; for (const s of q.shells) total += s.length;
      const all = new Float32Array(total); let o = 0; for (const s of q.shells) { all.set(s, o); o += s.length; }
      return { def: q.def, raster: q.raster, poly: q.poly, fins: q.fins, backingTop: q.backingTop, mesh: { tris: all, nVerts: q.nVerts, shells: q.shells.length } };
    }),
  };
}

/* ---------- cover plate with a press-in inlay ---------- */
function maskPolygons(R, mask, def, pp, tol) {
  const loops = contours(R, mask, def, pp).map((l) => simplify(l, tol)).filter((l) => Math.abs(area(l)) > 0.05);
  const outers = loops.filter((l) => area(l) > 0).map((l) => ({ outer: l.map((q) => [q[0], q[1], 0]), raw: l, a: area(l), holes: [] }));
  for (const l of loops) {
    if (area(l) >= 0) continue;
    let best = null;
    for (const o of outers) if (inside(l[0], o.raw) && (!best || o.a < best.a)) best = o;
    if (best) best.holes.push(l.map((q) => [q[0], q[1], 0]));
  }
  return outers;
}
function capTris(out, rings, z, up) {
  const flat = [], holeIdx = [], lens = []; let count = 0;
  rings.forEach((r, ri) => { if (ri) holeIdx.push(count); lens.push(r.length); for (const v of r) { flat.push(v[0], v[1]); count++; } });
  const t = reinsertSkipped(earcut(flat, holeIdx, 2), lens, count, flat);
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i], b = t[i + 1], c = t[i + 2];
    const cr = (flat[2 * b] - flat[2 * a]) * (flat[2 * c + 1] - flat[2 * a + 1]) - (flat[2 * c] - flat[2 * a]) * (flat[2 * b + 1] - flat[2 * a + 1]);
    if (Math.abs(cr) < 1e-10) continue;
    const [p, q] = (cr > 0) === up ? [b, c] : [c, b];
    out.push(flat[2 * a], flat[2 * a + 1], z, flat[2 * p], flat[2 * p + 1], z, flat[2 * q], flat[2 * q + 1], z);
  }
}
function wallTris(out, ring, z0, z1, flip) {
  for (let i = 0, m = ring.length; i < m; i++) {
    const a = ring[i], b = ring[(i + 1) % m];
    if (Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12) continue;
    if (!flip) out.push(a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1, a[0], a[1], z0, b[0], b[1], z1, a[0], a[1], z1);
    else out.push(a[0], a[1], z0, b[0], b[1], z1, b[0], b[1], z0, a[0], a[1], z0, a[0], a[1], z1, b[0], b[1], z1);
  }
}
export function generatePlate(sampler, opts) {
  const A = plateArt(sampler, opts), { q, R, def, pp, art } = A, { w, h, res } = R;
  const recess = dilate(art, w, h, q.gap / res);
  const inlay = maskPolygons(R, art, def, pp, q.simplify);
  const lp = { T: q.depth, apex: 0, V0: 0, V1: 1 };
  const parts = inlay.map((poly) => loft(poly, def, lp).tris);
  let tot = 0; for (const s of parts) tot += s.length;
  const inlayTris = new Float32Array(tot); { let at = 0; for (const s of parts) { inlayTris.set(s, at); at += s.length; } }
  const rec = maskPolygons(R, recess, def, pp, q.simplify), zf = q.floor, zt = q.floor + q.depth, hx = q.W / 2, hy = q.H / 2;
  const rect = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]], circ = circle(0, 0, q.hole / 2, 72);
  const holes = []; for (const r of rec) for (const hh of r.holes) holes.push({ loop: hh, a: Math.abs(area(hh)), kids: [] });
  const roots = [];
  for (const r of rec) {
    let parent = null;
    for (const hh of holes) if (inside(r.raw[0], hh.loop) && r.a < hh.a && (!parent || hh.a < parent.a)) parent = hh;
    (parent ? parent.kids : roots).push(r.outer);
  }
  let holeHost = null;
  for (const hh of holes) if (inside(circ[0], hh.loop) && (!holeHost || hh.a < holeHost.a)) holeHost = hh;
  const pt = [];
  capTris(pt, [rect, circ], 0, false);
  capTris(pt, [rect].concat(holeHost ? [] : [circ], roots), zt, true);
  for (const hh of holes) capTris(pt, [hh.loop].concat(hh === holeHost ? [circ] : [], hh.kids), zt, true);
  for (const r of rec) capTris(pt, [r.outer].concat(r.holes), zf, true);
  wallTris(pt, rect, 0, zt, false); wallTris(pt, circ, 0, zt, false);
  for (const r of rec) { wallTris(pt, r.outer, zf, zt, true); for (const hh of r.holes) wallTris(pt, hh, zf, zt, true); }
  return { params: q, plateTris: new Float32Array(pt), inlayTris, pieces: inlay.length, areaMm2: A.areaMm2 };
}
