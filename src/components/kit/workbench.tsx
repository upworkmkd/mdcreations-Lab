'use client';
import { useEffect, useState } from 'react';
import { BuyBox, type BuyBoxProps } from '@/components/buy-box';
import { track } from '@/components/tracker';

export type KitBuy = Omit<BuyBoxProps, 'tool' | 'next' | 'ready' | 'getDesign' | 'doneBlurb'>;

/** Preview / What you get tabs over the stage, for makers that list their parts (see WhatYouGet). */
export function StageTabs({ tab, onTab, tool }: { tab: 'preview' | 'get'; onTab(t: 'preview' | 'get'): void; tool: string }) {
  return (
    <div className="kit-tabs wyg-tabs" role="group" aria-label="Show">
      <button type="button" aria-pressed={tab === 'preview'} onClick={() => onTab('preview')}>Preview</button>
      <button type="button" aria-pressed={tab === 'get'} onClick={() => { onTab('get'); track('what_you_get', tool); }}>What you get</button>
    </div>
  );
}

/** The shared maker layout: settings on the left, the preview in the middle, "Get the files" underneath. */
export function Workbench({ side, stage, bar, stats, busy, tool, next, ready, getDesign, buy, doneBlurb, youGet, getting }: {
  side: React.ReactNode; stage: React.ReactNode; bar?: React.ReactNode; stats?: React.ReactNode; busy?: string | null;
  tool: string; next: string; ready: boolean; getDesign: BuyBoxProps['getDesign']; buy: KitBuy; doneBlurb: string; youGet: React.ReactNode;
  getting?: React.ReactNode;   // the "What you get" panel
}) {
  const [tab, setTab] = useState<'preview' | 'get'>('preview');
  // the design as it would be saved, handy for support and tests (like window.__lamp on the shadow lamp)
  useEffect(() => { (window as unknown as { __kit?: unknown }).__kit = { tool, getDesign }; }, [tool, getDesign]);
  const showGet = Boolean(getting) && tab === 'get';
  return (
    <div className="kit">
      <aside className="kit-side">{side}</aside>
      <div className="kit-main">
        {(bar || getting) && <div className="kit-bar">{getting ? <StageTabs tab={tab} onTab={setTab} tool={tool} /> : null}{!showGet && bar}</div>}
        <div className="kit-stage" hidden={showGet}>{stage}{busy && <span className="kit-busy">{busy}</span>}</div>
        {showGet && <div className="kit-stage wyg-stage">{getting}</div>}
        {stats && <div className="kit-foot">{stats}</div>}
        <div className="kit-buy">
          <div>{youGet}</div>
          <div className="buy-slot"><BuyBox {...buy} tool={tool} next={next} ready={ready} getDesign={getDesign} doneBlurb={doneBlurb} /></div>
        </div>
      </div>
    </div>
  );
}
