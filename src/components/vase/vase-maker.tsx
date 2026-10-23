'use client';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, Range, Select, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { buildVase } from '@/lib/vase/build.js';
import type { VaseMode, VaseParams } from '@/lib/vase/design';

const BASE: VaseParams = { mode: 'spiral', height: 180, r0: 38, r1: 55, r2: 46, r3: 34, sides: 0, soft: 0.3, twist: 0, ripples: 0, rippleDepth: 0, wave: 0, bands: 0, bandDepth: 0, wall: 1.6, floor: 3, drain: 0, segments: 160, step: 1.2, fitting: 'top', hole: 42 };
const PRESETS: Record<string, Partial<VaseParams>> = {
  'Twisted hexagon': { sides: 6, soft: 0.25, twist: 120, ripples: 0, rippleDepth: 0, r0: 40, r1: 52, r2: 48, r3: 36, height: 180 },
  'Ripple bottle': { sides: 0, ripples: 18, rippleDepth: 2.5, wave: 1.5, twist: 0, r0: 38, r1: 60, r2: 30, r3: 22, height: 220 },
  'Spiral flutes': { sides: 0, ripples: 24, rippleDepth: 1.8, twist: 180, wave: 0, r0: 45, r1: 50, r2: 50, r3: 45, height: 160 },
  'Ribbed bowl': { sides: 0, ripples: 0, rippleDepth: 0, bands: 10, bandDepth: 2, r0: 40, r1: 70, r2: 85, r3: 90, height: 90 },
  'Star column': { sides: 5, soft: 0, twist: 72, ripples: 0, rippleDepth: 0, r0: 35, r1: 35, r2: 35, r3: 35, height: 200 },
  'Bell shade': { mode: 'shade', sides: 0, ripples: 30, rippleDepth: 1.4, twist: 60, r0: 110, r1: 95, r2: 70, r3: 55, height: 150, fitting: 'top' },
  'Drum shade': { mode: 'shade', sides: 12, soft: 0.6, ripples: 0, rippleDepth: 0, twist: 30, r0: 90, r1: 90, r2: 90, r3: 90, height: 160, fitting: 'top' },
};

