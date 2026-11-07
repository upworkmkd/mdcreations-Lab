'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MeshView, type MeshSnap } from '@/components/kit/mesh-view';
import { Group, Range, Select, Text } from '@/components/kit/controls';
import { Workbench, type KitBuy } from '@/components/kit/workbench';
import { WhatYouGet, STANDARD_FILES } from '@/components/kit/what-you-get';
import { buildIllusion } from '@/lib/illusion/build.js';
import { PX } from '@/lib/illusion/design';
import { loadGoogleFont, textMask } from '@/lib/mesh/text-mask';
import { encodeRle } from '@/lib/layers/rle.js';
import { restoreFrom, str, num, type SavedDesign } from '@/lib/saved-design';

const FONTS: [string, string, number][] = [['Poppins', 'Poppins Bold (round)', 800], ['Archivo Black', 'Archivo Black (wide)', 400], ['Bebas Neue', 'Bebas Neue (tall)', 400], ['Baloo 2', 'Baloo (Hindi and English)', 800]];
const COLOURS = ['#d9a441', '#c0392b', '#f4f1e8', '#161616', '#1f5fa8', '#2e7d4f', '#d36fa0', '#8a8f98'];
const BASES = ['#2c2e21', '#161616', '#f4f1e8', '#6b3a2a', '#1f5fa8', '#c0392b'];
const HEART = '♥';

type Mask = { mask: Uint8Array; w: number; h: number; pxmm: number };
type Settings = { nameA: string; nameB: string; font: string; H: number; base: number; gap: number; letters: string; baseCol: string };

