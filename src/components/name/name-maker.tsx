'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, Range, Select, Seg, Text, Check } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { PX, buildName } from '@/lib/name/build.js';
import { SCRIPTS } from '@/lib/name/fonts';
import type { NameMode, NameParams } from '@/lib/name/design';
import { loadGoogleFont, textMask } from '@/lib/mesh/text-mask';
import { encodeRle } from '@/lib/layers/rle.js';

const COLOURS = ['#f4f1e8', '#161616', '#c0392b', '#1f5fa8', '#2e7d4f', '#f2c14e', '#e67e22', '#d36fa0', '#7a4fa0', '#8a8f98', '#c9a227'];
const PRESET: Record<NameMode, Partial<NameParams> & { size: number }> = {
  keychain: { size: 10, border: 2.5, baseT: 2.4, letterT: 1.2, backing: 'outline', corner: 3 },
  sign: { size: 26, border: 6, baseT: 3, letterT: 2, backing: 'plate', corner: 6 },
  topper: { size: 30, border: 3, baseT: 3, letterT: 0, backing: 'outline', corner: 3 },
};

export function NameMaker(buy: KitBuy) {
  const [script, setScript] = useState('latin');
  const sc = SCRIPTS.find((s) => s.id === script)!;
  const [fontIdx, setFontIdx] = useState(0);
  const font = sc.fonts[Math.min(fontIdx, sc.fonts.length - 1)];
  const [text, setText] = useState('Aarav');
  const [size, setSize] = useState(PRESET.keychain.size);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');
  const [p, setP] = useState<NameParams>({ mode: 'keychain', backing: 'outline', border: 2.5, bold: 0.2, baseT: 2.4, letterT: 1.2, hole: 5, holes: true, stake: 60, corner: 3 });
  const [baseCol, setBaseCol] = useState('#161616'), [topCol, setTopCol] = useState('#f2c14e');
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const snap = useRef<MeshSnap | null>(null);
  const set = <K extends keyof NameParams>(k: K, v: NameParams[K]) => setP((o) => ({ ...o, [k]: v }));
  const fkey = `${font.family}:${font.weight}`;

  useEffect(() => { let ok = true; loadGoogleFont(font.family, font.weight, text || sc.sample).then(() => ok && setLoaded((o) => ({ ...o, [fkey]: true }))); return () => { ok = false; }; }, [fkey, font.family, font.weight, text, sc.sample]);

  const mode = (m: NameMode) => { const pr = PRESET[m]; setSize(pr.size); setP((o) => ({ ...o, ...pr, mode: m })); if (m === 'topper') { setBaseCol('#c9a227'); } };
  const pickScript = (id: string) => { const n = SCRIPTS.find((s) => s.id === id)!; if (!text.trim() || text === sc.sample || text === 'Aarav') setText(n.sample); setScript(id); setFontIdx(0); };

  const lines = useMemo(() => text.split('\n').slice(0, 3), [text]);
  const mask = useMemo(() => (loaded[fkey] && lines.join('').trim() ? textMask(lines, { family: font.family, weight: font.weight, heightMm: size, pxPerMm: PX, align }) : null), [loaded, fkey, lines, font, size, align]);
  const live = useMemo(() => ({ p, mask }), [p, mask]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => { if (!dp.mask) return null; try { return buildName(dp.p, dp.mask) as { base: Float32Array; letters: Float32Array; size: number[] }; } catch { return null; } }, [dp]);
  const parts = useMemo(() => (model ? [{ tris: model.base, color: baseCol }, { tris: model.letters, color: p.letterT > 0 ? topCol : baseCol }] : []), [model, baseCol, topCol, p.letterT]);
  const tooThin = model && mask ? size < 6 && p.bold < 0.3 : false;

  const getDesign = useCallback(() => {
    if (!mask) return null;
    return { design: { name: lines.join(' ').slice(0, 40) || 'Name', text: lines.join(' / '), font: font.family, p, w: mask.w, h: mask.h, mask: encodeRle(mask.mask), colors: { base: baseCol, letters: topCol } }, preview: snap.current?.jpeg() ?? '' };
  }, [mask, lines, font.family, p, baseCol, topCol]);

  return (
    <Workbench tool="name-sign" next="/tools/name-sign/make" ready={Boolean(model)} getDesign={getDesign} buy={buy}
      doneBlurb="Your name piece is built. Print the base, then the letters in a second colour (or change filament at the height in the README)."
      busy={dp !== live || !loaded[fkey] ? (loaded[fkey] ? 'Updating…' : 'Loading the font…') : null}
      bar={<span className="muted">Drag to turn, scroll to zoom. Letters are drawn in your browser, in any language your keyboard can type.</span>}
      stage={<MeshView parts={parts} fitKey={`${dp.p.mode}-${dp.mask?.w}-${dp.mask?.h}`} snapRef={snap} />}
      stats={model ? <><span>Size <b>{model.size[0].toFixed(0)} × {model.size[1].toFixed(0)} mm</b></span><span>Height <b>{model.size[2].toFixed(1)} mm</b></span>{p.letterT > 0 && <span>Colour change at <b>{p.baseT.toFixed(1)} mm</b></span>}{tooThin && <span style={{ color: '#8a3b12' }}>Small letters: thicken them a little so they print cleanly.</span>}</> : <span>Type a name to begin.</span>}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>{p.letterT > 0 ? 'A two-colour 3MF (opens in Bambu Studio and OrcaSlicer with your colours) plus two STL files (backing and raised letters)' : 'One STL file'}{p.mode === 'keychain' ? ' with the key ring hole' : p.mode === 'topper' ? ' with cake stakes' : ''}, a preview, print notes and a commercial license to sell what you print.</p></>}
      side={<>
        <Group title="What to make">
          <Seg<NameMode> label="Type" value={p.mode} onChange={mode} options={[['keychain', 'Keychain'], ['sign', 'Name sign'], ['topper', 'Cake topper']]} />
        </Group>
        <Group title="Text">
          <Select label="Language" value={script} onChange={pickScript} options={SCRIPTS.map((s) => [s.id, s.label] as [string, string])} />
          <Text label="Name or words (up to 3 lines)" value={text} onChange={setText} area max={80} hint="Use Enter for a new line. Type in any script; switch the language to get matching fonts." />
          <Select label="Font" value={String(Math.min(fontIdx, sc.fonts.length - 1))} onChange={(v) => setFontIdx(Number(v))} options={sc.fonts.map((f, i) => [String(i), f.label] as [string, string])} />
          {lines.length > 1 && <Seg<'left' | 'center' | 'right'> label="Line alignment" value={align} onChange={setAlign} options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} />}
          <Range label="Letter height" value={size} onChange={setSize} min={5} max={80} step={1} fmt={(v) => `${v} mm`} hint="Height of the tallest line, top of the letters to the bottom." />
          <Range label="Thicken letters" value={p.bold} onChange={(v) => set('bold', v)} min={0} max={1.5} step={0.05} fmt={(v) => `${v.toFixed(2)} mm`} hint="Helps thin script fonts print strong." />
        </Group>
        <Group title="Backing">
          <Seg<'outline' | 'plate'> label="Shape" value={p.backing} onChange={(v) => set('backing', v)} options={[['outline', 'Follows the letters'], ['plate', 'Rounded plate']]} />
          <Range label="Border" value={p.border} onChange={(v) => set('border', v)} min={1} max={12} step={0.5} fmt={(v) => `${v} mm`} />
          {p.backing === 'plate' && <Range label="Corner radius" value={p.corner} onChange={(v) => set('corner', v)} min={0} max={15} step={0.5} fmt={(v) => `${v} mm`} />}
          <Range label="Backing thickness" value={p.baseT} onChange={(v) => set('baseT', v)} min={1} max={8} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Range label="Raised letters" value={p.letterT} onChange={(v) => set('letterT', v)} min={0} max={6} step={0.2} fmt={(v) => (v ? `${v.toFixed(1)} mm` : 'flat (one colour)')} />
          {p.mode === 'keychain' && <Range label="Ring hole" value={p.hole} onChange={(v) => set('hole', v)} min={3} max={8} step={0.5} fmt={(v) => `${v} mm`} />}
          {p.mode === 'sign' && p.backing === 'plate' && <Check label="Two hanging holes" value={p.holes} onChange={(v) => set('holes', v)} />}
          {p.mode === 'topper' && <Range label="Stake length" value={p.stake} onChange={(v) => set('stake', v)} min={30} max={100} step={5} fmt={(v) => `${v} mm`} />}
        </Group>
        <Group title="Colours (preview)">
          <div className="kit-ctl"><span>Backing</span><span /><div className="kit-swatches" style={{ gridColumn: '1/-1' }}>{COLOURS.map((c) => <button key={c} type="button" aria-label={`Backing ${c}`} aria-pressed={baseCol === c} style={{ background: c }} onClick={() => setBaseCol(c)} />)}</div></div>
          {p.letterT > 0 && <div className="kit-ctl"><span>Letters</span><span /><div className="kit-swatches" style={{ gridColumn: '1/-1' }}>{COLOURS.map((c) => <button key={c} type="button" aria-label={`Letters ${c}`} aria-pressed={topCol === c} style={{ background: c }} onClick={() => setTopCol(c)} />)}</div></div>}
        </Group>
      </>} />
  );
}
