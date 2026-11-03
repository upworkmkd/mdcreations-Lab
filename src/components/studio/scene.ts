/* The Design Studio board as objects: strokes, shapes, text, stickers and filled areas, each with a colour, a
 * position (mm, from the top left of the board), a scale and a rotation, so they can be moved after they are made.
 * `compose` paints them in order (later ones on top) onto the colour grid that the 3D model is built from. */
import { textMask } from '@/lib/mesh/text-mask';

export type Sym = 'none' | 'mirror' | 'r4' | 'r6' | 'r8';
export type Shape = 'rect' | 'circle' | 'star' | 'heart';
type Common = { id: number; colour: number; x: number; y: number; s: number; r: number; sym: Sym };   // colour 0 = eraser
export type Item = Common & (
  | { t: 'path'; pts: number[]; width: number }                        // points in mm around (x, y)
  | { t: 'shape'; kind: Shape; w: number; h: number }
  | ({ t: 'text' } & TextStyle)
  | { t: 'sticker'; ch: string; hmm: number }
  | { t: 'bitmap'; m: Uint8Array; mw: number; mh: number; pxmm: number }   // a filled area
);
/** How a piece of text looks. hmm: letter height in mm (the tallest line, ink top to bottom). */
export type TextStyle = { text: string; font: string; weight: number; italic: boolean; hmm: number; align: 'left' | 'center' | 'right'; spacing: number; lineGap: number; outline: number };
export type Board = { W: number; H: number; pxmm: number; w: number; h: number };

let nextId = 1;
export const newId = () => nextId++;

