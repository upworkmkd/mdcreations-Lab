'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, PicturePick, Range, Select, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { RATIOS, buildPainting, gridFor, layerCount, layerTop, simulate, spread, swapGuide } from '@/lib/fpaint/build.js';
import type { Filament, PaintParams } from '@/lib/fpaint/design';
import { adjust, grayGrid, type Framing } from '@/lib/mesh/image-grid';
import { bytesToB64 } from '@/lib/mesh/b64.js';
import './paint.css';

type Pic = CanvasImageSource & { width: number; height: number };
/** A made-up sunset over hills, used until you upload your own picture. */
function demoLandscape(): HTMLCanvasElement {
  const W = 1200, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#2a2a3a'); sky.addColorStop(0.55, '#9a8a8a'); sky.addColorStop(1, '#f4ead8');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W * 0.62, H * 0.5, 10, W * 0.62, H * 0.5, 260); sun.addColorStop(0, '#ffffff'); sun.addColorStop(0.25, '#fff6e0'); sun.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  const ridge = (base: number, amp: number, col: string, seed: number) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) g.lineTo(x, base - amp * (0.55 * Math.sin(x / 140 + seed) + 0.3 * Math.sin(x / 53 + seed * 2) + 0.15 * Math.sin(x / 23 + seed * 3)));
    g.lineTo(W, H); g.closePath(); g.fill();
  };
  ridge(H * 0.6, 70, '#8a8494', 1); ridge(H * 0.68, 80, '#5d5866', 2.3); ridge(H * 0.78, 60, '#36323d', 4.1);
  const lake = g.createLinearGradient(0, H * 0.82, 0, H); lake.addColorStop(0, '#d9cfc0'); lake.addColorStop(1, '#4a4652');
  g.fillStyle = lake; g.fillRect(0, H * 0.84, W, H * 0.16);
  g.fillStyle = '#1c1a20'; for (let i = 0; i < 9; i++) { const x = 60 + i * 38 + (i % 3) * 9, hgt = 90 + (i % 4) * 30; g.beginPath(); g.moveTo(x, H * 0.86); g.lineTo(x + 16, H * 0.86 - hgt); g.lineTo(x + 32, H * 0.86); g.fill(); }
  return c;
}
const PALETTES: Record<string, Omit<Filament, 'start'>[]> = {
  'Black and white': [{ name: 'Black', hex: '#111111', td: 0.6 }, { name: 'Grey', hex: '#8a8f98', td: 1.0 }, { name: 'White', hex: '#f5f5f2', td: 1.6 }],
  Sunset: [{ name: 'Black', hex: '#111111', td: 0.6 }, { name: 'Red', hex: '#c0392b', td: 1.0 }, { name: 'Orange', hex: '#e67e22', td: 1.1 }, { name: 'Yellow', hex: '#f2c14e', td: 1.3 }, { name: 'White', hex: '#f5f5f2', td: 1.6 }],
  Ocean: [{ name: 'Navy', hex: '#14213d', td: 0.7 }, { name: 'Blue', hex: '#1f5fa8', td: 1.0 }, { name: 'Teal', hex: '#2a9d8f', td: 1.2 }, { name: 'White', hex: '#f5f5f2', td: 1.6 }],
  Forest: [{ name: 'Black', hex: '#111111', td: 0.6 }, { name: 'Green', hex: '#2e7d4f', td: 1.0 }, { name: 'Lime', hex: '#9bc53d', td: 1.2 }, { name: 'Cream', hex: '#efe6cf', td: 1.5 }],
  Sepia: [{ name: 'Dark brown', hex: '#3b2414', td: 0.7 }, { name: 'Brown', hex: '#8b5a2b', td: 1.0 }, { name: 'Sand', hex: '#d8b98a', td: 1.3 }, { name: 'Ivory', hex: '#f3ead6', td: 1.6 }],
};

