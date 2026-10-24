'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, PicturePick, Range, Select, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { RATIOS, buildRelief, gridFor } from '@/lib/relief/build.js';
import type { Plaque, ReliefParams } from '@/lib/relief/design';
import { adjust, grayGrid, loadImage, type Framing } from '@/lib/mesh/image-grid';
import { bytesToB64 } from '@/lib/mesh/b64.js';
import { transform } from '@/lib/mesh/mesh.js';

type Pic = CanvasImageSource & { width: number; height: number };
const SHAPES: [Plaque, string][] = [['rounded', 'Rounded rectangle'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['oval', 'Oval'], ['heart', 'Heart'], ['arch', 'Arch']];
const FINISH: [string, string][] = [['#d8d2c4', 'Stone'], ['#b98a5a', 'Wood'], ['#c9a227', 'Gold'], ['#8a8f98', 'Silver'], ['#f4f1e8', 'White']];
const DEMO = '/images/gallery/temple.jpg';

/** Box blur on a byte grid (radius in samples), run twice for a soft result. */
function blur(src: Uint8Array, w: number, h: number, r: number) {
  if (r < 1) return src;
  const a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { b[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; } }
  }
  const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) o[i] = Math.round(a[i]); return o;
}

function coarse(v: Uint8Array, G: { w: number; h: number; pitch: number }) {
  const k = Math.max(1, Math.round(0.9 / G.pitch)), w = Math.floor((G.w - 1) / k) + 1, h = Math.floor((G.h - 1) / k) + 1, out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = v[j * k * G.w + i * k];
  return { v: out, G: { ...G, w, h, pitch: G.pitch * k } };
}

