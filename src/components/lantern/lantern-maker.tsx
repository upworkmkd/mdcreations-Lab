'use client';
import { useCallback, useDeferredValue, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Check, Group, PicturePick, Range, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { WhatYouGet, STANDARD_FILES } from '@/components/kit/what-you-get';
import { buildLantern, lanternSize, wallMask } from '@/lib/lantern/build.js';
import type { LanternParams } from '@/lib/lantern/design';
import { encodeRle } from '@/lib/layers/rle.js';
import { restoreFrom, savedPicture, useRestoredPicture, type SavedDesign } from '@/lib/saved-design';

const noop = () => () => {};
type Pic = CanvasImageSource & { width: number; height: number };
type Scene = 'stars' | 'hearts' | 'festival' | 'picture';
type Settings = { scene: Scene; picture: string | null; repeat: number; level: number; invert: boolean; p: LanternParams; colour: string; names?: string; density?: number; zoom?: number; ox?: number; oy?: number };
const SCENE_NAME: Record<Exclude<Scene, 'picture'>, string> = { stars: 'Starry night', hearts: 'Hearts', festival: 'Festival lights' };
const NAME_FONT = '"Poppins", "Arial Black", Arial, sans-serif';

/** A heart centred on (x, y), `s` wide, turned by `rot` (radians). */
function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s / 34, s / 34); g.beginPath();
  for (let k = 0; k <= 64; k++) { const t = (k / 64) * Math.PI * 2, X = 16 * Math.sin(t) ** 3, Y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); if (k) g.lineTo(X, Y + 2); else g.moveTo(X, Y + 2); }
  g.closePath(); g.fill(); g.restore();
}

/* ------------------------------------------------------------------ built-in scenes (white = light on the walls) */
function scene(kind: Exclude<Scene, 'picture'>, w: number, h: number, density: number, names: string[]): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  let r = 11; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const pine = (x: number, base: number, ht: number) => { g.beginPath(); g.moveTo(x, base - ht); for (let k = 0; k < 4; k++) { const y = base - ht + (ht * (k + 1)) / 4.4, wd = (ht * (k + 1)) / 7; g.lineTo(x + wd, y); g.lineTo(x + wd * 0.45, y); } g.lineTo(x + ht * 0.04, base); g.lineTo(x - ht * 0.04, base); for (let k = 3; k >= 0; k--) { const y = base - ht + (ht * (k + 1)) / 4.4, wd = (ht * (k + 1)) / 7; g.lineTo(x - wd * 0.45, y); g.lineTo(x - wd, y); } g.closePath(); g.fill(); };
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
  if (kind === 'stars') {
    for (let k = 0; k < (w * h / 420) * density; k++) { const s = rnd(); g.beginPath(); g.arc(rnd() * w, rnd() * h * 0.78, 1.4 + s * s * 4.2, 0, 7); g.fill(); }
    // a crescent moon
    const mx = w * 0.18, my = h * 0.28, mr = h * 0.13; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.9, 0, 7); g.fill();
    g.fillStyle = '#000'; for (let x = -10; x < w + 10; x += 14 + rnd() * 18) pine(x, h, h * (0.14 + rnd() * 0.16));
  } else if (kind === 'hearts') {
    // big hearts spread round, each holding a name (in shadow, inside the light); small hearts in between
    const big = Math.max(1, Math.round(w / (h * 1.05))), bs = Math.min(h * 0.62, (w / big) * 0.8), spots: [number, number, number][] = [];
    for (let i = 0; i < big; i++) {
      const x = ((i + 0.5) / big) * w, y = h * (i % 2 ? 0.55 : 0.47);
      g.fillStyle = '#fff'; heart(g, x, y, bs); spots.push([x, y, bs * 0.62]);
      const name = names.length ? names[i % names.length] : '';
      if (name) {
        g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
        // below the dip between the two lobes, where the heart is widest
        let fs = bs * 0.2; g.font = `800 ${fs}px ${NAME_FONT}`;
        const tw = g.measureText(name).width; if (tw > bs * 0.6) { fs *= (bs * 0.6) / tw; g.font = `800 ${fs}px ${NAME_FONT}`; }
        g.fillText(name, x, y + bs * 0.03);
      }
    }
    g.fillStyle = '#fff';
    const n = Math.round((w * h / 2600) * density), placed: [number, number, number][] = [];
    for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) {
      const s = h * (0.045 + rnd() ** 2 * 0.11), x = rnd() * w, y = s * 0.6 + rnd() * (h - s * 1.2);
      const clear = (q: [number, number, number]) => Math.hypot(q[0] - x, q[1] - y) > q[2] + s * 0.62;
      if (!spots.every(clear) || !placed.every((q) => Math.hypot(q[0] - x, q[1] - y) > (q[2] + s) * 0.62)) continue;
      heart(g, x, y, s, (rnd() - 0.5) * 0.7); placed.push([x, y, s]); k++;
    }
  } else {
    // strings of lights in swags, hanging lanterns and diyas along the bottom
    const gap = 34 / Math.max(0.3, density);
    for (let row = 0; row < 2; row++) { const y0 = h * (0.12 + row * 0.22), sag = h * 0.08, n = Math.round(w / gap); for (let k = 0; k <= n; k++) { const x = (k / n) * w, t = (k % 6) / 6, y = y0 + Math.sin(Math.PI * t) * sag; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); } }
    for (let x = w / 10; x < w; x += w / 5) { const y = h * 0.42; g.beginPath(); g.ellipse(x, y, h * 0.05, h * 0.075, 0, 0, 7); g.fill(); g.fillRect(x - 1.5, y - h * 0.15, 3, h * 0.08); }
    for (let x = w / 16; x < w; x += w / 8) { const y = h * 0.86; g.beginPath(); g.ellipse(x, y, h * 0.06, h * 0.025, 0, 0, Math.PI); g.fill(); g.beginPath(); g.moveTo(x, y - h * 0.09); g.quadraticCurveTo(x + h * 0.025, y - h * 0.03, x, y - h * 0.01); g.quadraticCurveTo(x - h * 0.025, y - h * 0.03, x, y - h * 0.09); g.fill(); }
  }
  return c;
}

