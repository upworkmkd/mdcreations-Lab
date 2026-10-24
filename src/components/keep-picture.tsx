'use client';
import { useId, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { keepOptedIn, onKeepChange, setKeepOptIn } from '@/lib/keep-picture';

/** The opt-in under every upload box. Unticked by default; the answer is shared by all upload boxes on the site. */
export function KeepPicture({ className = '' }: { className?: string }) {
  const id = useId();
  const on = useSyncExternalStore((cb) => onKeepChange(() => cb()), keepOptedIn, () => false);
  return (
    <label htmlFor={id} className={`keep-pic ${className}`}>
      <input id={id} type="checkbox" checked={on} onChange={(e) => setKeepOptIn(e.target.checked)} />
      <span>Help improve this tool: let MD Creations keep a copy of my picture for 10 days. <Link href="/privacy#pictures">How we use it</Link></span>
    </label>
  );
}
