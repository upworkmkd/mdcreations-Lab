'use client';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, Range, Select, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { SlippyMap, type Layer, type Selection, type View } from './slippy-map';
import { buildColoured, buildTerrain, HEIGHT_PALETTES, heightClasses, satelliteClasses, terrain } from '@/lib/topo/build.js';
import { heightField } from '@/lib/mesh/mesh.js';
import { fetchElevation, fetchImagery, xToLon, yToLat } from '@/lib/topo/geo';
import type { ColourMode, TopoParams, TopoShape } from '@/lib/topo/design';
import { bytesToB64 } from '@/lib/mesh/b64.js';
import './topo.css';

const PLACES: [string, View][] = [
  ['Mount Everest', { lat: 27.9881, lon: 86.925, zoom: 11 }],
  ['Kanchenjunga', { lat: 27.7025, lon: 88.1475, zoom: 11 }],
  ['Nanda Devi', { lat: 30.3753, lon: 79.9707, zoom: 11 }],
  ['Kedarnath', { lat: 30.7352, lon: 79.0669, zoom: 12 }],
  ['Pangong Lake, Ladakh', { lat: 33.72, lon: 78.75, zoom: 10 }],
  ['Munnar, Western Ghats', { lat: 10.0889, lon: 77.0595, zoom: 11 }],
  ['Mount Abu', { lat: 24.5926, lon: 72.7156, zoom: 12 }],
  ['Grand Canyon', { lat: 36.1069, lon: -112.1129, zoom: 11 }],
  ['Mount Fuji', { lat: 35.3606, lon: 138.7274, zoom: 12 }],
  ['Matterhorn', { lat: 45.9763, lon: 7.6586, zoom: 12 }],
  ['Yosemite Valley', { lat: 37.7456, lon: -119.5936, zoom: 12 }],
];
type Model = { tris: Float32Array; size: number[]; relief: number; lo: number; hi: number };
type Grid = { elev: Int16Array; rgb: Uint8Array | null; w: number; h: number; lat: number; lon: number; metres: number; shape: TopoShape };
type Part = { tris: Float32Array; color: string };

