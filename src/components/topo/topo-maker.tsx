'use client';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, Range, Select, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { SlippyMap, type Selection, type View } from './slippy-map';
import { buildTerrain } from '@/lib/topo/build.js';
import { fetchElevation, xToLon, yToLat } from '@/lib/topo/geo';
import type { TopoParams, TopoShape } from '@/lib/topo/design';
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
type Grid = { elev: Int16Array; w: number; h: number; lat: number; lon: number; metres: number; shape: TopoShape };

export function TopoMaker(buy: KitBuy) {
  const [view, setView] = useState<View>(PLACES[0][1]);
  const [name, setName] = useState(PLACES[0][0]);
  const [p, setP] = useState<TopoParams>({ shape: 'square', width: 120, metres: 10000, exaggeration: 1.5, base: 3, terrace: 0, seaFloor: 'flat' });
  const [detail, setDetail] = useState<'200' | '300'>('200');
  const [grid, setGrid] = useState<Grid | null>(null);
  const [state, setState] = useState<{ kind: 'idle' | 'loading' | 'error'; text?: string }>({ kind: 'idle' });
  const [query, setQuery] = useState(''), [results, setResults] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [tab, setTab] = useState<'map' | '3d'>('map');
  const sel = useRef<Selection | null>(null), snap = useRef<MeshSnap | null>(null);
  const set = <K extends keyof TopoParams>(k: K, v: TopoParams[K]) => setP((o) => ({ ...o, [k]: v }));
  const aspect = p.shape === 'rect' ? 1.5 : 1;

  async function takeArea() {
    const s = sel.current; if (!s) return;
    const n = Number(detail), m = Math.round((n - 1) / aspect) + 1;
    setState({ kind: 'loading', text: 'Fetching elevation…' });
    try {
      const { elev } = await fetchElevation(s.zoom, s.x0, s.y0, s.x1, s.y1, n, m);
      const lat = yToLat((s.y0 + s.y1) / 2, s.zoom), lon = xToLon((s.x0 + s.x1) / 2, s.zoom);
      setGrid({ elev, w: n, h: m, lat, lon, metres: s.metres, shape: p.shape });
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

  const live = useMemo(() => ({ p, grid }), [p, grid]);
  const dp = useDeferredValue(live);
  const model = useMemo<Model | null>(() => {
    if (!dp.grid) return null;
    const g = dp.grid, k = g.w > 220 ? 2 : 1, w = Math.floor((g.w - 1) / k) + 1, h = Math.floor((g.h - 1) / k) + 1, e = new Int16Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) e[j * w + i] = g.elev[j * k * g.w + i * k];
    return buildTerrain({ ...dp.p, shape: g.shape }, e, w, h) as Model;
  }, [dp]);
  const parts = useMemo(() => (model ? [{ tris: model.tris, color: '#b9b08f' }] : []), [model]);

  const getDesign = useCallback(() => {
    if (!grid) return null;
    return { design: { name, p: { ...p, shape: grid.shape }, lat: grid.lat, lon: grid.lon, w: grid.w, h: grid.h, elev: bytesToB64(new Uint8Array(grid.elev.buffer)) }, preview: snap.current?.jpeg() ?? '' };
  }, [grid, name, p]);
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
      stage={tab === 'map' ? <SlippyMap view={view} onView={setView} aspect={aspect} shape={p.shape} onSelection={(s) => { sel.current = s; }} />
        : <MeshView parts={parts} fitKey={`${grid?.lat}-${grid?.lon}-${grid?.shape}-${dp.p.width}`} snapRef={snap} />}
      stats={model ? <><span>Model <b>{model.size[0].toFixed(0)} × {model.size[1].toFixed(0)} × {model.size[2].toFixed(0)} mm</b></span><span>Area <b>{(p.metres / 1000).toFixed(p.metres < 10000 ? 1 : 0)} km</b> across</span><span>Elevation <b>{Math.round(model.lo)}–{Math.round(model.hi)} m</b></span></>
        : <span>{state.kind === 'error' ? state.text : 'Move and zoom the map until the frame holds your place, then press “Use this area”.'}</span>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>A terrain STL of the area you chose, print tips with heights for colour changes, a preview and a commercial license.</p></>}
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
