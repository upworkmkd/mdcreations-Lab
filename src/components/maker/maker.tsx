'use client';
import { PrintOrder } from '@/components/print-order';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { mountStudio } from './studio.js';
import { AuthDialog } from '@/components/auth-dialog';
import { supabaseBrowser } from '@/lib/supabase/client';
import { formatMoney, type Currency } from '@/lib/money';
import { EXAMPLES } from '@/lib/gallery';
import { track } from '@/components/tracker';
import { startPlan } from '@/lib/subscribe.client';
import { PlanChooser, type ChooserPlan, type Choice } from './plan-chooser';
import { ThankYou } from './thank-you';
import { LampView, type LampData } from './lamp-view';
import './maker.css';
import { KeepPicture } from '@/components/keep-picture';

type Studio = { designPayload(): unknown; previewJpeg(): string; destroy(): void; loadExample(src: string, name: string): void };
type Phase = { kind: 'idle' } | { kind: 'working'; text: string } | { kind: 'done'; fileId: string } | { kind: 'error'; text: string; orderId?: string };

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpInstance = { open(): void; on(ev: string, fn: (r: { error?: { description?: string } }) => void): void };
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => RzpInstance } }

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('The payment window could not be loaded. Check your connection and try again.'));
    document.head.append(s);
  });
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong.'), { status: r.status, orderId: j.orderId });
  return j as T;
}

export type MakerPlan = { name: string; remaining: number | null; limit: number | null };