/* ---------------------------------------------------------------- pictures of text, stickers and fills */
const glyphs = new Map<string, HTMLCanvasElement | null>();
/** Drops the cached pictures of text and stickers (after a font has loaded, so they are drawn again in it). */
export function forgetGlyphs() { for (const k of [...glyphs.keys()]) if (!k.startsWith('b')) glyphs.delete(k); }
function maskCanvas(m: Uint8Array, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
  const g = c.getContext('2d')!, im = g.createImageData(c.width, c.height);
  for (let i = 0; i < w * h; i++) if (m[i]) im.data[i * 4 + 3] = 255;
  g.putImageData(im, 0, 0); return c;
}
/** The item's own picture at `pxmm` (text, sticker or fill), centred on its position; null for strokes and shapes. */
function glyph(it: Item, pxmm: number): HTMLCanvasElement | null {
  if (it.t === 'bitmap') {
    const key = `b${it.id}`; if (!glyphs.has(key)) glyphs.set(key, maskCanvas(it.m, it.mw, it.mh)); return glyphs.get(key)!;
  }
  if (it.t === 'text') {
    const res = Math.max(pxmm, 6), key = `t|${it.font}|${it.weight}|${it.italic}|${it.hmm}|${it.align}|${it.spacing}|${it.lineGap}|${it.outline}|${res}|${it.text}`;
    if (!glyphs.has(key)) {
      const m = textMask(it.text.split('\n').slice(0, 4), { family: it.font, weight: it.weight, italic: it.italic, heightMm: it.hmm, pxPerMm: res, align: it.align, letterSpacing: it.spacing, lineGap: it.lineGap, outlineMm: it.outline });
      glyphs.set(key, m ? maskCanvas(m.mask, m.w, m.h) : null);
    }
    return glyphs.get(key)!;
  }
  if (it.t === 'sticker') {
    const res = Math.max(pxmm, 6), key = `s|${it.ch}|${it.hmm}|${res}`;
    if (!glyphs.has(key)) {
      const px = it.hmm * res, c = document.createElement('canvas'); c.width = Math.ceil(px * 1.6); c.height = Math.ceil(px * 1.4);
      const g = c.getContext('2d')!; g.font = `800 ${px}px "Baloo 2", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.ch, c.width / 2, c.height / 2);
      // trim to the ink
      const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) glyphs.set(key, null);
      else { const t = document.createElement('canvas'); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1; t.getContext('2d')!.drawImage(c, -x0, -y0); glyphs.set(key, t); }
    }
    return glyphs.get(key)!;
  }
  return null;
}
const glyphRes = (it: Item, pxmm: number) => (it.t === 'bitmap' ? it.pxmm : Math.max(pxmm, 6));

/** The item's own box (mm), around its position, before scale and rotation. */
export function localBox(it: Item, pxmm: number): [number, number, number, number] {
  if (it.t === 'path') {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < it.pts.length; i += 2) { x0 = Math.min(x0, it.pts[i]); x1 = Math.max(x1, it.pts[i]); y0 = Math.min(y0, it.pts[i + 1]); y1 = Math.max(y1, it.pts[i + 1]); }
    const r = it.width / 2; return [x0 - r, y0 - r, x1 + r, y1 + r];
  }
  if (it.t === 'shape') return [-it.w / 2, -it.h / 2, it.w / 2, it.h / 2];
  const g = glyph(it, pxmm); if (!g) return [-1, -1, 1, 1];
  const k = glyphRes(it, pxmm), w = g.width / k, h = g.height / k; return [-w / 2, -h / 2, w / 2, h / 2];
}

/** mm on the item -> mm on the board. */
export const itemMatrix = (it: Item) => new DOMMatrix().translate(it.x, it.y).rotate(it.r).scale(it.s);
export function symMatrices(sym: Sym, b: Board): DOMMatrix[] {
  const I = new DOMMatrix(), cx = b.W / 2, cy = b.H / 2;
  if (sym === 'mirror') return [I, new DOMMatrix().translate(b.W, 0).scale(-1, 1)];
  const n = sym === 'r4' ? 4 : sym === 'r6' ? 6 : sym === 'r8' ? 8 : 1;
  return Array.from({ length: n }, (_, k) => new DOMMatrix().translate(cx, cy).rotate((360 * k) / n).translate(-cx, -cy));
}
function starPath(r: number) {
  const p = new Path2D();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; const x = rr * Math.cos(a), y = rr * Math.sin(a); if (i) p.lineTo(x, y); else p.moveTo(x, y); }
  p.closePath(); return p;
}
function heartPath(w: number, h: number) {
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2, p = new Path2D();
  p.moveTo(0, y0 + h * 0.28);
  p.bezierCurveTo(0, y0, x0, y0, x0, y0 + h * 0.32);
  p.bezierCurveTo(x0, y0 + h * 0.62, 0, y0 + h * 0.8, 0, y1);
  p.bezierCurveTo(0, y0 + h * 0.8, x1, y0 + h * 0.62, x1, y0 + h * 0.32);
  p.bezierCurveTo(x1, y0, 0, y0, 0, y0 + h * 0.28);
  p.closePath(); return p;
}

/** Draws the item in its local mm frame (the caller sets the transform). Any colour: only the shape matters. */
export function drawLocal(g: CanvasRenderingContext2D, it: Item, pxmm: number) {
  if (it.t === 'path') {
    g.lineWidth = it.width; g.lineCap = 'round'; g.lineJoin = 'round';
    if (it.pts.length <= 2) { g.beginPath(); g.arc(it.pts[0] ?? 0, it.pts[1] ?? 0, it.width / 2, 0, Math.PI * 2); g.fill(); return; }
    g.beginPath(); g.moveTo(it.pts[0], it.pts[1]); for (let i = 2; i < it.pts.length; i += 2) g.lineTo(it.pts[i], it.pts[i + 1]); g.stroke(); return;
  }
  if (it.t === 'shape') {
    if (it.kind === 'rect') g.fillRect(-it.w / 2, -it.h / 2, it.w, it.h);
    else if (it.kind === 'circle') { g.beginPath(); g.ellipse(0, 0, Math.max(0.1, it.w / 2), Math.max(0.1, it.h / 2), 0, 0, Math.PI * 2); g.fill(); }
    else if (it.kind === 'star') g.fill(starPath(Math.max(it.w, it.h) / 2));
    else g.fill(heartPath(it.w, it.h));
    return;
  }
  const c = glyph(it, pxmm); if (!c) return;
  const k = glyphRes(it, pxmm); g.drawImage(c, -c.width / k / 2, -c.height / k / 2, c.width / k, c.height / k);
}

/** Board corners (mm) of the item's box, after its own move/scale/rotation (no repeats). */
export function corners(it: Item, pxmm: number) {
  const [x0, y0, x1, y1] = localBox(it, pxmm), m = itemMatrix(it);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => { const p = m.transformPoint(new DOMPoint(x, y)); return [p.x, p.y] as [number, number]; });
}

/** Is the board point (mm) on the item? (Inside its box; repeats do not count.) */
export function hits(it: Item, x: number, y: number, pxmm: number) {
  const p = itemMatrix(it).inverse().transformPoint(new DOMPoint(x, y)), [x0, y0, x1, y1] = localBox(it, pxmm), pad = 1.5 / Math.max(0.2, it.s);
  return p.x >= x0 - pad && p.x <= x1 + pad && p.y >= y0 - pad && p.y <= y1 + pad;
}

let scratch: HTMLCanvasElement | null = null;
/** Paints the pixel layer and every item, in order, onto the colour grid (w × h cells, row 0 = top). */
export function compose(b: Board, pixels: Uint8Array | null, items: Item[]): Uint8Array {
  const { w, h, pxmm } = b, out = pixels && pixels.length === w * h ? pixels.slice() : new Uint8Array(w * h);
  if (typeof document === 'undefined' || !items.length) return out;
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  const g = scratch.getContext('2d', { willReadFrequently: true })!;
  for (const it of items) {
    // the area this item can touch, in cells
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const ms = symMatrices(it.sym, b);
    for (const sm of ms) for (const [cx, cy] of corners(it, pxmm)) { const p = sm.transformPoint(new DOMPoint(cx, cy)); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const X0 = Math.max(0, Math.floor(x0 * pxmm) - 2), Y0 = Math.max(0, Math.floor(y0 * pxmm) - 2), X1 = Math.min(w, Math.ceil(x1 * pxmm) + 2), Y1 = Math.min(h, Math.ceil(y1 * pxmm) + 2);
    if (X1 <= X0 || Y1 <= Y0) continue;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.fillStyle = '#000'; g.strokeStyle = '#000'; g.imageSmoothingEnabled = pxmm >= 1;
    for (const sm of ms) {
      const m = new DOMMatrix().scale(pxmm).multiply(sm).multiply(itemMatrix(it));
      g.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); drawLocal(g, it, pxmm);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = g.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data, bw = X1 - X0;
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (d[((y - Y0) * bw + (x - X0)) * 4 + 3] > 110) out[y * w + x] = it.colour;
  }
  return out;
}

/** Flood fill on the composed grid from a cell: the area as a new "filled area" item. */
export function fillItem(b: Board, labels: Uint8Array, cx: number, cy: number, colour: number): Item | null {
  const { w, h } = b, from = labels[cy * w + cx]; if (from === colour) return null;
  const seen = new Uint8Array(w * h), st = [cy * w + cx]; seen[cy * w + cx] = 1;
  let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
  while (st.length) {
    const i = st.pop()!, x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1]) if (j >= 0 && !seen[j] && labels[j] === from) { seen[j] = 1; st.push(j); }
  }
  const mw = x1 - x0 + 1, mh = y1 - y0 + 1, m = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) m[y * mw + x] = seen[(y + y0) * w + x + x0];
  return { id: newId(), t: 'bitmap', m, mw, mh, pxmm: b.pxmm, colour, x: (x0 + mw / 2) / b.pxmm, y: (y0 + mh / 2) / b.pxmm, s: 1, r: 0, sym: 'none' };
}
