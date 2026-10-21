'use client';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MONEY, PRINTERS, compute, defaultsFor, fmt, fromHash, toHash, type Filament, type Inputs, type Money } from '@/lib/print-cost/calc';
import { readSlicedFile } from '@/lib/print-cost/slicer';
import { track } from '@/components/tracker';

const STORE = 'mdc-print-cost-v1';
const noop = () => () => {};

/** Free print cost calculator. Renders only in the browser, so saved settings and shared links load straight away. */
export function PrintCost({ currency }: { currency: 'INR' | 'USD' }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <Calculator currency={currency} /> : <div className="calc calc-loading" aria-busy="true">Loading the calculator…</div>;
}

function initial(currency: Money): Inputs {
  const base = defaultsFor(currency);
  if (location.hash.length > 5) return fromHash(location.hash, base);
  try { const s = localStorage.getItem(STORE); if (s) return fromHash(s, base); } catch { /* private mode */ }
  return base;
}

function Field({ label, value, onChange, unit, step = 1, hint, min = 0 }: { label: string; value: number; onChange(v: number): void; unit?: string; step?: number; hint?: string; min?: number }) {
  return (
    <label className="calc-f">
      <span className="l">{label}</span>
      <span className="in"><input type="number" inputMode="decimal" min={min} step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />{unit && <em>{unit}</em>}</span>
      {hint && <span className="h">{hint}</span>}
    </label>
  );
}

