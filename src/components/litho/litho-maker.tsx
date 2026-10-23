'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Check, Group, PicturePick, Range, Select, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { RATIOS, buildLitho, gridFor } from '@/lib/litho/build.js';
import type { LithoParams, LithoShape } from '@/lib/litho/design';
import { adjust, grayGrid, loadImage, type Framing } from '@/lib/mesh/image-grid';
import { bytesToB64 } from '@/lib/mesh/b64.js';

const SHAPES: [LithoShape, string][] = [['flat', 'Flat panel'], ['curved', 'Curved panel'], ['cylinder', 'Cylinder lamp'], ['heart', 'Heart'], ['moon', 'Moon lamp']];
const DEMO = '/images/hero-layered.jpg';
type Pic = CanvasImageSource & { width: number; height: number };

/** A made-up moon surface (maria, craters and grain), drawn as a world map for the moon lamp. */
function moonSurface(seed = 7): HTMLCanvasElement {
  const W = 1200, H = 600, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!; let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, W, H);
  const blob = (x: number, y: number, rad: number, col: string, a: number) => {
    const stretch = 1 / Math.max(0.25, Math.cos(((y / H) - 0.5) * Math.PI));
    for (const dx of [-W, 0, W]) {
      g.save(); g.translate(x + dx, y); g.scale(stretch, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill(); g.restore();
    }
  };
  for (let k = 0; k < 14; k++) blob(rnd() * W, H * (0.25 + rnd() * 0.5), 60 + rnd() * 120, '#6d6d6d', 0.55);       // dark seas
  for (let k = 0; k < 260; k++) {                                                                                     // craters
    const x = rnd() * W, y = H * (0.08 + rnd() * 0.84), rad = 3 + Math.pow(rnd(), 3) * 38;
    blob(x, y, rad * 1.25, '#f2f2f2', 0.45); blob(x + rad * 0.15, y + rad * 0.15, rad * 0.8, '#555', 0.55); blob(x - rad * 0.1, y - rad * 0.1, rad * 0.45, '#a8a8a8', 0.6);
  }
  const d = g.getImageData(0, 0, W, H);                                                                               // grain
  for (let i = 0; i < W * H; i++) { const n = (rnd() - 0.5) * 18; for (let k = 0; k < 3; k++) d.data[i * 4 + k] = Math.max(0, Math.min(255, d.data[i * 4 + k] + n)); }
  g.putImageData(d, 0, 0);
  return c;
}

type Part = { tris: Float32Array; offset?: [number, number, number]; file: string };

/** Picks every k-th sample: a lighter grid for the live 3D preview. */
function coarse(gray: Uint8Array, G: { w: number; h: number; pitch: number }, closedU: boolean) {
  const k = Math.max(1, Math.round(0.9 / G.pitch));
  const w = closedU ? Math.ceil(G.w / k) : Math.floor((G.w - 1) / k) + 1, h = Math.floor((G.h - 1) / k) + 1;
  const out = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out[j * w + i] = gray[Math.min(G.h - 1, j * k) * G.w + Math.min(G.w - 1, i * k)];
  return { gray: out, G: { ...G, w, h, pitch: closedU ? (G.w * G.pitch) / w : G.pitch * k } };
}

