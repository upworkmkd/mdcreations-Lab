'use client';
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { MeshView } from '@/components/kit/mesh-view';
import { Check, Group, Range, Select, Seg } from '@/components/kit/controls';
import { blur, buildRaised, buildRelief, grayOf, guessRead, pictureMask, raisedGrid, reliefGrid } from '@/lib/image-stl/build.js';
import { adjust } from '@/lib/mesh/image-grid';
import { stlBinary } from '@/lib/mesh/mesh.js';
import { coloured3mf } from '@/lib/mesh/threemf.js';
import { track } from '@/components/tracker';

/* The free Image to STL converter: everything happens in the browser, the picture is never uploaded. */

type Mode = 'raised' | 'relief';
type Read = 'auto' | 'dark' | 'light' | 'background' | 'alpha';
type Base = 'none' | 'outline' | 'plate' | 'circle';
type Pic = { img: HTMLImageElement; w: number; h: number; name: string };
type Box = { x: number; y: number; w: number; h: number };

const EXAMPLES: { label: string; src: string; mode: Mode }[] = [
  { label: 'Silhouette', src: '/guides/shadow-lamp/good-silhouette-in.webp', mode: 'raised' },
  { label: 'Drawing', src: '/guides/shadow-lamp/good-lineart-in.webp', mode: 'raised' },
  { label: 'Photo', src: '/images/gallery/prod-owl.jpg', mode: 'relief' },
];
const COLOURS = ['#f4f1e8', '#161616', '#ffffff', '#c0392b', '#1f5fa8', '#2e7d4f', '#f2c14e', '#7a4fa0', '#e67e22', '#8a8f98', '#b98a5a', '#c9a227'];
const OK_EXT = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'bmp'];

/** RGBA pixels of (part of) the picture, drawn at w × h. */
function pixels(p: Pic, w: number, h: number, crop?: Box) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.imageSmoothingQuality = 'high';
  const r = crop ?? { x: 0, y: 0, w: p.w, h: p.h };
  g.drawImage(p.img, r.x, r.y, r.w, r.h, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

function loadPic(src: string, name: string) {
  return new Promise<Pic>((res, rej) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { w = 1000; h = 1000; }                         // an SVG without a size
      const k = Math.min(1, 2400 / Math.max(w, h));                  // huge photos: no need for more
      res({ img, w: Math.round(w * k) || w, h: Math.round(h * k) || h, name });
    };
    img.onerror = () => rej(new Error('This picture could not be opened. Save it as PNG or JPG and try again (iPhone HEIC photos need converting first).'));
    img.src = src;
  });
}

