'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, Range, Select, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { WhatYouGet, STANDARD_FILES } from '@/components/kit/what-you-get';
import { buildStudio } from '@/lib/studio/build.js';
import type { StudioBase, StudioColour, StudioTemplate } from '@/lib/studio/design';
import { encodeRle } from '@/lib/layers/rle.js';
import { loadGoogleFont } from '@/lib/mesh/text-mask';
import { track } from '@/components/tracker';
import { num, restoreFrom, rleBytes, str, type SavedDesign } from '@/lib/saved-design';
import { TextPanel } from './text-panel';
import { type Board, type Item, type Shape, type Sym, type TextStyle, compose, forgetGlyphs, corners, drawLocal, fillItem, hits, itemMatrix, newId, symMatrices } from './scene';

/* Design Studio: draw with up to four colours on a plate, a keychain, a coaster or a pixel grid; every colour is
 * raised to its own height and the piece downloads as STL files and a coloured 3MF. Everything drawn is an object
 * (stroke, shape, text, sticker, filled area) that can be selected, moved, resized, turned, recoloured or deleted.
 * Pixel art paints squares straight onto its grid. */

type Tool = 'select' | 'brush' | 'eraser' | 'fill' | 'line' | Shape | 'text' | 'sticker';
type Snapshot = { items: Item[]; pixels: Uint8Array };

const TEMPLATES: { id: StudioTemplate; label: string; hint: string }[] = [
  { id: 'sign', label: 'Sign', hint: 'A name plate, door sign or wall plaque: raised colours on a rounded plate.' },
  { id: 'keychain', label: 'Keychain', hint: 'Your drawing with a backing that follows it and a ring hole.' },
  { id: 'coaster', label: 'Coaster', hint: 'A round coaster or trivet. Try the 8-way repeat for a mandala.' },
  { id: 'pixel', label: 'Pixel art', hint: 'Colour squares on a grid, like bead art. Prints cleanly in colours.' },
  { id: 'free', label: 'Free shape', hint: 'No base: whatever you draw is the piece. Join everything up.' },
];
// W and H in mm (pixel art: squares of `cell` mm)
type Setup = { W: number; H: number; pxmm: number; cell?: number; base: StudioBase; heights: number; hole: number; sym: Sym };
const SETUP: Record<StudioTemplate, Setup> = {
  sign: { W: 160, H: 80, pxmm: 4, base: { kind: 'plate', thickness: 3, color: '#f4f1e8', border: 4, corner: 6 }, heights: 1.6, hole: 0, sym: 'none' },
  keychain: { W: 70, H: 32, pxmm: 6, base: { kind: 'outline', thickness: 2.4, color: '#161616', border: 2.5, corner: 4 }, heights: 1.2, hole: 4, sym: 'none' },
  coaster: { W: 100, H: 100, pxmm: 4, base: { kind: 'circle', thickness: 3, color: '#f4f1e8', border: 3, corner: 0 }, heights: 1, hole: 0, sym: 'r8' },
  pixel: { W: 72, H: 72, pxmm: 1 / 3, cell: 3, base: { kind: 'plate', thickness: 1.2, color: '#f4f1e8', border: 0, corner: 0 }, heights: 1.6, hole: 0, sym: 'none' },
  free: { W: 120, H: 120, pxmm: 4, base: { kind: 'none', thickness: 2, color: '#f4f1e8', border: 2, corner: 0 }, heights: 3, hole: 0, sym: 'none' },
};
const START_COLOURS = ['#161616', '#c0392b', '#f2c14e', '#1f5fa8'];
const PALETTE = ['#161616', '#f4f1e8', '#ffffff', '#c0392b', '#e67e22', '#f2c14e', '#2e7d4f', '#8fbf5a', '#1f5fa8', '#8fb8c9', '#7a4fa0', '#d36fa0', '#8a8f98', '#b98a5a', '#c9a227', '#6b3a2a'];
const START_TEXT: TextStyle = { text: 'Welcome', font: 'Poppins', weight: 800, italic: false, hmm: 18, align: 'center', spacing: 0, lineGap: 0.25, outline: 0 };
const STICKERS = ['ॐ', '🪔', '🌸', '🦋', '🐾', '❤️', '⭐', '🌙', '☀️', '🏠', '🚗', '✈️', '🎂', '⚽', '🏏', '🐘', '🦚', '🎵', '🍀', '👑', '🐟', '🌳', '🔑', '☕'];
const TOOLS: [Tool, string, string][] = [
  ['select', '⬚', 'Select'], ['brush', '✎', 'Brush'], ['eraser', '⌫', 'Eraser'], ['fill', '◧', 'Fill'], ['line', '╱', 'Line'], ['rect', '▭', 'Box'],
  ['circle', '◯', 'Circle'], ['star', '☆', 'Star'], ['heart', '♡', 'Heart'], ['text', 'T', 'Text'], ['sticker', '☺', 'Sticker'],
];

