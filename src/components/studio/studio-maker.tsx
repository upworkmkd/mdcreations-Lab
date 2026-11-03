'use client';
/* The drawing is one large byte grid that every brush stroke changes in place (copying it on each stroke would be
 * far too slow); `rev` tells React when it changed. */
/* eslint-disable react-hooks/immutability */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, Range, Select, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { WhatYouGet, STANDARD_FILES } from '@/components/kit/what-you-get';
import { buildStudio } from '@/lib/studio/build.js';
import type { StudioBase, StudioColour, StudioTemplate } from '@/lib/studio/design';
import { encodeRle } from '@/lib/layers/rle.js';
import { loadGoogleFont, textMask } from '@/lib/mesh/text-mask';
import { track } from '@/components/tracker';

/* Design Studio: draw with up to four colours on a plate, a keychain, a coaster or a pixel grid; every colour is
 * raised to its own height and the piece downloads as STL files and a coloured 3MF. Drawing happens on a colour
 * grid (one byte per cell); shapes, text and stickers are drawn on a scratch canvas first and then stamped in. */

type Tool = 'brush' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'star' | 'heart' | 'text' | 'sticker';
type Sym = 'none' | 'mirror' | 'r4' | 'r6' | 'r8';
type Doc = { w: number; h: number; pxmm: number; labels: Uint8Array };

const TEMPLATES: { id: StudioTemplate; label: string; hint: string }[] = [
  { id: 'sign', label: 'Sign', hint: 'A name plate, door sign or wall plaque: raised colours on a rounded plate.' },
  { id: 'keychain', label: 'Keychain', hint: 'Your drawing with a backing that follows it and a ring hole.' },
  { id: 'coaster', label: 'Coaster', hint: 'A round coaster or trivet. Try the 8-way repeat for a mandala.' },
  { id: 'pixel', label: 'Pixel art', hint: 'Colour squares on a grid, like bead art. Prints cleanly in colours.' },
  { id: 'free', label: 'Free shape', hint: 'No base: whatever you draw is the piece. Join everything up.' },
];
type Setup = { W: number; H: number; pxmm: number; base: StudioBase; heights: number; hole: number; tool: Tool };
const SETUP: Record<StudioTemplate, Setup> = {
  sign: { W: 160, H: 80, pxmm: 4, base: { kind: 'plate', thickness: 3, color: '#f4f1e8', border: 4, corner: 6 }, heights: 1.6, hole: 0, tool: 'text' },
  keychain: { W: 70, H: 32, pxmm: 6, base: { kind: 'outline', thickness: 2.4, color: '#161616', border: 2.5, corner: 4 }, heights: 1.2, hole: 4, tool: 'text' },
  coaster: { W: 100, H: 100, pxmm: 4, base: { kind: 'circle', thickness: 3, color: '#f4f1e8', border: 3, corner: 0 }, heights: 1, hole: 0, tool: 'brush' },
  pixel: { W: 24, H: 24, pxmm: 1 / 3, base: { kind: 'plate', thickness: 1.2, color: '#f4f1e8', border: 0, corner: 0 }, heights: 1.6, hole: 0, tool: 'brush' },
  free: { W: 120, H: 120, pxmm: 4, base: { kind: 'none', thickness: 2, color: '#f4f1e8', border: 2, corner: 0 }, heights: 3, hole: 0, tool: 'brush' },
};
const START_COLOURS = ['#161616', '#c0392b', '#f2c14e', '#1f5fa8'];
const PALETTE = ['#161616', '#f4f1e8', '#ffffff', '#c0392b', '#e67e22', '#f2c14e', '#2e7d4f', '#8fbf5a', '#1f5fa8', '#8fb8c9', '#7a4fa0', '#d36fa0', '#8a8f98', '#b98a5a', '#c9a227', '#6b3a2a'];
const FONTS: [string, number, string][] = [['Poppins', 800, 'Poppins Bold'], ['Baloo 2', 800, 'Baloo (Hindi + English)'], ['Pacifico', 400, 'Pacifico (script)'], ['Bebas Neue', 400, 'Bebas Neue (tall)'], ['Great Vibes', 400, 'Great Vibes (wedding)'], ['Yatra One', 400, 'Yatra One (Hindi)']];
const STICKERS = ['ॐ', '🪔', '🌸', '🦋', '🐾', '❤️', '⭐', '🌙', '☀️', '🏠', '🚗', '✈️', '🎂', '⚽', '🏏', '🐘', '🦚', '🎵', '🍀', '👑', '🐟', '🌳', '🔑', '☕'];
const TOOLS: [Tool, string, string][] = [
  ['brush', '✎', 'Brush'], ['eraser', '⌫', 'Eraser'], ['fill', '◧', 'Fill'], ['line', '╱', 'Line'], ['rect', '▭', 'Box'],
  ['circle', '◯', 'Circle'], ['star', '☆', 'Star'], ['heart', '♡', 'Heart'], ['text', 'T', 'Text'], ['sticker', '☺', 'Sticker'],
];

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));

