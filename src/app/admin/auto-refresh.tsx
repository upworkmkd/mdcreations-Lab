'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Reloads the page data every few seconds while switched on. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [on, seconds, router]);
  return (
    <label className="check adm-live"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Update every {seconds}s</label>
  );
}
