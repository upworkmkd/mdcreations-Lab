'use client';
import { useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const COOKIE = 'mdl_cur';
const noop = () => () => {};
const read = () => (typeof document === 'undefined' ? '' : document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '');

async function choose(v: string) {
  await fetch('/api/admin/currency', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currency: v }) });
}

/** In the admin sidebar: show the whole site in INR or USD, or go back to the visitor's location. */
export function AdminCurrency() {
  const router = useRouter();
  const saved = useSyncExternalStore(noop, read, () => '');
  const [picked, setV] = useState<string | null>(null);
  const v = picked ?? (saved === 'INR' || saved === 'USD' ? saved : 'auto');
  return (
    <label className="adm-cur">
      <span>Site currency</span>
      <select className="input" value={v} onChange={async (e) => { const n = e.target.value; setV(n); await choose(n); router.refresh(); }}>
        <option value="auto">Automatic (by location)</option>
        <option value="INR">₹ INR (India)</option>
        <option value="USD">$ USD (outside India)</option>
      </select>
    </label>
  );
}

/** On the public site, while an admin is looking at the other currency: a small reminder with a reset. */
export function AdminCurrencyBadge() {
  const router = useRouter(), path = usePathname();
  const saved = useSyncExternalStore(noop, read, () => '');
  const [cleared, setC] = useState<string | null>(null);
  const c = cleared ?? saved;
  if (!(c === 'INR' || c === 'USD') || path.startsWith('/admin')) return null;
  return (
    <div className="adm-cur-badge" role="status">
      Admin test: prices in <b>{c}</b>
      <button type="button" onClick={async () => { await choose('auto'); setC(''); router.refresh(); }}>Back to automatic</button>
    </div>
  );
}