export function Maker({ currency, amountMinor, signedIn: signedIn0, payConfigured, example, plan: plan0, plans = [], otherPlan = false, viewerName = '', reviewed = false, printMinor = null }: { currency: Currency; amountMinor: number | null; signedIn: boolean; payConfigured: boolean; example?: string; plan?: MakerPlan | null; plans?: ChooserPlan[]; otherPlan?: boolean; viewerName?: string; reviewed?: boolean; printMinor?: number | null }) {
  const [thanks, setThanks] = useState<string | null>(null);   // file id while the thank-you window is open
  const [askedReview, setAskedReview] = useState(reviewed);
  const [plan, setPlan] = useState<MakerPlan | null>(plan0 ?? null);
  const [view, setView] = useState<'shadow' | '3d' | 'wall'>('shadow');
  const [lamp, setLamp] = useState<LampData | null>(null);
  const [chooser, setChooser] = useState(false);
  const choice = useRef<Choice>('single');
  const first = EXAMPLES.find((e) => e.id === example) ?? EXAMPLES.find((e) => e.id === 'elephant')!;
  const [picked, setPicked] = useState<string | null>(first.id);
  const root = useRef<HTMLDivElement>(null), studio = useRef<Studio | null>(null);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(signedIn0);
  const [authOpen, setAuthOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const finish = (fileId: string) => { setPhase({ kind: 'done', fileId }); setThanks(fileId); };
  const [left, setLeft] = useState<number | null | undefined>(plan ? plan.remaining : undefined);   // undefined = no plan
  const onPlan = plan != null && (left == null || left > 0);

  useEffect(() => {
    if (!root.current) return;
    const s = mountStudio(root.current, { onReady: setReady, onResult: setLamp, sample: `/examples/${first.id}.png`, sampleName: first.name }) as Studio;
    studio.current = s;
    (window as unknown as { __lamp?: Studio }).__lamp = s;   // handy for support and tests
    return () => { s.destroy(); studio.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const purchase = useCallback(async () => {
    const s = studio.current; if (!s) return;
    const design = s.designPayload();
    if (!design) return;
    try {
      setPhase({ kind: 'working', text: 'Saving your design…' });
      const { id: designId } = await post<{ id: string }>('/api/designs', { tool: 'shadow-lamp', design, preview: s.previewJpeg() });
      setPhase({ kind: 'working', text: 'Starting the payment…' });
      const co = await post<{ free?: boolean; plan?: boolean; remaining?: number | null; fileId?: string; orderId?: string; keyId: string; providerOrderId: string; amount: number; currency: string; description: string; prefill: { name: string; email: string } }>(
        '/api/checkout', { designId, currency });
      if (co.free && co.fileId) { if (co.plan) setLeft(co.remaining ?? null); finish(co.fileId); return; }
      await loadCheckout();
      const paid = await new Promise<RzpResponse | null>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: co.keyId, order_id: co.providerOrderId, amount: co.amount, currency: co.currency,
          name: 'MD Creations Labs', description: co.description, image: `${location.origin}/brand/mark-dark.svg`,
          prefill: co.prefill, theme: { color: '#424532' },
          handler: (r: RzpResponse) => resolve(r),
          modal: { ondismiss: () => resolve(null), confirm_close: true },
        });
        rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'The payment failed.')));
        rzp.open();
        setPhase({ kind: 'working', text: 'Waiting for the payment…' });
      });
      track(paid ? 'payment_done' : 'payment_cancelled', paid ? 'Razorpay payment completed' : 'Closed the payment window', { orderId: co.orderId });
      if (!paid) { setPhase({ kind: 'error', text: 'Payment cancelled. Your design is still here; press the button again when you are ready.' }); return; }
      setPhase({ kind: 'working', text: 'Payment received. Building your files (this takes a few seconds)…' });
      const v = await post<{ fileId: string }>('/api/payments/verify', paid);
      finish(v.fileId);
    } catch (e) {
      const err = e as Error & { status?: number; orderId?: string };
      track('purchase_error', err.message, { status: err.status, orderId: err.orderId });
      if (err.status === 401) { setSignedIn(false); setPhase({ kind: 'idle' }); setAuthOpen(true); return; }
      setPhase({ kind: 'error', text: err.message, orderId: err.orderId });
    }
  }, [currency]);

  // after signing in (or straight away): carry out what they picked in the chooser
  const proceed = useCallback(async () => {
    const c = choice.current;
    if (c === 'single') { purchase(); return; }
    const p = plans.find((x) => x.id === c); if (!p) return;
    try {
      const ok = await startPlan({ plan: p.id, planName: p.name, currency, tool: p.tools === 1 ? 'shadow-lamp' : undefined, onStep: (text) => setPhase({ kind: 'working', text }) });
      if (!ok) { setPhase({ kind: 'error', text: 'Payment window closed. Nothing was charged; your design is still here.' }); return; }
      setPlan({ name: p.name, remaining: p.limit, limit: p.limit }); setLeft(p.limit);
      setPhase({ kind: 'working', text: 'Plan started. Building your files…' });
      purchase();
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401) { setSignedIn(false); setPhase({ kind: 'idle' }); setAuthOpen(true); return; }
      setPhase({ kind: 'error', text: err.message });
    }
  }, [plans, currency, purchase]);

  const ensureSignedIn = useCallback(async () => {
    if (signedIn) return true;
    // they may have signed in or confirmed their email in another tab
    const { data } = await supabaseBrowser().auth.getUser().catch(() => ({ data: { user: null } }));
    if (!data.user) { setAuthOpen(true); return false; }
    setSignedIn(true); return true;
  }, [signedIn]);

  const onBuy = useCallback(async () => {
    if (plan) { choice.current = 'single'; if (await ensureSignedIn()) purchase(); return; }   // on a plan: the server decides if it is included
    track('chooser_open', 'Download options');
    setChooser(true);
  }, [plan, ensureSignedIn, purchase]);

  const onChoose = useCallback(async (c: Choice) => {
    choice.current = c; setChooser(false);
    track('chooser_pick', c === 'single' ? 'Just this design' : `${c} plan`);
    if (await ensureSignedIn()) proceed();
  }, [ensureSignedIn, proceed]);

  const price = amountMinor != null ? formatMoney(amountMinor, currency) : null;
  const working = phase.kind === 'working';

  return (
    <div className="maker" ref={root}>
      <div className="app">
        <section className="stage" aria-label="Shadow preview">
          <div className="viewtabs" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'shadow'} onClick={() => setView('shadow')}>Shadow</button>
            <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D lamp</button>
            <button type="button" aria-pressed={view === 'wall'} onClick={() => setView('wall')}>On the wall, lit</button>
          </div>
          {view !== 'shadow' && <div className="lampbox">
            <LampView data={lamp} mode={view} />
            <span className="lamphint">{view === '3d' ? 'The assembled lamp: walls, base, cover plate and LED post. Drag to turn, scroll to zoom.' : 'At night with the LED on: the shadow is cast by the actual walls. Drag to look around, scroll to zoom.'}</span>
          </div>}
          <div className="wallbox" id="wallbox" hidden={view !== 'shadow'}>
            <canvas id="wall" width={704} height={704} aria-label="Shadow on the wall" />
            <div className="chip" id="chip">Loading</div>
            <div className="readout" id="readout" />
          </div>
          <div className="stagebar">
            <span className="grow">Drag to move the shadow, scroll or pinch to resize. The olive box is the lamp.</span>
            <label className="check"><input type="checkbox" id="guides" defaultChecked /> Guides</label>
            <label className="check"><input type="checkbox" id="diff" /> Show what changes</label>
          </div>
        </section>

        <div className="steps">
          <section className="step">
            <header><span className="num">1</span><h2>Picture</h2></header>
            <div className="drop" id="drop">
              <canvas id="thumb" width={128} height={128} aria-hidden />
              <div className="txt">
                <span className="name" id="fname">{first.name}</span>
                <div className="row">
                  <button type="button" className="btn small" id="pick" onClick={() => setPicked(null)}>Upload your picture</button>
                  <input type="file" id="file" accept="image/*" hidden />
                </div>
              </div>
            </div>
            <KeepPicture />
            <div className="field">
              <span className="hint">Or start from an example</span>
              <div className="examples">
                {EXAMPLES.map((e) => (
                  <button key={e.id} type="button" aria-pressed={picked === e.id} onClick={() => { setPicked(e.id); studio.current?.loadExample(`/examples/${e.id}.png`, e.name); }}>
                    <img src={`/examples/${e.id}.png`} alt="" />{e.name}
                  </button>
                ))}
              </div>
            </div>
            <p className="hint">Any picture works: dark parts become shadow and light parts let the light through, so a photo keeps its face, beard or spokes. Bold, high-contrast pictures read best. Too much or too little shadow? Move the darkness cut-off. You can also drop or paste a picture.</p>
            <div className="row">
              <div className="field">
                <label htmlFor="mode">How to read it</label>
                <select id="mode" className="input" defaultValue="art">
                  <option value="art">Dark parts become shadow</option>
                  <option value="photo">Solid cut-out (remove a plain background)</option>
                  <option value="alpha">Use the transparent background</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="level"><span id="levelLab">Darkness cut-off</span><output id="levelOut" /></label>
                <input type="range" id="level" min={1} max={254} defaultValue={128} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="smooth">Smooth the outline<output id="smoothOut" /></label>
                <input type="range" id="smooth" min={0} max={40} defaultValue={4} />
              </div>
              <label className="check"><input type="checkbox" id="invert" /> Swap light and shadow</label>
            </div>
            <label className="check" id="gapsRow" hidden><input type="checkbox" id="gaps" defaultChecked /> Also cut out gaps enclosed by the figure</label>
          </section>

          <section className="step">
            <header><span className="num">2</span><h2>Size and position</h2></header>
            <div className="field">
              <label htmlFor="size">Shadow height on the wall<output id="sizeOut" /></label>
              <input type="range" id="size" min={30} max={200} defaultValue={110} />
            </div>
            <div className="row">
              <button type="button" className="btn small ghost" id="fit">Fit automatically</button>
              <label className="check"><input type="checkbox" id="mirror" /> Mirror</label>
            </div>
            <div className="field">
              <label htmlFor="loose">Loose pieces (dots, splashes, stars)</label>
              <select id="loose" className="input" defaultValue="struts">
                <option value="struts">Hold them with thin support bars (one colour)</option>
                <option value="backing">Keep every dot on a clear layer (clear + one colour)</option>
                <option value="drop">Leave them out</option>
              </select>
            </div>
            <p className="note" id="placeNote" hidden />
          </section>

          <section className="step">
            <header><span className="num">3</span><h2>Cover plate</h2></header>
            <label className="check"><input type="checkbox" id="plateOn" defaultChecked /> Add a plate that hides the wiring</label>
            <div className="platebody" id="plateBody">
              <div className="platebox" id="platebox"><canvas id="plateCv" width={454} height={574} aria-label="Cover plate" /></div>
              <div className="platectl">
                <span className="name" id="plateName">Using the shadow picture</span>
                <div className="row">
                  <button type="button" className="btn small ghost" id="platePick">Choose a plate picture</button>
                  <button type="button" className="btn small ghost" id="plateSame" hidden>Use the shadow picture</button>
                  <input type="file" id="plateFile" accept="image/*" hidden />
                </div>
                <KeepPicture />
                <div className="platectl" id="plateRead" hidden>
                  <div className="field"><label htmlFor="pMode">How to read it</label>
                    <select id="pMode" className="input" defaultValue="art"><option value="art">Dark parts become the picture</option><option value="photo">Remove the plain background</option><option value="alpha">Use the transparent background</option></select></div>
                  <div className="field"><label htmlFor="pLevel">Cut-off<output id="pLevelOut" /></label><input type="range" id="pLevel" min={1} max={254} defaultValue={128} /></div>
                  <label className="check"><input type="checkbox" id="pInvert" /> Swap picture and background</label>
                </div>
                <div className="field"><label htmlFor="plateKind">How to print it</label>
                  <select id="plateKind" className="input" defaultValue="separate"><option value="separate">Two prints: plate + press-in picture</option><option value="combined">One plate in two colours, flat (AMS, 3MF)</option></select></div>
                <div className="row" id="plateColours" hidden>
                  <label className="colour"><input type="color" id="plateCol" defaultValue="#3a3d2c" /> Plate</label>
                  <label className="colour"><input type="color" id="artCol" defaultValue="#e9c78f" /> Picture</label>
                </div>
                <div className="field"><label htmlFor="plateStyle">Picture style</label>
                  <select id="plateStyle" className="input" defaultValue="solid"><option value="solid">Solid shape</option><option value="outline">Outline only</option></select></div>
                <div className="field" id="plateLineRow" hidden><label htmlFor="plateLine">Line width<output id="plateLineOut" /></label><input type="range" id="plateLine" min={1} max={3} step={0.1} defaultValue={1.6} /></div>
                <div className="field"><label htmlFor="plateSize">Picture size<output id="plateSizeOut" /></label><input type="range" id="plateSize" min={20} max={250} defaultValue={100} /></div>
                <div className="row"><button type="button" className="btn small ghost" id="plateFit">Centre and fit</button></div>
                <div className="tags" id="plateTags" />
              </div>
            </div>
            <p className="hint" id="plateHint">Drag the picture on the plate to place it. Two prints, no colour change: a 2 mm plate with the picture sunk 1 mm deep, and the picture itself, 1 mm thick, which presses in.</p>
          </section>

          <section className="step buy">
            <header><span className="num">4</span><h2>Get the files</h2></header>
            <div className="field">
              <label htmlFor="name">Design name</label>
              <input type="text" id="name" className="input" defaultValue={first.name} maxLength={40} autoComplete="off" />
            </div>
            <label className="check"><input type="checkbox" id="withBase" defaultChecked /> Include the base and battery cover</label>

            {phase.kind === 'done' ? (
              <div className="done">
                <p className="serif">Your files are ready.</p>
                <a className="btn" href={`/api/files/${phase.fileId}/download`}>Download the zip <span className="arrow">↓</span></a>
                <p className="hint">They are saved in <Link href="/account">your account</Link>, so you can download them again any time. Changed something? {plan ? 'Make another version below.' : 'You can buy another version below.'}</p>
                <button type="button" className="linkish" onClick={() => setPhase({ kind: 'idle' })}>Make another version</button>
              </div>
            ) : (
              <>
                <button type="button" className="btn buybtn" onClick={onBuy} disabled={!ready || working || (!onPlan && !payConfigured)}>
                  {working ? phase.text : onPlan ? <>Download <span className="sep" /> <span className="mono">in your {plan!.name} plan</span></> : plan ? <>Buy and download <span className="sep" /> <span className="mono">{price}</span></> : <>Download <span className="sep" /> <span className="mono">{price ? `from ${price}` : 'choose an option'}</span></>}
                </button>
                {onPlan ? <p className="note ok">{left == null ? 'Unlimited designs on your plan.' : `${left} of ${plan!.limit} plan designs left today.`}</p>
                  : plan ? <p className="note">You have used today&apos;s {plan.limit} plan designs. This one is charged separately, or come back after midnight (India time).</p>
                  : !payConfigured ? <p className="note">Payments are being set up. Please check back soon.</p>
                  : amountMinor == null ? <p className="note">This tool is not sold in {currency} yet. Please contact us to buy it.</p> : null}
                {phase.kind === 'error' && (
                  <p className="note">{phase.text}{phase.orderId ? <> If you were charged, your files will appear in <Link href="/account">your account</Link> within a few minutes.</> : null}</p>
                )}
                {printMinor != null && (
                  <PrintOrder tool="shadow-lamp" toolName="Shadow Lamp" next="/tools/shadow-lamp/make" ready={ready && !working} priceMinor={printMinor} signedIn={signedIn}
                    getDesign={() => { const s = studio.current; const design = s?.designPayload(); return s && design ? { design, preview: s.previewJpeg() } : null; }} />
                )}
                <p className="hint">Free to try. {signedIn ? 'You are signed in.' : 'You will sign in or create an account before paying.'} {onPlan ? 'Your files stay in your account.' : <>One payment per design, or <Link href="/pricing">a monthly plan</Link>; your files stay in your account.</>} Every download includes a <Link href="/license">commercial license</Link>.</p>
              </>
            )}

            <details className="fine">
              <summary>Fine-tuning</summary>
              <div className="grid">
                <div className="field"><label htmlFor="vmax">Tallest wall<output id="vmaxOut" /></label><input type="range" id="vmax" min={45} max={69} step={0.5} defaultValue={67.5} /></div>
                <div className="field"><label htmlFor="thin">Thinnest printed detail<output id="thinOut" /></label><input type="range" id="thin" min={0.2} max={1.2} step={0.05} defaultValue={0.35} /></div>
                <div className="field"><label htmlFor="apex">Light above the ledge<output id="apexOut" /></label><input type="range" id="apex" min={70} max={80} step={0.5} defaultValue={75} /></div>
                <div className="field"><label htmlFor="plateGap">Plate picture: gap around each piece<output id="plateGapOut" /></label><input type="range" id="plateGap" min={0.05} max={0.3} step={0.01} defaultValue={0.15} /></div>
                <label className="check"><input type="checkbox" id="wrap" defaultChecked /> Carry corner pieces on the next wall</label>
                <label className="check"><input type="checkbox" id="ribs" defaultChecked /> Alignment ribs</label>
                <label className="check"><input type="checkbox" id="cuts" defaultChecked /> Switch and charging cut-outs (wall 3)</label>
              </div>
            </details>
          </section>
        </div>
      </div>

      <section aria-label="Printed walls" className="walls">
        <p className="eyebrow">The four walls, as they will print</p>
        <div className="panels" id="panels" />
      </section>

      <ThankYou open={thanks != null} onClose={() => { setThanks(null); setAskedReview(true); }} fileId={thanks} name={viewerName} askReview={!askedReview} />
      <PlanChooser open={chooser} onClose={() => setChooser(false)} onChoose={onChoose} single={amountMinor != null ? price : null} plans={plans} otherPlan={otherPlan} />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onSignedIn={() => { setSignedIn(true); setAuthOpen(false); proceed(); }}
        next="/tools/shadow-lamp/make" reason="Sign in to buy and download your files. Your design stays right here." />
    </div>
  );
}