function emptyDoc(t: StudioTemplate, W: number, H: number): Doc {
  // pixel art: W and H count squares; everything else is in mm
  const s = SETUP[t], pxmm = s.pxmm, w = t === 'pixel' ? W : Math.max(4, Math.round(W * pxmm)), h = t === 'pixel' ? H : Math.max(4, Math.round(H * pxmm));
  return { w, h, pxmm, labels: new Uint8Array(w * h) };
}
/** Same drawing on a grid of another size (nearest cell), when the piece is resized. */
function resample(d: Doc, w: number, h: number): Doc {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = d.labels[Math.min(d.h - 1, Math.floor((y + 0.5) * d.h / h)) * d.w + Math.min(d.w - 1, Math.floor((x + 0.5) * d.w / w))];
  return { ...d, w, h, labels: out };
}
function starPath(cx: number, cy: number, r: number) {
  const p = new Path2D();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a); if (i) p.lineTo(x, y); else p.moveTo(x, y); }
  p.closePath(); return p;
}
function heartPath(x0: number, y0: number, x1: number, y1: number) {
  const w = x1 - x0, h = y1 - y0, p = new Path2D();
  p.moveTo(x0 + w / 2, y0 + h * 0.28);
  p.bezierCurveTo(x0 + w / 2, y0, x0, y0, x0, y0 + h * 0.32);
  p.bezierCurveTo(x0, y0 + h * 0.62, x0 + w / 2, y0 + h * 0.8, x0 + w / 2, y1);
  p.bezierCurveTo(x0 + w / 2, y0 + h * 0.8, x1, y0 + h * 0.62, x1, y0 + h * 0.32);
  p.bezierCurveTo(x1, y0, x0 + w / 2, y0, x0 + w / 2, y0 + h * 0.28);
  p.closePath(); return p;
}