/**
 * The picture band round the lantern: the picture repeated `repeat` times, dark = solid (or the other way). Each copy
 * fits whole in its share of the band at zoom 0; zoom (0-100) enlarges it up to 5 times, and ox / oy (-100 to 100)
 * move it left / right and up / down (at 100 it has just slid out). The wall outside the picture stays solid. The
 * built-in scenes fill their share exactly.
 */
function band(src: Pic, w: number, h: number, repeat: number, level: number, invert: boolean, fit: { zoom: number; ox: number; oy: number } | null = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  const tw = w / repeat, k = fit ? Math.min(tw / src.width, h / src.height) * (1 + fit.zoom / 25) : Math.max(tw / src.width, h / src.height), dw = src.width * k, dh = src.height * k;
  const dx = (tw - dw) / 2 + ((fit?.ox ?? 0) / 100) * (tw + dw) / 2, dy = (h - dh) / 2 - ((fit?.oy ?? 0) / 100) * (h + dh) / 2;
  for (let i = 0; i < repeat; i++) { g.save(); g.beginPath(); g.rect(i * tw, 0, tw, h); g.clip(); g.drawImage(src, i * tw + dx, dy, dw, dh); g.restore(); }
  const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
  // with a picture, the wall beside and around it (where no copy is drawn) stays solid, so it does not become one big hole
  const inside = (x: number, y: number) => { if (!fit) return true; const u = x % tw; return u >= dx && u < dx + dw && y >= dy && y < dy + dh; };
  for (let i = 0; i < w * h; i++) { if (!inside(i % w, Math.floor(i / w))) { m[i] = 1; continue; } const a = d[i * 4 + 3] / 255, l = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * a + 255 * (1 - a); let on = l < level; if (invert) on = !on; m[i] = on ? 1 : 0; }
  return m;
}
/** What the walls look like: the light through the holes, unrolled. */
function wallsUrl(mask: Uint8Array, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!, im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, glow = 1 - Math.abs(y / h - 0.5) * 0.9, on = !mask[i]; im.data[i * 4] = on ? 255 * glow : 22; im.data[i * 4 + 1] = on ? 214 * glow : 18; im.data[i * 4 + 2] = on ? 150 * glow : 14; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c.toDataURL('image/jpeg', 0.8);
}

const BASE_P: LanternParams = { diameter: 90, height: 120, wall: 1.6, rimTop: 5, rimBottom: 7, rocker: true };

