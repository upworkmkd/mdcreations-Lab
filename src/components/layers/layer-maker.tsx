'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mountLayerStudio } from './studio.js';
import { BuyBox, type BuyBoxProps } from '@/components/buy-box';
import './studio.css';
import { KeepPicture } from '@/components/keep-picture';

type Studio = { designPayload(): unknown; previewJpeg(): string; destroy(): void; isReady(): boolean };

/** The Layered Sculpture Maker: the studio on the left and centre, layers and "Get the files" on the right. */
export function LayerMaker(props: Omit<BuyBoxProps, 'tool' | 'next' | 'ready' | 'getDesign' | 'doneBlurb'>) {
  const root = useRef<HTMLDivElement>(null), studio = useRef<Studio | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!root.current) return;
    const s = mountLayerStudio(root.current, { onReady: setReady }) as Studio;
    studio.current = s;
    return () => { s.destroy(); studio.current = null; };
  }, []);

  const getDesign = useCallback(() => {
    const s = studio.current; if (!s) return null;
    const design = s.designPayload(); if (!design) return null;
    return { design, preview: s.previewJpeg() };
  }, []);

  return (
    <div className="lss" ref={root}>
      <div className="app" id="app">
        <header className="top">
          <div className="brand">
            <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="3" y="3" width="22" height="22" rx="3" fill="var(--line-2)" /><rect x="6" y="6" width="22" height="22" rx="3" fill="var(--muted)" /><rect x="9" y="9" width="22" height="22" rx="3" fill="var(--accent)" /><circle cx="20" cy="20" r="6.5" fill="var(--panel)" /></svg>
            <div>
              <h1>Layered Sculpture Maker</h1>
              <p>One picture in, a stack of printable colour layers out. Everything runs in your browser; your picture is only shared if you tick the box.</p>
            </div>
          </div>
          <div className="top-actions">
            <input className="vh" id="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
            <label className="btn primary" htmlFor="file">Upload your picture</label>
            <button className="btn" id="btn-sample" type="button">Sample artwork</button>
            <KeepPicture className="on-top" />
          </div>
        </header>

        <aside className="controls" aria-label="Controls">
          <p className="eyebrow">Starting points</p>
          <div className="presets" id="presets" />
          <div id="groups" />
          <p className="hint" style={{ marginTop: 14 }}>Double-click a slider to reset it. Settings are remembered in this browser.</p>
        </aside>

        <main className="stage">
          <div className="stage-bar">
            <div className="tabs" role="tablist" aria-label="Preview">
              <button role="tab" id="tab-3d" data-view="3d" aria-selected="true" type="button">3D stack</button>
              <button role="tab" id="tab-flat" data-view="flat" aria-selected="false" type="button">Front view</button>
              <button role="tab" id="tab-source" data-view="source" aria-selected="false" type="button">Picture</button>
            </div>
            <label className="mini" htmlFor="v-build">Assemble <input type="range" id="v-build" min={1} max={8} step={1} defaultValue={8} /><output id="o-build">8 / 8</output></label>
            <label className="mini" id="m-explode" htmlFor="v-explode">Spread <input type="range" id="v-explode" min={0} max={20} step={0.5} defaultValue={0} /><output id="o-explode">0 mm</output></label>
            <label className="mini" id="m-spin"><input type="checkbox" id="v-spin" /> Turn</label>
            <button className="btn small" id="v-reset" type="button" aria-label="Reset view">Reset</button>
          </div>
          <div className="viewport" id="viewport">
            <canvas id="gl" />
            <canvas id="flat" hidden />
            <canvas id="srcview" hidden />
            <div className="tag" id="tag-sample">Sample artwork. Upload your own picture to replace it.</div>
            <div className="busy" id="busy" hidden>Building…</div>
            <div className="drop" id="drop" hidden>Drop the image here</div>
          </div>
          <div className="stage-foot" id="foot" />
        </main>

        <aside className="layers" aria-label="Layers and files">
          <p className="eyebrow">Stack, side on</p>
          <div className="card">
            <div className="elev"><div className="elev-bars" id="elev" /><div className="elev-dim" id="elev-dim" /></div>
            <dl className="facts" id="facts" />
          </div>
          <p className="eyebrow">Layers, front to back</p>
          <ol className="list" id="list" />
          <p className="eyebrow">Get the files</p>
          <div className="card export">
            <div className="ctl"><label htmlFor="x-prefix">Design name</label><input type="text" id="x-prefix" maxLength={40} spellCheck={false} /></div>
            <div className="ctl check"><input type="checkbox" id="x-mirror" /><label htmlFor="x-mirror">Mirror for printing face-down</label><p className="hint">Turn on when the smooth bed side will be the display face.</p></div>
            <div className="ctl check"><input type="checkbox" id="x-ref" /><label htmlFor="x-ref">Add an assembled colour-reference STL</label></div>
            <BuyBox {...props} tool="layered-sculpture" next="/tools/layered-sculpture/make" ready={ready} getDesign={getDesign}
              doneBlurb="Your sculpture is built. Download the zip, print one layer per colour, and stack them back to front." />
            <button className="btn small" id="x-png" type="button" style={{ marginTop: 10 }}>Save the preview picture (PNG)</button>
            <p className="hint" style={{ marginTop: 10 }}>The zip holds one STL per layer, a preview, an assembly guide and your commercial license.</p>
          </div>
        </aside>
      </div>
      <div id="toast" role="status" aria-live="polite" hidden />
    </div>
  );
}
