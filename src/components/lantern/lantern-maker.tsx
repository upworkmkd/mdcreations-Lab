'use client';
import { useCallback, useDeferredValue, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Check, Group, PicturePick, Range, Seg } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { WhatYouGet, STANDARD_FILES } from '@/components/kit/what-you-get';
import { buildLantern, lanternSize, wallMask } from '@/lib/lantern/build.js';
import type { LanternParams } from '@/lib/lantern/design';
import { encodeRle } from '@/lib/layers/rle.js';
import { restoreFrom, savedPicture, useRestoredPicture, type SavedDesign } from '@/lib/saved-design';

const noop = () => () => {};
type Pic = CanvasImageSource & { width: number; height: number };
type Scene = 'stars' | 'forest' | 'festival' | 'picture';
type Settings = { scene: Scene; picture: string | null; repeat: number; level: number; invert: boolean; p: LanternParams; colour: string };

/* ------------------------------------------------------------------ built-in scenes (white = light on the walls) */
function scene(kind: Exclude<Scene, 'picture'>, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  let r = 11; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const pine = (x: number, base: number, ht: number) => { g.beginPath(); g.moveTo(x, base - ht); for (let k = 0; k < 4; k++) { const y = base - ht + (ht * (k + 1)) / 4.4, wd = (ht * (k + 1)) / 7; g.lineTo(x + wd, y); g.lineTo(x + wd * 0.45, y); } g.lineTo(x + ht * 0.04, base); g.lineTo(x - ht * 0.04, base); for (let k = 3; k >= 0; k--) { const y = base - ht + (ht * (k + 1)) / 4.4, wd = (ht * (k + 1)) / 7; g.lineTo(x - wd * 0.45, y); g.lineTo(x - wd, y); } g.closePath(); g.fill(); };
  if (kind === 'stars') {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
    for (let k = 0; k < w * h / 420; k++) { const s = rnd(); g.beginPath(); g.arc(rnd() * w, rnd() * h * 0.78, 1.4 + s * s * 4.2, 0, 7); g.fill(); }
    // a crescent moon
    const mx = w * 0.18, my = h * 0.28, mr = h * 0.13; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.9, 0, 7); g.fill();
    g.fillStyle = '#000'; for (let x = -10; x < w + 10; x += 14 + rnd() * 18) pine(x, h, h * (0.14 + rnd() * 0.16));
  } else if (kind === 'forest') {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#000';
    for (let x = -10; x < w + 10; x += 22 + rnd() * 30) pine(x, h, h * (0.35 + rnd() * 0.5));
    g.fillRect(0, h * 0.94, w, h * 0.06);
    for (let k = 0; k < 9; k++) { const x = rnd() * w, y = h * (0.12 + rnd() * 0.25), s = h * 0.035; g.lineWidth = Math.max(2, s * 0.35); g.strokeStyle = '#000'; g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s / 2, y - s * 0.7, x, y); g.quadraticCurveTo(x + s / 2, y - s * 0.7, x + s, y); g.stroke(); }
  } else {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
    // strings of lights in swags, hanging lanterns and diyas along the bottom
    for (let row = 0; row < 2; row++) { const y0 = h * (0.12 + row * 0.22), sag = h * 0.08, n = Math.round(w / 34); for (let k = 0; k <= n; k++) { const x = (k / n) * w, t = (k % 6) / 6, y = y0 + Math.sin(Math.PI * t) * sag; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); } }
    for (let x = w / 10; x < w; x += w / 5) { const y = h * 0.42; g.beginPath(); g.ellipse(x, y, h * 0.05, h * 0.075, 0, 0, 7); g.fill(); g.fillRect(x - 1.5, y - h * 0.15, 3, h * 0.08); }
    for (let x = w / 16; x < w; x += w / 8) { const y = h * 0.86; g.beginPath(); g.ellipse(x, y, h * 0.06, h * 0.025, 0, 0, Math.PI); g.fill(); g.beginPath(); g.moveTo(x, y - h * 0.09); g.quadraticCurveTo(x + h * 0.025, y - h * 0.03, x, y - h * 0.01); g.quadraticCurveTo(x - h * 0.025, y - h * 0.03, x, y - h * 0.09); g.fill(); }
  }
  return c;
}

