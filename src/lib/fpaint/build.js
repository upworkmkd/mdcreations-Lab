/* Filament painting (HueForge-style): one relief print whose height follows the picture's brightness; changing
 * filament at chosen layers paints it in colour, because thin light layers let the darker ones below show through.
 * Shared by the preview and the server build. Units: mm. */
import { heightField } from '@/lib/mesh/mesh.js';

export const RATIOS = { '4:3': 4 / 3, '3:2': 3 / 2, '1:1': 1, '3:4': 3 / 4, '2:3': 2 / 3, '16:9': 16 / 9, '9:16': 9 / 16 };
const MAX = 200_000;

export function gridFor(p) {
  const r = RATIOS[p.ratio] ?? 4 / 3, wmm = p.width, hmm = p.width / r;
  let pitch = p.detail === 'fine' ? 0.25 : 0.35;
  while ((Math.round(wmm / pitch) + 1) * (Math.round(hmm / pitch) + 1) > MAX) pitch += 0.02;
  pitch = +pitch.toFixed(2);
  return { w: Math.round(wmm / pitch) + 1, h: Math.round(hmm / pitch) + 1, pitch };
}

/** Top of layer n (1-based). */
export const layerTop = (p, n) => p.firstLayer + (n - 1) * p.layer;
/** Number of layers in the tallest part. */
export const layerCount = (p) => Math.max(2, Math.round((p.maxH - p.firstLayer) / p.layer) + 1);
/** The layer (1-based) a brightness 0–255 rises to. */
export function layerOf(p, v) {
  const n0 = Math.max(1, Math.round((p.minH - p.firstLayer) / p.layer) + 1), n1 = layerCount(p);
  const t = Math.pow(v / 255, p.curve);
  return Math.min(n1, Math.max(n0, Math.round(n0 + t * (n1 - n0))));
}

/** Height grid in mm (frame at full height). */
export function heights(p, v, G) {
  const { w, h, pitch } = G, out = new Float32Array(w * h), b = Math.round(p.frame / pitch), top = layerTop(p, layerCount(p));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    out[j * w + i] = b > 0 && (i < b || j < b || i >= w - b || j >= h - b) ? top : layerTop(p, layerOf(p, v[j * w + i]));
  }
  return out;
}

export function buildPainting(p, v, G) {
  return { tris: heightField(heights(p, v, G), G.w, G.h, G.pitch), size: [(G.w - 1) * G.pitch, (G.h - 1) * G.pitch, layerTop(p, layerCount(p))] };
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
/** Which filament prints layer n. colours: [{ hex, td, start }] with start = first layer (the first colour starts at 1). */
export function colourAt(colours, n) { let k = 0; for (let i = 0; i < colours.length; i++) if (colours[i].start <= n) k = i; return k; }

/**
 * Simulated look of the finished print. Each colour covers what is below it in proportion to how thick it is
 * compared with its transmission distance (TD: the thickness at which it hides everything underneath).
 */
export function simulate(p, v, w, h, colours, out) {
  const n1 = layerCount(p), cols = colours.map((c) => hex(c.hex)), memo = new Array(n1 + 1), thick = colours.map(() => 0);
  for (let n = 1; n <= n1; n++) {
    thick[colourAt(colours, n)] += n === 1 ? p.firstLayer : p.layer;
    let acc = cols[0].slice();
    for (let k = 1; k < cols.length; k++) if (thick[k] > 0) { const a = Math.min(1, thick[k] / Math.max(0.05, colours[k].td)); acc = [acc[0] * (1 - a) + cols[k][0] * a, acc[1] * (1 - a) + cols[k][1] * a, acc[2] * (1 - a) + cols[k][2] * a]; }
    memo[n] = acc;
  }
  for (let i = 0; i < w * h; i++) { const c = memo[layerOf(p, v[i])]; out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; }
  return out;
}

/** Spreads the colour changes over the layers, giving each colour room in proportion to its TD. */
export function spread(p, colours) {
  const n0 = Math.max(1, Math.round((p.minH - p.firstLayer) / p.layer) + 1), n1 = layerCount(p), rest = colours.slice(1);
  const total = rest.reduce((s, c) => s + c.td, 0) || 1, avail = n1 - n0;
  let at = n0 + 1;
  return colours.map((c, k) => { if (k === 0) return { ...c, start: 1 }; const s = Math.min(n1, at); at += Math.max(1, Math.round((avail * c.td) / total)); return { ...c, start: s }; });
}

/** Lines for the colour-swap guide. */
export function swapGuide(p, colours) {
  const n1 = layerCount(p), L = [];
  colours.forEach((c, k) => {
    const s = k === 0 ? 1 : c.start, e = k + 1 < colours.length ? colours[k + 1].start - 1 : n1;
    if (s > e) return;
    L.push(k === 0
      ? `  Start with ${c.name} (${c.hex}): layers 1-${e}, up to ${layerTop(p, e).toFixed(2)} mm`
      : `  Layer ${s} (Z ${layerTop(p, s - 1).toFixed(2)} -> ${layerTop(p, s).toFixed(2)} mm): change to ${c.name} (${c.hex}), layers ${s}-${e}`);
  });
  return L;
}
