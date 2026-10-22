/* Lithophanes: a brightness grid becomes a thickness map (dark = thick) on a flat, curved, cylinder, heart or moon shape.
 * Shared by the browser preview and the server build, so both make exactly the same files. Units: mm. */
import { Tris, heightField, sheet, revolve, extrude, transform, shrink, outward } from '@/lib/mesh/mesh.js';

export const SHAPES = ['flat', 'curved', 'cylinder', 'heart', 'moon'];
export const RATIOS = { '4:3': 4 / 3, '3:2': 3 / 2, '16:9': 16 / 9, '1:1': 1, '3:4': 3 / 4, '2:3': 2 / 3, '9:16': 9 / 16 };
const MAX_SAMPLES = 200_000;

/** Picture area in mm and the sample grid for these settings. The server checks the browser used the same grid. */
export function gridFor(p) {
  let wmm, hmm;
  if (p.shape === 'cylinder') { wmm = Math.PI * p.diameter; hmm = p.height; }
  else if (p.shape === 'moon') { wmm = Math.PI * p.diameter; hmm = wmm / 2; }
  else { const r = p.shape === 'heart' ? 1.08 : RATIOS[p.ratio] ?? 4 / 3; wmm = p.width; hmm = p.width / r; }
  let pitch = p.detail === 'fine' ? 0.3 : 0.4;
  const n = (pp) => (Math.round(wmm / pp) + 1) * (Math.round(hmm / pp) + 1);
  while (n(pitch) > MAX_SAMPLES) pitch += 0.02;
  pitch = +pitch.toFixed(2);
  return { w: Math.round(wmm / pitch) + (p.shape === 'cylinder' || p.shape === 'moon' ? 0 : 1), h: Math.round(hmm / pitch) + 1, pitch, wmm, hmm };
}

const thick = (p, g) => p.minT + (1 - g / 255) * (p.maxT - p.minT);

/** Heart outline test in a unit box (x, y from -1 to 1, y up). */
function inHeart(x, y) {
  const X = x * 1.18, Y = (y + 0.12) * 1.25;
  return (X * X + Y * Y - 1) ** 3 - X * X * Y * Y * Y <= 0;
}

