'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/components/tracker';
import { startPlan } from '@/lib/subscribe.client';

type Tool = { slug: string; name: string; live: boolean };
/** Tool picker and Subscribe button for a plan that is open for sign-up. */
export function Subscribe({ plan, planName, currency, tools, pickTool, signedIn, ready, label }: {
  plan: string; planName: string; currency: string; tools: Tool[]; pickTool: boolean; signedIn: boolean; ready: boolean; label: string;
}) {
  const router = useRouter();
  const firstLive = tools.find((t) => t.live)?.slug ?? '';
  const [tool, setTool] = useState(firstLive);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setErr(null);
    if (!signedIn) { router.push(`/login?next=${encodeURIComponent('/pricing')}`); return; }
    try {
      const ok = await startPlan({ plan, planName, currency, tool: pickTool ? tool : undefined, onStep: setBusy });
      if (!ok) { setBusy(null); setErr('Payment window closed. Nothing was charged.'); return; }
      router.push('/account?plan=started#plan');
    } catch (e) {
      const er = e as Error & { status?: number };
      if (er.status === 401) { router.push(`/login?next=${encodeURIComponent('/pricing')}`); return; }
      track('subscribe_error', er.message);
      setBusy(null); setErr(er.message);
    }
  };

  return (
    <div className="sub-box">
      {pickTool && (
        <label className="lbl">Your tool
          <select className="input" value={tool} onChange={(e) => setTool(e.target.value)}>
            {tools.map((t) => <option key={t.slug} value={t.slug} disabled={!t.live}>{t.name}{t.live ? '' : ' (coming soon)'}</option>)}
          </select>
        </label>
      )}
      <button type="button" className="btn" onClick={go} disabled={Boolean(busy) || !ready || (pickTool && !tool)}>{busy ?? label}</button>
      {!ready && <p className="msg">This plan opens for {currency} payments soon. Please contact us.</p>}
      {err && <p className="msg err" role="alert">{err}</p>}
    </div>
  );
}
