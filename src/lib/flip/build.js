/* Flip Picture: two pictures in one print. Ridges run up the plate; the left face of every ridge carries picture A and
 * the right face picture B, so from the left you see A and from the right you see B (a lenticular print).
 *
 * The pictures arrive as colour classes, one per cell (cols = ridges across, rows up the plate, row 0 = top), with a
 * shared palette. Every colour becomes one part made of half-ridge prisms, plus a flat base plate and an optional
 * stand. Shared by the preview and the server build. Units: mm, z up. */
import { box, flip, Tris } from '@/lib/mesh/mesh.js';

/**
 * a, b: class per cell (cols × rows). p: { pitch, cell, base, margin, ridge (height), stand }. palette: hex colours.
 * Returns { parts: [{ name, color, tris }], size }.
 */
export function buildFlip(a, b, cols, rows, palette, p) {
  const P = p.pitch, dy = p.cell, hb = p.base, hr = p.ridge ?? P / 2, m = p.margin ?? 4;
  const W = cols * P, H = rows * dy, x0 = -W / 2, yTop = H / 2;
  const per = palette.map(() => new Tris(4096));
  // one half-ridge prism over rows [r0, r1): side 0 = left half (picture A), 1 = right half (picture B)
  const half = (t, c, side, r0, r1) => {
    const xl = x0 + c * P, xm = xl + P / 2, xr = xl + P, y1 = yTop - r0 * dy, y0 = yTop - r1 * dy, zb = hb, zt = hb + hr;
    const tri = side === 0 ? [[xl, zb], [xm, zb], [xm, zt]] : [[xm, zb], [xr, zb], [xm, zt]];
    const A = (k, y) => [tri[k][0], y, tri[k][1]];
    // the two ends (triangles), then the three sides
    t.tri(...A(0, y0), ...A(2, y0), ...A(1, y0));
    t.tri(...A(0, y1), ...A(1, y1), ...A(2, y1));
    t.quad(A(0, y0), A(1, y0), A(1, y1), A(0, y1));   // bottom
    t.quad(A(1, y0), A(2, y0), A(2, y1), A(1, y1));   // the side between
    t.quad(A(2, y0), A(0, y0), A(0, y1), A(2, y1));   // the sloped face
  };
  for (const [side, cls] of [[0, a], [1, b]]) for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const k = cls[r * cols + c]; let e = r + 1;
      while (e < rows && cls[e * cols + c] === k) e++;
      half(per[k], c, side, r, e); r = e;
    }
  }
  const parts = palette.map((color, k) => ({ name: `colour-${k + 1}`, color, tris: flip(per[k].done()) })).filter((q) => q.tris.length);   // the prisms above wind inwards
  // the plate under the ridges, with a flat border, in the first (darkest) colour
  const bt = new Tris(64); box(bt, x0 - m, -yTop - m, 0, -x0 + m, yTop + m, hb + 0.01);
  parts.unshift({ name: 'plate', color: p.plateColor ?? palette[0], tris: bt.done() });
  if (p.stand) {
    // a foot with a slot that holds the plate upright (separate print)
    const st = new Tris(256), L = W + 2 * m, g = hb + 0.35, foot = 28, wall = 4, rail = 10, oy = -yTop - m - 45;
    box(st, -L / 2, oy - foot / 2, 0, L / 2, oy + foot / 2, 4);
    box(st, -L / 2, oy - g / 2 - wall, 3.99, L / 2, oy - g / 2, 4 + rail);
    box(st, -L / 2, oy + g / 2, 3.99, L / 2, oy + g / 2 + wall, 4 + rail);
    parts.push({ name: 'stand', color: p.plateColor ?? palette[0], tris: st.done() });
  }
  return { parts, size: [W + 2 * m, H + 2 * m, hb + hr] };
}

/**
 * Colour classes from pictures: n colours shared by both (k-means on the cells of both, seeded the same way every
 * time), ordered dark to light. px: RGB cells (cols × rows × 3) of each picture. Returns { a, b, palette }.
 */
export function flipClasses(pxA, pxB, cells, nWanted) {
  let n = nWanted;
  const all = new Float32Array(cells * 2 * 3); all.set(pxA, 0); all.set(pxB, cells * 3);
  const N = cells * 2, lum = (i) => 0.299 * all[i * 3] + 0.587 * all[i * 3 + 1] + 0.114 * all[i * 3 + 2];
  // start from the darkest cell, then each time the cell furthest from the colours picked so far (the same every time)
  const d2 = (i, c) => (all[i * 3] - c[0]) ** 2 + (all[i * 3 + 1] - c[1]) ** 2 + (all[i * 3 + 2] - c[2]) ** 2;
  let dark = 0; for (let i = 1; i < N; i++) if (lum(i) < lum(dark)) dark = i;
  let cent = [[all[dark * 3], all[dark * 3 + 1], all[dark * 3 + 2]]];
  const near = new Float32Array(N).fill(Infinity);
  while (cent.length < n) {
    let far = -1, fd = -1;
    for (let i = 0; i < N; i++) { near[i] = Math.min(near[i], d2(i, cent[cent.length - 1])); if (near[i] > fd) { fd = near[i]; far = i; } }
    if (fd < 400) break;   // fewer clearly different colours than asked for
    cent.push([all[far * 3], all[far * 3 + 1], all[far * 3 + 2]]);
  }
  n = cent.length;
  const lab = new Uint8Array(N);
  for (let it = 0; it < 12; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < N; i++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < n; k++) { const d = (all[i * 3] - cent[k][0]) ** 2 + (all[i * 3 + 1] - cent[k][1]) ** 2 + (all[i * 3 + 2] - cent[k][2]) ** 2; if (d < bd) { bd = d; best = k; } }
      lab[i] = best; const s = sum[best]; s[0] += all[i * 3]; s[1] += all[i * 3 + 1]; s[2] += all[i * 3 + 2]; s[3]++;
    }
    cent = cent.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
  }
  const rank = cent.map((c, k) => [0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], k]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const to = new Uint8Array(n); rank.forEach((k, i) => { to[k] = i; });
  const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  return { a: lab.slice(0, cells).map((k) => to[k]), b: lab.slice(cells).map((k) => to[k]), palette: rank.map((k) => hex(cent[k])) };
}
