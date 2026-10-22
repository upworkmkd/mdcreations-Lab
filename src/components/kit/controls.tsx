'use client';
import { useId } from 'react';

/** Small form controls shared by the tool workbenches. */
export function Range({ label, value, onChange, min, max, step = 1, fmt = (v: number) => String(v), hint }: { label: string; value: number; onChange(v: number): void; min: number; max: number; step?: number; fmt?: (v: number) => string; hint?: string }) {
  const id = useId();
  return (
    <div className="kit-ctl">
      <label htmlFor={id}>{label}</label><output htmlFor={id}>{fmt(value)}</output>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
export function Select<T extends string>({ label, value, onChange, options, hint }: { label: string; value: T; onChange(v: T): void; options: [T, string][]; hint?: string }) {
  const id = useId();
  return (
    <div className="kit-ctl">
      <label htmlFor={id}>{label}</label><span />
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
export function Seg<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange(v: T): void; options: [T, string][] }) {
  return (
    <div className="kit-ctl">
      <span>{label}</span><span />
      <div className="kit-seg" role="group" aria-label={label}>{options.map(([v, l]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}</div>
    </div>
  );
}
export function Check({ label, value, onChange, hint }: { label: string; value: boolean; onChange(v: boolean): void; hint?: string }) {
  const id = useId();
  return (
    <div className="kit-ctl check">
      <input id={id} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /><label htmlFor={id}>{label}</label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
export function Text({ label, value, onChange, max = 60, area, placeholder, hint }: { label: string; value: string; onChange(v: string): void; max?: number; area?: boolean; placeholder?: string; hint?: string }) {
  const id = useId();
  return (
    <div className="kit-ctl">
      <label htmlFor={id}>{label}</label><span />
      {area ? <textarea id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} type="text" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
export function Num({ label, value, onChange, step = 1, min, max, suffix, hint }: { label: string; value: number; onChange(v: number): void; step?: number; min?: number; max?: number; suffix?: string; hint?: string }) {
  const id = useId();
  return (
    <div className="kit-ctl">
      <label htmlFor={id}>{label}</label><output>{suffix}</output>
      <input id={id} type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ''} step={step} min={min} max={max} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
export function Color({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  const id = useId();
  return (
    <div className="kit-ctl">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="kit-group"><h3>{title}</h3>{children}</section>;
}

/** Picture picker: click, drop or paste. Calls back with a decoded image. */
export function PicturePick({ onImage, preview, label = 'Upload a picture' }: { onImage(img: HTMLImageElement, name: string): void; preview?: string | null; label?: string }) {
  const id = useId();
  const load = (f?: File | null) => {
    if (!f || !f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => onImage(im, f.name.replace(/\.[^.]+$/, ''));
    im.src = url;
  };
  return (
    <label htmlFor={id} className="kit-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files[0]); }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview ? <img src={preview} alt="" /> : null}
      <span>{label} <br /><small>PNG, JPG or WebP · or drop it here</small></span>
      <input id={id} type="file" accept="image/*" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
  );
}
