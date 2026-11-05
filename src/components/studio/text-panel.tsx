'use client';
import { useId } from 'react';
import type { TextStyle } from './scene';
import { STUDIO_FONTS, WEIGHT_NAME, fontByFamily, nearestWeight } from './fonts';

/** Text settings: the words, font, weight, italic, size, spacing, line spacing, alignment and filled or outline letters.
 *  Edits the selected text, or sets up the next text to be placed. */
export function TextPanel({ value, onChange, editing, pixel }: { value: TextStyle; onChange(p: Partial<TextStyle>): void; editing: boolean; pixel: boolean }) {
  const id = useId(), f = fontByFamily(value.font);
  const groups = [...new Set(STUDIO_FONTS.map((x) => x.group))];
  return (
    <div className="st-textbar" role="group" aria-label="Text settings">
      <div className="st-tb-row">
        <label className="st-tb-field grow" htmlFor={`${id}-t`}>
          <span>{editing ? 'Edit the text' : 'Text to place'}</span>
          <textarea id={`${id}-t`} rows={value.text.includes('\n') ? 2 : 1} value={value.text} maxLength={80} placeholder="Type, then click on the board"
            onChange={(e) => onChange({ text: e.target.value.split('\n').slice(0, 4).join('\n') })} />
        </label>
        <label className="st-tb-field" htmlFor={`${id}-f`}>
          <span>Font</span>
          <select id={`${id}-f`} value={value.font} onChange={(e) => { const nf = fontByFamily(e.target.value); onChange({ font: nf.family, weight: nearestWeight(nf, value.weight) }); }}
            style={{ fontFamily: `"${value.font}", sans-serif` }}>
            {groups.map((g) => <optgroup key={g} label={g}>{STUDIO_FONTS.filter((x) => x.group === g).map((x) => <option key={x.family} value={x.family}>{x.family}</option>)}</optgroup>)}
          </select>
        </label>
        <label className="st-tb-field" htmlFor={`${id}-w`}>
          <span>Weight</span>
          <select id={`${id}-w`} value={value.weight} disabled={f.weights.length < 2} onChange={(e) => onChange({ weight: Number(e.target.value) })}>
            {f.weights.map((w) => <option key={w} value={w}>{WEIGHT_NAME[w] ?? w}</option>)}
          </select>
        </label>
        <div className="st-tb-field">
          <span>Style</span>
          <div className="st-tb-btns">
            <button type="button" aria-pressed={value.weight >= 700} title="Bold" style={{ fontWeight: 800 }} disabled={f.weights.length < 2}
              onClick={() => onChange({ weight: value.weight >= 700 ? nearestWeight(f, 400) : nearestWeight(f, 800) })}>B</button>
            <button type="button" aria-pressed={value.italic} title="Italic" style={{ fontStyle: 'italic', fontFamily: 'serif' }} onClick={() => onChange({ italic: !value.italic })}>I</button>
            <button type="button" aria-pressed={value.outline > 0} title="Outline letters (hollow)" onClick={() => onChange({ outline: value.outline > 0 ? 0 : 1.2 })}><span className="st-tb-outline">A</span></button>
          </div>
        </div>
        <div className="st-tb-field">
          <span>Align</span>
          <div className="st-tb-btns">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} type="button" aria-pressed={value.align === a} title={`Align ${a}`} onClick={() => onChange({ align: a })}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><path d={a === 'left' ? 'M2 3h12M2 6.5h8M2 10h12M2 13.5h8' : a === 'center' ? 'M2 3h12M4 6.5h8M2 10h12M4 13.5h8' : 'M2 3h12M6 6.5h8M2 10h12M6 13.5h8'} stroke="currentColor" strokeWidth="1.6" /></svg>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="st-tb-row">
        <label className="st-tb-field st-tb-range" htmlFor={`${id}-s`}>
          <span>Letter height <b>{value.hmm} mm</b></span>
          <span className="st-tb-pair">
            <input id={`${id}-s`} type="range" min={pixel ? 9 : 3} max={pixel ? 90 : 120} step={1} value={value.hmm} onChange={(e) => onChange({ hmm: Number(e.target.value) })} />
            <input type="number" min={2} max={200} step={0.5} value={value.hmm} aria-label="Letter height in mm" onChange={(e) => { const v = Number(e.target.value); if (v >= 2 && v <= 200) onChange({ hmm: v }); }} />
          </span>
        </label>
        <label className="st-tb-field st-tb-range" htmlFor={`${id}-ls`}>
          <span>Letter spacing <b>{value.spacing > 0 ? '+' : ''}{Math.round(value.spacing * 100)}%</b></span>
          <input id={`${id}-ls`} type="range" min={-0.1} max={0.6} step={0.02} value={value.spacing} onChange={(e) => onChange({ spacing: Number(e.target.value) })} />
        </label>
        <label className="st-tb-field st-tb-range" htmlFor={`${id}-lg`}>
          <span>Line spacing <b>{Math.round(value.lineGap * 100)}%</b></span>
          <input id={`${id}-lg`} type="range" min={0} max={1.2} step={0.05} value={value.lineGap} disabled={!value.text.includes('\n')} onChange={(e) => onChange({ lineGap: Number(e.target.value) })} />
        </label>
        {value.outline > 0 && (
          <label className="st-tb-field st-tb-range" htmlFor={`${id}-o`}>
            <span>Outline width <b>{value.outline.toFixed(1)} mm</b></span>
            <input id={`${id}-o`} type="range" min={0.6} max={4} step={0.2} value={value.outline} onChange={(e) => onChange({ outline: Number(e.target.value) })} />
          </label>
        )}
      </div>
      <p className="st-tb-note">{editing ? 'Changes apply to the selected text.' : 'Press Enter for a new line (up to 4). Letters under about 4 mm, or outlines under 0.8 mm, are hard to print.'}</p>
    </div>
  );
}
