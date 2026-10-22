'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Check, Group, PicturePick, Range, Select, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { buildCookie, fillHoles, grow, shrink, pieces, pxFor } from '@/lib/cookie/build.js';
import { PRESETS, drawPreset, type Preset } from '@/lib/cookie/shapes';
import type { CookieMode, CookieParams } from '@/lib/cookie/design';
import { loadGoogleFont, textMask } from '@/lib/mesh/text-mask';
import { encodeRle } from '@/lib/layers/rle.js';

const noop = () => () => {};
type Pic = CanvasImageSource & { width: number; height: number };
type Source = 'preset' | 'picture' | 'text';
type Part = { file: string; tris: Float32Array; offset?: [number, number, number]; pieces?: number };

/**
 * Draws a picture so its longest side is `long` px and returns its "ink" mask: for a picture with a transparent
 * background, every visible pixel (whatever its colour); otherwise pixels darker than `thr` (null = automatic).
 */
function darkMask(img: Pic, long: number, thr: number | null, invert: boolean) {
  const k = long / Math.max(img.width, img.height), w = Math.max(4, Math.round(img.width * k)), h = Math.max(4, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h), L = new Float32Array(w * h);
  let clear = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 128) clear++;
  const alpha = clear > w * h * 0.02;
  for (let i = 0; i < w * h; i++) L[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
  const t = thr ?? otsu(L);
  for (let i = 0; i < w * h; i++) { let on = alpha ? d[i * 4 + 3] > 128 : L[i] < t; if (invert) on = !on; m[i] = on ? 1 : 0; }
  return { m, w, h, alpha, thr: t };
}
/** The brightness that best splits a picture into dark and light (Otsu's method). */
function otsu(L: Float32Array) {
  const hist = new Float64Array(256); for (const v of L) hist[Math.min(255, Math.max(0, Math.round(v)))]++;
  let sum = 0, n = 0; for (let i = 0; i < 256; i++) { sum += i * hist[i]; n += hist[i]; }
  let sB = 0, wB = 0, best = 0, at = 128;
  for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; at = i; } }
  return at + 0.5;
}
const place = (src: Uint8Array, sw: number, sh: number, W: number, H: number) => {
  const o = new Uint8Array(W * H), ox = Math.floor((W - sw) / 2), oy = Math.floor((H - sh) / 2);
  for (let y = 0; y < sh; y++) o.set(src.subarray(y * sw, y * sw + sw), (y + oy) * W + ox); return o;
};

