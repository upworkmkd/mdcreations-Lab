'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ytThumb } from '@/lib/youtube';
import { track } from '@/components/tracker';

/**
 * A YouTube video that loads only when played: until then it is a picture with a play button,
 * so the page stays fast and nothing from YouTube loads for visitors who do not watch.
 */
export function YouTubeEmbed({ id, title, autoplay = false, where = 'page' }: { id: string; title: string; autoplay?: boolean; where?: string }) {
  const [on, setOn] = useState(autoplay);
  return (
    <div className="yt">
      {on ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`} title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
      ) : (
        <button type="button" className="yt-cover" onClick={() => { setOn(true); track('video_play', title, { id, where }); }} aria-label={`Play: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ytThumb(id)} alt="" loading="lazy" />
          <span className="yt-play" aria-hidden><svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3Z" fill="#c4302b" /><path d="m27 34 18-10-18-10z" fill="#fff" /></svg></span>
        </button>
      )}
    </div>
  );
}

/** A link that plays the video in a window over the page. Only the × button (or Esc) closes it. */
export function VideoButton({ id, title, label, where = 'maker' }: { id: string; title: string; label: string; where?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="linkish yt-link" onClick={() => { setOpen(true); track('video_open', title, { id, where }); }}>
        <span className="yt-dot" aria-hidden>▶</span> {label}
      </button>
      {open && createPortal(<VideoDialog id={id} title={title} where={where} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function VideoDialog({ id, title, where, onClose }: { id: string; title: string; where: string; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return (
    <dialog ref={ref} className="yt-dlg" onClose={onClose} aria-label={title}>
      <div className="yt-dlg-head">
        <b>{title}</b>
        <button type="button" className="yt-x" onClick={() => ref.current?.close()} aria-label="Close">×</button>
      </div>
      <YouTubeEmbed id={id} title={title} autoplay where={where} />
    </dialog>
  );
}
