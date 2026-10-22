/* Cookie cutters, matching stamps and rangoli stencils from pixel masks. Shared by the preview and the server.
 * Masks are row 0 = top, `px` pixels per mm. Units: mm. */
import { Tris, extrude, maskPolys, grow, shrink, transform, outward, revolve } from '@/lib/mesh/mesh.js';

export const MODES = ['cutter', 'stamp', 'stencil'];
/** Pixels per mm for a design whose longest side is `size` mm. */
export const pxFor = (size) => Math.max(3, Math.min(6, Math.floor(1100 / size)));

const and = (a, b) => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] && b[i] ? 1 : 0; return o; };
const andNot = (a, b) => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] && !b[i] ? 1 : 0; return o; };

/** Labels 4-connected pieces; returns { count, lab, big, largest() }. */
export function pieces(m, w, h) {
  const lab = new Int32Array(w * h), sizes = [0]; let n = 0; const st = [];
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s]) continue;
    n++; let c = 0; lab[s] = n; st.push(s);
    while (st.length) { const i = st.pop(); c++; const x = i % w; for (const j of [i - 1, i + 1, i - w, i + w]) { if (j < 0 || j >= w * h || (j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue; if (m[j] && !lab[j]) { lab[j] = n; st.push(j); } } }
    sizes.push(c);
  }
  let big = 0; for (let k = 1; k <= n; k++) if (sizes[k] > sizes[big]) big = k;
  return { count: n, lab, big, sizes, largest: () => { const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = lab[i] === big ? 1 : 0; return o; } };
}

/**
 * Ties every loose island to the main piece with a thin straight-ish bridge (the shortest way across the gap),
 * so a stencil prints as one piece and keeps every part of the design.
 */
export function joinIslands(plate0, w, h, widthPx, minPx = 4) {
  // specks too small to print are dropped instead of bridged
  let plate = plate0, pc = pieces(plate, w, h);
  if (pc.count < 2) return plate;
  if (pc.sizes.some((n, k) => k && k !== pc.big && n < minPx)) { plate = plate.slice(); for (let i = 0; i < w * h; i++) { const k = pc.lab[i]; if (k && k !== pc.big && pc.sizes[k] < minPx) plate[i] = 0; } pc = pieces(plate, w, h); if (pc.count < 2) return plate; }
  const { lab, big } = pc, dist = new Int32Array(w * h).fill(-1), par = new Int32Array(w * h).fill(-1), q = new Int32Array(w * h);
  let qh = 0, qt = 0;
  for (let i = 0; i < w * h; i++) if (lab[i] === big) { dist[i] = 0; q[qt++] = i; }
  const nb = [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1];
  while (qh < qt) {
    const i = q[qh++], x = i % w;
    for (let k = 0; k < 8; k++) {
      const j = i + nb[k]; if (j < 0 || j >= w * h) continue;
      const xj = j % w; if (Math.abs(xj - x) > 1) continue;
      if (dist[j] >= 0) continue;
      dist[j] = dist[i] + 1; par[j] = i; q[qt++] = j;   // spreads everywhere, so islands nested inside other islands are reached too
    }
  }
  // for each island, its pixel closest to the main piece
  const bestAt = new Int32Array(pc.count + 1).fill(-1);
  for (let i = 0; i < w * h; i++) { const k = lab[i]; if (k && k !== big && dist[i] >= 0 && (bestAt[k] < 0 || dist[i] < dist[bestAt[k]])) bestAt[k] = i; }
  const path = new Uint8Array(w * h);
  for (let k = 1; k <= pc.count; k++) { let i = bestAt[k]; if (k === big || i < 0) continue; while (i >= 0 && lab[i] !== big) { path[i] = 1; i = par[i]; } }
  const fat = grow(path, w, h, Math.max(1, widthPx / 2));
  const out = plate.slice(); for (let i = 0; i < w * h; i++) if (fat[i]) out[i] = 1;
  return out;
}

/**
 * shape: filled outline mask, detail: inner line mask (or null), both w × h at px px/mm (with room for the walls around).
 * p: { mode, height, wall, edge, flange, flangeT, plateT, reliefT, clearance, handle, stencilT, rim, islands: 'keep'|'remove'|'join', bridge }
 */