export function CookieMaker(buy: KitBuy) {
  const [source, setSource] = useState<Source>('preset');
  const [preset, setPreset] = useState<Preset>('mandala');
  const [pic, setPic] = useState<Pic | null>(null), [thumb, setThumb] = useState<string | null>(null);
  const [text, setText] = useState('A'), [fontOk, setFontOk] = useState(false);
  const [thr, setThr] = useState<number | null>(null), [printed, setPrinted] = useState<'drawing' | 'cutout'>('drawing'), [invert, setInvert] = useState(false), [fill, setFill] = useState(true), [largest, setLargest] = useState(true), [useDetail, setUseDetail] = useState(true);
  const [plateShape, setPlateShape] = useState<'circle' | 'square' | 'rounded'>('circle');
  const [name, setName] = useState('Rangoli mandala');
  const [p, setP] = useState<CookieParams>({ mode: 'stencil', size: 160, height: 15, wall: 1.2, edge: 0.6, flange: 3, flangeT: 1.6, plateT: 2.4, reliefT: 1.5, clearance: 0.8, handle: true, stampToo: true, stencilT: 1.2, rim: 4, islands: 'join', bridge: 1.2 });
  const snap = useRef<MeshSnap | null>(null);
  const set = <K extends keyof CookieParams>(k: K, v: CookieParams[K]) => setP((o) => ({ ...o, [k]: v }));

  useEffect(() => { let ok = true; loadGoogleFont('Poppins', 800).then(() => ok && setFontOk(true)); return () => { ok = false; }; }, []);
  const mode = (m: CookieMode) => { setP((o) => ({ ...o, mode: m, size: m === 'stencil' ? 160 : o.mode === 'stencil' ? 80 : o.size })); if (m !== 'stencil' && source === 'preset' && (preset === 'mandala' || preset === 'rangoli')) { setPreset('heart'); setName('Heart'); } if (m === 'stencil' && source === 'preset' && preset !== 'rangoli' && preset !== 'mandala') { setPreset('mandala'); setName('Rangoli mandala'); } };

  // the masks, at the resolution the server uses
  // shapes are drawn on a canvas, which only exists in the browser (the page is also rendered once on the server)
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  const masks = useMemo(() => {
    if (!inBrowser) return null;
    const px = pxFor(p.size), long = Math.round(p.size * px);
    let raw: { m: Uint8Array; w: number; h: number; alpha?: boolean; thr?: number } | null = null;
    if (source === 'picture' && pic) raw = darkMask(pic, long, thr, invert);
    else if (source === 'preset') raw = darkMask(drawPreset(preset), long, 128, false);
    else if (source === 'text' && fontOk && text.trim()) { const t = textMask([text.trim()], { family: 'Poppins', weight: 800, heightMm: p.size, pxPerMm: px }); if (t) { const k = Math.min(1, long / Math.max(t.w, t.h)); raw = k < 1 ? darkMask(maskCanvas(t.mask, t.w, t.h), long, 128, false) : { m: t.mask, w: t.w, h: t.h }; } }
    if (!raw) return null;
    if (p.mode === 'stencil') {
      const W = long + 8, H = long + 8, plate = new Uint8Array(W * H), r = long / 2, rim = Math.round(p.rim * px);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
        const inside = plateShape === 'circle' ? dx * dx + dy * dy <= r * r : plateShape === 'square' ? Math.abs(dx) <= r && Math.abs(dy) <= r
          : (() => { const rr = r * 0.18, ax = Math.max(Math.abs(dx) - (r - rr), 0), ay = Math.max(Math.abs(dy) - (r - rr), 0); return ax * ax + ay * ay <= rr * rr; })();
        plate[y * W + x] = inside ? 1 : 0;
      }
      const inner = Math.round(long - 2 * rim - 4 * px), d2 = source === 'picture' && pic ? darkMask(pic, inner, thr, invert) : source === 'preset' ? darkMask(drawPreset(preset), inner, 128, false) : raw;
      const ink = place(d2.m, d2.w, d2.h, W, H);
      // 'drawing': the picture itself is printed and the gaps inside its outline are cut through;
      // 'cutout': the picture is cut out of a solid plate
      let detail = printed === 'drawing' ? fillHoles(ink, W, H).map((v, i) => (v && !ink[i] ? 1 : 0)) : ink, solidPic = false;
      if (printed === 'drawing') {
        // a solid picture (no enclosed gaps) would leave nothing to cut: cut its shape out instead
        let gaps = 0, area = 0; for (let i = 0; i < W * H; i++) { if (ink[i]) area++; if (detail[i]) gaps++; }
        if (gaps < area * 0.02) { detail = ink; solidPic = true; }
      }
      return { px, W, H, solidPic, alpha: d2.alpha ?? false, thr: d2.thr ?? 128, shape: plate, detail, n: pieces(plate.map((v, i) => (v && !detail[i] ? 1 : 0)), W, H).count };
    }
    const pad = Math.ceil((p.wall + p.flange + 3) * px), W = raw.w + 2 * pad, H = raw.h + 2 * pad;
    const all = place(raw.m, raw.w, raw.h, W, H);
    let shape = fill ? fillHoles(all, W, H) : all;
    shape = shrink(grow(shape, W, H, Math.round(0.4 * px)), W, H, Math.round(0.4 * px));     // close hairline gaps
    const pc = pieces(shape, W, H); if (largest && pc.count > 1) shape = pc.largest();
    const inner = shrink(shape, W, H, Math.round(Math.max(1.6, p.wall + 0.6) * px)), detail = new Uint8Array(W * H);
    let has = false; for (let i = 0; i < W * H; i++) if (all[i] && inner[i] && useDetail && source !== 'text') { detail[i] = 1; has = true; }
    return { px, W, H, alpha: raw.alpha ?? false, thr: raw.thr ?? 128, shape, detail: has ? detail : null, n: pc.count };
  }, [inBrowser, source, pic, preset, text, fontOk, thr, invert, fill, largest, useDetail, plateShape, p.size, p.mode, p.wall, p.flange, p.rim, printed]);

  const live = useMemo(() => ({ p, masks }), [p, masks]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => (dp.masks ? (buildCookie(dp.p, dp.masks.shape, dp.masks.detail, dp.masks.W, dp.masks.H, dp.masks.px) as Part[]) : null), [dp]);
  const parts = useMemo(() => {
    if (!model) return [];
    const span = (dp.masks!.W / dp.masks!.px) * 0.6 + 12;
    return model.map((q) => ({ tris: q.tris, color: q.file === 'cutter' ? '#d9534f' : q.file === 'stencil' ? '#2e7d4f' : q.file === 'stamp_handle' ? '#f2c14e' : '#f4f1e8',
      offset: (q.file === 'stamp_handle' ? [dp.p.mode === 'cutter' ? span * 1.85 : span, 0, 0] : dp.p.mode === 'cutter' && q.file.startsWith('stamp') ? [span, 0, 0] : undefined) as [number, number, number] | undefined }));
  }, [model, dp]);

  const getDesign = useCallback(() => {
    if (!masks) return null;
    return { design: { name, p, px: masks.px, w: masks.W, h: masks.H, shape: encodeRle(masks.shape), detail: masks.detail ? encodeRle(masks.detail) : null }, preview: snap.current?.jpeg() ?? '' };
  }, [masks, name, p]);

  const onImage = (im: HTMLImageElement, n: string) => {
    setPic(im); setThr(null); setSource('picture'); setName(n.slice(0, 40) || 'Cutter');
    const c = document.createElement('canvas'); c.width = 200; c.height = Math.round((200 * im.height) / im.width); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); setThumb(c.toDataURL('image/png'));
  };
  const stencilPieces = model?.find((q) => q.file === 'stencil')?.pieces ?? 0;

  return (
    <Workbench tool="cookie-cutter" next="/tools/cookie-cutter/make" ready={Boolean(model)} getDesign={getDesign} buy={buy}
      doneBlurb={p.mode === 'stencil' ? 'Your stencil is built. Print it flat and fill the cut-outs with colour.' : 'Your cutter is built. Print it flange-down, no supports needed.'}
      busy={dp !== live ? 'Updating…' : null}
      bar={<span className="muted">Drag to turn, scroll to zoom.{p.mode === 'cutter' && masks?.detail && p.stampToo ? ' The matching stamp is shown beside the cutter.' : ''}</span>}
      stage={<MeshView parts={parts} fitKey={`${dp.p.mode}-${dp.p.size}-${dp.p.stampToo}-${dp.masks?.detail ? 1 : 0}`} snapRef={snap} />}
      stats={model ? <><span>Size <b>{p.size} mm</b></span>{p.mode === 'cutter' && <span>Height <b>{p.height} mm</b></span>}<span>Files <b>{model.length} STL</b></span>
        {p.mode !== 'stencil' && (masks?.n ?? 0) > 1 && !largest && <span style={{ color: '#8a3b12' }}>{masks!.n} separate outlines</span>}
        {p.mode === 'stencil' && stencilPieces > 1 && <span style={{ color: '#8a3b12' }}>{stencilPieces - 1} loose piece{stencilPieces > 2 ? 's' : ''}{p.islands === 'remove' ? ' removed' : p.islands === 'join' ? ' joined with bridges' : ' (they will fall out)'}</span>}</> : <span>Choose a shape to begin.</span>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>{p.mode === 'cutter' ? 'The cutter STL' + (masks?.detail && p.stampToo ? ', a matching stamp that presses the inner lines, and a handle' : '') : p.mode === 'stamp' ? 'The stamp plate, its raised details and a handle' : 'The stencil STL'}, print notes and a commercial license to sell what you print.</p></>}
      side={<>
        <Group title="What to make">
          <Seg<CookieMode> label="Type" value={p.mode} onChange={mode} options={[['stencil', 'Rangoli stencil'], ['cutter', 'Cookie cutter'], ['stamp', 'Stamp']]} />
        </Group>
        <Group title="Shape">
          <Seg<Source> label="From" value={source} onChange={setSource} options={[['preset', 'Ready shapes'], ['picture', 'A picture'], ['text', 'Letters']]} />
          {source === 'preset' && <Select<Preset> label="Shape" value={preset} onChange={(v) => { setPreset(v); setName(PRESETS.find((q) => q[0] === v)![1]); }} options={PRESETS} />}
          {source === 'picture' && <>
            <PicturePick onImage={onImage} preview={thumb} label={thumb ? 'Change the picture' : 'Upload a picture'} />
            <p className="hint">A dark shape or a line drawing on a light background. PNGs with a transparent background work best.</p>
            {masks?.alpha
              ? <p className="hint">Transparent background found: every visible part of the picture is used, whatever its colour.</p>
              : <><Range label="Dark threshold" value={Math.round(thr ?? masks?.thr ?? 128)} onChange={setThr} min={20} max={250} fmt={(v) => (thr == null ? `${v} (auto)` : String(v))} hint="Pixels darker than this count as the shape." />
                {thr != null && <button type="button" className="linkish" onClick={() => setThr(null)}>Back to automatic</button>}</>}
            <Check label="Swap dark and light" value={invert} onChange={setInvert} />
          </>}
          {source === 'text' && <Text label="Letters or numbers" value={text} onChange={(v) => { setText(v); setName(v || 'Letters'); }} max={6} hint="One to six characters, like an initial or an age." />}
          {p.mode !== 'stencil' && source !== 'text' && <>
            <Check label="Fill gaps inside the outline" value={fill} onChange={setFill} />
            <Check label="Keep only the biggest outline" value={largest} onChange={setLargest} />
            <Check label="Use the inner lines for a stamp" value={useDetail} onChange={setUseDetail} />
          </>}
          <Range label="Size (longest side)" value={p.size} onChange={(v) => set('size', v)} min={p.mode === 'stencil' ? 80 : 30} max={p.mode === 'stencil' ? 280 : 160} step={5} fmt={(v) => `${v} mm`} />
        </Group>
        {p.mode === 'cutter' && <Group title="Cutter">
          <Range label="Height" value={p.height} onChange={(v) => set('height', v)} min={8} max={30} step={0.5} fmt={(v) => `${v} mm`} />
          <Range label="Wall" value={p.wall} onChange={(v) => set('wall', v)} min={0.8} max={2.4} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Range label="Cutting edge" value={p.edge} onChange={(v) => set('edge', Math.min(v, p.wall))} min={0.4} max={1.6} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} hint="The top few millimetres are thinner, so it cuts cleanly." />
          <Range label="Flange" value={p.flange} onChange={(v) => set('flange', v)} min={0} max={8} step={0.5} fmt={(v) => `${v} mm`} hint="The wide rim you press on." />
          {masks?.detail && <Check label="Add a matching stamp for the inner lines" value={p.stampToo} onChange={(v) => set('stampToo', v)} />}
        </Group>}
        {(p.mode === 'stamp' || (p.mode === 'cutter' && p.stampToo && masks?.detail)) && <Group title="Stamp">
          <Range label="Plate" value={p.plateT} onChange={(v) => set('plateT', v)} min={1.2} max={5} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Range label="Relief" value={p.reliefT} onChange={(v) => set('reliefT', v)} min={0.6} max={4} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />
          {p.mode === 'cutter' && <Range label="Gap to the cutter" value={p.clearance} onChange={(v) => set('clearance', v)} min={0.3} max={2} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />}
          <Check label="Add a handle" value={p.handle} onChange={(v) => set('handle', v)} />
        </Group>}
        {p.mode === 'stencil' && <Group title="Stencil">
          <Seg<'circle' | 'square' | 'rounded'> label="Plate" value={plateShape} onChange={setPlateShape} options={[['circle', 'Round'], ['square', 'Square'], ['rounded', 'Rounded']]} />
          <Range label="Thickness" value={p.stencilT} onChange={(v) => set('stencilT', v)} min={0.6} max={3} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Range label="Solid rim" value={p.rim} onChange={(v) => set('rim', v)} min={0} max={15} step={0.5} fmt={(v) => `${v} mm`} />
          <Seg<'drawing' | 'cutout'> label="The picture is" value={printed} onChange={setPrinted} options={[['drawing', 'Printed (gaps cut)'], ['cutout', 'Cut out']]} />
          {masks && 'solidPic' in masks && masks.solidPic && <p className="hint" style={{ color: '#8a3b12' }}>This picture is solid shapes with no gaps inside, so its shapes are cut out of the plate instead.</p>}
          <p className="hint">{printed === 'drawing' ? 'The stencil looks like your picture: its lines are plastic and the spaces between them are open for the powder.' : 'The picture is cut out of a solid plate: the powder lands in its shape.'}</p>
          <Seg<'join' | 'remove' | 'keep'> label="Loose pieces" value={p.islands} onChange={(v) => set('islands', v)} options={[['join', 'Join with bridges'], ['remove', 'Remove'], ['keep', 'Keep']]} />
          {p.islands === 'join' && <Range label="Bridge width" value={p.bridge} onChange={(v) => set('bridge', v)} min={0.6} max={3} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />}
          {source === 'picture' && <p className="hint">Dark parts of the picture are cut out of the plate.</p>}
        </Group>}
        <Group title="Name"><Text label="Design name" value={name} onChange={setName} max={40} /></Group>
      </>} />
  );
}

function maskCanvas(m: Uint8Array, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!, im = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = m[i] ? 0 : 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
}
