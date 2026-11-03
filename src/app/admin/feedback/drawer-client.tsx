'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setFeedback } from '../actions';

/** Esc closes the drawer; opening an unread note marks it read. */
export function DrawerHelpers({ close, id, unread }: { close: string; id: string; unread: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push(close, { scroll: false }); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [close, router]);
  useEffect(() => { if (unread) setFeedback(id, 'read').then(() => router.refresh()); }, [id, unread, router]);
  return null;
}