/** The picture band round the lantern: the picture repeated `repeat` times, dark = solid (or the other way). */
function band(src: Pic, w: number, h: number, repeat: number, level: number, invert: boolean) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  const tw = w / repeat, k = Math.max(tw / src.width, h / src.height), dw = src.width * k, dh = src.height * k;
  for (let i = 0; i < repeat; i++) g.drawImage(src, i * tw + (tw - dw) / 2, (h - dh) / 2, dw, dh);
  const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const a = d[i * 4 + 3] / 255, l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a); let on = l < level; if (invert) on = !on; m[i] = on ? 1 : 0; }
  return m;
}
/** What the walls look like: the light through the holes, unrolled. */
function wallsUrl(mask: Uint8Array, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!, im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, glow = 1 - Math.abs(y / h - 0.5) * 0.9, on = !mask[i]; im.data[i * 4] = on ? 255 * glow : 22; im.data[i * 4 + 1] = on ? 214 * glow : 18; im.data[i * 4 + 2] = on ? 150 * glow : 14; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c.toDataURL('image/jpeg', 0.8);
}

const BASE_P: LanternParams = { diameter: 90, height: 120, wall: 1.6, rimTop: 5, rimBottom: 7 };

export function LanternMaker({ saved, ...buy }: KitBuy & { saved?: SavedDesign | null }) {
  const [init] = useState(() => restoreFrom<Settings>(saved, (q) => ({ p: q.p as LanternParams })));
  const [sceneId, setScene] = useState<Scene>(init?.scene ?? 'stars');
  const [pic, setPic] = useState<Pic | null>(null), [thumb, setThumb] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(init?.repeat ?? 1), [level, setLevel] = useState(init?.level ?? 128), [invert, setInvert] = useState(init?.invert ?? false);
  const [p, setP] = useState<LanternParams>(() => ({ ...BASE_P, ...(init?.p ?? {}) }));
  const [colour, setColour] = useState(init?.colour ?? '#2c2e21');
  const [view, setView] = useState<'3d' | 'walls'>('3d');
  const snap = useRef<MeshSnap | null>(null);
  const set = <K extends keyof LanternParams>(k: K, v: LanternParams[K]) => setP((o) => ({ ...o, [k]: v }));
  useRestoredPicture(init?.picture, (im) => { setPic(im); setThumb(thumbOf(im)); });

  const S = useMemo(() => lanternSize(p), [p]);
  const bh = S.h - S.top - S.bottom;
  // the scenes are drawn on a canvas, which only exists in the browser (the page is also drawn once on the server)
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const bandMask = useMemo(() => {
    if (!ready) return null;
    if (sceneId === 'picture') return pic ? band(pic, S.w, bh, repeat, level, invert) : null;
    return band(scene(sceneId, Math.round(S.w / repeat), bh), S.w, bh, repeat, 128, invert);
  }, [ready, sceneId, pic, S.w, bh, repeat, level, invert]);
  const live = useMemo(() => ({ bandMask, p, S, bh }), [bandMask, p, S, bh]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => {
    if (!dp.bandMask) return null;
    const wm = wallMask(dp.bandMask, dp.S.w, dp.bh, dp.S.top, dp.S.bottom);
    return { ...buildLantern(wm.mask, dp.S.w, dp.S.h, dp.p, 1.6), wall: wm.mask, bridges: wm.bridges };
  }, [dp]);
  const parts = useMemo(() => (model ? [{ tris: model.shell, color: colour }, { tris: model.base, color: '#d9a441' }] : []), [model, colour]);
  const walls = useMemo(() => (model && view === 'walls' ? wallsUrl(model.wall, dp.S.w, dp.S.h) : null), [model, view, dp]);

  const getDesign = useCallback(() => {
    if (!bandMask || !model) return null;
    return {
      design: { name: sceneId === 'picture' ? 'Shadow lantern' : `${{ stars: 'Starry night', forest: 'Forest', festival: 'Festival lights' }[sceneId]} lantern`, p, w: S.w, h: bh, band: encodeRle(bandMask) },
      preview: snap.current?.jpeg() ?? '',
      settings: { scene: sceneId, picture: sceneId === 'picture' ? savedPicture(pic) : null, repeat, level, invert, p, colour } satisfies Settings,
    };
  }, [bandMask, model, sceneId, p, S.w, bh, pic, repeat, level, invert, colour]);

  const onImage = (im: HTMLImageElement) => { setPic(im); setThumb(thumbOf(im)); setScene('picture'); };
  return (
    <Workbench tool="shadow-lantern" next="/tools/shadow-lantern/make" ready={Boolean(model)} getDesign={getDesign} buy={buy}
      doneBlurb="Your lantern is built. Print the shell standing up in a dark, opaque filament, put a bare LED on the post and switch off the room lights."
      busy={!model ? 'Building…' : dp !== live ? 'Updating…' : null}
      bar={<><div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>Lantern</button><button type="button" aria-pressed={view === 'walls'} onClick={() => setView('walls')}>On the walls</button></div>
        {view === '3d' && <><span className="muted">Shell:</span><div className="kit-swatches">{['#2c2e21', '#161616', '#6b3a2a', '#1f3a5f'].map((c) => <button key={c} type="button" aria-label={c} aria-pressed={colour === c} style={{ background: c }} onClick={() => setColour(c)} />)}</div></>}</>}
      stage={view === '3d' ? <MeshView parts={parts} fitKey={`${p.diameter}-${p.height}`} snapRef={snap} />
        // eslint-disable-next-line @next/next/no-img-element
        : <div className="lan-walls">{walls ? <img src={walls} alt="The picture as it falls on the walls, all the way round" /> : null}<p>All the way round the room, as it falls on the walls in the dark (the left edge joins the right).</p></div>}
      stats={model ? <><span>Lantern <b>{p.diameter} × {p.height} mm</b></span><span>LED at <b>{model.led.toFixed(0)} mm</b></span>{model.bridges > 0 && <span>{model.bridges} floating {model.bridges === 1 ? 'bit gets' : 'bits get'} a thin bridge</span>}</> : <span>Choose a scene or upload a picture.</span>}
      getting={model ? <WhatYouGet meta={`${p.diameter} × ${p.height} mm`} parts={[
        { title: 'Lantern shell', text: 'The picture cut all the way round a cylinder. Prints standing up, no supports, in a dark opaque filament.', tris: model.shell, color: colour, tag: 'your picture' },
        { title: 'Base and LED post', text: `Holds the shell and puts the LED at ${model.led.toFixed(0)} mm, the middle of the picture, so it falls straight on the walls.`, tris: model.base, color: '#d9a441' },
      ]} files={STANDARD_FILES} needs={[
        { title: 'A bare 5 mm LED', text: 'Warm white. A tiny bright point gives the sharpest shadows (not a diffused tea light).' },
        { title: 'Power', text: 'A 2 × AA holder or a USB LED. The wires run down inside the post.' },
      ]} /> : null}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>The lantern shell and the base with an LED post as STL files, print and assembly notes, a preview and a commercial license.</p></>}
      side={<>
        <Group title="Picture">
          <Seg<Scene> label="Scene" value={sceneId} onChange={setScene} options={[['stars', 'Starry night'], ['forest', 'Forest'], ['festival', 'Festival'], ['picture', 'My picture']]} />
          {sceneId === 'picture' && <>
            <PicturePick tool="shadow-lantern" onImage={onImage} preview={thumb} label={thumb ? 'Change the picture' : 'Upload a picture'} />
            <Range label="Darkness cut-off" value={level} onChange={setLevel} min={20} max={235} step={1} hint="Darker than this is solid and casts shadow." />
          </>}
          <Range label="Repeat round the lantern" value={repeat} onChange={setRepeat} min={1} max={6} step={1} fmt={(v) => (v === 1 ? 'once (panorama)' : `${v} times`)} hint={sceneId === 'picture' ? 'A wide panorama goes round once; a single picture looks good 3 or 4 times.' : undefined} />
          <Check label="Swap light and shadow" value={invert} onChange={setInvert} />
        </Group>
        <Group title="Lantern">
          <Range label="Diameter" value={p.diameter} onChange={(v) => set('diameter', v)} min={70} max={130} step={5} fmt={(v) => `${v} mm`} />
          <Range label="Height" value={p.height} onChange={(v) => set('height', v)} min={80} max={180} step={5} fmt={(v) => `${v} mm`} />
          <Range label="Wall" value={p.wall} onChange={(v) => set('wall', v)} min={1.2} max={2.4} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} hint="Thicker walls block light better; 1.6 mm suits most filaments." />
        </Group>
      </>} />
  );
}

function thumbOf(im: Pic) {
  const c = document.createElement('canvas'); c.width = 240; c.height = Math.round((240 * im.height) / im.width); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8);
}
