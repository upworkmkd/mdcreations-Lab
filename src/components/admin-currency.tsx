'use client';
import { useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const CUR = 'mdl_cur', PAY = 'mdl_paytest';
const noop = () => () => {};
const cookie = (name: string) => (typeof document === 'undefined' ? '' : document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? '');
const readCur = () => cookie(CUR), readPay = () => cookie(PAY);

async function post(body: { currency?: string; payments?: string }) {
  await fetch('/api/admin/currency', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/** In the admin sidebar: the site's currency, and whether your own orders are free or go through Razorpay. */
export function AdminCurrency() {
  const router = useRouter();
  const savedCur = useSyncExternalStore(noop, readCur, () => '');
  const savedPay = useSyncExternalStore(noop, readPay, () => '');
  const [cur, setCur] = useState<string | null>(null);
  const [pay, setPay] = useState<string | null>(null);
  const c = cur ?? (savedCur === 'INR' || savedCur === 'USD' ? savedCur : 'auto');
  const p = pay ?? (savedPay === '1' ? 'real' : 'free');
  return (
    <>
      <label className="adm-cur">
        <span>Site currency</span>
        <select className="input" value={c} onChange={async (e) => { const n = e.target.value; setCur(n); await post({ currency: n }); router.refresh(); }}>
          <option value="auto">Automatic (by location)</option>
          <option value="INR">₹ INR (India)</option>
          <option value="USD">$ USD (outside India)</option>
        </select>
      </label>
      <label className="adm-cur">
        <span>Admin orders</span>
        <select className="input" value={p} onChange={async (e) => { const n = e.target.value; setPay(n); await post({ payments: n }); router.refresh(); }}>
          <option value="free">Free (skip payment)</option>
          <option value="real">Pay with Razorpay (test)</option>
        </select>
      </label>
    </>
  );
}

/** On the public site, while an admin test setting is on: a small reminder with a reset. */
export function AdminCurrencyBadge() {
  const router = useRouter(), path = usePathname();
  const savedCur = useSyncExternalStore(noop, readCur, () => '');
  const savedPay = useSyncExternalStore(noop, readPay, () => '');
  const [cleared, setC] = useState(false);
  const c = cleared ? '' : savedCur, payReal = !cleared && savedPay === '1';
  const curOn = c === 'INR' || c === 'USD';
  if ((!curOn && !payReal) || path.startsWith('/admin')) return null;
  return (
    <div className="adm-cur-badge" role="status">
      Admin test:{curOn && <> prices in <b>{c}</b></>}{curOn && payReal && ' ·'}{payReal && <> your orders <b>go through Razorpay</b></>}
      <button type="button" onClick={async () => { await post({ currency: 'auto' }); await post({ payments: 'free' }); setC(true); router.refresh(); }}>Turn off</button>
    </div>
  );
}
