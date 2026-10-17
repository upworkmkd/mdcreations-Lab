'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** For a paid order whose files were not built yet (a time-out, say): try again. */
export function RetryBuild({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const router = useRouter();
  return (
    <>
      <button className="linkish" disabled={busy} onClick={async () => {
        setBusy(true); setErr('');
        const r = await fetch(`/api/orders/${orderId}/fulfil`, { method: 'POST' });
        if (r.ok) router.refresh(); else setErr((await r.json().catch(() => ({}))).error || 'Failed');
        setBusy(false);
      }}>{busy ? 'building…' : 'build files'}</button>
      {err && <span className="muted" style={{ fontSize: 12 }}> {err}</span>}
    </>
  );
}