export function LanternMaker({ saved, ...buy }: KitBuy & { saved?: SavedDesign | null }) {
  const [init] = useState(() => restoreFrom<Settings>(saved, (q) => ({ p: q.p as LanternParams })));
  const [sceneId, setScene] = useState<Scene>(init?.scene && init.scene in SCENE_NAME || init?.scene === 'picture' ? init.scene : 'stars');
  const [zoom, setZoom] = useState(init?.zoom ?? 0), [ox, setOx] = useState(init?.ox ?? 0), [oy, setOy] = useState(init?.oy ?? 0);
  const [names, setNames] = useState(init?.names ?? ''), [density, setDensity] = useState(init?.density ?? 1);
  const nameList = useMemo(() => names.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6), [names]);
  const dNames = useDeferredValue(nameList);
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
    if (sceneId === 'picture') return pic ? band(pic, S.w, bh, repeat, level, invert, { zoom, ox, oy }) : null;
    return band(scene(sceneId, Math.round(S.w / repeat), bh, density, dNames), S.w, bh, repeat, 128, invert);
  }, [ready, sceneId, pic, S.w, bh, repeat, level, invert, density, dNames, zoom, ox, oy]);
  const live = useMemo(() => ({ bandMask, p, S, bh }), [bandMask, p, S, bh]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => {
    if (!dp.bandMask) return null;
    const wm = wallMask(dp.bandMask, dp.S.w, dp.bh, dp.S.top, dp.S.bottom);
    return { ...buildLantern(wm.mask, dp.S.w, dp.S.h, dp.p, 1.6), wall: wm.mask, bridges: wm.bridges };
  }, [dp]);
  const parts = useMemo(() => (model ? [{ tris: model.shell, color: colour }, { tris: model.base, color: '#d9a441' }, { tris: model.post, color: '#d9a441' }] : []), [model, colour]);
  const walls = useMemo(() => (model && view === 'walls' ? wallsUrl(model.wall, dp.S.w, dp.S.h) : null), [model, view, dp]);

  const getDesign = useCallback(() => {
    if (!bandMask || !model) return null;
    return {
      design: { name: sceneId === 'picture' ? 'Shadow lantern' : sceneId === 'hearts' && nameList.length ? `${nameList.join(' & ')} lantern` : `${SCENE_NAME[sceneId]} lantern`, p, w: S.w, h: bh, band: encodeRle(bandMask) },
      preview: snap.current?.jpeg() ?? '',
      settings: { scene: sceneId, picture: sceneId === 'picture' ? savedPicture(pic) : null, repeat, level, invert, p, colour, names, density, zoom, ox, oy } satisfies Settings,
    };
  }, [bandMask, model, sceneId, nameList, p, S.w, bh, pic, repeat, level, invert, colour, names, density, zoom, ox, oy]);

  const onImage = (im: HTMLImageElement) => { setPic(im); setThumb(thumbOf(im)); setScene('picture'); setZoom(0); setOx(0); setOy(0); };
  return (
    <Workbench tool="shadow-lantern" next="/tools/shadow-lantern/make" ready={Boolean(model)} getDesign={getDesign} buy={buy}
      doneBlurb="Your lantern is built. Print the shell standing up in a dark, opaque filament, wire the LED to the battery and charger under the base (see the README) and switch off the room lights."
      busy={!model ? 'Building…' : dp !== live ? 'Updating…' : null}
      bar={<><div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>Lantern</button><button type="button" aria-pressed={view === 'walls'} onClick={() => setView('walls')}>On the walls</button></div>
        {view === '3d' && <><span className="muted">Shell:</span><div className="kit-swatches">{['#2c2e21', '#161616', '#6b3a2a', '#1f3a5f'].map((c) => <button key={c} type="button" aria-label={c} aria-pressed={colour === c} style={{ background: c }} onClick={() => setColour(c)} />)}</div></>}</>}
      stage={view === '3d' ? <MeshView parts={parts} fitKey={`${p.diameter}-${p.height}`} snapRef={snap} />
        // eslint-disable-next-line @next/next/no-img-element
        : <div className="lan-walls">{walls ? <img src={walls} alt="The picture as it falls on the walls, all the way round" /> : null}<p>All the way round the room, as it falls on the walls in the dark (the left edge joins the right).</p></div>}
      stats={model ? <><span>Lantern <b>{p.diameter} × {p.height} mm</b></span><span>LED at <b>{model.led.toFixed(0)} mm</b></span>{model.bridges > 0 && <span>{model.bridges} floating {model.bridges === 1 ? 'bit gets' : 'bits get'} a thin bridge</span>}</> : <span>Choose a scene or upload a picture.</span>}
      getting={model ? <WhatYouGet meta={`${p.diameter} × ${p.height} mm`} parts={[
        { title: 'Lantern shell', text: 'The picture cut all the way round a cylinder. Prints standing up, no supports, in a dark opaque filament.', tris: model.shell, color: colour, tag: 'your picture' },
        { title: 'Base', text: `The shell stands in a groove in the plate. Underneath it is open: glue the battery, the Type-C charging module${p.rocker !== false ? ' and the switch' : ''} there. Prints upside down, no supports.`, tris: model.base, color: '#d9a441' },
        { title: 'LED post', text: `Pushes into the plate and holds the LED at ${(model.led - model.top).toFixed(0)} mm above it, the middle of the picture, so it falls straight on the walls.`, tris: model.post, color: '#d9a441' },
      ]} files={STANDARD_FILES} needs={[
        { title: 'A bare 5 mm LED', text: 'Warm white. A tiny bright point gives the sharpest shadows (not a diffused tea light).' },
        { title: 'Battery and charger', text: 'A small 3.7 V LiPo (or an 18650) and a TP4056 Type-C charging module, glued under the base. Charges from any USB-C phone charger.' },
        ...(p.rocker !== false ? [{ title: 'A mini rocker switch', text: 'KCD11 size (13 × 9 mm), snaps into the hole next to the charging port.' }] : []),
      ]} /> : null}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>The lantern shell, the base (with a Type-C charging port hole) and the LED post as STL files, print and assembly notes, a preview and a commercial license.</p></>}
      side={<>
        <Group title="Picture">
          <Seg<Scene> label="Scene" value={sceneId} onChange={setScene} options={[['stars', 'Starry night'], ['hearts', 'Hearts'], ['festival', 'Festival'], ['picture', 'My picture']]} />
          {sceneId === 'hearts' && <Text label="Names in the hearts" value={names} onChange={setNames} max={60} placeholder="Priya, Rahul" hint="Separate names with commas. Each big heart gets the next name, in shadow inside the light." />}
          {sceneId !== 'picture' && <Range label="Density" value={density} onChange={setDensity} min={0.3} max={1.6} step={0.1} fmt={(v) => `${Math.round(v * 100)}%`} hint={sceneId === 'hearts' ? 'How many small hearts round the big ones.' : sceneId === 'stars' ? 'How many stars.' : 'How close the lights are on the strings.'} />}
          {sceneId === 'picture' && <>
            <PicturePick tool="shadow-lantern" onImage={onImage} preview={thumb} label={thumb ? 'Change the picture' : 'Upload a picture'} />
            {pic && <>
              <Range label="Zoom" value={zoom} onChange={setZoom} min={0} max={100} step={1} fmt={(v) => (v ? `${(1 + v / 25).toFixed(1)}×` : 'whole picture')} hint="At 0 the whole picture fits. Zoom in to fill more of the lantern." />
              <Range label="Left / right" value={ox} onChange={setOx} min={-100} max={100} step={1} fmt={(v) => (v ? `${v > 0 ? 'right' : 'left'} ${Math.abs(v)}` : 'centre')} />
              <Range label="Up / down" value={oy} onChange={setOy} min={-100} max={100} step={1} fmt={(v) => (v ? `${v > 0 ? 'up' : 'down'} ${Math.abs(v)}` : 'centre')} />
              {(zoom !== 0 || ox !== 0 || oy !== 0) && <button type="button" className="linkish" onClick={() => { setZoom(0); setOx(0); setOy(0); }}>Reset the picture</button>}
            </>}
            <Range label="Darkness cut-off" value={level} onChange={setLevel} min={20} max={235} step={1} hint="Darker than this is solid and casts shadow." />
          </>}
          <Range label="Repeat round the lantern" value={repeat} onChange={setRepeat} min={1} max={6} step={1} fmt={(v) => (v === 1 ? 'once (panorama)' : `${v} times`)} hint={sceneId === 'picture' ? 'A wide panorama goes round once; a single picture looks good 3 or 4 times.' : undefined} />
          <Check label="Swap light and shadow" value={invert} onChange={setInvert} />
        </Group>
        <Group title="Lantern">
          <Range label="Diameter" value={p.diameter} onChange={(v) => set('diameter', v)} min={70} max={130} step={5} fmt={(v) => `${v} mm`} />
          <Range label="Height" value={p.height} onChange={(v) => set('height', v)} min={80} max={180} step={5} fmt={(v) => `${v} mm`} />
          <Check label="Hole for an on/off switch" value={p.rocker !== false} onChange={(v) => set('rocker', v)} />
          <Range label="Wall" value={p.wall} onChange={(v) => set('wall', v)} min={1.2} max={2.4} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} hint="Thicker walls block light better; 1.6 mm suits most filaments." />
        </Group>
      </>} />
  );
}

function thumbOf(im: Pic) {
  const c = document.createElement('canvas'); c.width = 240; c.height = Math.round((240 * im.height) / im.width); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8);
}
