'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ReviewForm } from '@/components/review-form';

/** Shown when the files are ready: thanks, the download, and (once per account) a review. */
export function ThankYou({ open, onClose, fileId, name, askReview }: { open: boolean; onClose(): void; fileId: string | null; name: string; askReview: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); else if (!open && d.open) d.close();
  }, [open]);
  const first = name.split(' ')[0];
  return (
    <dialog ref={ref} className="thanks" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="thanks-h">
      <div className="thanks-in">
        <button type="button" className="x" onClick={onClose} aria-label="Close">✕</button>
        <div className="thanks-top">
          <span className="glow" aria-hidden />
          <p className="eyebrow">Your files are ready</p>
          <h2 id="thanks-h">Thank you{first ? `, ${first}` : ''}!</h2>
          <p>Your lamp is built. Download the zip, print the walls, and switch it on somewhere dark. Your files stay in <Link href="/account">your account</Link>, with a commercial license.</p>
          {fileId && <a className="btn light" href={`/api/files/${fileId}/download`}>Download the zip <span className="arrow">↓</span></a>}
          <p className="thanks-tag">Printed it? Tag <a href="https://www.instagram.com/mdcreationsbymanoj/" target="_blank" rel="noopener noreferrer">@mdcreationsbymanoj</a>. We love seeing them on the wall.</p>
        </div>
        {askReview && (
          <div className="thanks-review">
            <h3>Got a minute? Tell other makers how it went.</h3>
            <ReviewForm name={name} compact />
          </div>
        )}
      </div>
    </dialog>
  );
}