export function TopoMaker(buy: KitBuy) {
  const [view, setView] = useState<View>(PLACES[0][1]);
  const [name, setName] = useState(PLACES[0][0]);
  const [p, setP] = useState<TopoParams>({ shape: 'square', width: 120, metres: 10000, exaggeration: 1.5, base: 3, terrace: 0, seaFloor: 'flat' });
  const [detail, setDetail] = useState<'200' | '300'>('200');
  const [grid, setGrid] = useState<Grid | null>(null);
  const [state, setState] = useState<{ kind: 'idle' | 'loading' | 'error'; text?: string }>({ kind: 'idle' });
  const [query, setQuery] = useState(''), [results, setResults] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [tab, setTab] = useState<'map' | '3d'>('map');
  const [layer, setLayer] = useState<Layer>('sat');
  const [mode, setMode] = useState<ColourMode>('satellite');
  const [colours, setColours] = useState<'2' | '3' | '4'>('4');
  const sel = useRef<Selection | null>(null), snap = useRef<MeshSnap | null>(null);
  const set = <K extends keyof TopoParams>(k: K, v: TopoParams[K]) => setP((o) => ({ ...o, [k]: v }));
  const aspect = p.shape === 'rect' ? 1.5 : 1;

  async function takeArea() {
    const s = sel.current; if (!s) return;
    const n = Number(detail), m = Math.round((n - 1) / aspect) + 1;
    setState({ kind: 'loading', text: 'Fetching elevation…' });
    try {
      // the satellite picture is only needed for its colours; the model still works without it
      const [{ elev }, rgb] = await Promise.all([fetchElevation(s.zoom, s.x0, s.y0, s.x1, s.y1, n, m), fetchImagery(s.zoom, s.x0, s.y0, s.x1, s.y1, n, m).catch(() => null)]);
      const lat = yToLat((s.y0 + s.y1) / 2, s.zoom), lon = xToLon((s.x0 + s.x1) / 2, s.zoom);
      if (!rgb) setMode((md) => (md === 'satellite' ? 'height' : md));
      setGrid({ elev, rgb, w: n, h: m, lat, lon, metres: s.metres, shape: p.shape });
      setP((o) => ({ ...o, metres: Math.round(s.metres) }));
      setState({ kind: 'idle' }); setTab('3d');
    } catch (e) { setState({ kind: 'error', text: (e as Error).message === 'tile' ? 'Could not load the elevation for that area. Check your connection and try again.' : (e as Error).message }); }
  }
  async function search(e: React.FormEvent) {
    e.preventDefault(); if (!query.trim()) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query.trim())}`, { headers: { Accept: 'application/json' } });
      const j = (await r.json()) as { display_name: string; lat: string; lon: string }[];
      setResults(j.map((x) => ({ name: x.display_name, lat: Number(x.lat), lon: Number(x.lon) })));
      if (!j.length) setState({ kind: 'error', text: 'No places found with that name.' });
    } catch { setState({ kind: 'error', text: 'Search is not available right now. Move the map by hand instead.' }); }
  }

  const sat = useMemo(() => {
    if (!grid?.rgb || mode !== 'satellite') return null;
    return satelliteClasses(grid.rgb, grid.w, grid.h, Number(colours), null) as { cls: Uint8Array; palette: string[] };
  }, [grid, mode, colours]);
  const palette = mode === 'satellite' ? sat?.palette ?? [] : mode === 'height' ? HEIGHT_PALETTES[Number(colours) as 2 | 3 | 4].colours : ['#b9b08f'];

  const live = useMemo(() => ({ p, grid, mode, sat, colours }), [p, grid, mode, sat, colours]);
  const dp = useDeferredValue(live);
  const view3d = useMemo<{ model: Model; parts: Part[] } | null>(() => {
    if (!dp.grid) return null;
    const g = dp.grid, k = g.w > 220 ? 2 : 1, w = Math.floor((g.w - 1) / k) + 1, h = Math.floor((g.h - 1) / k) + 1, e = new Int16Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) e[j * w + i] = g.elev[j * k * g.w + i * k];
    const pp = { ...dp.p, shape: g.shape }, model = buildTerrain(pp, e, w, h) as Model;
    if (dp.mode === 'satellite' && dp.sat) {
      // the cell colours, thinned out like the elevation for the preview
      const cw = w - 1, ch = h - 1, gw = g.w - 1, cls = new Uint8Array(cw * ch);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) cls[j * cw + i] = dp.sat.cls[j * k * gw + i * k];
      return { model, parts: (buildColoured(pp, e, w, h, cls, dp.sat.palette) as { parts: Part[] }).parts.map((x) => ({ tris: x.tris, color: x.color })) };
    }
    if (dp.mode === 'height') {
      // what the filament changes give: each band in its colour (the print changes colour by layer, so the bands are flat)
      const n = Number(dp.colours) as 2 | 3 | 4, t = terrain(pp, e, w, h), cls = heightClasses(t.z, w, h, pp.base, t.relief, n) as Uint8Array, pal = HEIGHT_PALETTES[n].colours;
      const pitch = pp.width / (w - 1), cw = w - 1, ch = h - 1;
      const parts: Part[] = [];
      for (let c = 0; c < n; c++) {
        const keep = new Uint8Array(cw * ch); let any = false;
        for (let i = 0; i < cw * ch; i++) if (cls[i] === c) { keep[i] = 1; any = true; }
        if (any) parts.push({ tris: heightField(t.z, w, h, pitch, maskShape(keep, pp.shape, w, h, pitch)) as Float32Array, color: pal[c] });
      }
      return { model, parts };
    }
    return { model, parts: [{ tris: model.tris, color: '#b9b08f' }] };
  }, [dp]);
  const model = view3d?.model ?? null, parts = view3d?.parts ?? [];

  const getDesign = useCallback(() => {
    if (!grid) return null;
    const colour = mode === 'satellite' && sat && sat.palette.length > 1 ? { mode, n: sat.palette.length, palette: sat.palette, cls: bytesToB64(sat.cls) }
      : mode === 'height' ? { mode, n: Number(colours) } : { mode: 'one' };
    return { design: { name, p: { ...p, shape: grid.shape }, colour, lat: grid.lat, lon: grid.lon, w: grid.w, h: grid.h, elev: bytesToB64(new Uint8Array(grid.elev.buffer)) }, preview: snap.current?.jpeg() ?? '' };
  }, [grid, name, p, mode, sat, colours]);
  const stale = grid && (grid.shape !== p.shape);

  return (
    <Workbench tool="topo-map" next="/tools/topo-map/make" ready={Boolean(grid) && !stale} getDesign={getDesign} buy={buy}
      doneBlurb="Your terrain is built. Print it flat with adaptive layers, and try colour changes by height."
      busy={state.kind === 'loading' ? state.text! : tab === '3d' && dp !== live ? 'Updating…' : null}
      bar={<>
        <div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={tab === 'map'} onClick={() => setTab('map')}>1. Choose the area</button><button type="button" aria-pressed={tab === '3d'} disabled={!grid} onClick={() => setTab('3d')}>2. 3D model</button></div>
        {tab === 'map' && <button type="button" className="btn small" onClick={takeArea} disabled={state.kind === 'loading'}>Use this area <span className="arrow">→</span></button>}
        {stale && <span style={{ color: '#8a3b12', fontSize: 13 }}>Shape changed: press “Use this area” again.</span>}
      </>}
      stage={tab === 'map' ? <SlippyMap view={view} onView={setView} aspect={aspect} shape={p.shape} onSelection={(s) => { sel.current = s; }} layer={layer} onLayer={setLayer} />
        : <MeshView parts={parts} fitKey={`${grid?.lat}-${grid?.lon}-${grid?.shape}-${dp.p.width}`} bg="#e4e2d8" snapRef={snap} />}
      stats={model ? <><span>Model <b>{model.size[0].toFixed(0)} × {model.size[1].toFixed(0)} × {model.size[2].toFixed(0)} mm</b></span><span>Area <b>{(p.metres / 1000).toFixed(p.metres < 10000 ? 1 : 0)} km</b> across</span><span>Elevation <b>{Math.round(model.lo)}–{Math.round(model.hi)} m</b></span></>
        : <span>{state.kind === 'error' ? state.text : 'Move and zoom the map until the frame holds your place, then press “Use this area”.'}</span>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>{mode === 'satellite' && sat && sat.palette.length > 1 ? `A ${sat.palette.length}-colour 3MF ready for Bambu Studio and the AMS, the same parts as STL, print notes, a preview and a commercial license.` : mode === 'height' ? 'A terrain STL, the exact heights for your filament changes, a preview and a commercial license.' : 'A terrain STL of the area you chose, print notes, a preview and a commercial license.'}</p></>}
      side={<>
        <Group title="Place">
          <form onSubmit={search} className="kit-ctl" style={{ gridTemplateColumns: '1fr auto' }}>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a place" aria-label="Search a place" style={{ gridColumn: '1' }} />
            <button type="submit" className="btn small ghost">Find</button>
          </form>
          {results.length > 0 && <ul className="topo-results">{results.map((r) => <li key={`${r.lat},${r.lon}`}><button type="button" onClick={() => { setView({ lat: r.lat, lon: r.lon, zoom: 11 }); setName(r.name.split(',')[0].slice(0, 40)); setResults([]); setTab('map'); }}>{r.name}</button></li>)}</ul>}
          <Select label="Or a famous place" value="" onChange={(k) => { const pl = PLACES.find((x) => x[0] === k); if (pl) { setView(pl[1]); setName(pl[0]); setTab('map'); } }} options={[['', 'Choose…'], ...PLACES.map(([k]) => [k, k] as [string, string])]} />
          <Text label="Name" value={name} onChange={setName} max={40} />
        </Group>
        <Group title="Colours">
          <Seg<ColourMode> label="Print in" value={mode} onChange={setMode} options={[['satellite', 'Satellite colours'], ['height', 'By height'], ['one', 'One colour']]} />
          {mode !== 'one' && <Seg<'2' | '3' | '4'> label="Filaments" value={colours} onChange={setColours} options={[['2', '2'], ['3', '3'], ['4', '4']]} />}
          {mode !== 'one' && palette.length > 0 && <div className="topo-swatches" aria-label="Colours">{palette.map((c, i) => <span key={i}><i style={{ background: c }} />{i + 1}</span>)}</div>}
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{mode === 'satellite'
            ? (grid && !grid.rgb ? 'The satellite picture did not load for this area: press “Use this area” again, or colour by height.'
              : sat && sat.palette.length < 2 ? 'This area is one colour in the satellite picture, so it prints in one colour. Try a bigger area, or colour by height.'
              : sat && sat.palette.length < Number(colours) ? `This area only has ${sat.palette.length} clearly different colours, so it uses ${sat.palette.length} filaments.`
              : 'Forests, fields, water and snow in the colours of the real place, for an AMS. Each part comes coloured in the 3MF.')
            : mode === 'height' ? 'Green valleys to snowy peaks with filament changes at set heights. Works on any printer, no AMS needed.'
            : 'One filament. Paint it after printing, or print it in white for a clean model.'}</p>
        </Group>
        <Group title="Model">
          <Seg<TopoShape> label="Shape" value={p.shape} onChange={(s) => set('shape', s)} options={[['square', 'Square'], ['rect', '3 : 2'], ['circle', 'Round'], ['hexagon', 'Hexagon']]} />
          <Range label="Width" value={p.width} onChange={(v) => set('width', v)} min={60} max={250} step={5} fmt={(v) => `${v} mm`} />
          <Range label="Height exaggeration" value={p.exaggeration} onChange={(v) => set('exaggeration', v)} min={0.5} max={8} step={0.1} fmt={(v) => `×${v.toFixed(1)}`} hint={model ? `Highest point: ${model.size[2].toFixed(1)} mm. Flat areas look better with more.` : 'Mountains look right at ×1–2; gentle hills need ×3 or more.'} />
          <Range label="Base" value={p.base} onChange={(v) => set('base', v)} min={1} max={15} step={0.5} fmt={(v) => `${v} mm`} />
          <Range label="Terraces" value={p.terrace} onChange={(v) => set('terrace', v)} min={0} max={4} step={0.2} fmt={(v) => (v ? `${v.toFixed(1)} mm steps` : 'smooth')} hint="Steps like a contour map, great for layered colours." />
          <Seg<'flat' | 'keep'> label="Sea floor" value={p.seaFloor} onChange={(v) => set('seaFloor', v)} options={[['flat', 'Flat sea'], ['keep', 'Show the depths']]} />
          <Select<'200' | '300'> label="Detail" value={detail} onChange={setDetail} options={[['200', 'Standard'], ['300', 'Fine (bigger files)']]} />
        </Group>
      </>} />
  );
}

/** The cells of one colour, cut to the round or hexagonal outline too. */
function maskShape(keep: Uint8Array, shape: TopoShape, w: number, h: number, pitch: number) {
  if (shape === 'square' || shape === 'rect') return keep;
  const W = (w - 1) * pitch, H = (h - 1) * pitch, cw = w - 1, ch = h - 1, R = Math.min(W, H) / 2;
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const x = (i + 0.5) * pitch - W / 2, y = H / 2 - (j + 0.5) * pitch, ax = Math.abs(x), ay = Math.abs(y);
    const ok = shape === 'circle' ? x * x + y * y <= R * R : ay <= R * 0.866 && ax * 0.866 + ay * 0.5 <= R * 0.866;
    if (!ok) keep[j * cw + i] = 0;
  }
  return keep;
}