export function VaseMaker(buy: KitBuy) {
  const [p, setP] = useState<VaseParams>({ ...BASE, ...PRESETS['Twisted hexagon'] });
  const [name, setName] = useState('Twisted hexagon');
  const [colour, setColour] = useState('#d36fa0');
  const snap = useRef<MeshSnap | null>(null);
  const set = <K extends keyof VaseParams>(k: K, v: VaseParams[K]) => setP((o) => ({ ...o, [k]: v }));
  const dp = useDeferredValue(p);
  const model = useMemo(() => buildVase(dp) as { parts: { tris: Float32Array; file: string }[]; size: number[] }, [dp]);
  const parts = useMemo(() => model.parts.map((q) => ({ tris: q.tris, color: colour })), [model, colour]);
  const getDesign = useCallback(() => ({ design: { name, p }, preview: snap.current?.jpeg() ?? '' }), [name, p]);
  const maxR = Math.max(p.r0, p.r1, p.r2, p.r3);
  const mode = (m: VaseMode) => setP((o) => ({ ...o, mode: m, ...(m === 'shade' && o.mode !== 'shade' ? { r0: 100, r1: 95, r2: 80, r3: 70, height: 150 } : {}), ...(m !== 'shade' && o.mode === 'shade' ? { r0: 40, r1: 55, r2: 46, r3: 34, height: 180 } : {}), ...(m === 'planter' ? { drain: o.drain || 8 } : {}) }));

  return (
    <Workbench tool="vase" next="/tools/vase/make" ready getDesign={getDesign} buy={buy}
      doneBlurb={p.mode === 'spiral' ? 'Your vase is built. Turn on vase mode (spiralize) in your slicer.' : 'Your files are built. Print upright with no supports.'}
      busy={dp !== p ? 'Updating…' : null}
      bar={<><span className="muted">Colour (preview only):</span><div className="kit-swatches">{['#d36fa0', '#f4f1e8', '#2e7d4f', '#1f5fa8', '#c9a227', '#e67e22', '#161616', '#8fb8c9'].map((c) => <button key={c} type="button" aria-label={c} aria-pressed={colour === c} style={{ background: c }} onClick={() => setColour(c)} />)}</div></>}
      stage={<MeshView parts={parts} fitKey={`${dp.mode}-${dp.height}-${Math.round(Math.max(dp.r0, dp.r1, dp.r2, dp.r3) / 10)}`} snapRef={snap} />}
      stats={<><span>Size <b>{(2 * maxR).toFixed(0)} × {p.height} mm</b></span><span>Mode <b>{p.mode === 'spiral' ? 'vase mode (spiral)' : p.mode === 'shade' ? 'lamp shade' : p.mode}</b></span>{p.mode !== 'spiral' && <span>Wall <b>{p.wall} mm</b></span>}</>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>The STL{p.mode === 'shade' && p.fitting !== 'none' ? ' with a fitting ring for the lamp holder' : ''}, print settings for {p.mode === 'spiral' ? 'vase mode' : 'normal printing'}, a preview and a commercial license to sell what you print.</p></>}
      side={<>
        <Group title="Start from">
          <Select label="Style" value="" onChange={(k) => { if (PRESETS[k]) { setP((o) => ({ ...BASE, mode: o.mode === 'shade' || PRESETS[k].mode === 'shade' ? (PRESETS[k].mode ?? 'spiral') : o.mode, ...PRESETS[k] })); setName(k); } }} options={[['', 'Choose a style…'], ...Object.keys(PRESETS).map((k) => [k, k] as [string, string])]} />
        </Group>
        <Group title="What to make">
          <Seg<VaseMode> label="Type" value={p.mode} onChange={mode} options={[['spiral', 'Vase mode'], ['vase', 'Vase'], ['planter', 'Planter'], ['shade', 'Lamp shade']]} />
          <p className="hint">{p.mode === 'spiral' ? 'A solid shape: your slicer prints just the outer wall in one continuous spiral. Fast and seamless.' : p.mode === 'shade' ? 'Open at both ends with real walls. Add a ring for an E27 or E14 lamp holder.' : 'Real walls and a floor, for normal printing.'}</p>
        </Group>
        <Group title="Shape">
          <Range label="Height" value={p.height} onChange={(v) => set('height', v)} min={40} max={300} step={5} fmt={(v) => `${v} mm`} />
          <Range label="Bottom width" value={p.r0 * 2} onChange={(v) => set('r0', v / 2)} min={30} max={260} step={2} fmt={(v) => `${v} mm`} />
          <Range label="Lower width" value={p.r1 * 2} onChange={(v) => set('r1', v / 2)} min={30} max={260} step={2} fmt={(v) => `${v} mm`} />
          <Range label="Upper width" value={p.r2 * 2} onChange={(v) => set('r2', v / 2)} min={30} max={260} step={2} fmt={(v) => `${v} mm`} />
          <Range label="Top width" value={p.r3 * 2} onChange={(v) => set('r3', v / 2)} min={30} max={260} step={2} fmt={(v) => `${v} mm`} />
          <Range label="Sides" value={p.sides} onChange={(v) => set('sides', v)} min={0} max={12} step={1} fmt={(v) => (v < 3 ? 'round' : `${v}`)} />
          {p.sides >= 3 && <Range label="Soft corners" value={p.soft} onChange={(v) => set('soft', v)} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} />}
          <Range label="Twist" value={p.twist} onChange={(v) => set('twist', v)} min={-360} max={360} step={5} fmt={(v) => `${v}°`} />
        </Group>
        <Group title="Texture">
          <Range label="Ripples around" value={p.ripples} onChange={(v) => set('ripples', v)} min={0} max={48} step={1} fmt={(v) => (v ? `${v}` : 'none')} />
          {p.ripples > 0 && <>
            <Range label="Ripple depth" value={p.rippleDepth} onChange={(v) => set('rippleDepth', v)} min={0} max={6} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />
            <Range label="Wave" value={p.wave} onChange={(v) => set('wave', v)} min={-4} max={4} step={0.25} fmt={(v) => v.toFixed(2)} hint="Makes the ripples swing as they rise." />
          </>}
          <Range label="Rings up the side" value={p.bands} onChange={(v) => set('bands', v)} min={0} max={20} step={1} fmt={(v) => (v ? `${v}` : 'none')} />
          {p.bands > 0 && <Range label="Ring depth" value={p.bandDepth} onChange={(v) => set('bandDepth', v)} min={0} max={6} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />}
        </Group>
        {p.mode !== 'spiral' && <Group title={p.mode === 'shade' ? 'Shade' : 'Walls'}>
          <Range label="Wall" value={p.wall} onChange={(v) => set('wall', v)} min={0.8} max={4} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />
          {p.mode !== 'shade' && <Range label="Floor" value={p.floor} onChange={(v) => set('floor', v)} min={1} max={8} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />}
          {p.mode === 'planter' && <Range label="Drain hole" value={p.drain} onChange={(v) => set('drain', v)} min={0} max={20} step={1} fmt={(v) => (v ? `${v} mm` : 'none')} />}
          {p.mode === 'shade' && <>
            <Seg<'none' | 'top' | 'bottom'> label="Lamp holder ring" value={p.fitting} onChange={(v) => set('fitting', v)} options={[['top', 'At the top'], ['bottom', 'At the bottom'], ['none', 'None']]} />
            {p.fitting !== 'none' && <Select label="Holder" value={String(p.hole)} onChange={(v) => set('hole', Number(v))} options={[['42', 'E27 (42 mm ring)'], ['40', 'E27 (40 mm ring)'], ['29', 'E14 (29 mm ring)'], ['35', 'B22 (35 mm ring)']]} />}
          </>}
        </Group>}
        <Group title="Name"><Text label="Design name" value={name} onChange={setName} max={40} /></Group>
      </>} />
  );
}