/** The letters of a name, one per block: spaces dropped, Latin in capitals (they fill the height best). */
function lettersOf(s: string) {
  const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? [...new (Intl as unknown as { Segmenter: new (l?: string, o?: object) => { segment(t: string): Iterable<{ segment: string }> } }).Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : [...s];
  return seg.filter((g) => g.trim()).map((g) => g.toUpperCase());
}
/** The shorter name is padded with hearts at both ends, so every block has a letter on each side. */
function pairUp(a: string[], b: string[]) {
  const n = Math.max(a.length, b.length), pad = (x: string[]) => { const d = n - x.length, l = Math.floor(d / 2); return [...Array(l).fill(HEART), ...x, ...Array(d - l).fill(HEART)]; };
  return { A: pad(a), B: pad(b) };
}
/** One letter (or the heart) as a mask exactly H mm tall, cropped to its ink. */
function letterMask(ch: string, family: string, weight: number, H: number): Mask | null {
  let m: { mask: Uint8Array; w: number; h: number } | null;
  if (ch === HEART) {
    const h = Math.round(H * PX), w = Math.round(h * 0.95), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(w / 2, h); g.bezierCurveTo(-w * 0.15, h * 0.55, w * 0.05, -h * 0.12, w / 2, h * 0.24); g.bezierCurveTo(w * 0.95, -h * 0.12, w * 1.15, h * 0.55, w / 2, h); g.fill();
    const d = g.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) mask[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    m = { mask, w, h };
  } else m = textMask([ch], { family, weight, heightMm: H, pxPerMm: PX });
  if (!m) return null;
  let x0 = m.w, x1 = -1, y0 = m.h, y1 = -1;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.mask[y * m.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) out.set(m.mask.subarray((y + y0) * m.w + x0, (y + y0) * m.w + x0 + w), y * w);
  return { mask: out, w, h, pxmm: PX };
}
function viewUrl(v: { w: number; h: number; data: Uint8Array }, colour: string) {
  const c = document.createElement('canvas'); c.width = v.w; c.height = v.h; const g = c.getContext('2d')!, im = g.createImageData(v.w, v.h);
  const [r, gg, b] = [1, 3, 5].map((k) => parseInt(colour.slice(k, k + 2), 16));
  for (let i = 0; i < v.w * v.h; i++) if (v.data[i]) { im.data[i * 4] = r; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return c.toDataURL('image/png');
}

export function IllusionMaker({ saved, ...buy }: KitBuy & { saved?: SavedDesign | null }) {
  const [init] = useState(() => restoreFrom<Settings>(saved, (q) => ({ nameA: str(q.nameA, 'PRIYA'), nameB: str(q.nameB, 'RAHUL'), font: str(q.font, 'Poppins'), H: num(q.H, 30), base: num(q.base, 3), gap: num(q.gap, 3.5) })));
  const [nameA, setNameA] = useState(init?.nameA ?? 'PRIYA'), [nameB, setNameB] = useState(init?.nameB ?? 'RAHUL');
  const [font, setFont] = useState(init?.font ?? 'Poppins');
  const [H, setH] = useState(init?.H ?? 30), [base, setBase] = useState(init?.base ?? 3), [gap, setGap] = useState(init?.gap ?? 3.5);
  const [letters, setLetters] = useState(init?.letters ?? '#d9a441'), [baseCol, setBaseCol] = useState(init?.baseCol ?? '#2c2e21');
  const [fontOk, setFontOk] = useState<string | null>(null);
  const snap = useRef<MeshSnap | null>(null);
  const weight = FONTS.find((f) => f[0] === font)?.[2] ?? 700;

  useEffect(() => { let ok = true; loadGoogleFont(font, weight, nameA + nameB + 'प्रिया').then(() => { if (ok) setFontOk(font); }); return () => { ok = false; }; }, [font, weight, nameA, nameB]);

  const A = useMemo(() => lettersOf(nameA).slice(0, 12), [nameA]), B = useMemo(() => lettersOf(nameB).slice(0, 12), [nameB]);
  const pairs = useMemo(() => {
    if (fontOk !== font || !A.length || !B.length) return null;
    const { A: a, B: b } = pairUp(A, B), out: { a: Mask; b: Mask }[] = [];
    for (let i = 0; i < a.length; i++) { const ma = letterMask(a[i], font, weight, H), mb = letterMask(b[i], font, weight, H); if (!ma || !mb) return null; out.push({ a: ma, b: mb }); }
    return out;
  }, [fontOk, font, weight, A, B, H]);
  const live = useMemo(() => ({ pairs, H, base, gap }), [pairs, H, base, gap]);
  const dp = useDeferredValue(live);
  const model = useMemo(() => (dp.pairs ? buildIllusion(dp.pairs, { H: dp.H, base: dp.base, gap: dp.gap, cell: 0.6 }) as { parts: { name: string; tris: Float32Array }[]; size: number[]; dropped: number; views: { front: { w: number; h: number; data: Uint8Array }; side: { w: number; h: number; data: Uint8Array } } } : null), [dp]);
  const parts = useMemo(() => (model ? [{ tris: model.parts[0].tris, color: letters }, { tris: model.parts[1].tris, color: baseCol }] : []), [model, letters, baseCol]);
  const views = useMemo(() => (model ? { front: viewUrl(model.views.front, '#2c2e21'), side: viewUrl(model.views.side, '#2c2e21') } : null), [model]);

  const getDesign = useCallback(() => {
    if (!pairs) return null;
    const L = (m: Mask) => ({ w: m.w, h: m.h, mask: encodeRle(m.mask) });
    return {
      design: { name: `${nameA} & ${nameB}`.slice(0, 40), nameA, nameB, font, H, base, gap, colors: { letters, base: baseCol }, pairs: pairs.map((p) => ({ a: L(p.a), b: L(p.b) })) },
      preview: snap.current?.jpeg() ?? '', settings: { nameA, nameB, font, H, base, gap, letters, baseCol } satisfies Settings,
    };
  }, [pairs, nameA, nameB, font, H, base, gap, letters, baseCol]);

  const uneven = A.length !== B.length;
  return (
    <Workbench tool="name-illusion" next="/tools/name-illusion/make" ready={Boolean(model)} getDesign={getDesign} buy={buy}
      doneBlurb="Your illusion is built. Print it standing up, base down, and film it turning from one name to the other."
      busy={!pairs ? 'Loading the font…' : dp !== live ? 'Updating…' : null}
      bar={<><span className="muted">Letters:</span><div className="kit-swatches">{COLOURS.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={letters === c} style={{ background: c }} onClick={() => setLetters(c)} />)}</div>
        <span className="muted">Base:</span><div className="kit-swatches">{BASES.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={baseCol === c} style={{ background: c }} onClick={() => setBaseCol(c)} />)}</div></>}
      stage={<MeshView parts={parts} fitKey={`${A.length}-${B.length}-${H}`} snapRef={snap} />}
      stats={model && views ? <div className="ill-views">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <figure><img src={views.front} alt={`Seen from the front: ${nameA}`} /><figcaption>From the front: <b>{nameA}</b></figcaption></figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <figure><img src={views.side} alt={`Seen from the side: ${nameB}`} /><figcaption>From the side: <b>{nameB}</b></figcaption></figure>
        <span>Size <b>{model.size[0].toFixed(0)} × {model.size[1].toFixed(0)} × {model.size[2].toFixed(0)} mm</b></span>
        {model.dropped > 0 && <span style={{ color: '#8a3b12' }}>A few tiny floating bits are left out (they would not print). A bolder font avoids them.</span>}
      </div> : <span>Type two names to begin.</span>}
      getting={model ? <WhatYouGet meta={`${model.size[0].toFixed(0)} × ${model.size[1].toFixed(0)} × ${model.size[2].toFixed(0)} mm`} parts={[
        { title: 'Letter blocks', text: `Each block is one letter of ${nameA} and one of ${nameB} in a single shape. Prints standing up, no supports.`, tris: model.parts[0].tris, color: letters, tag: 'your names' },
        { title: 'Base', text: 'Holds the letters on their diagonal. Print it in a second colour with one filament change.', tris: model.parts[1].tris, color: baseCol },
      ]} files={[{ title: 'Colour 3MF', text: 'Letters and base in their colours, ready for Bambu Studio.' }, ...STANDARD_FILES]} /> : null}
      youGet={<><p className="eyebrow">What you get</p><p style={{ marginTop: 8, fontSize: 14.5 }}>A colour 3MF and STL files of a sculpture that reads {nameA || 'one name'} from the front and {nameB || 'another'} from the side, print notes, a preview and a commercial license.</p></>}
      side={<>
        <Group title="The two names">
          <Text label="Seen from the front" value={nameA} onChange={setNameA} max={12} hint="Up to 12 letters. Capital letters work best." />
          <Text label="Seen from the side" value={nameB} onChange={setNameB} max={12} />
          {uneven && <p className="hint">The names have different lengths, so the shorter one gets hearts at its ends.</p>}
          <Select label="Font" value={font} onChange={setFont} options={FONTS.map(([f, l]) => [f, l] as [string, string])} hint="Bold fonts read best from both sides." />
        </Group>
        <Group title="Size">
          <Range label="Letter height" value={H} onChange={setH} min={20} max={60} step={1} fmt={(v) => `${v} mm`} />
          <Range label="Space between letters" value={gap} onChange={setGap} min={1.5} max={10} step={0.5} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Range label="Base" value={base} onChange={setBase} min={2} max={6} step={0.5} fmt={(v) => `${v.toFixed(1)} mm`} />
        </Group>
      </>} />
  );
}