/** Returns { parts: [{ file, tris, label }], size: [x, y, z] } for these settings and grid. */
export function buildLitho(p, gray, G) {
  const parts = [];
  const { w, h, pitch } = G;
  const T = (i, j) => thick(p, gray[j * w + i]);
  const bpx = Math.round(p.border / pitch);

  if (p.shape === 'flat' || p.shape === 'heart') {
    const W = w + 2 * bpx, H = h + 2 * bpx, hg = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const ii = i - bpx, jj = j - bpx;
      hg[j * W + i] = ii >= 0 && jj >= 0 && ii < w && jj < h ? T(ii, jj) : p.maxT;
    }
    let keep;
    if (p.shape === 'heart') {
      const cw = W - 1, ch = H - 1, inside = new Uint8Array(W * H);
      keep = new Uint8Array(cw * ch);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) keep[j * cw + i] = inHeart(((i + 0.5) / cw) * 2 - 1, 1 - ((j + 0.5) / ch) * 2) ? 1 : 0;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) inside[j * W + i] = inHeart((i / (W - 1)) * 2 - 1, 1 - (j / (H - 1)) * 2) ? 1 : 0;
      const core = shrink(inside, W, H, Math.max(1, bpx));
      for (let k = 0; k < W * H; k++) if (!core[k]) hg[k] = p.maxT;
    }
    // stood upright: picture facing -y (towards you), bottom edge on z = 0
    const hh = ((H - 1) * pitch) / 2;
    const panel = transform(heightField(hg, W, H, pitch, keep), ([x, y, z]) => [x, -z, y + hh]);
    parts.push({ file: p.shape, label: 'Lithophane', tris: panel, offset: p.stand ? [0, 0, STAND_SLOT_Z] : undefined });
    if (p.stand) parts.push({ file: 'stand', label: 'Stand', tris: slotStand(Math.max(40, (W - 1) * pitch * 0.55), p.maxT), offset: [0, -p.maxT / 2, 0] });
    return { parts, size: [(W - 1) * pitch, p.maxT, (H - 1) * pitch] };
  }

  if (p.shape === 'curved') {
    const nu = w + 2 * bpx, nv = h + 2 * bpx, arcLen = (nu - 1) * pitch, th = (p.angle * Math.PI) / 180, R = arcLen / th;
    const tAt = (i, j) => { const ii = i - bpx, jj = j - bpx; return ii >= 0 && jj >= 0 && ii < w && jj < h ? T(ii, jj) : p.maxT; };
    const pos = (i, j, r) => { const f = -th / 2 + (i / (nu - 1)) * th, z = (nv - 1 - j) * pitch; return [r * Math.sin(f), -r * Math.cos(f) + R, z]; };
    const tris = sheet(nu, nv, (i, j) => pos(i, j, R), (i, j) => pos(i, j, R + tAt(i, j)));
    parts.push({ file: 'curved', label: 'Lithophane', tris });
    return { parts, size: [2 * (R + p.maxT) * Math.sin(Math.min(th, Math.PI) / 2), 0, (nv - 1) * pitch] };
  }

  if (p.shape === 'cylinder') {
    const rim = Math.max(1, bpx), nu = w, nv = h + 2 * rim, R = p.diameter / 2 - p.maxT;
    const tAt = (i, j) => { const jj = j - rim; return jj >= 0 && jj < h ? T(i, jj) : p.maxT; };
    const pos = (i, j, r) => { const f = (i / nu) * Math.PI * 2; return [r * Math.sin(f), -r * Math.cos(f), (nv - 1 - j) * pitch]; };
    const tris = sheet(nu, nv, (i, j) => pos(i, j, R), (i, j) => pos(i, j, R + tAt(i, j)), { closedU: true });
    parts.push({ file: 'cylinder', label: 'Lithophane', tris });
    if (p.stand) {
      // round lamp base: the lithophane stands on a shelf inside a low lip; a tea light or LED puck sits underneath
      const Ri = R - 4, Rs = R + p.maxT + 0.4, Ro = Rs + 2.4;
      parts.push({ file: 'lamp_base', label: 'Lamp base', tris: revolve([[Ri, 0], [Ro, 0], [Ro, 14], [Rs, 14], [Rs, 10], [Ri, 10]], 144), offset: [0, 0, -10] });
    }
    return { parts, size: [p.diameter, p.diameter, (nv - 1) * pitch] };
  }

  // moon: the picture wraps a sphere, longitude across, with an opening at the bottom for the light
  const nu = w, Rs = p.diameter / 2 - p.maxT, hole = Math.min(25, Rs * 0.45), th0 = Math.asin(hole / Rs);
  const rows = h, nv = rows + 1;   // the last row is the top pole
  let poleT = 0; for (let i = 0; i < w; i++) poleT += T(i, 0); poleT /= w;
  const pt = (i, j, out) => {
    if (j === nv - 1) return [0, 0, Rs + (out ? poleT : 0)];
    const jj = rows - 1 - j;                                    // image row: 0 = top
    const th = th0 + (j / (nv - 1)) * (Math.PI - th0), f = (i / nu) * Math.PI * 2, r = Rs + (out ? T(i, Math.min(rows - 1, jj)) : 0);
    return [r * Math.sin(th) * Math.sin(f), -r * Math.sin(th) * Math.cos(f), -r * Math.cos(th)];
  };
  parts.push({ file: 'moon', label: 'Lithophane', tris: sheet(nu, nv, (i, j) => pt(i, j, false), (i, j) => pt(i, j, true), { closedU: true, poleEnd: true }) });
  if (p.stand) {
    const ring = Rs * Math.sin(th0), Rc = ring - 0.4, Rb = ring + 16, zc = -Rs * Math.cos(th0);
    parts.push({ file: 'stand', label: 'Stand', tris: revolve([[Rc - 2.4, 0], [Rb, 0], [Rb, 5], [Rc, 9], [Rc, 15], [Rc - 2.4, 15]], 144), offset: [0, 0, zc - 9] });
  }
  return { parts, size: [p.diameter, p.diameter, p.diameter] };
}

const STAND_SLOT_Z = 5;
/** A small slotted stand for flat lithophanes (slot floor at STAND_SLOT_Z). */
function slotStand(len, t) {
  const s = t + 0.5, d = 22, hgt = 12, slot = 7, c = d / 2;
  const prof = [[0, 0], [d, 0], [d, 4], [c + s / 2 + 3, hgt], [c + s / 2, hgt], [c + s / 2, hgt - slot], [c - s / 2, hgt - slot], [c - s / 2, hgt], [c - s / 2 - 3, hgt], [0, 4]];
  const tt = new Tris(); extrude(tt, [{ outer: prof, holes: [] }], -len / 2, len / 2);
  // profile drawn in (y, z), extruded along x
  return outward(transform(tt.done(), ([a, b, z]) => [z, a - c, b]));
}