export function buildCookie(p, shape, detail, w, h, px) {
  const mm = 1 / px, R = (v) => Math.max(1, Math.round(v * px)), out = [];
  if (p.mode === 'cutter') {
    const edgeH = Math.min(3, p.height * 0.3);
    const wall = andNot(grow(shape, w, h, R(p.wall)), shape), edge = andNot(grow(shape, w, h, R(p.edge)), shape);
    const flange = andNot(grow(shape, w, h, R(p.wall + p.flange)), shape);
    const t = new Tris();
    extrude(t, maskPolys(flange, w, h, mm, 0.02, 1), 0, p.flangeT);
    extrude(t, maskPolys(wall, w, h, mm, 0.02, 1), p.flangeT, p.height - edgeH);
    extrude(t, maskPolys(edge, w, h, mm, 0.02, 1), p.height - edgeH, p.height);
    out.push({ file: 'cutter', label: 'Cutter', tris: t.done() });
    if (detail && p.stampToo) out.push(...stamp(p, shape, detail, w, h, px, true));
  } else if (p.mode === 'stamp') {
    out.push(...stamp(p, shape, detail, w, h, px, false));
  } else {
    // stencil: the plate with the design cut out; `shape` is the plate outline, `detail` what is cut away
    let plate = andNot(shape, detail ?? new Uint8Array(w * h));
    if (p.rim > 0) { const inner = shrink(shape, w, h, R(p.rim)); for (let i = 0; i < w * h; i++) if (shape[i] && !inner[i]) plate[i] = 1; }
    const pc = pieces(plate, w, h);
    if (p.islands === 'remove' && pc.count > 1) plate = pc.largest();
    if (p.islands === 'join' && pc.count > 1) plate = joinIslands(plate, w, h, Math.round(p.bridge * px), Math.round(0.8 * px * 0.8 * px));
    const t = new Tris(); extrude(t, maskPolys(plate, w, h, mm, 0.02, 1), 0, p.stencilT);
    out.push({ file: 'stencil', label: 'Stencil', tris: t.done(), pieces: pc.count });
  }
  return out;
}

/** A stamp that fits inside the cutter: a plate, the raised (mirrored) details, and a knob to hold. */
function stamp(p, shape, detail, w, h, px, inCutter) {
  const mm = 1 / px, R = (v) => Math.max(1, Math.round(v * px));
  const plate = inCutter ? shrink(shape, w, h, R(p.clearance)) : shape;
  const lines = detail ? and(detail, shrink(plate, w, h, R(0.6))) : new Uint8Array(w * h);
  const mirror = (tris) => outward(transform(tris, ([x, y, z]) => [-x, y, z]));
  const t = new Tris(); extrude(t, maskPolys(plate, w, h, mm, 0.02, 1), 0, p.plateT);
  const parts = [];
  // the details face down when pressing, so they are mirrored and sit on top of the plate as printed
  const r = new Tris(); extrude(r, maskPolys(lines, w, h, mm, 0.02, 1), p.plateT, p.plateT + p.reliefT);
  parts.push({ file: 'stamp', label: 'Stamp', tris: mirror(t.done()) });
  if (r.n) parts.push({ file: 'stamp_details', label: 'Stamp details', tris: mirror(r.done()) });
  if (p.handle) {
    // a knob printed separately and glued to the smooth back of the stamp
    parts.push({ file: 'stamp_handle', label: 'Handle', tris: revolve([[0.01, 0], [9, 0], [9, 2], [5, 4], [5, 14], [9, 18], [9, 22], [0.01, 22]], 64), offset: [0, 0, -24] });
  }
  return parts;
}

/** Fills enclosed gaps so an outline becomes one solid shape. */
export function fillHoles(m, w, h) {
  const seen = new Uint8Array(w * h), st = [];
  const push = (i) => { if (!seen[i] && !m[i]) { seen[i] = 1; st.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
  const out = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) out[i] = m[i] || !seen[i] ? 1 : 0; return out;
}
export { grow, shrink };
