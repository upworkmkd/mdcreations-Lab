'use client';
import { useEffect, useRef } from 'react';

export type ChooserPlan = { id: string; name: string; price: string | null; status: string; ready: boolean; limit: number | null; tools: number | null };
export type Choice = 'single' | string;   // 'single' or a plan id

/** Asked before a download: one design, or a plan. */
export function PlanChooser({ open, onClose, onChoose, single, plans, otherPlan }: {
  open: boolean; onClose(): void; onChoose(c: Choice): void; single: string | null; plans: ChooserPlan[]; otherPlan: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="chooser" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="chooser-h">
      <div className="chooser-in">
        <header>
          <h2 id="chooser-h">How would you like to download?</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="chooser-opts">
          <button type="button" className="opt" onClick={() => onChoose('single')} disabled={!single}>
            <span className="t">Just this design</span>
            <span className="p">{single ?? '—'}<small> once</small></span>
            <span className="d">Pay once and download this design now. Yours to keep, with a commercial license.</span>
            <span className="go">Buy this design →</span>
          </button>
          {plans.map((p) => {
            const contact = p.status !== 'live';
            const blocked = !contact && (otherPlan || !p.ready);
            const body = (
              <>
                {p.id === 'starter' && <span className="flag">Best value</span>}
                <span className="t">{p.name} plan</span>
                <span className="p">{p.price ?? '—'}<small> a month</small></span>
                <span className="d">
                  {p.tools == null ? 'Every tool' : 'The Shadow Lamp Maker'}, {p.limit == null ? 'unlimited designs' : `${p.limit} designs a day`}, commercial license.{' '}
                  {contact ? 'Talk to us and we will set it up.' : 'This design is included: it downloads as soon as the plan starts.'}
                </span>
                <span className="go">{contact ? 'Contact us →' : blocked ? (otherPlan ? 'You already have a plan' : 'Opening soon') : `Start ${p.name} →`}</span>
              </>
            );
            return contact
              ? <a key={p.id} className="opt" href={`/contact?plan=${p.id}`} target="_blank" rel="noopener">{body}</a>
              : <button key={p.id} type="button" className={`opt${p.id === 'starter' ? ' pick' : ''}`} onClick={() => onChoose(p.id)} disabled={blocked}>{body}</button>;
          })}
        </div>
        <p className="chooser-foot">Plans renew monthly and you can cancel any time from your account. <a href="/pricing" target="_blank" rel="noopener">Compare plans</a></p>
      </div>
    </dialog>
  );
}
