'use client';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import QR from 'qrcode';
import { MeshView } from '@/components/kit/mesh-view';
import { Check, Group, Num, Range, Seg, Select, Text } from '@/components/kit/controls';
import { KINDS, payload, type Fields, type Kind } from '@/lib/qr/payload';
import { PX, buildQrPlate } from '@/lib/qr/build.js';
import { stlBinary, storeZip } from '@/lib/mesh/mesh.js';
import { loadGoogleFont, textMask } from '@/lib/mesh/text-mask';
import { track } from '@/components/tracker';

type Shape = 'rounded' | 'square' | 'keychain' | 'circle';
type Ecc = 'L' | 'M' | 'Q' | 'H';
const COLOURS = ['#f4f1e8', '#161616', '#ffffff', '#c0392b', '#1f5fa8', '#2e7d4f', '#f2c14e', '#7a4fa0', '#e67e22', '#8a8f98'];

const FORM: Record<Kind, { k: string; label: string; area?: boolean; placeholder?: string; type?: 'select' | 'check'; options?: [string, string][] }[]> = {
  url: [{ k: 'url', label: 'Web address', placeholder: 'yourshop.com' }],
  text: [{ k: 'text', label: 'Text', area: true, placeholder: 'Anything you like' }],
  wifi: [
    { k: 'ssid', label: 'Network name (SSID)' }, { k: 'password', label: 'Password' },
    { k: 'security', label: 'Security', type: 'select', options: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP (old)'], ['nopass', 'No password']] },
    { k: 'hidden', label: 'Hidden network', type: 'check' },
  ],
  upi: [{ k: 'vpa', label: 'UPI ID', placeholder: 'yourname@okhdfcbank' }, { k: 'name', label: 'Name shown to the payer' }, { k: 'amount', label: 'Fixed amount in ₹ (optional)', placeholder: 'Leave empty to let them type it' }, { k: 'note', label: 'Note (optional)' }],
  whatsapp: [{ k: 'phone', label: 'WhatsApp number with country code', placeholder: '91 98765 43210' }, { k: 'message', label: 'Starting message (optional)', area: true }],
  contact: [{ k: 'name', label: 'Name' }, { k: 'phone', label: 'Phone' }, { k: 'email', label: 'Email' }, { k: 'org', label: 'Company (optional)' }, { k: 'url', label: 'Website (optional)' }],
  phone: [{ k: 'phone', label: 'Phone number' }],
  email: [{ k: 'email', label: 'Email address' }, { k: 'subject', label: 'Subject (optional)' }, { k: 'body', label: 'Message (optional)', area: true }],
};

export function QrMaker() {
  const [kind, setKind] = useState<Kind>('url');
  const [fields, setFields] = useState<Record<Kind, Fields>>({ url: { url: 'labs.themdcreations.com' }, text: {}, wifi: { security: 'WPA' }, upi: {}, whatsapp: {}, contact: {}, phone: {}, email: {} });
  const [size, setSize] = useState(50), [ecc, setEcc] = useState<Ecc>('M'), [quiet, setQuiet] = useState(2);
  const [baseT, setBaseT] = useState(2), [codeT, setCodeT] = useState(1), [shape, setShape] = useState<Shape>('rounded'), [corner, setCorner] = useState(4), [hole, setHole] = useState(5);
  const [labelOn, setLabelOn] = useState(true), [labelText, setLabelText] = useState(''), [labelSize, setLabelSize] = useState(5);
  const [baseCol, setBaseCol] = useState('#f4f1e8'), [codeCol, setCodeCol] = useState('#161616');
  const [view, setView] = useState<'3d' | 'flat'>('3d');
  const [fontReady, setFontReady] = useState(false);
  const flat = useRef<HTMLCanvasElement>(null);

  useEffect(() => { let ok = true; loadGoogleFont('Poppins', 700).then(() => ok && setFontReady(true)); return () => { ok = false; }; }, []);

  const f = fields[kind];
  const pl = useMemo(() => payload(kind, f), [kind, f]);
  const qr = useMemo(() => {
    if (!pl.text) return null;
    try { const q = QR.create(pl.text, { errorCorrectionLevel: ecc }); return { size: q.modules.size, get: (r: number, c: number) => Boolean(q.modules.get(r, c)) }; }
    catch { return null; }
  }, [pl.text, ecc]);
  const labelShown = labelOn ? (labelText.trim() || pl.label).slice(0, 40) : '';
  const settings = useDeferredValue({ qr, size, quiet, baseT, codeT, shape, corner, hole, labelShown, labelSize, fontReady });

  const model = useMemo(() => {
    const s = settings; if (!s.qr) return null;
    const mod = s.size / s.qr.size, pxPerMm = PX / mod;
    let label = s.labelShown && s.fontReady ? textMask([s.labelShown], { family: 'Poppins', weight: 700, heightMm: s.labelSize, pxPerMm }) : null;
    const room = (s.qr.size + 2 * s.quiet - 1) * PX;   // keep the label within the plate width
    if (label && label.w > room) label = textMask([s.labelShown], { family: 'Poppins', weight: 700, heightMm: Math.max(2, s.labelSize * room / label.w), pxPerMm });
    return { ...buildQrPlate(s.qr, label, { module: mod, quiet: s.quiet, baseT: s.baseT, codeT: s.codeT, shape: s.shape, corner: s.corner, labelGap: Math.max(1, s.labelSize * 0.35), hole: s.hole }), module: mod };
  }, [settings]);

  useEffect(() => {
    const c = flat.current; if (!c || !qr) return;
    const m = Math.max(4, Math.floor(560 / (qr.size + 2 * quiet))), w = (qr.size + 2 * quiet) * m;
    c.width = w; c.height = w; const g = c.getContext('2d')!; g.fillStyle = baseCol; g.fillRect(0, 0, w, w); g.fillStyle = codeCol;
    for (let r = 0; r < qr.size; r++) for (let k = 0; k < qr.size; k++) if (qr.get(r, k)) g.fillRect((k + quiet) * m, (r + quiet) * m, m, m);
  }, [qr, quiet, baseCol, codeCol, view]);

  const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
  const contrast = Math.abs(lum(baseCol) - lum(codeCol));
  const darkOnLight = lum(codeCol) < lum(baseCol);
  const tooSmall = model ? model.module < 1.2 : false;

  async function download() {
    if (!model || !qr) return;
    const name = (pl.label || kind).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'qr-code';
    const png = await new Promise<Uint8Array>((res) => flat.current ? flat.current.toBlob(async (b) => res(new Uint8Array(await b!.arrayBuffer())), 'image/png') : res(new Uint8Array()));
    const readme = [
      `QR code plate - ${KINDS.find((k) => k[0] === kind)?.[1]}${pl.label && kind !== 'wifi' ? `: ${pl.label}` : kind === 'wifi' ? `: ${f.ssid}` : ''}`,
      'Made with the free QR Code to STL tool - labs.themdcreations.com/tools/qr-code', '',
      `Size: ${model.size[0].toFixed(1)} x ${model.size[1].toFixed(1)} mm, ${(baseT + codeT).toFixed(1)} mm tall`,
      `QR: ${qr.size} x ${qr.size} modules of ${model.module.toFixed(2)} mm, error correction ${ecc}`, '',
      'FILES', `  ${name}.stl   one solid piece: the ${baseT} mm plate with the code${labelShown ? ' and label' : ''} raised ${codeT} mm on top`, '',
      'PRINTING',
      `  Two colours: add a filament change (or an AMS colour change) at ${baseT.toFixed(2)} mm, the first layer of the code.`,
      '  In Bambu Studio / OrcaSlicer: slice, drag the layer slider to that height, right-click + and choose "Change filament".',
      '  Layer height 0.2 mm or finer; use the darker colour for the code so phones can read it.',
      '  Test the scan with your phone before printing many: the flat PNG in this zip is the same code.', '',
    ];
    const zip = storeZip([
      { name: `${name}.stl`, data: stlBinary(model.solid, 'QR code plate') },
      { name: `${name}_flat.png`, data: png },
      { name: 'README.txt', data: new TextEncoder().encode(readme.join('\r\n')) },
    ]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' })); a.download = `${name}_qr_stl.zip`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    track('free_download', 'qr-code', { kind, shape, size });
  }

  const parts = useMemo(() => (model ? [{ tris: model.base, color: baseCol }, { tris: model.code, color: codeCol }] : []), [model, baseCol, codeCol]);

  return (
    <div className="kit">
      <aside className="kit-side">
        <Group title="What the code opens">
          <Select<Kind> label="Type" value={kind} onChange={setKind} options={KINDS} />
          {FORM[kind].map((fd) => fd.type === 'select'
            ? <Select key={fd.k} label={fd.label} value={f[fd.k] ?? fd.options![0][0]} onChange={(v) => setFields((o) => ({ ...o, [kind]: { ...o[kind], [fd.k]: v } }))} options={fd.options!} />
            : fd.type === 'check'
              ? <Check key={fd.k} label={fd.label} value={f[fd.k] === '1'} onChange={(v) => setFields((o) => ({ ...o, [kind]: { ...o[kind], [fd.k]: v ? '1' : '' } }))} />
              : <Text key={fd.k} label={fd.label} area={fd.area} placeholder={fd.placeholder} max={fd.area ? 600 : 200} value={f[fd.k] ?? ''} onChange={(v) => setFields((o) => ({ ...o, [kind]: { ...o[kind], [fd.k]: v } }))} />)}
          {pl.error && <p className="hint" style={{ color: '#8a3b12' }}>{pl.error}</p>}
          {kind === 'wifi' && <p className="hint">The password is stored inside the code itself. Anyone who scans it can join.</p>}
        </Group>
        <Group title="Size and shape">
          <Seg<Shape> label="Shape" value={shape} onChange={setShape} options={[['rounded', 'Rounded'], ['square', 'Square'], ['keychain', 'Keychain'], ['circle', 'Round']]} />
          <Range label="Code width" value={size} onChange={setSize} min={20} max={150} fmt={(v) => `${v} mm`} hint={model ? `Each square is ${model.module.toFixed(2)} mm.${tooSmall ? ' Below 1.2 mm a 0.4 mm nozzle struggles: make it bigger or use less text.' : ''}` : undefined} />
          {shape !== 'square' && shape !== 'circle' && <Range label="Corner radius" value={corner} onChange={setCorner} min={1} max={12} step={0.5} fmt={(v) => `${v} mm`} />}
          {shape === 'keychain' && <Range label="Ring hole" value={hole} onChange={setHole} min={3} max={10} step={0.5} fmt={(v) => `${v} mm`} />}
          <Range label="Border around the code" value={quiet} onChange={setQuiet} min={1} max={6} fmt={(v) => `${v} squares`} hint="Phones need a clear margin. 2 is plenty on a contrasting plate." />
          <Range label="Plate thickness" value={baseT} onChange={setBaseT} min={0.8} max={6} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Range label="Code height" value={codeT} onChange={setCodeT} min={0.4} max={3} step={0.2} fmt={(v) => `${v.toFixed(1)} mm`} />
          <Select<Ecc> label="Error correction" value={ecc} onChange={setEcc} options={[['L', 'Low: smallest code'], ['M', 'Medium (recommended)'], ['Q', 'High'], ['H', 'Highest: survives scratches']]} />
        </Group>
        <Group title="Label">
          <Check label="Add a label under the code" value={labelOn} onChange={setLabelOn} />
          {labelOn && <>
            <Text label="Label text" value={labelText} onChange={setLabelText} placeholder={pl.label || 'Scan me'} max={40} />
            <Range label="Letter height" value={labelSize} onChange={setLabelSize} min={3} max={14} step={0.5} fmt={(v) => `${v} mm`} />
          </>}
        </Group>
        <Group title="Colours (preview)">
          <div className="kit-ctl"><span>Plate</span><span /><div className="kit-swatches" style={{ gridColumn: '1/-1' }}>{COLOURS.map((c) => <button key={c} type="button" aria-label={`Plate ${c}`} aria-pressed={baseCol === c} style={{ background: c }} onClick={() => setBaseCol(c)} />)}</div></div>
          <div className="kit-ctl"><span>Code</span><span /><div className="kit-swatches" style={{ gridColumn: '1/-1' }}>{COLOURS.map((c) => <button key={c} type="button" aria-label={`Code ${c}`} aria-pressed={codeCol === c} style={{ background: c }} onClick={() => setCodeCol(c)} />)}</div></div>
          {contrast < 90 && <p className="hint" style={{ color: '#8a3b12' }}>These colours are too close for phones to read. Pick a dark and a light one.</p>}
          {contrast >= 90 && !darkOnLight && <p className="hint">Light code on a dark plate works with most phones, but dark on light is the safest.</p>}
        </Group>
      </aside>
      <div className="kit-main">
        <div className="kit-bar">
          <div className="kit-tabs" role="group" aria-label="View"><button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D</button><button type="button" aria-pressed={view === 'flat'} onClick={() => setView('flat')}>Flat (test the scan)</button></div>
          <span className="muted">{view === 'flat' ? 'Point your phone camera at the screen to check it opens the right thing.' : 'Drag to turn, scroll to zoom.'}</span>
        </div>
        <div className="kit-stage">
          {view === '3d' ? <MeshView parts={parts} fitKey={`${shape}-${size}-${labelShown ? 1 : 0}`} height={520} /> : null}
          <canvas ref={flat} className="flat" hidden={view !== 'flat'} style={{ maxHeight: 520, imageRendering: 'pixelated' }} />
        </div>
        <div className="kit-foot">
          {model && qr ? <>
            <span>Size <b>{model.size[0].toFixed(0)} × {model.size[1].toFixed(0)} mm</b></span>
            <span>Code <b>{qr.size} × {qr.size}</b> squares of <b>{model.module.toFixed(2)} mm</b></span>
            <span>Colour change at <b>{baseT.toFixed(1)} mm</b></span>
          </> : <span>{pl.error ?? 'Too much text for one code. Shorten it or lower the error correction.'}</span>}
        </div>
        <div className="kit-buy">
          <div>
            <p className="eyebrow">Free download</p>
            <p style={{ marginTop: 8, fontSize: 14.5 }}>One STL with the code raised on the plate (change filament at the height shown for two colours), a flat PNG of the same code and print notes. Made in your browser; nothing you type is sent to us.</p>
          </div>
          <div className="buy-slot">
            <button type="button" className="btn buybtn" disabled={!model} onClick={download}>Download the STL files <span className="arrow">↓</span></button>
            <p className="hint">Free, no account needed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