function Calculator({ currency }: { currency: 'INR' | 'USD' }) {
  const [x, setX] = useState<Inputs>(() => initial(currency));
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const r = useMemo(() => compute(x), [x]);
  const sym = MONEY[x.money].symbol, m = (v: number, d?: number) => fmt(v, x.money, d);

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setX((o) => { const n = { ...o, [k]: v }; persist(n); return n; });
  const setFil = (i: number, f: Partial<Filament>) => setX((o) => { const n = { ...o, filaments: o.filaments.map((g, j) => (j === i ? { ...g, ...f } : g)) }; persist(n); return n; });
  function persist(n: Inputs) { try { localStorage.setItem(STORE, toHash(n)); } catch { /* ignore */ } if (location.hash) history.replaceState(null, '', location.pathname); }

  async function onFile(f?: File | null) {
    if (!f) return;
    setNote('Reading ' + f.name + '…');
    try {
      const info = await readSlicedFile(f);
      if (!info) { setNote(`Could not find the print time or filament weight in ${f.name}. Slice it first, then export the G-code or the sliced 3MF.`); return; }
      setX((o) => {
        const n = { ...o };
        if (info.seconds) { n.hours = Math.floor(info.seconds / 3600); n.minutes = Math.round((info.seconds % 3600) / 60); }
        if (info.grams?.length) n.filaments = info.grams.slice(0, 8).map((g, i) => ({ name: o.filaments[i]?.name ?? `Filament ${i + 1}`, pricePerKg: o.filaments[i]?.pricePerKg ?? o.filaments[0]?.pricePerKg ?? 0, grams: +g.toFixed(1) }));
        persist(n); return n;
      });
      setNote(`From ${f.name} (${info.source}): ${info.seconds ? `${Math.floor(info.seconds / 3600)} h ${Math.round((info.seconds % 3600) / 60)} min` : 'no time found'}${info.grams?.length ? `, ${info.grams.map((g) => g.toFixed(1) + ' g').join(' + ')}` : ', no weight found'}.`);
      track('calc_import', info.source);
    } catch { setNote(`Could not read ${f.name}.`); }
  }

  const share = async () => {
    const url = `${location.origin}${location.pathname}#${toHash(x)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { history.replaceState(null, '', '#' + toHash(x)); }
    track('calc_share');
  };
  const reset = () => { const d = defaultsFor(x.money); setX(d); persist(d); setNote(null); };

  const rows: [string, number, string][] = [
    ['Filament', r.material / r.pieces, '#8a7a4c'],
    ['Printer depreciation', r.depreciation / r.pieces, '#424532'],
    ['Maintenance', r.maintenance / r.pieces, '#676e47'],
    ['Electricity', r.electricity / r.pieces, '#c89b4b'],
    ['Failed prints', r.failures / r.pieces, '#a0522d'],
    ['Labour', r.labour / r.pieces, '#5b7083'],
    ['Packaging & other', r.packaging + r.other, '#9aa08a'],
  ];
  const max = Math.max(1e-9, ...rows.map((q) => q[1]));

  return (
    <div className="calc">
      <div className="calc-in">
        <section className="calc-card">
          <div className="calc-h"><h2>The print</h2>
            <button type="button" className="btn small ghost" onClick={() => fileRef.current?.click()}>Read a G-code or 3MF</button>
            <input ref={fileRef} type="file" hidden accept=".gcode,.gco,.g,.3mf,.bgcode" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <div className="calc-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
            {note ?? 'Drop a sliced file here (G-code from Bambu Studio, OrcaSlicer, PrusaSlicer or Cura, or a sliced .gcode.3mf) to fill in the time and grams. It is read in your browser and never uploaded.'}
          </div>
          <div className="calc-grid">
            <Field label="Print time" value={x.hours} onChange={(v) => set('hours', v)} unit="h" />
            <Field label="and" value={x.minutes} onChange={(v) => set('minutes', v)} unit="min" />
            <Field label="Pieces on this plate" value={x.pieces} onChange={(v) => set('pieces', Math.max(1, Math.round(v)))} min={1} hint="The cost is split between them." />
          </div>
          <div className="calc-fil">
            {x.filaments.map((f, i) => (
              <div key={i} className="calc-filrow">
                <label className="calc-f"><span className="l">Filament</span><span className="in"><input type="text" value={f.name} maxLength={30} onChange={(e) => setFil(i, { name: e.target.value })} /></span></label>
                <Field label="Price" value={f.pricePerKg} onChange={(v) => setFil(i, { pricePerKg: v })} unit={`${sym}/kg`} step={x.money === 'INR' ? 50 : 1} />
                <Field label="Used" value={f.grams} onChange={(v) => setFil(i, { grams: v })} unit="g" step={0.1} />
                {x.filaments.length > 1 && <button type="button" className="calc-x" aria-label={`Remove ${f.name}`} onClick={() => set('filaments', x.filaments.filter((_, j) => j !== i))}>×</button>}
              </div>
            ))}
            {x.filaments.length < 8 && <button type="button" className="linkish" onClick={() => set('filaments', [...x.filaments, { name: `Filament ${x.filaments.length + 1}`, pricePerKg: x.filaments[0]?.pricePerKg ?? 0, grams: 0 }])}>+ Add another filament (multi-colour)</button>}
          </div>
        </section>

        <section className="calc-card">
          <div className="calc-h"><h2>The printer</h2>
            <select aria-label="Printer preset (power draw)" defaultValue="" onChange={(e) => { const p = PRINTERS.find((q) => q.name === e.target.value); if (p) set('watts', p.watts); }}>
              <option value="">Printer preset…</option>{PRINTERS.map((p) => <option key={p.name} value={p.name}>{p.name} (~{p.watts} W)</option>)}
            </select>
          </div>
          <div className="calc-grid">
            <Field label="Printer price" value={x.printerPrice} onChange={(v) => set('printerPrice', v)} unit={sym} step={x.money === 'INR' ? 500 : 10} hint="What you paid, with any upgrades." />
            <Field label="Expected life" value={x.lifeHours} onChange={(v) => set('lifeHours', v)} unit="hours" step={500} hint="Printing hours before it is worn out or replaced." />
            <Field label="Maintenance & spares" value={x.maintPerHour} onChange={(v) => set('maintPerHour', v)} unit={`${sym}/h`} step={x.money === 'INR' ? 0.5 : 0.01} hint="Nozzles, belts, plates, lubricant." />
            <Field label="Power draw" value={x.watts} onChange={(v) => set('watts', v)} unit="W" step={5} hint="Average while printing." />
            <Field label="Electricity" value={x.kwhRate} onChange={(v) => set('kwhRate', v)} unit={`${sym}/kWh`} step={x.money === 'INR' ? 0.5 : 0.01} />
            <Field label="Failure rate" value={x.failPct} onChange={(v) => set('failPct', Math.min(90, v))} unit="%" hint="Share of prints you have to redo." />
          </div>
          <p className="calc-dep">Depreciation: {m(x.printerPrice)} ÷ {x.lifeHours.toLocaleString()} h = <b>{m(r.depPerHour, 2)} per printing hour</b>, so this {r.hours.toFixed(1)} h print uses <b>{m(r.depreciation, 2)}</b> of the printer.</p>
        </section>

        <section className="calc-card">
          <div className="calc-h"><h2>Your time and extras</h2></div>
          <div className="calc-grid">
            <Field label="Preparation" value={x.prepMin} onChange={(v) => set('prepMin', v)} unit="min" hint="Slicing, plate prep, starting the print." />
            <Field label="Post-processing" value={x.postMin} onChange={(v) => set('postMin', v)} unit="min" hint="Removing supports, sanding, painting, assembly." />
            <Field label="Your hourly rate" value={x.labourRate} onChange={(v) => set('labourRate', v)} unit={`${sym}/h`} step={x.money === 'INR' ? 25 : 1} />
            <Field label="Packaging" value={x.packaging} onChange={(v) => set('packaging', v)} unit={`${sym}/piece`} step={x.money === 'INR' ? 5 : 0.1} />
            <Field label="Other costs" value={x.other} onChange={(v) => set('other', v)} unit={`${sym}/piece`} step={x.money === 'INR' ? 5 : 0.1} hint="Magnets, LEDs, screws, paint." />
          </div>
        </section>

        <section className="calc-card">
          <div className="calc-h"><h2>Selling price</h2>
            <select aria-label="Currency" value={x.money} onChange={(e) => set('money', e.target.value as Money)}>{(Object.keys(MONEY) as Money[]).map((k) => <option key={k} value={k}>{MONEY[k].label}</option>)}</select>
          </div>
          <div className="calc-grid">
            <Field label="Profit margin" value={x.marginPct} onChange={(v) => set('marginPct', v)} unit="%" step={5} hint="Added on top of the full cost." />
            <Field label="Marketplace fee" value={x.feePct} onChange={(v) => set('feePct', Math.min(90, v))} unit="%" step={0.5} hint="Etsy, Amazon, Meesho, payment gateway." />
            <Field label={x.money === 'INR' ? 'GST' : 'Sales tax / VAT'} value={x.taxPct} onChange={(v) => set('taxPct', v)} unit="%" hint={x.money === 'INR' ? '18% is common for 3D printed goods; 0 if you are not registered.' : 'Leave at 0 if prices are shown without tax.'} />
          </div>
        </section>
      </div>

      <aside className="calc-out" aria-live="polite">
        <div className="calc-price">
          <p className="eyebrow">Suggested price per piece</p>
          <div className="big">{m(r.price)}</div>
          <p className="sub">{x.taxPct ? `${m(r.priceExTax)} + ${m(r.tax)} ${x.money === 'INR' ? 'GST' : 'tax'}` : 'no tax added'}{x.feePct ? ` · covers a ${x.feePct}% fee` : ''}</p>
        </div>
        <dl className="calc-sum">
          <div><dt>Cost to make one piece</dt><dd>{m(r.pieceCost)}</dd></div>
          <div><dt>Your profit per piece</dt><dd>{m(r.profit)}</dd></div>
          {r.pieces > 1 && <div><dt>Whole plate ({r.pieces} pieces)</dt><dd>{m(r.plateCost + (r.packaging + r.other) * r.pieces)}</dd></div>}
          <div><dt>Machine cost per hour</dt><dd>{m(r.machinePerHour, 2)}</dd></div>
          <div><dt>Filament · energy</dt><dd>{r.grams.toFixed(0)} g · {r.kwh.toFixed(2)} kWh</dd></div>
        </dl>
        <div className="calc-bars">
          <p className="eyebrow">Where the cost goes (per piece)</p>
          {rows.map(([k, v, c]) => (
            <div key={k} className="calc-bar">
              <span className="k">{k}</span><span className="v">{m(v)}</span>
              <span className="track"><span style={{ width: `${(v / max) * 100}%`, background: c }} /></span>
            </div>
          ))}
        </div>
        <div className="calc-actions">
          <button type="button" className="btn small" onClick={share}>{copied ? 'Link copied' : 'Copy a link to this quote'}</button>
          <button type="button" className="btn small ghost" onClick={() => window.print()}>Print</button>
          <button type="button" className="linkish" onClick={reset}>Reset</button>
        </div>
        <p className="calc-fine">Your settings are remembered in this browser. Numbers are estimates: check your own printer, power and filament prices.</p>
      </aside>
    </div>
  );
}
