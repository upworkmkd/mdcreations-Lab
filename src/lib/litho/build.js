/* Lithophanes: a brightness grid becomes a thickness map (dark = thick) on a flat, curved, cylinder, heart or moon shape.
 * Shared by the browser preview and the server build, so both make exactly the same files. Units: mm. */
import { Tris, heightField, sheet, revolve, extrude, transform, shrink, outward, cap } from '@/lib/mesh/mesh.js';

export const SHAPES = ['flat', 'curved', 'cylinder', 'heart', 'moon'];
export const RATIOS = { '4:3': 4 / 3, '3:2': 3 / 2, '16:9': 16 / 9, '1:1': 1, '3:4': 3 / 4, '2:3': 2 / 3, '9:16': 9 / 16 };
const MAX_SAMPLES = 200_000;

/** The bases each shape can have, the first being the default. Stands keep their own length (baseLen). */
export const BASES = {
  flat: ['slot', 'wide', 'led', 'none'],
  heart: ['slot', 'wide', 'led', 'none'],
  curved: ['arc', 'none'],
  cylinder: ['lamp', 'ring', 'none'],
  moon: ['stand', 'pedestal', 'none'],
};
export const BASE_LABEL = {
  slot: 'Slot stand', wide: 'Wide stand (steadier)', led: 'LED strip stand (light behind)', arc: 'Curved stand',
  lamp: 'Lamp base (tea light or LED puck inside)', ring: 'Ring foot', stand: 'Low stand', pedestal: 'Tall pedestal', none: 'No base',
};
export const BASE_LEN = { slot: 60, wide: 90, led: 110, arc: 70 };
/** The base for these settings (designs saved before base styles had only "stand": yes or no). */
export function baseOf(p) {
  const list = BASES[p.shape] ?? ['none'];
  if (p.base && list.includes(p.base)) return p.base;
  return p.stand === false ? 'none' : list[0];
}