export function StudioMaker(buy: KitBuy) {
  const [template, setTemplate] = useState<StudioTemplate>('sign');
  const [pending, setPending] = useState<StudioTemplate | null>(null);
  const [W, setW] = useState(SETUP.sign.W), [H, setH] = useState(SETUP.sign.H);
  const [doc, setDoc] = useState<Doc>(() => emptyDoc('sign', SETUP.sign.W, SETUP.sign.H));
  const [rev, setRev] = useState(0);                       // bumps on every change of the drawing
  const [colours, setColours] = useState<StudioColour[]>(START_COLOURS.map((c) => ({ color: c, height: SETUP.sign.heights })));
  const [active, setActive] = useState(1);
  const [base, setBase] = useState<StudioBase>(SETUP.sign.base);
  const [hole, setHole] = useState(SETUP.sign.hole);
  const [tool, setTool] = useState<Tool>('text');
  const [size, setSize] = useState(3);                     // brush and line width, mm
  const [sym, setSym] = useState<Sym>('none');
  const [text, setText] = useState('Welcome'), [font, setFont] = useState(0), [textH, setTextH] = useState(18);
  const [sticker, setSticker] = useState('ॐ'), [stickerH, setStickerH] = useState(30);
  const [view, setView] = useState<'draw' | '3d'>('draw');
  const [name, setName] = useState('My design');
  const cv = useRef<HTMLCanvasElement>(null), over = useRef<HTMLCanvasElement>(null), snap = useRef<MeshSnap | null>(null);
  const undo = useRef<Uint8Array[]>([]), redo = useRef<Uint8Array[]>([]);
  const drag = useRef<{ x: number; y: number; lx: number; ly: number; id: number } | null>(null);
  const pixel = template === 'pixel';
  const changed = () => setRev((r) => r + 1);

  useEffect(() => { const [f, wt] = FONTS[font]; loadGoogleFont(f, wt, text || 'Aa'); }, [font, text]);
  useEffect(() => { loadGoogleFont('Baloo 2', 800, 'ॐ'); }, []);

  /* ---------------------------------------------------------------- drawing */
  const transforms = useCallback((w: number, h: number): DOMMatrix[] => {
    const I = new DOMMatrix(), cx = w / 2, cy = h / 2;
    if (sym === 'mirror') return [I, new DOMMatrix().translate(w, 0).scale(-1, 1)];
    const n = sym === 'r4' ? 4 : sym === 'r6' ? 6 : sym === 'r8' ? 8 : 1;
    return Array.from({ length: n }, (_, k) => new DOMMatrix().translate(cx, cy).rotate((360 * k) / n).translate(-cx, -cy));
  }, [sym]);

  /** Stamps whatever `draw` paints (in any colour) into the grid as the active colour, or erases it; with symmetry. */
  const stamp = useCallback((draw: (g: CanvasRenderingContext2D) => void, erase = false) => {
    const { w, h, labels } = doc;
    const op = document.createElement('canvas'); op.width = w; op.height = h;
    const g = op.getContext('2d')!; g.imageSmoothingEnabled = !pixel; g.fillStyle = '#000'; g.strokeStyle = '#000';
    draw(g);
    const all = document.createElement('canvas'); all.width = w; all.height = h;
    const a = all.getContext('2d', { willReadFrequently: true })!; a.imageSmoothingEnabled = !pixel;
    for (const m of transforms(w, h)) { a.setTransform(m); a.drawImage(op, 0, 0); }
    const px = a.getImageData(0, 0, w, h).data, v = erase ? 0 : active;
    for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] > 110) labels[i] = v;
    changed();
  }, [doc, transforms, active, pixel]);

  const save = useCallback(() => { undo.current.push(doc.labels.slice()); if (undo.current.length > 40) undo.current.shift(); redo.current = []; }, [doc]);
  const doUndo = () => { const u = undo.current.pop(); if (!u || u.length !== doc.labels.length) return; redo.current.push(doc.labels.slice()); doc.labels.set(u); changed(); };
  const doRedo = () => { const r = redo.current.pop(); if (!r || r.length !== doc.labels.length) return; undo.current.push(doc.labels.slice()); doc.labels.set(r); changed(); };
  const clearAll = () => { save(); doc.labels.fill(0); changed(); };

  const fill = useCallback((x: number, y: number) => {
    const { w, h, labels } = doc, from = labels[y * w + x], to = active; if (from === to) return;
    const st = [y * w + x]; labels[y * w + x] = to;
    while (st.length) { const i = st.pop()!, cx = i % w; for (const j of [cx > 0 ? i - 1 : -1, cx < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1]) if (j >= 0 && labels[j] === from) { labels[j] = to; st.push(j); } }
    changed();
  }, [doc, active]);

  const placeGlyph = useCallback(async (x: number, y: number, kind: 'text' | 'sticker') => {
    const pxmm = doc.pxmm;
    if (kind === 'text') {
      const [f, wt] = FONTS[font];
      await loadGoogleFont(f, wt, text || 'Aa');
      const m = textMask(text.split('\n').slice(0, 3), { family: f, weight: wt, heightMm: textH, pxPerMm: pxmm, align: 'center' });
      if (!m) return;
      const c = document.createElement('canvas'); c.width = m.w; c.height = m.h; const g = c.getContext('2d')!, im = g.createImageData(m.w, m.h);
      for (let i = 0; i < m.w * m.h; i++) if (m.mask[i]) im.data[i * 4 + 3] = 255;
      g.putImageData(im, 0, 0);
      stamp((o) => o.drawImage(c, Math.round(x - m.w / 2), Math.round(y - m.h / 2)));
    } else {
      await loadGoogleFont('Baloo 2', 800, 'ॐ');
      const px = stickerH * pxmm;
      stamp((o) => { o.font = `800 ${px}px "Baloo 2", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText(sticker, x, y); });
    }
  }, [doc.pxmm, font, text, textH, sticker, stickerH, stamp]);

  const shapeOn = (g: CanvasRenderingContext2D, t: Tool, x0: number, y0: number, x1: number, y1: number, lw: number) => {
    const L = Math.min(x0, x1), T = Math.min(y0, y1), R = Math.max(x0, x1), B = Math.max(y0, y1);
    if (t === 'line') { g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    else if (t === 'rect') g.fillRect(L, T, Math.max(1, R - L), Math.max(1, B - T));
    else if (t === 'circle') { g.beginPath(); g.ellipse((L + R) / 2, (T + B) / 2, Math.max(0.5, (R - L) / 2), Math.max(0.5, (B - T) / 2), 0, 0, Math.PI * 2); g.fill(); }
    else if (t === 'star') g.fill(starPath((L + R) / 2, (T + B) / 2, Math.max(R - L, B - T) / 2));
    else if (t === 'heart') g.fill(heartPath(L, T, Math.max(R, L + 2), Math.max(B, T + 2)));
  };

  const at = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * doc.w, y: ((e.clientY - r.top) / r.height) * doc.h }; };
  const paintCell = (x: number, y: number, erase: boolean) => {
    const { w, h, labels } = doc, v = erase ? 0 : active, cx = Math.floor(x), cy = Math.floor(y);
    const pts: [number, number][] = [[cx, cy]];
    if (sym === 'mirror') pts.push([w - 1 - cx, cy]);
    else if (sym !== 'none') { const n = sym === 'r4' ? 4 : sym === 'r6' ? 6 : 8, ox = w / 2, oy = h / 2; for (let k = 1; k < n; k++) { const a = (2 * Math.PI * k) / n, dx = cx + 0.5 - ox, dy = cy + 0.5 - oy; pts.push([Math.floor(ox + dx * Math.cos(a) - dy * Math.sin(a)), Math.floor(oy + dx * Math.sin(a) + dy * Math.cos(a))]); } }
    for (const [px, py] of pts) if (px >= 0 && py >= 0 && px < w && py < h) labels[py * w + px] = v;
    changed();
  };

  const down = (e: React.PointerEvent) => {
    if (view !== 'draw') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e); save();
    if (tool === 'fill') { if (p.x >= 0 && p.y >= 0 && p.x < doc.w && p.y < doc.h) fill(Math.floor(p.x), Math.floor(p.y)); return; }
    if (tool === 'text' || tool === 'sticker') { placeGlyph(p.x, p.y, tool); track('studio_place', tool); return; }
    drag.current = { x: p.x, y: p.y, lx: p.x, ly: p.y, id: e.pointerId };
    if (tool === 'brush' || tool === 'eraser') {
      if (pixel) paintCell(p.x, p.y, tool === 'eraser');
      else { const lw = Math.max(1, size * doc.pxmm); stamp((g) => { g.beginPath(); g.arc(p.x, p.y, lw / 2, 0, Math.PI * 2); g.fill(); }, tool === 'eraser'); }
    }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const p = at(e);
    if (tool === 'brush' || tool === 'eraser') {
      if (pixel) paintCell(p.x, p.y, tool === 'eraser');
      else { const lw = Math.max(1, size * doc.pxmm), { lx, ly } = d; stamp((g) => { g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(lx, ly); g.lineTo(p.x, p.y); g.stroke(); }, tool === 'eraser'); }
      d.lx = p.x; d.ly = p.y;
    } else { d.lx = p.x; d.ly = p.y; drawOverlay(); }
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (tool !== 'brush' && tool !== 'eraser') { const lw = Math.max(1, size * doc.pxmm); stamp((g) => shapeOn(g, tool, d.x, d.y, d.lx, d.ly, lw)); drawOverlay(); }
  };

  /* ---------------------------------------------------------------- showing the drawing */
  const drawOverlay = useCallback(() => {
    const o = over.current, c = cv.current; if (!o || !c) return;
    const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    o.width = Math.round(r.width * dpr); o.height = Math.round(r.height * dpr);
    const g = o.getContext('2d')!; g.clearRect(0, 0, o.width, o.height);
    const k = o.width / doc.w;
    if (pixel && k >= 6) { g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1; g.beginPath(); for (let x = 1; x < doc.w; x++) { g.moveTo(x * k, 0); g.lineTo(x * k, o.height); } for (let y = 1; y < doc.h; y++) { g.moveTo(0, y * k); g.lineTo(o.width, y * k); } g.stroke(); }
    if (sym !== 'none') { g.strokeStyle = 'rgba(122,79,160,.45)'; g.setLineDash([6, 6]); g.lineWidth = 1.5; g.beginPath(); if (sym === 'mirror') { g.moveTo(o.width / 2, 0); g.lineTo(o.width / 2, o.height); } else { const n = sym === 'r4' ? 4 : sym === 'r6' ? 6 : 8, R = Math.hypot(o.width, o.height); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; g.moveTo(o.width / 2, o.height / 2); g.lineTo(o.width / 2 + R * Math.cos(a), o.height / 2 + R * Math.sin(a)); } } g.stroke(); g.setLineDash([]); }
    const d = drag.current;
    if (d && tool !== 'brush' && tool !== 'eraser') {
      g.save(); g.scale(k, k); g.fillStyle = g.strokeStyle = colours[active - 1].color + 'aa';
      for (const m of transforms(doc.w, doc.h)) { g.save(); g.transform(m.a, m.b, m.c, m.d, m.e, m.f); shapeOn(g, tool, d.x, d.y, d.lx, d.ly, Math.max(1, size * doc.pxmm)); g.restore(); }
      g.restore();
    }
  }, [doc, pixel, sym, tool, colours, active, size, transforms]);

  useEffect(() => {
    const c = cv.current; if (!c) return;
    let raf = requestAnimationFrame(() => {
      const { w, h, labels } = doc; c.width = w; c.height = h;
      const g = c.getContext('2d')!, im = g.createImageData(w, h), d = im.data;
      const cols = colours.map((q) => hexRgb(q.color)), bc = hexRgb(base.color), out = [228, 226, 216], out2 = [238, 236, 228];
      const r = Math.min(base.corner * doc.pxmm, w / 2, h / 2);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, v = labels[i];
        let rgb: number[];
        if (v) rgb = cols[v - 1];
        else {
          let inBase = base.kind === 'outline' || base.kind === 'none' ? false : true;
          if (base.kind === 'circle') inBase = (x + 0.5 - w / 2) ** 2 + (y + 0.5 - h / 2) ** 2 <= (Math.min(w, h) / 2) ** 2;
          else if (base.kind === 'plate' && r > 0) { const dx = Math.max(r - x - 0.5, x + 0.5 - (w - r), 0), dy = Math.max(r - y - 0.5, y + 0.5 - (h - r), 0); inBase = dx * dx + dy * dy <= r * r; }
          rgb = inBase ? mix(bc, [255, 255, 255], 0.15) : ((x >> 3) + (y >> 3)) & 1 ? out : out2;
        }
        d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      drawOverlay();
      raf = 0;
    });
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [doc, rev, colours, base, drawOverlay, view]);
  useEffect(() => { const f = () => drawOverlay(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, [drawOverlay]);

  /* ---------------------------------------------------------------- templates and size */
  const used = useMemo(() => { const s = new Set<number>(); for (const v of doc.labels) if (v) s.add(v); return s; }, [doc, rev]);   // eslint-disable-line react-hooks/exhaustive-deps
  const start = (t: StudioTemplate) => {
    const s = SETUP[t];
    setTemplate(t); setPending(null); setW(s.W); setH(s.H); setBase(s.base); setHole(s.hole); setTool(s.tool);
    setColours((o) => o.map((c) => ({ ...c, height: s.heights })));
    setDoc(emptyDoc(t, s.W, s.H)); undo.current = []; redo.current = []; setSym(t === 'coaster' ? 'r8' : 'none');
    if (t === 'keychain') setText('Aarav'); if (t === 'sign') setText('Welcome');
    track('studio_template', t);
  };
  const pick = (t: StudioTemplate) => { if (t === template) return; if (used.size) setPending(t); else start(t); };
  const resize = (nw: number, nh: number) => {
    const s = SETUP[template]; setW(nw); setH(nh);
    setDoc((d) => (template === 'pixel' ? resample(d, nw, nh) : resample(d, Math.max(4, Math.round(nw * s.pxmm)), Math.max(4, Math.round(nh * s.pxmm)))));
    undo.current = []; redo.current = []; changed();
  };

  /* ---------------------------------------------------------------- 3D and download */
  const design = useMemo(() => ({ w: doc.w, h: doc.h, pxmm: doc.pxmm, labels: doc.labels.slice(), colours, base, hole, square: pixel }), [doc, rev, colours, base, hole, pixel]);   // eslint-disable-line react-hooks/exhaustive-deps
  const deferred = useDeferredValue(design);
  const model = useMemo(() => {
    if (view !== '3d') return null;
    try { return buildStudio(deferred) as { parts: { name: string; color: string; tris: Float32Array; z0: number; z1: number }[]; size: number[]; pieces: number; warnings: string[] }; }
    catch (e) { return { error: (e as Error).message } as never; }
  }, [deferred, view]);
  const err = model && (model as { error?: string }).error;
  const parts = useMemo(() => (model && !err ? model.parts.map((p) => ({ tris: p.tris, color: p.color })) : []), [model, err]);

  const getDesign = useCallback(() => {
    if (!used.size) return null;
    const c = cv.current, j = document.createElement('canvas'), k = Math.min(1, 900 / Math.max(doc.w, doc.h) * (pixel ? 30 : 1));
    j.width = Math.round(doc.w * k); j.height = Math.round(doc.h * k);
    const g = j.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, j.width, j.height); g.imageSmoothingEnabled = !pixel; if (c) g.drawImage(c, 0, 0, j.width, j.height);
    return {
      design: { name, template, w: doc.w, h: doc.h, pxmm: doc.pxmm, labels: encodeRle(doc.labels), colours, base, hole, square: pixel },
      preview: snap.current?.jpeg() || j.toDataURL('image/jpeg', 0.85),
    };
  }, [used, doc, pixel, name, template, colours, base, hole]);

  const setColour = (i: number, c: Partial<StudioColour>) => setColours((o) => o.map((x, k) => (k === i ? { ...x, ...c } : x)));
  const t0 = TEMPLATES.find((t) => t.id === template)!;
  const cells = `${doc.w} × ${doc.h}`;

  const getting = view === '3d' && model && !err ? (
    <WhatYouGet meta={`${model.size[0].toFixed(0)} × ${model.size[1].toFixed(0)} × ${model.size[2].toFixed(1)} mm`}
      parts={model.parts.map((p) => ({ title: p.name === 'Base' ? ({ plate: 'Plate', circle: 'Coaster', outline: 'Backing', none: 'Base' } as Record<string, string>)[base.kind] : `${p.name}`, text: p.name === 'Base' ? `${base.thickness} mm thick${hole ? `, with a ${hole} mm ring hole` : ''}.` : `Raised ${(p.z1 - p.z0).toFixed(1)} mm, from ${p.z0.toFixed(1)} mm.`, tris: p.tris, color: p.color, tag: p.name === 'Base' ? undefined : 'your drawing' }))}
      files={[...(model.parts.length > 1 ? [{ title: 'Colour 3MF', text: 'Every part in its colour, for Bambu Studio and OrcaSlicer.' }] : []), ...STANDARD_FILES]}
      needs={hole ? [{ title: 'A key ring', text: `Through the ${hole} mm hole.` }] : []} />
  ) : <p className="wyg" style={{ color: 'var(--ink-3)' }}>Open the 3D view once to see the parts of your design.</p>;

  return (
    <Workbench tool="design-studio" next="/tools/design-studio/make" ready={used.size > 0} getDesign={getDesign} buy={buy}
      doneBlurb="Your design is built. Open the 3MF in Bambu Studio for colours, or print the STL files."
      getting={getting}
      bar={<>
        <div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={view === 'draw'} onClick={() => setView('draw')}>Draw</button><button type="button" aria-pressed={view === '3d'} onClick={() => { setView('3d'); track('studio_3d', template); }}>3D</button></div>
        <span className="muted">{view === 'draw' ? `${t0.label} · ${W} × ${H} ${pixel ? 'squares' : 'mm'}` : 'Drag to turn, scroll to zoom.'}</span>
      </>}
      stage={view === '3d'
        ? (err ? <p className="st-empty">{err}</p> : <MeshView parts={parts} fitKey={`${template}-${W}-${H}-${base.kind}`} snapRef={snap} />)
        : (
          <div className="st">
            <div className="st-tools" role="toolbar" aria-label="Drawing tools">
              {TOOLS.map(([id, ic, label]) => <button key={id} type="button" aria-pressed={tool === id} title={label} onClick={() => setTool(id)}><span aria-hidden>{ic}</span><small>{label}</small></button>)}
              <span className="st-sep" />
              <button type="button" title="Undo" onClick={doUndo}><span aria-hidden>↶</span><small>Undo</small></button>
              <button type="button" title="Redo" onClick={doRedo}><span aria-hidden>↷</span><small>Redo</small></button>
              <button type="button" title="Clear" onClick={clearAll}><span aria-hidden>✕</span><small>Clear</small></button>
            </div>
            <div className="st-opts">
              <span className="st-colours" role="group" aria-label="Colour">
                {colours.map((c, i) => <button key={i} type="button" aria-label={`Colour ${i + 1}`} aria-pressed={active === i + 1} style={{ background: c.color }} onClick={() => { setActive(i + 1); if (tool === 'eraser') setTool('brush'); }}>{i + 1}</button>)}
              </span>
              {(tool === 'brush' || tool === 'eraser' || tool === 'line') && !pixel && <label className="st-opt">Size <input type="range" min={0.5} max={15} step={0.5} value={size} onChange={(e) => setSize(Number(e.target.value))} /> <b>{size} mm</b></label>}
              {tool === 'text' && <>
                <input className="st-text" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} placeholder="Type, then click on the design" aria-label="Text" />
                <select value={font} onChange={(e) => setFont(Number(e.target.value))} aria-label="Font">{FONTS.map((f, i) => <option key={f[0]} value={i}>{f[2]}</option>)}</select>
                <label className="st-opt">Height <input type="range" min={pixel ? 15 : 4} max={pixel ? 60 : 80} value={textH} onChange={(e) => setTextH(Number(e.target.value))} /> <b>{textH} mm</b></label>
              </>}
              {tool === 'sticker' && <>
                <span className="st-stickers">{STICKERS.map((s) => <button key={s} type="button" aria-pressed={sticker === s} onClick={() => setSticker(s)}>{s}</button>)}</span>
                <label className="st-opt">Size <input type="range" min={6} max={120} value={stickerH} onChange={(e) => setStickerH(Number(e.target.value))} /> <b>{stickerH} mm</b></label>
              </>}
              <label className="st-opt">Repeat <select value={sym} onChange={(e) => setSym(e.target.value as Sym)}><option value="none">Off</option><option value="mirror">Mirror left / right</option><option value="r4">4 around the centre</option><option value="r6">6 around the centre</option><option value="r8">8 around the centre</option></select></label>
            </div>
            <div className="st-canvas" style={{ aspectRatio: `${doc.w} / ${doc.h}`, ['--ar' as string]: doc.w / doc.h }}>
              <canvas ref={cv} className={pixel ? 'px' : ''} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Drawing" />
              <canvas ref={over} className="st-over" aria-hidden />
            </div>
            <p className="st-hint">{tool === 'text' ? 'Type your text above, then click where it goes.' : tool === 'sticker' ? 'Pick a sticker, then click where it goes.' : tool === 'fill' ? 'Click an area to fill it with the colour.' : tool === 'brush' || tool === 'eraser' ? 'Drag to draw.' : 'Drag to draw the shape.'}</p>
          </div>
        )}
      stats={<><span>Size <b>{W} × {H} {pixel ? `squares of ${(1 / doc.pxmm).toFixed(1)} mm` : 'mm'}</b></span><span>Colours used <b>{used.size}</b></span>{base.kind !== 'none' && used.size > 0 && <span>Colour change at <b>{base.thickness.toFixed(1)} mm</b></span>}{view === '3d' && model && !err && model.pieces > 1 && <span style={{ color: '#8a3b12' }}><b>{model.pieces} separate pieces</b></span>}<span className="muted">{cells} cells</span></>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>A colour 3MF ready for Bambu Studio and OrcaSlicer (each colour already set), one STL per colour and the base, print notes with the colour-change height, a preview and a commercial license.</p></>}
      side={<>
        <Group title="What are you making?">
          <Seg<StudioTemplate> label="Template" value={template} onChange={pick} options={TEMPLATES.map((t) => [t.id, t.label])} />
          {pending ? (
            <div className="st-confirm">
              <p>Start a new {TEMPLATES.find((t) => t.id === pending)!.label.toLowerCase()}? Your drawing will be cleared.</p>
              <div><button type="button" className="btn small" onClick={() => start(pending)}>Start new</button><button type="button" className="btn small ghost" onClick={() => setPending(null)}>Keep drawing</button></div>
            </div>
          ) : <p className="hint">{t0.hint}</p>}
        </Group>
        <Group title="Size">
          <Range label={pixel ? 'Squares across' : 'Width'} value={W} onChange={(v) => resize(v, template === 'coaster' ? v : H)} min={pixel ? 8 : 20} max={pixel ? 64 : 250} fmt={(v) => (pixel ? `${v}` : `${v} mm`)} />
          {template !== 'coaster' && <Range label={pixel ? 'Squares down' : 'Height'} value={H} onChange={(v) => resize(W, v)} min={pixel ? 8 : 15} max={pixel ? 64 : 250} fmt={(v) => (pixel ? `${v}` : `${v} mm`)} />}
          {pixel && <p className="hint">Each square is {(1 / doc.pxmm).toFixed(0)} mm: the piece is {Math.round(W / doc.pxmm)} × {Math.round(H / doc.pxmm)} mm.</p>}
        </Group>
        <Group title="Colours and heights">
          {colours.map((c, i) => (
            <div key={i} className="st-colrow">
              <button type="button" className="st-dot" aria-label={`Draw with colour ${i + 1}`} aria-pressed={active === i + 1} style={{ background: c.color }} onClick={() => setActive(i + 1)} />
              <div className="kit-swatches st-pal">{PALETTE.map((p) => <button key={p} type="button" aria-label={p} aria-pressed={c.color === p} style={{ background: p }} onClick={() => setColour(i, { color: p })} />)}</div>
              <Range label={`Colour ${i + 1} height`} value={c.height} onChange={(v) => setColour(i, { height: v })} min={0.4} max={10} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
            </div>
          ))}
          <p className="hint">Each colour stands this high on the base. Colours on the same layer need an AMS; one colour on a base works with a single filament change.</p>
        </Group>
        <Group title="Base">
          <Select<StudioBase['kind']> label="Base" value={base.kind} onChange={(k) => setBase((b) => ({ ...b, kind: k }))} options={[['plate', 'Plate (the whole canvas)'], ['circle', 'Round'], ['outline', 'Follows the drawing'], ['none', 'No base']]} />
          {base.kind !== 'none' && <>
            <Range label="Thickness" value={base.thickness} onChange={(v) => setBase((b) => ({ ...b, thickness: v }))} min={0.6} max={8} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
            {base.kind === 'plate' && <Range label="Corner radius" value={base.corner} onChange={(v) => setBase((b) => ({ ...b, corner: v }))} min={0} max={40} fmt={(v) => `${v} mm`} />}
            {base.kind === 'outline' && <Range label="Border round the drawing" value={base.border} onChange={(v) => setBase((b) => ({ ...b, border: v }))} min={0.5} max={12} step={0.5} fmt={(v) => `${v} mm`} />}
            <div className="kit-ctl"><span>Base colour</span><span /><div className="kit-swatches" style={{ gridColumn: '1/-1' }}>{PALETTE.map((p) => <button key={p} type="button" aria-label={p} aria-pressed={base.color === p} style={{ background: p }} onClick={() => setBase((b) => ({ ...b, color: p }))} />)}</div></div>
          </>}
          <Range label="Keychain ring hole" value={hole} onChange={setHole} min={0} max={8} step={0.5} fmt={(v) => (v ? `${v} mm` : 'none')} />
          <Text label="Name" value={name} onChange={setName} max={40} />
        </Group>
      </>} />
  );
}