export function ReliefMaker(buy: KitBuy) {
  const [img, setImg] = useState<Pic | null>(null), [thumb, setThumb] = useState<string | null>(null);
  const [name, setName] = useState('Photo relief');
  const [p, setP] = useState<ReliefParams>({ shape: 'rounded', width: 140, ratio: '4:3', height: 105, corner: 10, base: 2, relief: 3, frame: 5, frameUp: 1, raise: 'dark', detail: 'standard', hole: 0 });
  const [fr, setFr] = useState<Framing>({ zoom: 1, x: 0, y: 0 });
  const [adj, setAdj] = useState({ brightness: 0, contrast: 0.15, gamma: 1 });
  const [soft, setSoft] = useState(0.4);
  const [finish, setFinish] = useState('#d8d2c4');
  const snap = useRef<MeshSnap | null>(null);
  const set = <K extends keyof ReliefParams>(k: K, v: ReliefParams[K]) => setP((o) => ({ ...o, [k]: v }));

  useEffect(() => { let ok = true; loadImage(DEMO).then((im) => { if (ok) setImg((cur) => cur ?? im); }).catch(() => {}); return () => { ok = false; }; }, []);

  const free = p.shape !== 'circle' && p.shape !== 'heart';
  const plaqueH = p.ratio === 'custom' ? p.height : Math.round(p.width / (RATIOS[p.ratio as keyof typeof RATIOS] ?? 4 / 3));
  const G = useMemo(() => gridFor(p), [p]);
  const v = useMemo(() => (img ? blur(adjust(grayGrid(img, G.w, G.h, fr), adj), G.w, G.h, Math.round(soft / G.pitch)) : null), [img, G, fr, adj, soft]);
  const live = useMemo(() => ({ p, v, G }), [p, v, G]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => { if (!dp.v) return null; const c = coarse(dp.v, dp.G); return buildRelief(dp.p, c.v, c.G) as { tris: Float32Array; size: number[] }; }, [dp]);
  // shown standing up, like a plaque on a shelf; the file itself lies flat for printing
  const upright = useMemo(() => (model ? transform(model.tris, ([x, y, z]: number[]) => [x, -z, y]) : null), [model]);
  const parts = useMemo(() => (upright ? [{ tris: upright, color: finish }] : []), [upright, finish]);

  const onImage = (im: HTMLImageElement, n: string) => {
    setImg(im); setName(n.slice(0, 40) || 'Photo relief'); setFr({ zoom: 1, x: 0, y: 0 });
    const c = document.createElement('canvas'); c.width = 240; c.height = Math.round((240 * im.height) / im.width); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); setThumb(c.toDataURL('image/jpeg', 0.8));
  };
  const getDesign = useCallback(() => (v ? { design: { name, p, w: G.w, h: G.h, gray: bytesToB64(v) }, preview: snap.current?.jpeg() ?? '' } : null), [v, name, p, G]);

  return (
    <Workbench tool="photo-relief" next="/tools/photo-relief/make" ready={Boolean(v)} getDesign={getDesign} buy={buy}
      doneBlurb="Your relief is built. Print it flat, picture up, and try a dry-brush of paint to bring out the detail."
      busy={dp !== live ? 'Updating…' : null}
      bar={<><span className="muted">Finish (preview only):</span><div className="kit-swatches">{FINISH.map(([c, l]) => <button key={c} type="button" aria-label={l} title={l} aria-pressed={finish === c} style={{ background: c }} onClick={() => setFinish(c)} />)}</div></>}
      stage={<MeshView parts={parts} fitKey={`${dp.p.shape}-${dp.p.width}-${dp.p.ratio}-${dp.p.ratio === 'custom' ? dp.p.height : ''}`} snapRef={snap} />}
      stats={model ? <><span>Size <b>{model.size[0].toFixed(0)} × {model.size[1].toFixed(0)} × {model.size[2].toFixed(1)} mm</b></span><span>Relief <b>{p.relief} mm</b></span><span>Detail <b>{G.pitch} mm</b></span></> : <span>Upload a photo to begin.</span>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>The plaque STL with your picture in relief, a preview, print tips and a commercial license. Your photo stays in your browser unless you choose to share it; only the brightness grid is sent when you download.</p></>}
      side={<>
        <Group title="Photo">
          <PicturePick tool="photo-relief" onImage={onImage} preview={thumb} label={thumb ? 'Change the photo' : 'Upload a photo'} />
          <Range label="Zoom" value={fr.zoom} onChange={(x) => setFr((o) => ({ ...o, zoom: x }))} min={1} max={3} step={0.05} fmt={(x) => `${x.toFixed(2)}×`} />
          <Range label="Move left / right" value={fr.x} onChange={(x) => setFr((o) => ({ ...o, x }))} min={-1} max={1} step={0.02} fmt={(x) => x.toFixed(2)} />
          <Range label="Move up / down" value={fr.y} onChange={(y) => setFr((o) => ({ ...o, y }))} min={-1} max={1} step={0.02} fmt={(y) => y.toFixed(2)} />
          <Range label="Brightness" value={adj.brightness} onChange={(b) => setAdj((o) => ({ ...o, brightness: b }))} min={-0.4} max={0.4} step={0.02} fmt={(b) => b.toFixed(2)} />
          <Range label="Contrast" value={adj.contrast} onChange={(c) => setAdj((o) => ({ ...o, contrast: c }))} min={-0.5} max={0.8} step={0.02} fmt={(c) => c.toFixed(2)} />
          <Range label="Mid-tones" value={adj.gamma} onChange={(g) => setAdj((o) => ({ ...o, gamma: g }))} min={0.5} max={2} step={0.05} fmt={(g) => g.toFixed(2)} />
          <Range label="Smoothing" value={soft} onChange={setSoft} min={0} max={2} step={0.1} fmt={(s) => `${s.toFixed(1)} mm`} hint="Softens grain and noise so the relief prints cleanly." />
          <Seg<'light' | 'dark'> label="Raised parts" value={p.raise} onChange={(r) => set('raise', r)} options={[['light', 'Light areas'], ['dark', 'Dark areas']]} />
        </Group>
        <Group title="Plaque">
          <Select<Plaque> label="Shape" value={p.shape} onChange={(s) => set('shape', s)} options={SHAPES} />
          {free && <Select label="Proportions" value={p.ratio} onChange={(r) => setP((o) => ({ ...o, ratio: r, height: r === 'custom' ? plaqueH : o.height }))} options={[...Object.keys(RATIOS).map((k) => [k, k.replace(':', ' : ')] as [string, string]), ['custom', 'Custom: set width and height']]} />}
          <Range label="Width" value={p.width} onChange={(x) => set('width', x)} min={50} max={250} step={5} fmt={(x) => `${x} mm`} />
          {free && <Range label="Height" value={plaqueH} onChange={(x) => setP((o) => ({ ...o, ratio: 'custom', height: x }))} min={40} max={250} step={5} fmt={(x) => `${x} mm`} hint={p.ratio === 'custom' ? 'Your own size. Pick a proportion above to lock the shape again.' : 'Follows the proportion. Move it to set your own height.'} />}
          {p.shape === 'rounded' && <Range label="Corner radius" value={p.corner} onChange={(x) => set('corner', x)} min={2} max={40} step={1} fmt={(x) => `${x} mm`} />}
          <Range label="Base" value={p.base} onChange={(x) => set('base', x)} min={1} max={6} step={0.2} fmt={(x) => `${x.toFixed(1)} mm`} />
          <Range label="Relief depth" value={p.relief} onChange={(x) => set('relief', x)} min={0.6} max={10} step={0.2} fmt={(x) => `${x.toFixed(1)} mm`} />
          <Range label="Frame width" value={p.frame} onChange={(x) => set('frame', x)} min={0} max={15} step={0.5} fmt={(x) => (x ? `${x} mm` : 'no frame')} />
          {p.frame > 0 && <Range label="Frame above the picture" value={p.frameUp} onChange={(x) => set('frameUp', x)} min={0} max={4} step={0.2} fmt={(x) => `${x.toFixed(1)} mm`} />}
          <Range label="Hanging hole" value={p.hole} onChange={(x) => set('hole', x)} min={0} max={8} step={0.5} fmt={(x) => (x ? `${x} mm` : 'none')} />
          <Select<'standard' | 'fine'> label="Detail" value={p.detail} onChange={(x) => set('detail', x)} options={[['standard', 'Standard (0.4 mm)'], ['fine', 'Fine (0.3 mm)']]} />
          <Text label="Name" value={name} onChange={setName} max={40} />
        </Group>
      </>} />
  );
}
