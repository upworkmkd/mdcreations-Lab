'use client';
import { BuyBox, type BuyBoxProps } from '@/components/buy-box';

export type KitBuy = Omit<BuyBoxProps, 'tool' | 'next' | 'ready' | 'getDesign' | 'doneBlurb'>;

/** The shared maker layout: settings on the left, the preview in the middle, "Get the files" underneath. */
export function Workbench({ side, stage, bar, stats, busy, tool, next, ready, getDesign, buy, doneBlurb, youGet }: {
  side: React.ReactNode; stage: React.ReactNode; bar?: React.ReactNode; stats?: React.ReactNode; busy?: string | null;
  tool: string; next: string; ready: boolean; getDesign: BuyBoxProps['getDesign']; buy: KitBuy; doneBlurb: string; youGet: React.ReactNode;
}) {
  return (
    <div className="kit">
      <aside className="kit-side">{side}</aside>
      <div className="kit-main">
        {bar && <div className="kit-bar">{bar}</div>}
        <div className="kit-stage">{stage}{busy && <span className="kit-busy">{busy}</span>}</div>
        {stats && <div className="kit-foot">{stats}</div>}
        <div className="kit-buy">
          <div>{youGet}</div>
          <div className="buy-slot"><BuyBox {...buy} tool={tool} next={next} ready={ready} getDesign={getDesign} doneBlurb={doneBlurb} /></div>
        </div>
      </div>
    </div>
  );
}