const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const boardOf = (W: number, H: number, pxmm: number): Board => ({ W, H, pxmm, w: Math.max(4, Math.round(W * pxmm)), h: Math.max(4, Math.round(H * pxmm)) });
const isTyping = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };

type Drag =
  | { kind: 'draw'; id: number; pts: number[] }
  | { kind: 'shape'; id: number; x0: number; y0: number }
  | { kind: 'move'; id: number; dx: number; dy: number }
  | { kind: 'scale'; id: number; s0: number; d0: number }
  | { kind: 'rotate'; id: number; r0: number; a0: number }
  | { kind: 'pixel'; erase: boolean };

/* "Edit design": the board as it was, objects and all. Filled areas carry their pixels, kept run-length encoded. */
type Bitmap = Extract<Item, { t: 'bitmap' }>;
type SavedItem = Exclude<Item, Bitmap> | (Omit<Bitmap, 'm'> & { m: string });
type Settings = { name: string; template: StudioTemplate; board: Board; items: SavedItem[]; pixels: string | null; colours: StudioColour[]; base: StudioBase; hole: number; sym: Sym; ts: TextStyle };
const itemsOut = (l: Item[]): SavedItem[] => l.map((it) => (it.t === 'bitmap' ? { ...it, m: encodeRle(it.m) } : it) as SavedItem);
const itemsIn = (l: SavedItem[] | undefined): Item[] => (l ?? []).flatMap((it) => {
  try { return [(it.t === 'bitmap' ? { ...it, id: newId(), m: rleBytes(it.m, it.mw * it.mh) } : { ...it, id: newId() }) as Item]; } catch { return []; }
});

/**
 * Older designs kept only the finished colour grid: pixel art comes back as its squares, anything else as one filled
 * area per colour (they can be moved, recoloured or drawn over, but text is no longer text).
 */
function fromParams(q: Record<string, unknown>): Partial<Settings> & { pixelsBytes?: Uint8Array } {
  const w = num(q.w, 0), h = num(q.h, 0), pxmm = num(q.pxmm, 4), template = str(q.template, 'sign') as StudioTemplate;
  if (!w || !h || typeof q.labels !== 'string') return {};
  const labels = rleBytes(q.labels, w * h), board: Board = { W: w / pxmm, H: h / pxmm, pxmm, w, h };
  const colours = Array.isArray(q.colours) ? q.colours as StudioColour[] : undefined;
  const out: Partial<Settings> = { name: str(q.name, 'My design'), template, board, colours, base: q.base as StudioBase, hole: num(q.hole, 0) };
  if (q.square || template === 'pixel') return { ...out, pixels: encodeRle(labels) };
  const items: SavedItem[] = [];
  for (let c = 1; c <= (colours?.length ?? 4); c++) {
    const m = new Uint8Array(w * h); let any = false;
    for (let i = 0; i < w * h; i++) if (labels[i] === c) { m[i] = 1; any = true; }
    if (any) items.push({ id: 0, t: 'bitmap', m: encodeRle(m), mw: w, mh: h, pxmm, colour: c, x: board.W / 2, y: board.H / 2, s: 1, r: 0, sym: 'none' } as SavedItem);
  }
  return { ...out, items };
}