export function LithoMaker(buy: KitBuy) {
  const [img, setImg] = useState<Pic | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [name, setName] = useState('Lithophane');
  const [p, setP] = useState<LithoParams>({ shape: 'flat', width: 120, ratio: '4:3', diameter: 80, height: 100, angle: 120, minT: 0.8, maxT: 3, border: 3, detail: 'standard', stand: true });
  const [fr, setFr] = useState<Framing>({ zoom: 1, x: 0, y: 0 });
  const [adj, setAdj] = useState({ brightness: 0, contrast: 0.1, gamma: 1 });
  const [view, setView] = useState<'3d' | 'lit'>('3d');
  const snap = useRef<MeshSnap | null>(null), lit = useRef<HTMLCanvasElement>(null);
  const set = <K extends keyof LithoParams>(k: K, v: LithoParams[K]) => setP((o) => ({ ...o, [k]: v }));

  useEffect(() => { let ok = true; loadImage(DEMO).then((im) => { if (ok) setImg((cur) => cur ?? im); }).catch(() => {}); return () => { ok = false; }; }, []);

  // the full grid is what gets sent and printed; the 3D preview uses a lighter copy of it
  const G = useMemo(() => gridFor(p), [p]);
  const gray = useMemo(() => (img ? adjust(grayGrid(img, G.w, G.h, fr), adj) : null), [img, G.w, G.h, fr, adj]);
  const live = useMemo(() => ({ p, gray, G }), [p, gray, G]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => {
    if (!dp.gray) return null;
    const c = coarse(dp.gray, dp.G, dp.p.shape === 'cylinder' || dp.p.shape === 'moon');
    return buildLitho(dp.p, c.gray, c.G) as { parts: Part[]; size: number[] };
  }, [dp]);

  useEffect(() => {
    const c = lit.current; if (!c || !gray) return;
    c.width = G.w; c.height = G.h; const g = c.getContext('2d')!, im = g.createImageData(G.w, G.h);
    for (let i = 0; i < G.w * G.h; i++) {
      const t = p.minT + (1 - gray[i] / 255) * (p.maxT - p.minT), L = Math.exp(-1.35 * (t - p.minT)) * 0.97 + 0.03;
      im.data[i * 4] = 255 * L; im.data[i * 4 + 1] = 222 * L; im.data[i * 4 + 2] = 170 * L; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, [gray, G, p.minT, p.maxT, view]);

  const parts = useMemo(() => (model ? model.parts.map((q) => ({ tris: q.tris, color: q.file.includes('base') || q.file === 'stand' ? '#8f8a7a' : '#f3ecd9', offset: q.offset })) : []), [model]);
  const onImage = (im: HTMLImageElement, n: string) => {
    setImg(im); setName(n.slice(0, 40) || 'Lithophane'); setFr({ zoom: 1, x: 0, y: 0 });
    const c = document.createElement('canvas'); c.width = 240; c.height = Math.round((240 * im.height) / im.width);
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); setThumb(c.toDataURL('image/jpeg', 0.8));
  };

  const getDesign = useCallback(() => {
    if (!gray) return null;
    return { design: { name, p, w: G.w, h: G.h, gray: bytesToB64(gray) }, preview: snap.current?.jpeg() ?? '' };
  }, [gray, name, p, G]);

  const round = p.shape === 'cylinder' || p.shape === 'moon';

  const panel = p.shape === 'flat' || p.shape === 'curved';

  const panelH = p.ratio === 'custom' ? p.height : Math.round(p.width / (RATIOS[p.ratio as keyof typeof RATIOS] ?? 4 / 3));
  const sizeText = model ? model.size.filter((v) => v > 0).map((v) => v.toFixed(0)).join(' × ') + ' mm' : '';

  return (
    <Workbench tool="lithophane" next="/tools/lithophane/make" ready={Boolean(gray)} getDesign={getDesign} buy={buy}
      doneBlurb="Your lithophane is built. Print it in white PLA with 100% infill and light it from behind."
      busy={dp !== live ? 'Updating…' : null}
      bar={<>
        <div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button><button type="button" aria-pressed={view === 'lit'} onClick={() => setView('lit')}>Lit from behind</button></div>
        <span className="muted">{view === 'lit' ? 'Roughly how it glows with a warm light behind it.' : 'Drag to turn, scroll to zoom. The preview is lighter than the files.'}</span>
      </>}
      stage={<>{view === '3d' && <MeshView parts={parts} fitKey={`${dp.p.shape}-${dp.p.width}-${dp.p.diameter}-${dp.p.height}-${dp.p.ratio}-${dp.p.stand}`} snapRef={snap} />}
        <canvas ref={lit} className="flat" hidden={view !== 'lit'} style={{ background: '#2a2620' }} /></>}
      stats={model ? <><span>Size <b>{sizeText}</b></span><span>Thickness <b>{p.minT}–{p.maxT} mm</b></span><span>Detail <b>{G.pitch} mm</b></span><span>Files <b>{model.parts.length} STL</b></span></> : <span>Upload a photo to begin.</span>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>The lithophane STL{p.stand ? (round ? (p.shape === 'moon' ? ' and its stand' : ' and its lamp base') : ' and a stand') : ''}, a preview picture, print settings and a commercial license. Your photo stays in your browser; only the brightness grid is sent when you download.</p></>}
      side={<>
        <Group title="Photo">
          <PicturePick onImage={onImage} preview={thumb} label={thumb ? 'Change the photo' : 'Upload a photo'} />
          {p.shape === 'moon' && <button type="button" className="btn small ghost" onClick={() => { const m = moonSurface(Math.floor(Math.random() * 1e6) + 1); setImg(m); setThumb(m.toDataURL('image/jpeg', 0.7)); setName('Moon lamp'); setFr({ zoom: 1, x: 0, y: 0 }); }}>Use a moon surface instead</button>}
          <Range label="Zoom" value={fr.zoom} onChange={(v) => setFr((o) => ({ ...o, zoom: v }))} min={1} max={3} step={0.05} fmt={(v) => `${v.toFixed(2)}×`} />
          <Range label="Move left / right" value={fr.x} onChange={(v) => setFr((o) => ({ ...o, x: v }))} min={-1} max={1} step={0.02} fmt={(v) => v.toFixed(2)} />
          <Range label="Move up / down" value={fr.y} onChange={(v) => setFr((o) => ({ ...o, y: v }))} min={-1} max={1} step={0.02} fmt={(v) => v.toFixed(2)} />
          <Range label="Brightness" value={adj.brightness} onChange={(v) => setAdj((o) => ({ ...o, brightness: v }))} min={-0.4} max={0.4} step={0.02} fmt={(v) => v.toFixed(2)} />
          <Range label="Contrast" value={adj.contrast} onChange={(v) => setAdj((o) => ({ ...o, contrast: v }))} min={-0.5} max={0.8} step={0.02} fmt={(v) => v.toFixed(2)} />
          <Range label="Mid-tones" value={adj.gamma} onChange={(v) => setAdj((o) => ({ ...o, gamma: v }))} min={0.5} max={2} step={0.05} fmt={(v) => v.toFixed(2)} hint="Raise to open up dark faces and shadows." />
        </Group>
        <Group title="Shape">
          <Select<LithoShape> label="Shape" value={p.shape} onChange={(v) => set('shape', v)} options={SHAPES} />
          {panel && <Select label="Proportions" value={p.ratio} onChange={(v) => setP((o) => ({ ...o, ratio: v, height: v === 'custom' ? panelH : o.height }))} options={[...Object.keys(RATIOS).map((k) => [k, k.replace(':', ' : ')] as [string, string]), ['custom', 'Custom: set width and height']]} />}
          {!round && <Range label="Width" value={p.width} onChange={(v) => set('width', v)} min={50} max={250} step={5} fmt={(v) => `${v} mm`} />}
          {panel && <Range label="Height" value={panelH} onChange={(v) => setP((o) => ({ ...o, ratio: 'custom', height: v }))} min={40} max={250} step={5} fmt={(v) => `${v} mm`} hint={p.ratio === 'custom' ? 'Your own size. Pick a proportion above to lock the shape again.' : 'Follows the proportion. Move it to set your own height.'} />}
          {round && <Range label="Diameter" value={p.diameter} onChange={(v) => set('diameter', v)} min={p.shape === 'moon' ? 60 : 50} max={p.shape === 'moon' ? 180 : 160} step={5} fmt={(v) => `${v} mm`} />}
          {p.shape === 'cylinder' && <Range label="Height" value={p.height} onChange={(v) => set('height', v)} min={50} max={220} step={5} fmt={(v) => `${v} mm`} />}
          {p.shape === 'curved' && <Range label="Curve" value={p.angle} onChange={(v) => set('angle', v)} min={40} max={200} step={5} fmt={(v) => `${v}°`} />}
          {p.shape !== 'moon' && <Range label={p.shape === 'cylinder' ? 'Top and bottom rim' : 'Frame'} value={p.border} onChange={(v) => set('border', v)} min={0} max={10} step={0.5} fmt={(v) => `${v} mm`} />}
          {p.shape !== 'curved' && <Check label={p.shape === 'cylinder' ? 'Add a lamp base' : 'Add a stand'} value={p.stand} onChange={(v) => set('stand', v)} />}
        </Group>
        <Group title="Thickness">
          <Range label="Thinnest (brightest)" value={p.minT} onChange={(v) => set('minT', Math.min(v, p.maxT - 0.4))} min={0.4} max={2} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Range label="Thickest (darkest)" value={p.maxT} onChange={(v) => set('maxT', Math.max(v, p.minT + 0.4))} min={1.5} max={6} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Select<'standard' | 'fine'> label="Detail" value={p.detail} onChange={(v) => set('detail', v)} options={[['standard', 'Standard (0.4 mm, smaller files)'], ['fine', 'Fine (0.3 mm)']]} />
          <Text label="Name" value={name} onChange={setName} max={40} />
        </Group>
      </>} />
  );
}