export function ImageStlMaker() {
  const [pic, setPic] = useState<Pic | null>(null), [err, setErr] = useState('');
  const [mode, setMode] = useState<Mode>('raised');
  const [read, setRead] = useState<Read>('auto'), [level, setLevel] = useState(128), [tol, setTol] = useState(60);
  const [thicken, setThicken] = useState(0), [speck, setSpeck] = useState(1);
  const [width, setWidth] = useState(80), [height, setHeight] = useState(2), [mirror, setMirror] = useState(false);
  const [base, setBase] = useState<Base>('plate'), [baseT, setBaseT] = useState(2), [border, setBorder] = useState(4), [corner, setCorner] = useState(5), [hole, setHole] = useState(0);
  const [depth, setDepth] = useState(3), [rBase, setRBase] = useState(1.2), [raise, setRaise] = useState<'dark' | 'light'>('dark');
  const [soft, setSoft] = useState(0.3), [contrast, setContrast] = useState(0.1), [bright, setBright] = useState(0), [cut, setCut] = useState(false), [pitch, setPitch] = useState(0.3);
  const [baseCol, setBaseCol] = useState('#f4f1e8'), [topCol, setTopCol] = useState('#161616');
  const [view, setView] = useState<'3d' | 'flat'>('3d');
  const flat = useRef<HTMLCanvasElement>(null), fileId = useId();

  async function take(src: string, name: string, m?: Mode) {
    try { const p = await loadPic(src, name); setPic(p); setErr(''); setRead('auto'); if (m) setMode(m); }
    catch (e) { setErr((e as Error).message); }
  }
  function takeFile(f?: File | null) {
    if (!f) return;
    const ext = (f.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
    if (!f.type.startsWith('image/') && !OK_EXT.includes(ext)) { setErr(`${ext ? ext.toUpperCase() + ' files' : 'That file'} cannot be converted here. Upload a PNG, JPG, SVG or WebP picture.`); return; }
    if (/hei[cf]/i.test(f.type) || /^hei[cf]$/.test(ext)) { setErr('iPhone HEIC photos cannot be opened in the browser. Share or export the photo as JPG first, then upload that.'); return; }
    if (f.size > 25 * 1024 * 1024) { setErr('That picture is over 25 MB. Make it smaller and try again.'); return; }
    track('image_stl_upload', ext || f.type, { kb: Math.round(f.size / 1024) });
    take(URL.createObjectURL(f), f.name.replace(/\.[^.]+$/, ''));
  }

  const takeRef = useRef(takeFile);
  useEffect(() => { takeRef.current = takeFile; });
  useEffect(() => {
    let ok = true; loadPic(EXAMPLES[0].src, 'silhouette').then((p) => { if (ok) setPic((cur) => cur ?? p); }).catch(() => {});
    const onPaste = (e: ClipboardEvent) => { const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/')); if (f) takeRef.current(f); };
    window.addEventListener('paste', onPaste);
    return () => { ok = false; window.removeEventListener('paste', onPaste); };
  }, []);

  // how to read it: chosen, or guessed from a small copy of the picture
  const guessed = useMemo<Exclude<Read, 'auto'>>(() => {
    if (!pic) return 'dark';
    const k = Math.min(1, 300 / Math.max(pic.w, pic.h)), w = Math.max(8, Math.round(pic.w * k)), h = Math.max(8, Math.round(pic.h * k));
    return guessRead(pixels(pic, w, h), w, h) as Exclude<Read, 'auto'>;
  }, [pic]);
  const how: Exclude<Read, 'auto'> = read === 'auto' ? guessed : read;

  // raised shapes: trim the empty space round the shape, so the width is the width of the shape itself
  const crop = useMemo<Box | null>(() => {
    if (!pic) return null;
    const k = Math.min(1, 500 / Math.max(pic.w, pic.h)), w = Math.max(8, Math.round(pic.w * k)), h = Math.max(8, Math.round(pic.h * k));
    const m = pictureMask(pixels(pic, w, h), w, h, { read: how, level, tol });
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { x: 0, y: 0, w: pic.w, h: pic.h };
    const s = pic.w / w, padX = 1, padY = 1;
    const bx0 = Math.max(0, x0 - padX), by0 = Math.max(0, y0 - padY), bx1 = Math.min(w, x1 + 1 + padX), by1 = Math.min(h, y1 + 1 + padY);
    return { x: bx0 * s, y: by0 * (pic.h / h), w: (bx1 - bx0) * s, h: (by1 - by0) * (pic.h / h) };
  }, [pic, how, level, tol]);

  const src = useMemo(() => (mode === 'raised' ? crop : pic ? { x: 0, y: 0, w: pic.w, h: pic.h } : null), [mode, crop, pic]);
  const aspect = src ? src.h / src.w : 1;

  // the grid: a mask for raised shapes, brightness for reliefs
  const grid = useMemo(() => {
    if (!pic || !src) return null;
    if (mode === 'raised') {
      const G = raisedGrid(width, aspect);
      const d = pixels(pic, G.w, G.h, src);
      return { kind: 'raised' as const, G, mask: pictureMask(d, G.w, G.h, { read: how, level, tol }) };
    }
    const G = reliefGrid(width, aspect, pitch);
    const d = pixels(pic, G.w, G.h, src);
    const gray = blur(adjust(grayOf(d, G.w, G.h), { brightness: bright, contrast }), G.w, G.h, Math.round(soft / G.pitch));
    const keep = cut ? pictureMask(d, G.w, G.h, { read: how, level, tol }) : null;
    return { kind: 'relief' as const, G, gray, keep };
  }, [pic, src, mode, width, aspect, how, level, tol, pitch, bright, contrast, soft, cut]);

  const settings = useDeferredValue({ grid, height, mirror, base, baseT, border, corner, hole, thicken, speck, depth, rBase, raise });
  const result = useMemo(() => {
    const s = settings, g = s.grid; if (!g) return null;
    try {
      if (g.kind === 'raised') {
        const r = buildRaised(g.mask, g.G.w, g.G.h, g.G.pxmm, { height: s.height, base: s.base, baseT: s.baseT, border: s.border, corner: s.corner, hole: s.hole, mirror: s.mirror, thicken: s.thicken, speck: s.speck });
        return { ok: true as const, kind: 'raised' as const, ...r };
      }
      const r = buildRelief(g.gray, g.keep, g.G.w, g.G.h, g.G.pitch, { baseT: s.rBase, depth: s.depth, raise: s.raise, mirror: s.mirror });
      return { ok: true as const, kind: 'relief' as const, base: new Float32Array(), top: r.tris, size: r.size, pieces: 1, topZ: 0 };
    } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  }, [settings]);

  const parts = useMemo(() => {
    if (!result?.ok) return [];
    if (result.kind === 'relief') return [{ tris: result.top, color: baseCol }];
    return [{ tris: result.base, color: baseCol }, { tris: result.top, color: base === 'none' ? baseCol : topCol }];
  }, [result, baseCol, topCol, base]);

  // flat view: what will be raised (or the brightness the relief follows)
  useEffect(() => {
    const c = flat.current, g = grid; if (!c || !g || view !== 'flat') return;
    const { w, h } = g.G; c.width = w; c.height = h;
    const ctx = c.getContext('2d')!, im = ctx.createImageData(w, h), d = im.data;
    const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const on = hex(mode === 'raised' ? topCol : '#000000'), off = [236, 233, 222];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4, s = j * w + (mirror ? w - 1 - i : i);
      if (g.kind === 'raised') { const v = g.mask[s] ? on : ((i >> 3) + (j >> 3)) & 1 ? off : [246, 244, 236]; d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; }
      else { let v = g.gray[s]; if (raise === 'light') v = 255 - v; if (g.keep && !g.keep[s]) v = 255; d[o] = d[o + 1] = d[o + 2] = v; }
      d[o + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
  }, [grid, view, mode, topCol, mirror, raise]);

  const busy = settings.grid !== grid || settings.height !== height || settings.base !== base;
  const fileName = (pic?.name || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';

  function save(data: Uint8Array, name: string, type: string) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data as BlobPart], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function downloadStl() {
    if (!result?.ok) return;
    const all = new Float32Array(result.base.length + result.top.length); all.set(result.base); all.set(result.top, result.base.length);
    save(stlBinary(all, 'Image to STL - labs.themdcreations.com'), `${fileName}.stl`, 'model/stl');
    track('free_download', 'image-to-stl', { mode, base, format: 'stl', width });
  }
  function download3mf() {
    if (!result?.ok || !result.base.length) return;
    const parts3 = [{ name: 'Base', tris: result.base, color: baseCol }, { name: 'Raised', tris: result.top, color: topCol }];
    save(coloured3mf(parts3, { title: pic?.name || 'Image to STL' }), `${fileName}.3mf`, 'model/3mf');
    track('free_download', 'image-to-stl', { mode, base, format: '3mf', width });
  }

  const raised = mode === 'raised';
  const sw = (label: string, val: string, set: (c: string) => void) => (
    <div className="kit-ctl"><span>{label}</span><span /><div className="kit-swatches" style={{ gridColumn: '1/-1' }}>{COLOURS.map((c) => <button key={c} type="button" aria-label={`${label} ${c}`} aria-pressed={val === c} style={{ background: c }} onClick={() => set(c)} />)}</div></div>
  );

  return (
    <div className="kit">
      <aside className="kit-side">
        <Group title="Picture">
          <label htmlFor={fileId} className="kit-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); takeFile(e.dataTransfer.files[0]); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {pic ? <img src={pic.img.src} alt="" /> : null}
            <span>{pic ? 'Change the picture' : 'Upload a picture'}<br /><small>PNG, JPG, SVG or WebP · drop or paste it here</small></span>
            <input id={fileId} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.svg,.webp" hidden onChange={(e) => { takeFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {err && <p className="hint" style={{ color: '#8a3b12' }}>{err}</p>}
          <div className="kit-ctl"><span>Or try an example</span><span />
            <div className="kit-seg" style={{ gridColumn: '1/-1' }}>{EXAMPLES.map((x) => <button key={x.src} type="button" aria-pressed={pic?.img.src.endsWith(x.src)} onClick={() => take(x.src, x.label.toLowerCase(), x.mode)}>{x.label}</button>)}</div>
          </div>
          <p className="hint">Your picture stays on your device: the STL is made in your browser and nothing is uploaded.</p>
        </Group>

        <Group title="What to make">
          <Seg<Mode> label="Type" value={mode} onChange={setMode} options={[['raised', 'Raised shape'], ['relief', 'Heightmap relief']]} />
          <p className="hint">{raised
            ? 'For logos, silhouettes, drawings and text: the shape is raised as a solid with straight sides, on a base if you like.'
            : 'For photos and shaded pictures: dark parts stand higher than light parts (or the other way round), like a carved plaque.'}</p>
        </Group>

        {(raised || cut) && <Group title="Reading the picture">
          <Select<Read> label="What is the shape" value={read} onChange={setRead} options={[
            ['auto', `Automatic (${{ dark: 'dark parts', light: 'light parts', background: 'remove the background', alpha: 'transparent background' }[guessed]})`],
            ['dark', 'Dark parts (dark shape on light)'], ['light', 'Light parts (light shape on dark)'],
            ['background', 'Everything except a plain background'], ['alpha', 'Everything except transparent parts'],
          ]} />
          {(how === 'dark' || how === 'light') && <Range label="Darkness cut-off" value={level} onChange={setLevel} min={10} max={245} hint="Raise it if parts of your shape are missing; lower it if the background comes along." />}
          {how === 'background' && <Range label="Background tolerance" value={tol} onChange={setTol} min={10} max={200} hint="Raise it if bits of the background stay; lower it if the shape loses parts." />}
          {raised && <>
            <Range label="Thicken thin lines" value={thicken} onChange={setThicken} min={0} max={1.5} step={0.1} fmt={(v) => (v ? `${v.toFixed(1)} mm` : 'off')} hint="Thin lines (under about 0.8 mm) do not print well. Thicken them here." />
            <Range label="Remove specks" value={speck} onChange={setSpeck} min={0} max={10} step={0.5} fmt={(v) => (v ? `under ${v} mm²` : 'off')} />
          </>}
        </Group>}

        <Group title="Size">
          <Range label="Width" value={width} onChange={setWidth} min={15} max={300} step={1} fmt={(v) => `${v} mm`} hint={`Height follows the picture: ${(width * aspect).toFixed(0)} mm.`} />
          {raised
            ? <Range label="Raised height" value={height} onChange={setHeight} min={0.4} max={20} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
            : <>
              <Range label="Relief depth" value={depth} onChange={setDepth} min={0.6} max={10} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
              <Range label="Base thickness" value={rBase} onChange={setRBase} min={0.4} max={6} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
            </>}
          <Check label="Mirror (for stamps and the back of glass)" value={mirror} onChange={setMirror} />
        </Group>

        {raised ? (
          <Group title="Base">
            <Select<Base> label="Base" value={base} onChange={setBase} options={[['plate', 'Rounded plate'], ['outline', 'Follows the outline'], ['circle', 'Round coaster'], ['none', 'No base: the shape only']]} />
            {base !== 'none' && <>
              <Range label="Base thickness" value={baseT} onChange={setBaseT} min={0.6} max={8} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
              <Range label="Border round the shape" value={border} onChange={setBorder} min={1} max={20} step={0.5} fmt={(v) => `${v} mm`} />
              {base === 'plate' && <Range label="Corner radius" value={corner} onChange={setCorner} min={0} max={30} step={1} fmt={(v) => `${v} mm`} />}
            </>}
            <Range label="Keychain hole" value={hole} onChange={setHole} min={0} max={10} step={0.5} fmt={(v) => (v ? `${v} mm` : 'none')} />
          </Group>
        ) : (
          <Group title="Relief">
            <Seg<'dark' | 'light'> label="Higher parts" value={raise} onChange={setRaise} options={[['dark', 'Dark parts'], ['light', 'Light parts']]} />
            <Range label="Brightness" value={bright} onChange={setBright} min={-0.4} max={0.4} step={0.02} fmt={(v) => v.toFixed(2)} />
            <Range label="Contrast" value={contrast} onChange={setContrast} min={-0.5} max={0.8} step={0.02} fmt={(v) => v.toFixed(2)} />
            <Range label="Smoothing" value={soft} onChange={setSoft} min={0} max={2} step={0.1} fmt={(v) => (v ? `${v.toFixed(1)} mm` : 'off')} hint="Softens grain and noise so the surface prints cleanly." />
            <Seg<'rect' | 'cut'> label="Outline" value={cut ? 'cut' : 'rect'} onChange={(v) => setCut(v === 'cut')} options={[['rect', 'Whole rectangle'], ['cut', 'Cut to the shape']]} />
            <Select<string> label="Detail" value={String(pitch)} onChange={(v) => setPitch(Number(v))} options={[['0.5', 'Draft (0.5 mm)'], ['0.3', 'Standard (0.3 mm)'], ['0.2', 'Fine (0.2 mm)']]} />
          </Group>
        )}

        <Group title="Colours (preview)">
          {sw(raised && base !== 'none' ? 'Base' : 'Colour', baseCol, setBaseCol)}
          {raised && base !== 'none' && sw('Raised shape', topCol, setTopCol)}
        </Group>
      </aside>

      <div className="kit-main">
        <div className="kit-bar">
          <div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button><button type="button" aria-pressed={view === 'flat'} onClick={() => setView('flat')}>Flat</button></div>
          <span className="muted">{view === 'flat' ? (raised ? 'The coloured parts are raised.' : 'Darker here means higher.') : 'Drag to turn, scroll or pinch to zoom.'}</span>
        </div>
        <div className="kit-stage">
          {view === '3d' ? <MeshView parts={parts} fitKey={`${mode}-${base}-${width}-${pic?.img.src}`} height={520} /> : <canvas ref={flat} className="flat" style={{ maxHeight: 520, maxWidth: '100%' }} />}
          {busy && <span className="kit-busy">Updating…</span>}
        </div>
        <div className="kit-foot">
          {result?.ok ? <>
            <span>Size <b>{result.size[0].toFixed(0)} × {result.size[1].toFixed(0)} × {result.size[2].toFixed(1)} mm</b></span>
            {result.kind === 'raised' && result.base.length > 0 && <span>Colour change at <b>{result.topZ.toFixed(1)} mm</b></span>}
            {result.kind === 'raised' && result.pieces > 1 && <span style={{ color: '#8a3b12' }}><b>{result.pieces} separate pieces</b>{base === 'none' || base === 'outline' ? ': choose a plate, or a wider border, to join them' : ''}</span>}
            {result.kind === 'relief' && <span>Detail <b>{grid?.kind === 'relief' ? grid.G.pitch : pitch} mm</b></span>}
          </> : <span>{result?.error ?? 'Upload a picture to begin.'}</span>}
        </div>
        <div className="kit-buy">
          <div>
            <p className="eyebrow">Free download</p>
            <p style={{ marginTop: 8, fontSize: 14.5 }}>{raised && base !== 'none'
              ? `A binary STL ready for any slicer, or a 3MF with the base and the raised shape as two colours for Bambu Studio and OrcaSlicer. For two colours with one nozzle, change filament at ${baseT.toFixed(1)} mm.`
              : 'A binary STL ready for Bambu Studio, OrcaSlicer, Cura, PrusaSlicer or any other slicer. Print it flat.'} No account, no watermark, and you can sell what you print.</p>
          </div>
          <div className="buy-slot">
            <button type="button" className="btn buybtn" disabled={!result?.ok || busy} onClick={downloadStl}>Download STL <span className="arrow">↓</span></button>
            {raised && base !== 'none' && <button type="button" className="btn ghost" style={{ marginTop: 8 }} disabled={!result?.ok || busy} onClick={download3mf}>Two-colour 3MF</button>}
            <p className="hint">Free, no account needed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
