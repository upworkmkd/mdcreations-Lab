'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Check, Group, PicturePick, Range, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { WhatYouGet, STANDARD_FILES } from '@/components/kit/what-you-get';
import { buildFlip, flipClasses } from '@/lib/flip/build.js';
import { encodeRle } from '@/lib/layers/rle.js';
import { loadGoogleFont } from '@/lib/mesh/text-mask';
import { restoreFrom, savedPicture, useRestoredPicture, type SavedDesign } from '@/lib/saved-design';

type Pic = CanvasImageSource & { width: number; height: number };
type Src = 'text' | 'picture';
type Ratio = '4:3' | '1:1' | '3:4' | '3:2';
type Side = { src: Src; text: string; picture: string | null };
type Settings = { a: Side; b: Side; mode: 'two' | 'auto'; n: number; dark: string; light: string; width: number; ratio: Ratio; pitch: number; stand: boolean };

const RATIO: Record<Ratio, number> = { '4:3': 3 / 4, '1:1': 1, '3:4': 4 / 3, '3:2': 2 / 3 };   // height / width
const SWATCH = ['#161616', '#f4f1e8', '#c0392b', '#1f5fa8', '#2e7d4f', '#f2c14e', '#d36fa0', '#7a4fa0'];
const CELL = 0.8;   // mm per row up the plate

/** A side of the flip drawn into the grid (cols × rows) as RGB: a word, or the picture (cover). */
function cellsOf(side: Side, pic: Pic | null, cols: number, rows: number, pitch: number) {
  // drawn at the plate's real proportions (6 px per mm), then read back one sample per cell
  const W = Math.round(cols * pitch * 6), H = Math.round(rows * CELL * 6), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  if (side.src === 'picture' && pic) { const k = Math.max(W / pic.width, H / pic.height); g.drawImage(pic, (W - pic.width * k) / 2, (H - pic.height * k) / 2, pic.width * k, pic.height * k); }
  else if (side.text.trim()) {
    const lines = side.text.trim().split(/\s*\/\s*|\n/).slice(0, 3); g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let px = H / (lines.length * 1.15); g.font = `900 ${px}px Poppins, sans-serif`;
    const wide = Math.max(...lines.map((l) => g.measureText(l).width)); if (wide > W * 0.92) { px *= (W * 0.92) / wide; g.font = `900 ${px}px Poppins, sans-serif`; }
    lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * px * 1.1));
  }
  const s = document.createElement('canvas'); s.width = cols; s.height = rows; const sg = s.getContext('2d', { willReadFrequently: true })!;
  sg.imageSmoothingQuality = 'high'; sg.drawImage(c, 0, 0, cols, rows);
  const d = sg.getImageData(0, 0, cols, rows).data, out = new Float32Array(cols * rows * 3);
  for (let i = 0; i < cols * rows; i++) { out[i * 3] = d[i * 4]; out[i * 3 + 1] = d[i * 4 + 1]; out[i * 3 + 2] = d[i * 4 + 2]; }
  return out;
}
function viewUrl(cls: Uint8Array, cols: number, rows: number, palette: string[], pitch: number) {
  const c = document.createElement('canvas'); c.width = cols; c.height = rows; const g = c.getContext('2d')!, im = g.createImageData(cols, rows);
  const rgb = palette.map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
  for (let i = 0; i < cols * rows; i++) { const q = rgb[cls[i]] ?? [0, 0, 0]; im.data[i * 4] = q[0]; im.data[i * 4 + 1] = q[1]; im.data[i * 4 + 2] = q[2]; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  // shown at the plate's real proportions
  const o = document.createElement('canvas'); o.width = Math.round(cols * pitch * 2); o.height = Math.round(rows * CELL * 2);
  const og = o.getContext('2d')!; og.imageSmoothingEnabled = false; og.drawImage(c, 0, 0, o.width, o.height); return o.toDataURL('image/png');
}
function thumbOf(im: Pic) { const c = document.createElement('canvas'); c.width = 200; c.height = Math.round((200 * im.height) / im.width); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); }

