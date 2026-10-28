'use client';
import { useId, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { keepOptedIn, onKeepChange, setKeepOptIn } from '@/lib/keep-picture';

/** Under every upload box. Ticked to start with; unticking keeps pictures in the browser only. Shared by all upload boxes. */
export function KeepPicture({ className = '' }: { className?: string }) {
  const id = useId();
  const on = useSyncExternalStore((cb) => onKeepChange(() => cb()), keepOptedIn, () => true);
  return (
    <label htmlFor={id} className={`keep-pic ${className}`}>
      <input id={id} type="checkbox" checked={on} onChange={(e) => setKeepOptIn(e.target.checked)} />
      <span>Keep a copy of my picture for 10 days to help improve this tool. Untick to keep it only in your browser. <Link href="/privacy#pictures">How we use it</Link></span>
    </label>
  );
}