export function PaintMaker(buy: KitBuy) {
  const [img, setImg] = useState<Pic | null>(null), [thumb, setThumb] = useState<string | null>(null);
  const [name, setName] = useState('Filament painting');
  const [p, setP] = useState<PaintParams>({ width: 150, ratio: '4:3', detail: 'standard', firstLayer: 0.2, layer: 0.08, minH: 0.6, maxH: 2.4, curve: 1, frame: 0 });
  const [colours, setColours] = useState<Filament[]>(() => spread({ width: 150, ratio: '4:3', detail: 'standard', firstLayer: 0.2, layer: 0.08, minH: 0.6, maxH: 2.4, curve: 1, frame: 0 }, PALETTES.Sunset.map((c) => ({ ...c, start: 1 }))));
  const [fr, setFr] = useState<Framing>({ zoom: 1, x: 0, y: 0 });
  const [adj, setAdj] = useState({ brightness: 0, contrast: 0.1, gamma: 1 });
  const [view, setView] = useState<'paint' | '3d'>('paint');
  const snap = useRef<MeshSnap | null>(null), cv = useRef<HTMLCanvasElement>(null);
  const n1 = layerCount(p);
  const setPar = <K extends keyof PaintParams>(k: K, val: PaintParams[K]) => { const n = { ...p, [k]: val }; setP(n); setColours((c) => spread(n, c)); };

  useEffect(() => { const t = setTimeout(() => setImg((cur) => cur ?? demoLandscape()), 0); return () => clearTimeout(t); }, []);

  const G = useMemo(() => gridFor(p), [p]);
  const v = useMemo(() => (img ? adjust(grayGrid(img, G.w, G.h, fr), adj) : null), [img, G, fr, adj]);

  useEffect(() => {
    const c = cv.current; if (!c || !v) return;
    c.width = G.w; c.height = G.h; const g = c.getContext('2d')!, im = g.createImageData(G.w, G.h);
    simulate(p, v, G.w, G.h, colours, im.data); g.putImageData(im, 0, 0);
  }, [v, G, p, colours, view]);

  const live = useMemo(() => ({ p, v, G }), [p, v, G]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => {
    if (!dp.v || view !== '3d') return null;
    const k = 2, w = Math.floor((dp.G.w - 1) / k) + 1, h = Math.floor((dp.G.h - 1) / k) + 1, s = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s[j * w + i] = dp.v[j * k * dp.G.w + i * k];
    return buildPainting(dp.p, s, { w, h, pitch: dp.G.pitch * k }) as { tris: Float32Array; size: number[] };
  }, [dp, view]);
  const parts = useMemo(() => (model ? [{ tris: model.tris, color: '#e9e4d6' }] : []), [model]);

  const setCol = (k: number, c: Partial<Filament>) => setColours((o) => o.map((x, i) => (i === k ? { ...x, ...c } : x)));
  const setStart = (k: number, s: number) => setColours((o) => o.map((x, i) => (i === k ? { ...x, start: Math.max(i > 1 ? o[i - 1].start + 1 : 2, Math.min(i + 1 < o.length ? o[i + 1].start - 1 : n1, s)) } : x)));
  const onImage = (im: HTMLImageElement, n: string) => {
    setImg(im); setName(n.slice(0, 40) || 'Filament painting'); setFr({ zoom: 1, x: 0, y: 0 });
    const c = document.createElement('canvas'); c.width = 240; c.height = Math.round((240 * im.height) / im.width); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); setThumb(c.toDataURL('image/jpeg', 0.8));
  };
  const getDesign = useCallback(() => {
    if (!v) return null;
    // the painted simulation is the nicest picture of the result
    const preview = cv.current ? (() => { const c = document.createElement('canvas'), k = Math.min(1, 900 / G.w); c.width = Math.round(G.w * k); c.height = Math.round(G.h * k); c.getContext('2d')!.drawImage(cv.current!, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85); })() : snap.current?.jpeg() ?? '';
    return { design: { name, p, colours, w: G.w, h: G.h, gray: bytesToB64(v) }, preview };
  }, [v, name, p, colours, G]);

  const guide = useMemo(() => swapGuide(p, colours) as string[], [p, colours]);

  return (
    <Workbench tool="filament-painting" next="/tools/filament-painting/make" ready={Boolean(v)} getDesign={getDesign} buy={buy}
      doneBlurb="Your painting is built. Set the same layer heights in your slicer and add the colour changes from the guide."
      busy={view === '3d' && dp !== live ? 'Updating…' : null}
      bar={<>
        <div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={view === 'paint'} onClick={() => setView('paint')}>Painted</button><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D relief</button></div>
        <span className="muted">{view === 'paint' ? 'An estimate of the printed colours. Real results depend on your filaments.' : 'Drag to turn, scroll to zoom.'}</span>
      </>}
      stage={<>{view === '3d' && <MeshView parts={parts} fitKey={`${dp.p.width}-${dp.p.ratio}`} snapRef={snap} />}<canvas ref={cv} className="flat" hidden={view !== 'paint'} /></>}
      stats={<><span>Size <b>{p.width} × {(p.width / (RATIOS as Record<string, number>)[p.ratio]).toFixed(0)} mm</b></span><span>Height <b>{layerTop(p, n1).toFixed(2)} mm</b></span><span>Layers <b>{n1}</b></span><span>Swaps <b>{colours.length - 1}</b></span></>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>One STL, a colour-swap guide with the exact layer for every filament change, slicer settings, a preview and a commercial license.</p></>}
      side={<>
        <Group title="Picture">
          <PicturePick onImage={onImage} preview={thumb} label={thumb ? 'Change the picture' : 'Upload a picture'} />
          <Range label="Zoom" value={fr.zoom} onChange={(z) => setFr((o) => ({ ...o, zoom: z }))} min={1} max={3} step={0.05} fmt={(z) => `${z.toFixed(2)}×`} />
          <Range label="Move left / right" value={fr.x} onChange={(x) => setFr((o) => ({ ...o, x }))} min={-1} max={1} step={0.02} fmt={(x) => x.toFixed(2)} />
          <Range label="Move up / down" value={fr.y} onChange={(y) => setFr((o) => ({ ...o, y }))} min={-1} max={1} step={0.02} fmt={(y) => y.toFixed(2)} />
          <Range label="Brightness" value={adj.brightness} onChange={(b) => setAdj((o) => ({ ...o, brightness: b }))} min={-0.4} max={0.4} step={0.02} fmt={(b) => b.toFixed(2)} />
          <Range label="Contrast" value={adj.contrast} onChange={(c) => setAdj((o) => ({ ...o, contrast: c }))} min={-0.5} max={0.8} step={0.02} fmt={(c) => c.toFixed(2)} />
          <Range label="Mid-tones" value={p.curve} onChange={(c) => setP((o) => ({ ...o, curve: c }))} min={0.4} max={2.5} step={0.05} fmt={(c) => c.toFixed(2)} hint="Lower lifts the darks into the middle colours." />
        </Group>
        <Group title="Filaments (dark to light)">
          <Select label="Palette" value="" onChange={(k) => k && setColours(spread(p, PALETTES[k].map((c) => ({ ...c, start: 1 }))))} options={[['', 'Choose a palette…'], ...Object.keys(PALETTES).map((k) => [k, k] as [string, string])]} />
          {colours.map((c, k) => (
            <div key={k} className="fp-row">
              <input type="color" value={c.hex} aria-label={`Colour ${k + 1}`} onChange={(e) => setCol(k, { hex: e.target.value })} />
              <input type="text" value={c.name} maxLength={30} aria-label={`Name ${k + 1}`} onChange={(e) => setCol(k, { name: e.target.value })} />
              <label className="fp-td">TD <input type="number" step={0.1} min={0.1} max={10} value={c.td} onChange={(e) => setCol(k, { td: Math.max(0.1, Number(e.target.value) || 0.1) })} /></label>
              {colours.length > 2 && <button type="button" className="fp-x" aria-label={`Remove ${c.name}`} onClick={() => setColours((o) => spread(p, o.filter((_, i) => i !== k)))}>×</button>}
              {k > 0 && <div className="fp-start"><input type="range" min={2} max={n1} value={c.start} aria-label={`${c.name} starts at layer`} onChange={(e) => setStart(k, Number(e.target.value))} /><span>from layer {c.start} · {layerTop(p, c.start - 1).toFixed(2)} mm</span></div>}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {colours.length < 8 && <button type="button" className="linkish" onClick={() => setColours((o) => spread(p, [...o, { name: 'White', hex: '#f5f5f2', td: 1.6, start: 1 }]))}>+ Add a filament</button>}
            <button type="button" className="linkish" onClick={() => setColours((o) => spread(p, o))}>Spread the changes evenly</button>
          </div>
          <p className="hint">TD (transmission distance) is how thick a filament must be to hide what is under it. Lower means more opaque. HueForge and many filament makers list it.</p>
        </Group>
        <Group title="Print">
          <Range label="Width" value={p.width} onChange={(x) => setPar('width', x)} min={60} max={250} step={5} fmt={(x) => `${x} mm`} />
          <Select label="Proportions" value={p.ratio} onChange={(r) => setPar('ratio', r)} options={Object.keys(RATIOS).map((k) => [k, k.replace(':', ' : ')] as [string, string])} />
          <Select label="Layer height" value={String(p.layer)} onChange={(x) => setPar('layer', Number(x))} options={[['0.04', '0.04 mm (finest, slow)'], ['0.08', '0.08 mm (recommended)'], ['0.12', '0.12 mm'], ['0.16', '0.16 mm'], ['0.2', '0.20 mm (fast)']]} />
          <Select label="First layer" value={String(p.firstLayer)} onChange={(x) => setPar('firstLayer', Number(x))} options={[['0.16', '0.16 mm'], ['0.2', '0.20 mm'], ['0.24', '0.24 mm'], ['0.28', '0.28 mm']]} />
          <Range label="Base (darkest parts)" value={p.minH} onChange={(x) => setPar('minH', Math.min(x, p.maxH - 0.4))} min={0.4} max={2} step={0.04} fmt={(x) => `${x.toFixed(2)} mm`} />
          <Range label="Tallest (lightest parts)" value={p.maxH} onChange={(x) => setPar('maxH', Math.max(x, p.minH + 0.4))} min={1.2} max={5} step={0.04} fmt={(x) => `${x.toFixed(2)} mm`} />
          <Range label="Frame" value={p.frame} onChange={(x) => setPar('frame', x)} min={0} max={10} step={0.5} fmt={(x) => (x ? `${x} mm` : 'none')} />
          <Select<'standard' | 'fine'> label="Detail" value={p.detail} onChange={(x) => setPar('detail', x)} options={[['standard', 'Standard (0.35 mm)'], ['fine', 'Fine (0.25 mm)']]} />
          <Text label="Name" value={name} onChange={setName} max={40} />
        </Group>
        <Group title="Colour swaps">
          <pre className="fp-guide">{guide.join('\n')}</pre>
        </Group>
      </>} />
  );
}