export function FlipMaker({ saved, ...buy }: KitBuy & { saved?: SavedDesign | null }) {
  const [init] = useState(() => restoreFrom<Settings>(saved, () => null));
  const [a, setA] = useState<Side>(init?.a ?? { src: 'text', text: 'LOVE', picture: null });
  const [b, setB] = useState<Side>(init?.b ?? { src: 'text', text: 'YOU', picture: null });
  const [picA, setPicA] = useState<Pic | null>(null), [picB, setPicB] = useState<Pic | null>(null);
  const [thA, setThA] = useState<string | null>(null), [thB, setThB] = useState<string | null>(null);
  const [mode, setMode] = useState<'two' | 'auto'>(init?.mode ?? 'two'), [n, setN] = useState(init?.n ?? 3);
  const [dark, setDark] = useState(init?.dark ?? '#161616'), [light, setLight] = useState(init?.light ?? '#f4f1e8');
  const [width, setWidth] = useState(init?.width ?? 140), [ratio, setRatio] = useState<Ratio>(init?.ratio ?? '4:3'), [pitch, setPitch] = useState(init?.pitch ?? 2.5);
  const [stand, setStand] = useState(init?.stand ?? true);
  const [fontOk, setFontOk] = useState(false);
  const snap = useRef<MeshSnap | null>(null);
  useRestoredPicture(init?.a?.picture, (im) => { setPicA(im); setThA(thumbOf(im)); });
  useRestoredPicture(init?.b?.picture, (im) => { setPicB(im); setThB(thumbOf(im)); });
  useEffect(() => { let ok = true; loadGoogleFont('Poppins', 900, a.text + b.text).then(() => ok && setFontOk(true)); return () => { ok = false; }; }, [a.text, b.text]);

  const cols = Math.max(8, Math.round(width / pitch)), rows = Math.max(8, Math.round((width * RATIO[ratio]) / CELL));
  const classes = useMemo(() => {
    if (!fontOk) return null;
    const pa = cellsOf(a, picA, cols, rows, pitch), pb = cellsOf(b, picB, cols, rows, pitch), cells = cols * rows;
    if (mode === 'auto') return flipClasses(pa, pb, cells, n) as { a: Uint8Array; b: Uint8Array; palette: string[] };
    // two filaments: dark parts of each picture in the dark colour
    const cut = (px: Float32Array) => { const o = new Uint8Array(cells); for (let i = 0; i < cells; i++) o[i] = 0.299 * px[i * 3] + 0.587 * px[i * 3 + 1] + 0.114 * px[i * 3 + 2] < 128 ? 0 : 1; return o; };
    return { a: cut(pa), b: cut(pb), palette: [dark, light] };
  }, [fontOk, a, b, picA, picB, cols, rows, pitch, mode, n, dark, light]);
  const live = useMemo(() => ({ classes, cols, rows, pitch, stand }), [classes, cols, rows, pitch, stand]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => (dp.classes ? buildFlip(dp.classes.a, dp.classes.b, dp.cols, dp.rows, dp.classes.palette, { pitch: dp.pitch, cell: CELL, base: 1.6, stand: dp.stand }) as { parts: { name: string; color: string; tris: Float32Array }[]; size: number[] } : null), [dp]);
  const parts = useMemo(() => (model ? model.parts.map((q) => ({ tris: q.tris, color: q.color })) : []), [model]);
  const views = useMemo(() => (classes ? { a: viewUrl(classes.a, cols, rows, classes.palette, pitch), b: viewUrl(classes.b, cols, rows, classes.palette, pitch) } : null), [classes, cols, rows, pitch]);

  const getDesign = useCallback(() => {
    if (!classes || !model) return null;
    const nameOf = (s: Side) => (s.src === 'text' ? s.text.trim() : 'picture') || 'picture';
    return {
      design: { name: `${nameOf(a)} / ${nameOf(b)}`.slice(0, 40), p: { width, pitch, cell: CELL, stand }, cols, rows, palette: classes.palette, a: encodeRle(classes.a), b: encodeRle(classes.b) },
      preview: snap.current?.jpeg() ?? '',
      settings: { a: { ...a, picture: a.src === 'picture' ? savedPicture(picA) : null }, b: { ...b, picture: b.src === 'picture' ? savedPicture(picB) : null }, mode, n, dark, light, width, ratio, pitch, stand } satisfies Settings,
    };
  }, [classes, model, a, b, picA, picB, width, pitch, stand, cols, rows, mode, n, dark, light, ratio]);

  const sideCtl = (label: string, s: Side, setS: (f: (o: Side) => Side) => void, thumb: string | null, onImage: (im: HTMLImageElement) => void) => (
    <Group title={label}>
      <Seg<Src> label="Show" value={s.src} onChange={(v) => setS((o) => ({ ...o, src: v }))} options={[['text', 'Words'], ['picture', 'A picture']]} />
      {s.src === 'text' ? <Text label="Words" value={s.text} onChange={(v) => setS((o) => ({ ...o, text: v }))} max={30} hint="Short and bold reads best. Use / for a new line." />
        : <PicturePick tool="flip-picture" onImage={onImage} preview={thumb} label={thumb ? 'Change the picture' : 'Upload a picture'} />}
    </Group>
  );
  return (
    <Workbench tool="flip-picture" next="/tools/flip-picture/make" ready={Boolean(model)} getDesign={getDesign} buy={buy}
      doneBlurb="Your flip picture is built. Print it flat in colour, stand it up and walk past it."
      busy={!classes ? 'Loading…' : dp !== live ? 'Updating…' : null}
      bar={<span className="muted">Turn it left and right: the left faces of the ridges carry one picture, the right faces the other.</span>}
      stage={<MeshView parts={parts} fitKey={`${cols}-${rows}-${stand}`} snapRef={snap} />}
      stats={model && views ? <div className="ill-views">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <figure><img src={views.a} alt="Seen from the left" /><figcaption>From the left</figcaption></figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <figure><img src={views.b} alt="Seen from the right" /><figcaption>From the right</figcaption></figure>
        <span>Size <b>{model.size[0].toFixed(0)} × {model.size[1].toFixed(0)} mm</b></span><span>Ridges <b>{cols}</b></span><span>Colours <b>{classes!.palette.length}</b></span>
      </div> : <span>Set the two sides to begin.</span>}
      getting={model ? <WhatYouGet meta={`${model.size[0].toFixed(0)} × ${model.size[1].toFixed(0)} mm`} parts={model.parts.map((q) => ({
        title: q.name === 'plate' ? 'Plate' : q.name === 'stand' ? 'Stand' : `Colour ${q.name.split('-')[1]}`,
        text: q.name === 'plate' ? 'The flat plate under the ridges, with a border.' : q.name === 'stand' ? 'Holds the plate upright on a shelf or desk.' : 'The ridge faces in this colour. All colours print together from the 3MF.',
        tris: q.tris, color: q.color }))} files={[{ title: 'Colour 3MF', text: 'Every colour set, ready for the AMS in Bambu Studio.' }, ...STANDARD_FILES]} /> : null}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>A colour 3MF ready for Bambu Studio and the AMS, the same parts as STL files, a stand, print notes, a preview and a commercial license.</p></>}
      side={<>
        {sideCtl('Seen from the left', a, setA, thA, (im) => { setPicA(im); setThA(thumbOf(im)); })}
        {sideCtl('Seen from the right', b, setB, thB, (im) => { setPicB(im); setThB(thumbOf(im)); })}
        <Group title="Colours">
          <Seg<'two' | 'auto'> label="Print in" value={mode} onChange={setMode} options={[['two', '2 colours'], ['auto', 'Picture colours']]} />
          {mode === 'two' ? <>
            <p className="hint">Dark parts</p><div className="kit-swatches">{SWATCH.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={dark === c} style={{ background: c }} onClick={() => setDark(c)} />)}</div>
            <p className="hint">Light parts</p><div className="kit-swatches">{SWATCH.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={light === c} style={{ background: c }} onClick={() => setLight(c)} />)}</div>
          </> : <Seg<string> label="Filaments" value={String(n)} onChange={(v) => setN(Number(v))} options={[['3', '3'], ['4', '4']]} />}
        </Group>
        <Group title="Size">
          <Range label="Width" value={width} onChange={setWidth} min={80} max={220} step={5} fmt={(v) => `${v} mm`} />
          <Seg<Ratio> label="Shape" value={ratio} onChange={setRatio} options={[['4:3', '4:3'], ['3:2', '3:2'], ['1:1', 'Square'], ['3:4', 'Portrait']]} />
          <Seg<string> label="Ridges" value={String(pitch)} onChange={(v) => setPitch(Number(v))} options={[['2', 'Fine'], ['2.5', 'Standard'], ['3.5', 'Bold']]} />
          <Check label="Add a stand" value={stand} onChange={setStand} />
        </Group>
      </>} />
  );
}