/** Picture area in mm and the sample grid for these settings. The server checks the browser used the same grid. */
export function gridFor(p) {
  let wmm, hmm;
  if (p.shape === 'cylinder') { wmm = Math.PI * p.diameter; hmm = p.height; }
  else if (p.shape === 'moon') { wmm = Math.PI * p.diameter; hmm = wmm / 2; }
  else if (p.shape !== 'heart' && p.ratio === 'custom') { wmm = p.width; hmm = p.height; }   // width and height set separately
  else { const r = p.shape === 'heart' ? 1.08 : RATIOS[p.ratio] ?? 4 / 3; wmm = p.width; hmm = p.width / r; }
  // small pieces get a finer grid so they stay sharp; big ones keep the usual one so files stay a sensible size
  const [lo, hi, target] = p.detail === 'fine' ? [0.16, 0.3, 110_000] : [0.2, 0.4, 60_000];
  let pitch = Math.min(hi, Math.max(lo, Math.round(Math.sqrt((wmm * hmm) / target) * 50) / 50));
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
    const base = baseOf(p), st = base !== 'none' ? stand(base, p.maxT) : null;
    parts.push({ file: p.shape, label: 'Lithophane', tris: panel, offset: st ? [0, 0, st.floor] : undefined });
    if (st) parts.push({ file: 'stand', label: BASE_LABEL[base], tris: st.straight(p.baseLen || BASE_LEN[base]), offset: [0, -p.maxT / 2, 0] });
    return { parts, size: [(W - 1) * pitch, p.maxT, (H - 1) * pitch] };
  }

  if (p.shape === 'curved') {
    const nu = w + 2 * bpx, nv = h + 2 * bpx, arcLen = (nu - 1) * pitch, th = (p.angle * Math.PI) / 180, R = arcLen / th;
    const tAt = (i, j) => { const ii = i - bpx, jj = j - bpx; return ii >= 0 && jj >= 0 && ii < w && jj < h ? T(ii, jj) : p.maxT; };
    const pos = (i, j, r) => { const f = -th / 2 + (i / (nu - 1)) * th, z = (nv - 1 - j) * pitch; return [r * Math.sin(f), -r * Math.cos(f) + R, z]; };
    const tris = sheet(nu, nv, (i, j) => pos(i, j, R), (i, j) => pos(i, j, R + tAt(i, j)));
    const base = baseOf(p), st = base === 'arc' ? stand('slot', p.maxT) : null;
    parts.push({ file: 'curved', label: 'Lithophane', tris, offset: st ? [0, 0, st.floor] : undefined });
    if (st) parts.push({ file: 'stand', label: BASE_LABEL.arc, tris: st.arc(R + p.maxT / 2, p.baseLen || BASE_LEN.arc) });
    return { parts, size: [2 * (R + p.maxT) * Math.sin(Math.min(th, Math.PI) / 2), 0, (nv - 1) * pitch] };
  }

  if (p.shape === 'cylinder') {
    const rim = Math.max(1, bpx), nu = w, nv = h + 2 * rim, R = p.diameter / 2 - p.maxT;
    const tAt = (i, j) => { const jj = j - rim; return jj >= 0 && jj < h ? T(i, jj) : p.maxT; };
    const pos = (i, j, r) => { const f = (i / nu) * Math.PI * 2; return [r * Math.sin(f), -r * Math.cos(f), (nv - 1 - j) * pitch]; };
    const tris = sheet(nu, nv, (i, j) => pos(i, j, R), (i, j) => pos(i, j, R + tAt(i, j)), { closedU: true });
    parts.push({ file: 'cylinder', label: 'Lithophane', tris });
    const base = baseOf(p), Rs = R + p.maxT + 0.4, Ro = Rs + 2.4;
    if (base === 'lamp') {
      // round lamp base: the lithophane stands on a shelf inside a low lip; a tea light or LED puck sits underneath
      const Ri = R - 4;
      parts.push({ file: 'lamp_base', label: BASE_LABEL.lamp, tris: revolve([[Ri, 0], [Ro, 0], [Ro, 14], [Rs, 14], [Rs, 10], [Ri, 10]], 144), offset: [0, 0, -10] });
    }
    if (base === 'ring') {
      // a low ring foot: keeps the cylinder upright and round, light goes in from below
      const Ri = R - 2;
      parts.push({ file: 'ring_foot', label: BASE_LABEL.ring, tris: revolve([[Ri, 0], [Ro, 0], [Ro, 6], [Rs, 6], [Rs, 3], [Ri, 3]], 144), offset: [0, 0, -3] });
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
  const base = baseOf(p), ring = Rs * Math.sin(th0), Rc = ring - 0.4, zc = -Rs * Math.cos(th0);
  if (base === 'stand') {
    const Rb = ring + 16;
    parts.push({ file: 'stand', label: BASE_LABEL.stand, tris: revolve([[Rc - 2.4, 0], [Rb, 0], [Rb, 5], [Rc, 9], [Rc, 15], [Rc - 2.4, 15]], 144), offset: [0, 0, zc - 9] });
  }
  if (base === 'pedestal') {
    // a tall hollow column: the LED sits inside and lights the moon through the opening; wide foot for balance
    const Rb = Math.max(ring + 22, 34), Rn = Math.max(12, Math.min(ring - 2, ring * 0.6)), Ri = Rn - 2.4, top = 48;
    parts.push({ file: 'pedestal', label: BASE_LABEL.pedestal, tris: revolve([[Ri, 0], [Rb, 0], [Rb, 4], [Rn, 14], [Rn, top - 8], [Rc, top], [Rc, top + 6], [Rc - 2.4, top + 6], [Rc - 2.4, top], [Ri, top - 8]], 144), offset: [0, 0, zc - top] });
  }
  return { parts, size: [p.diameter, p.diameter, p.diameter] };
}

/**
 * Stands that hold a panel upright in a slot. Profile in (depth, height); the slot is centred on depth c.
 * straight(len): along x, for flat panels and hearts. arc(r, len): along an arc of radius r, for curved panels.
 * floor: height of the slot floor (the panel sits this high).
 */
function stand(kind, t) {
  const s = t + 0.5;
  let prof, c, floor;
  if (kind === 'wide') {
    const d = 44, h = 14, slot = 8; c = d / 2; floor = h - slot;
    prof = [[0, 0], [d, 0], [d, 5], [c + s / 2 + 5, h], [c + s / 2, h], [c + s / 2, floor], [c - s / 2, floor], [c - s / 2, h], [c - s / 2 - 5, h], [0, 5]];
  } else if (kind === 'led') {
    // slot near the front, and a 12 mm channel just behind it for a stick-on LED strip that shines through the picture
    const d = 50, h = 16, slot = 9, g = 12, gd = 7; c = 15; floor = h - slot;
    const g0 = c + s / 2 + 3;
    prof = [[0, 0], [d, 0], [d, 8], [g0 + g + 3, h], [g0 + g, h], [g0 + g, h - gd], [g0, h - gd], [g0, h], [c + s / 2, h], [c + s / 2, floor], [c - s / 2, floor], [c - s / 2, h], [c - s / 2 - 4, h], [0, 6]];
  } else {
    const d = 22, h = 12, slot = 7; c = d / 2; floor = h - slot;
    prof = [[0, 0], [d, 0], [d, 4], [c + s / 2 + 3, h], [c + s / 2, h], [c + s / 2, floor], [c - s / 2, floor], [c - s / 2, h], [c - s / 2 - 3, h], [0, 4]];
  }
  return {
    floor,
    straight(len) {
      const tt = new Tris(); extrude(tt, [{ outer: prof, holes: [] }], -len / 2, len / 2);
      return outward(transform(tt.done(), ([a, b, z]) => [z, a - c, b]));   // profile drawn in (y, z), extruded along x
    },
    // swept along an arc of radius r centred on (0, r); depth goes towards the centre of the curve, like the panel's back
    arc(r, len) {
      const half = Math.min(Math.PI * 0.9, len / (2 * r)), n = Math.max(16, Math.ceil(len / 2)), tt = new Tris();
      const at = (a, z, f) => { const rr = r - (a - c); return [rr * Math.sin(f), -rr * Math.cos(f) + r, z]; };
      const m = prof.length;
      const fa = (i) => -half + (2 * half * i) / n;   // one formula for every angle, so the ends meet the caps exactly
      for (let i = 0; i < n; i++) {
        const f0 = fa(i), f1 = fa(i + 1);
        for (let k = 0; k < m; k++) { const P = prof[k], Q = prof[(k + 1) % m]; tt.quad(at(P[0], P[1], f0), at(Q[0], Q[1], f0), at(Q[0], Q[1], f1), at(P[0], P[1], f1)); }
      }
      for (const [f, up] of [[fa(0), false], [fa(n), true]]) {
        const c2 = new Tris(); cap(c2, prof, [], 0, up); const a2 = c2.done();
        for (let i = 0; i < a2.length; i += 9) { const A = at(a2[i], a2[i + 1], f), B = at(a2[i + 3], a2[i + 4], f), C = at(a2[i + 6], a2[i + 7], f); tt.tri(...A, ...B, ...C); }
      }
      return outward(tt.done());
    },
  };
}
