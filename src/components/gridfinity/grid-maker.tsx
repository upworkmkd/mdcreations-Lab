'use client';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Check, Group, Range, Seg, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { PITCH, UNIT, buildGrid } from '@/lib/gridfinity/build.js';
import type { GridParams } from '@/lib/gridfinity/design';

export function GridMaker(buy: KitBuy) {
  const [p, setP] = useState<GridParams>({ mode: 'bin', gx: 2, gy: 1, units: 6, divX: 1, divY: 0, wall: 1.2, floor: 1.2, lip: true, magnets: false, label: true });
  const [name, setName] = useState('Gridfinity bin');
  const [colour, setColour] = useState('#e67e22');
  const snap = useRef<MeshSnap | null>(null);
  const set = <K extends keyof GridParams>(k: K, v: GridParams[K]) => setP((o) => ({ ...o, [k]: v }));
  const dp = useDeferredValue(p);
  const model = useMemo(() => buildGrid(dp) as { parts: { tris: Float32Array }[]; size: number[] }, [dp]);
  const parts = useMemo(() => model.parts.map((q) => ({ tris: q.tris, color: colour })), [model, colour]);
  const getDesign = useCallback(() => ({ design: { name, p }, preview: snap.current?.jpeg() ?? '' }), [name, p]);

  return (
    <Workbench tool="gridfinity" next="/tools/gridfinity/make" ready getDesign={getDesign} buy={buy}
      doneBlurb="Your Gridfinity file is built. Print upright with no supports."
      bar={<><span className="muted">Colour (preview only):</span><div className="kit-swatches">{['#e67e22', '#161616', '#f4f1e8', '#1f5fa8', '#2e7d4f', '#c0392b', '#8a8f98'].map((c) => <button key={c} type="button" aria-label={c} aria-pressed={colour === c} style={{ background: c }} onClick={() => setColour(c)} />)}</div></>}
      stage={<MeshView parts={parts} fitKey={`${dp.mode}-${dp.gx}-${dp.gy}-${dp.units}`} snapRef={snap} />}
      stats={<><span>Size <b>{model.size.map((v) => v.toFixed(1)).join(' × ')} mm</b></span>{p.mode === 'bin' && <span>Compartments <b>{(p.divX + 1) * (p.divY + 1)}</b></span>}</>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>The {p.mode === 'plate' ? 'baseplate' : 'bin'} STL to the Gridfinity standard, print notes and a commercial license to sell what you print.</p></>}
      side={<>
        <Group title="What to make">
          <Seg<'bin' | 'plate'> label="Type" value={p.mode} onChange={(v) => { set('mode', v); setName(v === 'plate' ? 'Gridfinity baseplate' : 'Gridfinity bin'); }} options={[['bin', 'Bin'], ['plate', 'Baseplate']]} />
        </Group>
        <Group title="Size">
          <Range label="Width" value={p.gx} onChange={(v) => set('gx', v)} min={1} max={p.mode === 'plate' ? 6 : 6} fmt={(v) => `${v} × ${PITCH} mm`} />
          <Range label="Depth" value={p.gy} onChange={(v) => set('gy', v)} min={1} max={6} fmt={(v) => `${v} × ${PITCH} mm`} />
          {p.mode === 'bin' && <Range label="Height" value={p.units} onChange={(v) => set('units', v)} min={2} max={15} fmt={(v) => `${v} units (${v * UNIT} mm)`} />}
        </Group>
        {p.mode === 'bin' && <>
          <Group title="Inside">
            <Range label="Dividers across" value={p.divX} onChange={(v) => set('divX', v)} min={0} max={8} fmt={(v) => (v ? String(v) : 'none')} />
            <Range label="Dividers front to back" value={p.divY} onChange={(v) => set('divY', v)} min={0} max={6} fmt={(v) => (v ? String(v) : 'none')} />
            <Range label="Wall" value={p.wall} onChange={(v) => set('wall', v)} min={0.8} max={2.4} step={0.1} fmt={(v) => `${v.toFixed(1)} mm`} />
            <Range label="Floor" value={p.floor} onChange={(v) => set('floor', v)} min={0.8} max={4} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
          </Group>
          <Group title="Extras">
            <Check label="Stacking lip" value={p.lip} onChange={(v) => set('lip', v)} hint="Lets another bin stack on top." />
            <Check label="Label shelf" value={p.label} onChange={(v) => set('label', v)} />
            <Check label="Magnet holes (6 × 2 mm)" value={p.magnets} onChange={(v) => set('magnets', v)} />
          </Group>
        </>}
        <Group title="Name"><Text label="Design name" value={name} onChange={setName} max={40} /></Group>
      </>} />
  );
}