export function StudioMaker({ saved, ...buy }: KitBuy & { saved?: SavedDesign | null }) {
  const [init] = useState(() => restoreFrom<Settings>(saved, fromParams));
  const t0Init = init?.template && SETUP[init.template] ? init.template : 'sign';
  const [template, setTemplate] = useState<StudioTemplate>(t0Init);
  const [pending, setPending] = useState<StudioTemplate | null>(null);
  const [board, setBoard] = useState<Board>(() => (init?.board ? boardOf(init.board.W, init.board.H, init.board.pxmm) : boardOf(SETUP.sign.W, SETUP.sign.H, SETUP.sign.pxmm)));
  const [items, setItems] = useState<Item[]>(() => itemsIn(init?.items));
  const [pixels, setPixels] = useState<Uint8Array>(() => {
    const b = init?.board; if (!b || !init?.pixels) return new Uint8Array(0);
    try { return rleBytes(init.pixels, b.w * b.h); } catch { return new Uint8Array(t0Init === 'pixel' ? b.w * b.h : 0); }
  });
  const [sel, setSel] = useState<number | null>(null);
  const [colours, setColours] = useState<StudioColour[]>(() => init?.colours?.length ? init.colours : START_COLOURS.map((c) => ({ color: c, height: SETUP[t0Init].heights })));
  const [active, setActive] = useState(1);
  const [base, setBase] = useState<StudioBase>(init?.base ?? SETUP[t0Init].base);
  const [hole, setHole] = useState(init?.hole ?? SETUP[t0Init].hole);
  const [tool, setTool] = useState<Tool>(init ? 'select' : 'text');
  const [size, setSize] = useState(3);
  const [sym, setSym] = useState<Sym>(init?.sym ?? SETUP[t0Init].sym);
  const [ts, setTs] = useState<TextStyle>(init?.ts ?? START_TEXT);   // the next text to place
  const lastEdit = useRef<{ id: number; at: number } | null>(null);
  const [sticker, setSticker] = useState('ॐ'), [stickerH, setStickerH] = useState(30);
  const [view, setView] = useState<'draw' | '3d'>('draw');
  const [name, setName] = useState(init?.name ?? 'My design');
  const [fontTick, setFontTick] = useState(0);
  const [hist, setHist] = useState<{ undo: Snapshot[]; redo: Snapshot[] }>({ undo: [], redo: [] });
  const [drag, setDrag] = useState<Drag | null>(null);
  const cv = useRef<HTMLCanvasElement>(null), over = useRef<HTMLCanvasElement>(null), snap = useRef<MeshSnap | null>(null);
  const pixel = template === 'pixel';
  const selected = items.find((i) => i.id === sel) ?? null;

  // fonts: the canvas draws text only once its font has loaded; tick to redraw
  const selFont = selected?.t === 'text' ? `${selected.font}|${selected.weight}` : '';
  useEffect(() => {
    let ok = true; const fs = [[ts.font, ts.weight], ...(selFont ? [selFont.split('|')] : [])] as [string, number | string][];
    Promise.all(fs.map(([f, w]) => loadGoogleFont(f, Number(w), 'Aaआ'))).then(() => { if (!ok) return; forgetGlyphs(); setFontTick((n) => n + 1); });
    return () => { ok = false; };
  }, [ts.font, ts.weight, selFont]);
  useEffect(() => { let ok = true; loadGoogleFont('Baloo 2', 800, 'ॐ').then(() => { if (!ok) return; forgetGlyphs(); setFontTick((n) => n + 1); }); return () => { ok = false; }; }, []);

  /* ---------------------------------------------------------------- history */
  const record = useCallback(() => setHist((h) => ({ undo: [...h.undo.slice(-49), { items, pixels }], redo: [] })), [items, pixels]);
  const undo = useCallback(() => {
    const last = hist.undo[hist.undo.length - 1]; if (!last) return;
    setHist({ undo: hist.undo.slice(0, -1), redo: [...hist.redo, { items, pixels }] });
    setItems(last.items); setPixels(last.pixels); setSel(null);
  }, [hist, items, pixels]);
  const redo = useCallback(() => {
    const next = hist.redo[hist.redo.length - 1]; if (!next) return;
    setHist({ undo: [...hist.undo, { items, pixels }], redo: hist.redo.slice(0, -1) });
    setItems(next.items); setPixels(next.pixels); setSel(null);
  }, [hist, items, pixels]);

  const update = useCallback((id: number, patch: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? ({ ...it, ...patch } as Item) : it))), []);
  const remove = useCallback(() => { if (sel == null) return; record(); setItems((l) => l.filter((i) => i.id !== sel)); setSel(null); }, [sel, record]);
  const duplicate = useCallback(() => { if (!selected) return; record(); const c = { ...selected, id: newId(), x: selected.x + 5, y: selected.y + 5 } as Item; setItems((l) => [...l, c]); setSel(c.id); }, [selected, record]);
  const restack = (dir: 1 | -1) => { if (sel == null) return; record(); setItems((l) => { const i = l.findIndex((x) => x.id === sel), j = Math.max(0, Math.min(l.length - 1, i + dir)); if (i < 0 || i === j) return l; const c = l.slice(); const [it] = c.splice(i, 1); c.splice(j, 0, it); return c; }); };
  const clearAll = () => { record(); setItems([]); setPixels(new Uint8Array(pixel ? board.w * board.h : 0)); setSel(null); };

  // keyboard: undo / redo, delete, duplicate, nudge, deselect
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (view !== 'draw' || isTyping(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
      else if (e.key === 'Escape') setSel(null);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault(); const st = e.shiftKey ? 5 : 1;
        update(selected.id, { x: selected.x + (e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0), y: selected.y + (e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0) });
      }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [view, undo, redo, duplicate, remove, selected, update]);

  /* ---------------------------------------------------------------- the board */
  const labels = useMemo(() => compose(board, pixels, items), [board, pixels, items, fontTick]);   // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * board.W, y: ((e.clientY - r.top) / r.height) * board.H }; };
  const paintCell = (x: number, y: number, erase: boolean, into: Uint8Array) => {
    const { w, h, W, H } = board, cx = Math.floor((x / W) * w), cy = Math.floor((y / H) * h), v = erase ? 0 : active;
    const pts: [number, number][] = [[cx, cy]];
    if (sym === 'mirror') pts.push([w - 1 - cx, cy]);
    else if (sym !== 'none') { const n = sym === 'r4' ? 4 : sym === 'r6' ? 6 : 8, ox = w / 2, oy = h / 2; for (let k = 1; k < n; k++) { const a = (2 * Math.PI * k) / n, dx = cx + 0.5 - ox, dy = cy + 0.5 - oy; pts.push([Math.floor(ox + dx * Math.cos(a) - dy * Math.sin(a)), Math.floor(oy + dx * Math.sin(a) + dy * Math.cos(a))]); } }
    for (const [px, py] of pts) if (px >= 0 && py >= 0 && px < w && py < h) into[py * w + px] = v;
  };

  // the selected item's handles, in board mm
  const handles = useMemo(() => {
    if (!selected || tool !== 'select') return null;
    const c = corners(selected, board.pxmm), m = itemMatrix(selected);
    const top = m.transformPoint(new DOMPoint(0, 0)), mid = [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2];
    const ux = mid[0] - top.x, uy = mid[1] - top.y, ul = Math.hypot(ux, uy) || 1, rot = [mid[0] + (ux / ul) * 8, mid[1] + (uy / ul) * 8];
    return { c, rot, centre: [top.x, top.y] };
  }, [selected, tool, board.pxmm, fontTick]);   // eslint-disable-line react-hooks/exhaustive-deps

  const down = (e: React.PointerEvent) => {
    if (view !== 'draw') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e), mmPx = board.W / (cv.current!.getBoundingClientRect().width || 1), near = 7 * mmPx;
    if (tool === 'select') {
      if (handles) {
        if (Math.hypot(p.x - handles.rot[0], p.y - handles.rot[1]) < near) { record(); setDrag({ kind: 'rotate', id: selected!.id, r0: selected!.r, a0: Math.atan2(p.y - handles.centre[1], p.x - handles.centre[0]) }); return; }
        for (const c of handles.c) if (Math.hypot(p.x - c[0], p.y - c[1]) < near) { record(); setDrag({ kind: 'scale', id: selected!.id, s0: selected!.s, d0: Math.hypot(p.x - handles.centre[0], p.y - handles.centre[1]) || 1 }); return; }
      }
      const hit = [...items].reverse().find((it) => hits(it, p.x, p.y, board.pxmm));
      setSel(hit ? hit.id : null);
      if (hit) { record(); setDrag({ kind: 'move', id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y }); }
      return;
    }
    if (pixel && (tool === 'brush' || tool === 'eraser' || tool === 'fill')) {
      record();
      const px = pixels.length === board.w * board.h ? pixels.slice() : new Uint8Array(board.w * board.h);
      if (tool === 'fill') {
        const cx = Math.floor((p.x / board.W) * board.w), cy = Math.floor((p.y / board.H) * board.h), from = labels[cy * board.w + cx];
        if (from !== active) { const st = [cy * board.w + cx], seen = new Uint8Array(board.w * board.h); seen[st[0]] = 1; while (st.length) { const i = st.pop()!, x = i % board.w; px[i] = active; for (const j of [x > 0 ? i - 1 : -1, x < board.w - 1 ? i + 1 : -1, i >= board.w ? i - board.w : -1, i < board.w * (board.h - 1) ? i + board.w : -1]) if (j >= 0 && !seen[j] && labels[j] === from) { seen[j] = 1; st.push(j); } } }
        setPixels(px); return;
      }
      paintCell(p.x, p.y, tool === 'eraser', px); setPixels(px); setDrag({ kind: 'pixel', erase: tool === 'eraser' }); return;
    }
    record();
    if (tool === 'fill') {
      const cx = Math.floor((p.x / board.W) * board.w), cy = Math.floor((p.y / board.H) * board.h);
      if (cx < 0 || cy < 0 || cx >= board.w || cy >= board.h) return;
      const it = fillItem(board, labels, cx, cy, active); if (it) { setItems((l) => [...l, it]); }
      return;
    }
    if (tool === 'text' || tool === 'sticker') {
      if (tool === 'text' && !ts.text.trim()) return;
      const it: Item = tool === 'text'
        ? { id: newId(), t: 'text', ...ts, text: ts.text.trim(), colour: active, x: p.x, y: p.y, s: 1, r: 0, sym }
        : { id: newId(), t: 'sticker', ch: sticker, hmm: stickerH, colour: active, x: p.x, y: p.y, s: 1, r: 0, sym };
      setItems((l) => [...l, it]); setSel(it.id); setTool('select'); track('studio_place', tool); return;
    }
    if (tool === 'brush' || tool === 'eraser' || tool === 'line') {
      const it: Item = { id: newId(), t: 'path', pts: [p.x, p.y], width: size, colour: tool === 'eraser' ? 0 : active, x: 0, y: 0, s: 1, r: 0, sym };
      setItems((l) => [...l, it]); setDrag({ kind: 'draw', id: it.id, pts: [p.x, p.y] }); return;
    }
    const it: Item = { id: newId(), t: 'shape', kind: tool as Shape, w: 0.5, h: 0.5, colour: active, x: p.x, y: p.y, s: 1, r: 0, sym };
    setItems((l) => [...l, it]); setDrag({ kind: 'shape', id: it.id, x0: p.x, y0: p.y });
  };

  const move = (e: React.PointerEvent) => {
    const d = drag; if (!d) return;
    const p = at(e);
    if (d.kind === 'pixel') { const px = pixels.slice(); paintCell(p.x, p.y, d.erase, px); setPixels(px); return; }
    if (d.kind === 'draw') {
      const pts = tool === 'line' ? [d.pts[0], d.pts[1], p.x, p.y] : [...d.pts, p.x, p.y];
      setDrag({ ...d, pts }); update(d.id, { pts } as Partial<Item>); return;
    }
    if (d.kind === 'shape') {
      let w = Math.abs(p.x - d.x0), h = Math.abs(p.y - d.y0);
      if (e.shiftKey) w = h = Math.max(w, h);
      update(d.id, { w: Math.max(0.5, w), h: Math.max(0.5, h), x: d.x0 + Math.sign(p.x - d.x0) * w / 2, y: d.y0 + Math.sign(p.y - d.y0) * h / 2 } as Partial<Item>); return;
    }
    if (d.kind === 'move') { update(d.id, { x: p.x - d.dx, y: p.y - d.dy }); return; }
    if (d.kind === 'scale' && handles) { update(d.id, { s: Math.max(0.05, Math.min(20, d.s0 * Math.hypot(p.x - handles.centre[0], p.y - handles.centre[1]) / d.d0)) }); return; }
    if (d.kind === 'rotate' && handles) {
      let r = d.r0 + ((Math.atan2(p.y - handles.centre[1], p.x - handles.centre[0]) - d.a0) * 180) / Math.PI;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      update(d.id, { r }); return;
    }
  };

  const up = () => {
    const d = drag; setDrag(null); if (!d) return;
    if (d.kind === 'draw') {
      // a stroke keeps its points around its own centre, so it moves and turns like any other object
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < d.pts.length; i += 2) { x0 = Math.min(x0, d.pts[i]); x1 = Math.max(x1, d.pts[i]); y0 = Math.min(y0, d.pts[i + 1]); y1 = Math.max(y1, d.pts[i + 1]); }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      update(d.id, { x: cx, y: cy, pts: d.pts.map((v, i) => v - (i % 2 ? cy : cx)) } as Partial<Item>);
    }
    if (d.kind === 'shape') { setSel(d.id); setTool('select'); }
  };

  /* ---------------------------------------------------------------- showing it */
  useEffect(() => {
    const c = cv.current; if (!c || view !== 'draw') return;
    const raf = requestAnimationFrame(() => {
      const { w, h } = board; c.width = w; c.height = h;
      const g = c.getContext('2d')!, im = g.createImageData(w, h), d = im.data;
      const cols = colours.map((q) => hexRgb(q.color)), bc = hexRgb(base.color), o1 = [228, 226, 216], o2 = [238, 236, 228];
      const r = Math.min(base.corner * board.pxmm, w / 2, h / 2);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, v = labels[i];
        let rgb: number[];
        if (v) rgb = cols[v - 1];
        else {
          let inBase = base.kind === 'plate' || base.kind === 'circle';
          if (base.kind === 'circle') inBase = (x + 0.5 - w / 2) ** 2 + (y + 0.5 - h / 2) ** 2 <= (Math.min(w, h) / 2) ** 2;
          else if (base.kind === 'plate' && r > 0) { const dx = Math.max(r - x - 0.5, x + 0.5 - (w - r), 0), dy = Math.max(r - y - 0.5, y + 0.5 - (h - r), 0); inBase = dx * dx + dy * dy <= r * r; }
          rgb = inBase ? mix(bc, [255, 255, 255], 0.15) : ((x >> 3) + (y >> 3)) & 1 ? o1 : o2;
        }
        d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [board, labels, colours, base, view]);

  // overlay: grid, repeat guides, the selection box and its handles
  useEffect(() => {
    const o = over.current, c = cv.current; if (!o || !c || view !== 'draw') return;
    const raf = requestAnimationFrame(() => {
      const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      o.width = Math.round(r.width * dpr); o.height = Math.round(r.height * dpr);
      const g = o.getContext('2d')!, k = o.width / board.W; g.clearRect(0, 0, o.width, o.height);
      if (pixel && o.width / board.w >= 6) { const q = o.width / board.w; g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1; g.beginPath(); for (let x = 1; x < board.w; x++) { g.moveTo(x * q, 0); g.lineTo(x * q, o.height); } for (let y = 1; y < board.h; y++) { g.moveTo(0, y * q); g.lineTo(o.width, y * q); } g.stroke(); }
      if (sym !== 'none') {
        g.strokeStyle = 'rgba(122,79,160,.45)'; g.setLineDash([6, 6]); g.lineWidth = 1.5 * dpr; g.beginPath();
        if (sym === 'mirror') { g.moveTo(o.width / 2, 0); g.lineTo(o.width / 2, o.height); }
        else { const n = sym === 'r4' ? 4 : sym === 'r6' ? 6 : 8, R = Math.hypot(o.width, o.height); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; g.moveTo(o.width / 2, o.height / 2); g.lineTo(o.width / 2 + R * Math.cos(a), o.height / 2 + R * Math.sin(a)); } }
        g.stroke(); g.setLineDash([]);
      }
      // the shape being drawn shows in its colour at once (the board catches up a moment later)
      if (drag && (drag.kind === 'shape' || drag.kind === 'draw')) {
        const it = items.find((x) => x.id === drag.id);
        if (it) {
          g.fillStyle = g.strokeStyle = it.colour ? colours[it.colour - 1].color + 'cc' : 'rgba(255,255,255,.9)';
          for (const sm of symMatrices(it.sym, board)) { const m = new DOMMatrix().scale(k).multiply(sm).multiply(drag.kind === 'draw' ? new DOMMatrix() : itemMatrix(it)); g.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); drawLocal(g, drag.kind === 'draw' ? { ...it, pts: drag.pts } as Item : it, board.pxmm); }
          g.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
      if (handles) {
        g.strokeStyle = '#7a4fa0'; g.lineWidth = 1.5 * dpr; g.setLineDash([5 * dpr, 4 * dpr]);
        g.beginPath(); handles.c.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.closePath(); g.stroke(); g.setLineDash([]);
        const mid = [(handles.c[0][0] + handles.c[1][0]) / 2, (handles.c[0][1] + handles.c[1][1]) / 2];
        g.beginPath(); g.moveTo(mid[0] * k, mid[1] * k); g.lineTo(handles.rot[0] * k, handles.rot[1] * k); g.stroke();
        g.fillStyle = '#fff';
        for (const [x, y] of handles.c) { g.beginPath(); g.rect(x * k - 5 * dpr, y * k - 5 * dpr, 10 * dpr, 10 * dpr); g.fill(); g.stroke(); }
        g.beginPath(); g.arc(handles.rot[0] * k, handles.rot[1] * k, 6 * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [board, pixel, sym, handles, drag, items, colours, view]);

  /* ---------------------------------------------------------------- templates and size */
  const used = useMemo(() => { const s = new Set<number>(); for (const v of labels) if (v) s.add(v); return s; }, [labels]);
  const start = (t: StudioTemplate) => {
    const s = SETUP[t], b = boardOf(s.W, s.H, s.pxmm);
    setTemplate(t); setPending(null); setBoard(b); setBase(s.base); setHole(s.hole); setSym(s.sym);
    setColours((o) => o.map((c) => ({ ...c, height: s.heights })));
    setItems([]); setPixels(new Uint8Array(t === 'pixel' ? b.w * b.h : 0)); setSel(null); setHist({ undo: [], redo: [] });
    setTool(t === 'sign' || t === 'keychain' ? 'text' : 'brush');
    if (t === 'keychain') setTs((o) => ({ ...o, text: 'Aarav', hmm: 14 })); if (t === 'sign') setTs((o) => ({ ...o, text: 'Welcome', hmm: 18 }));
    track('studio_template', t);
  };
  const pick = (t: StudioTemplate) => { if (t === template) return; if (used.size) setPending(t); else start(t); };
  const resize = (W: number, H: number) => {
    const b = boardOf(W, H, board.pxmm), dx = (W - board.W) / 2, dy = (H - board.H) / 2;
    // objects keep their size and stay centred; pixel art keeps its squares (adds or trims at the edges)
    setItems((l) => l.map((it) => ({ ...it, x: it.x + dx, y: it.y + dy })));
    if (pixel) { const px = new Uint8Array(b.w * b.h), ox = Math.round((b.w - board.w) / 2), oy = Math.round((b.h - board.h) / 2); for (let y = 0; y < board.h; y++) for (let x = 0; x < board.w; x++) { const X = x + ox, Y = y + oy; if (X >= 0 && Y >= 0 && X < b.w && Y < b.h) px[Y * b.w + X] = pixels[y * board.w + x] ?? 0; } setPixels(px); }
    setBoard(b);
  };

  /* ---------------------------------------------------------------- 3D and download */
  const design = useMemo(() => ({ w: board.w, h: board.h, pxmm: board.pxmm, labels, colours, base, hole, square: pixel }), [board, labels, colours, base, hole, pixel]);
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
    const c = cv.current, j = document.createElement('canvas'), k = Math.min(pixel ? 30 : 1, 900 / Math.max(board.w, board.h));
    j.width = Math.round(board.w * k); j.height = Math.round(board.h * k);
    const g = j.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, j.width, j.height); g.imageSmoothingEnabled = !pixel; if (c) g.drawImage(c, 0, 0, j.width, j.height);
    return {
      design: { name, template, w: board.w, h: board.h, pxmm: board.pxmm, labels: encodeRle(labels), colours, base, hole, square: pixel },
      preview: snap.current?.jpeg() || j.toDataURL('image/jpeg', 0.85),
      settings: { name, template, board, items: itemsOut(items), pixels: pixel ? encodeRle(pixels) : null, colours, base, hole, sym, ts } satisfies Settings,
    };
  }, [used, board, pixel, name, template, labels, colours, base, hole, items, pixels, sym, ts]);

  const setColour = (i: number, c: Partial<StudioColour>) => setColours((o) => o.map((x, k) => (k === i ? { ...x, ...c } : x)));
  const chooseColour = (n: number) => { setActive(n); if (selected && tool === 'select' && selected.colour !== 0) { record(); update(selected.id, { colour: n }); } else if (tool === 'eraser') setTool('brush'); };
  const t0 = TEMPLATES.find((t) => t.id === template)!;
  const cellMm = SETUP.pixel.cell!;
  const kindName = (it: Item) => (it.t === 'path' ? (it.colour === 0 ? 'eraser stroke' : 'stroke') : it.t === 'shape' ? ({ rect: 'box', circle: 'circle', star: 'star', heart: 'heart' } as Record<string, string>)[it.kind] : it.t === 'bitmap' ? 'filled area' : it.t);

  const getting = view === '3d' && model && !err ? (
    <WhatYouGet meta={`${model.size[0].toFixed(0)} × ${model.size[1].toFixed(0)} × ${model.size[2].toFixed(1)} mm`}
      parts={model.parts.map((p) => ({ title: p.name === 'Base' ? ({ plate: 'Plate', circle: 'Coaster', outline: 'Backing', none: 'Base' } as Record<string, string>)[base.kind] : p.name, text: p.name === 'Base' ? `${base.thickness} mm thick${hole ? `, with a ${hole} mm ring hole` : ''}.` : `Raised ${(p.z1 - p.z0).toFixed(1)} mm, from ${p.z0.toFixed(1)} mm.`, tris: p.tris, color: p.color, tag: p.name === 'Base' ? undefined : 'your drawing' }))}
      files={[...(model.parts.length > 1 ? [{ title: 'Colour 3MF', text: 'Every part in its colour, for Bambu Studio and OrcaSlicer.' }] : []), ...STANDARD_FILES]}
      needs={hole ? [{ title: 'A key ring', text: `Through the ${hole} mm hole.` }] : []} />
  ) : <p className="wyg" style={{ color: 'var(--ink-3)' }}>Open the 3D view once to see the parts of your design.</p>;

  const hint = tool === 'select' ? (selected ? 'Drag to move. Corner squares resize, the round handle turns it (hold Shift for 15° steps). Delete removes it.' : 'Click anything you drew to select it.')
    : tool === 'text' ? 'Set the text above, then click where it goes. Select it later to move it or change its font.' : tool === 'sticker' ? 'Pick a sticker, then click where it goes.'
    : tool === 'fill' ? 'Click an area to fill it with the colour.' : tool === 'brush' || tool === 'eraser' ? 'Drag to draw.' : 'Drag to draw the shape (hold Shift for an even one).';

  return (
    <Workbench tool="design-studio" next="/tools/design-studio/make" ready={used.size > 0} getDesign={getDesign} buy={buy}
      doneBlurb="Your design is built. Open the 3MF in Bambu Studio for colours, or print the STL files."
      getting={getting}
      bar={<>
        <div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={view === 'draw'} onClick={() => setView('draw')}>Draw</button><button type="button" aria-pressed={view === '3d'} onClick={() => { setView('3d'); setSel(null); track('studio_3d', template); }}>3D</button></div>
        {view === 'draw' && <div className="st-undo" role="group" aria-label="History">
          <button type="button" onClick={undo} disabled={!hist.undo.length} title="Undo (Ctrl+Z)">↶ Undo</button>
          <button type="button" onClick={redo} disabled={!hist.redo.length} title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        </div>}
        <span className="muted">{view === 'draw' ? `${t0.label} · ${pixel ? `${board.w} × ${board.h} squares` : `${board.W} × ${board.H} mm`}` : 'Drag to turn, scroll to zoom.'}</span>
      </>}
      stage={view === '3d'
        ? (err ? <p className="st-empty">{err}</p> : <MeshView parts={parts} fitKey={`${template}-${board.W}-${board.H}-${base.kind}`} snapRef={snap} />)
        : (
          <div className="st">
            <div className="st-tools" role="toolbar" aria-label="Drawing tools">
              {TOOLS.map(([id, ic, label]) => <button key={id} type="button" aria-pressed={tool === id} title={label} onClick={() => { setTool(id); if (id !== 'select') setSel(null); }}><span aria-hidden>{ic}</span><small>{label}</small></button>)}
              <span className="st-sep" />
              <button type="button" title="Clear the board" onClick={clearAll}><span aria-hidden>✕</span><small>Clear</small></button>
            </div>
            <div className="st-opts">
              <span className="st-colours" role="group" aria-label="Colour">
                {colours.map((c, i) => <button key={i} type="button" aria-label={`Colour ${i + 1}`} aria-pressed={(selected && tool === 'select' ? selected.colour : active) === i + 1} style={{ background: c.color }} onClick={() => chooseColour(i + 1)}>{i + 1}</button>)}
              </span>
              {tool === 'select' && selected && <>
                <span className="st-selname">{kindName(selected)}</span>
                {selected.t === 'path' && <label className="st-opt">Width <input type="range" min={0.5} max={15} step={0.5} value={selected.width} onPointerDown={record} onChange={(e) => update(selected.id, { width: Number(e.target.value) } as Partial<Item>)} /> <b>{selected.width} mm</b></label>}
                <span className="st-actions">
                  <button type="button" onClick={duplicate} title="Duplicate (Ctrl+D)">Duplicate</button>
                  <button type="button" onClick={() => restack(1)} title="Bring forward">Forward</button>
                  <button type="button" onClick={() => restack(-1)} title="Send back">Back</button>
                  <button type="button" onClick={() => { record(); update(selected.id, { sym: selected.sym === 'none' ? sym : 'none' }); }} title="Repeat this object with the board's repeat setting">{selected.sym === 'none' ? 'Repeat it' : 'Stop repeating'}</button>
                  <button type="button" className="danger" onClick={remove} title="Delete (Del)">Delete</button>
                </span>
              </>}
              {(tool === 'brush' || tool === 'eraser' || tool === 'line') && !pixel && <label className="st-opt">Size <input type="range" min={0.5} max={15} step={0.5} value={size} onChange={(e) => setSize(Number(e.target.value))} /> <b>{size} mm</b></label>}
              {tool === 'sticker' && <>
                <span className="st-stickers">{STICKERS.map((s) => <button key={s} type="button" aria-pressed={sticker === s} onClick={() => setSticker(s)}>{s}</button>)}</span>
                <label className="st-opt">Size <input type="range" min={6} max={120} value={stickerH} onChange={(e) => setStickerH(Number(e.target.value))} /> <b>{stickerH} mm</b></label>
              </>}
              {tool !== 'select' && <label className="st-opt">Repeat <select value={sym} onChange={(e) => setSym(e.target.value as Sym)}><option value="none">Off</option><option value="mirror">Mirror left / right</option><option value="r4">4 around the centre</option><option value="r6">6 around the centre</option><option value="r8">8 around the centre</option></select></label>}
            </div>
            <div className="st-canvas" style={{ aspectRatio: `${board.W} / ${board.H}`, ['--ar' as string]: board.W / board.H }}>
              <canvas ref={cv} className={pixel ? 'px' : ''} data-tool={tool} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Drawing board" />
              <canvas ref={over} className="st-over" aria-hidden />
            </div>
            <p className="st-hint">{hint}</p>
          </div>
        )}
      stats={<><span>Size <b>{pixel ? `${board.w} × ${board.h} squares of ${cellMm} mm` : `${board.W} × ${board.H} mm`}</b></span><span>Objects <b>{items.length}</b></span><span>Colours used <b>{used.size}</b></span>{base.kind !== 'none' && used.size > 0 && <span>Colour change at <b>{base.thickness.toFixed(1)} mm</b></span>}{view === '3d' && model && !err && model.pieces > 1 && <span style={{ color: '#8a3b12' }}><b>{model.pieces} separate pieces</b></span>}</>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>A colour 3MF ready for Bambu Studio and OrcaSlicer (each colour already set), one STL per colour and the base, print notes with the colour-change height, a preview and a commercial license.</p></>}
      side={<>
        {view === 'draw' && (tool === 'text' || (tool === 'select' && selected?.t === 'text')) && (
          <Group title={tool === 'select' ? 'Selected text' : 'Text'}><TextPanel pixel={pixel} editing={tool === 'select' && selected?.t === 'text'}
                value={tool === 'select' && selected?.t === 'text' ? selected : ts}
                onChange={(patch) => {
                  if (tool === 'select' && selected?.t === 'text') {
                    // one undo step per burst of edits to the same text
                    const now = Date.now(), le = lastEdit.current;
                    if (!le || le.id !== selected.id || now - le.at > 1500) record();
                    lastEdit.current = { id: selected.id, at: now };
                    update(selected.id, patch as Partial<Item>);
                  } else setTs((o) => ({ ...o, ...patch }));
                }} /></Group>
        )}
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
          {pixel ? <>
            <Range label="Squares across" value={board.w} onChange={(v) => resize(v * cellMm, board.H)} min={8} max={64} />
            <Range label="Squares down" value={board.h} onChange={(v) => resize(board.W, v * cellMm)} min={8} max={64} />
            <p className="hint">Each square is {cellMm} mm: the piece is {board.W} × {board.H} mm.</p>
          </> : <>
            <Range label="Width" value={board.W} onChange={(v) => resize(v, template === 'coaster' ? v : board.H)} min={20} max={250} fmt={(v) => `${v} mm`} />
            {template !== 'coaster' && <Range label="Height" value={board.H} onChange={(v) => resize(board.W, v)} min={15} max={250} fmt={(v) => `${v} mm`} />}
          </>}
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
          <Select<StudioBase['kind']> label="Base" value={base.kind} onChange={(k) => setBase((b) => ({ ...b, kind: k }))} options={[['plate', 'Plate (the whole board)'], ['circle', 'Round'], ['outline', 'Follows the drawing'], ['none', 'No base']]} />
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
