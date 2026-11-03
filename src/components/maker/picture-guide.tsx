'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { track } from '@/components/tracker';
import { YouTubeEmbed } from '@/components/video/youtube';
import { youtubeId } from '@/lib/youtube';

/* "Which pictures work best?" next to the shadow lamp uploader: real examples, each picture next to the shadow the
 * maker makes from it (captured from this tool), marked as working or not, with tips and the tutorial video. */

type Example = { id: string; ok: boolean; title: string; text: string; note: string };
const EXAMPLES: Example[] = [
  { id: 'good-silhouette', ok: true, title: 'A bold shape on white', text: 'A solid dark shape on a plain white background. Every detail ends up in the shadow.', note: 'Matches your picture 99%' },
  { id: 'good-transparent', ok: true, title: 'A cut-out with a transparent background', text: 'Remove the background first and save it as a PNG. The maker reads the transparent background by itself.', note: 'Matches your picture 98.5%' },
  { id: 'good-lineart', ok: true, title: 'Bold, filled artwork', text: 'Thick branches, solid fills and clear gaps between parts print well and cast a sharp shadow.', note: 'Matches your picture 97%' },
  { id: 'bad-photo', ok: false, title: 'A photo with its background', text: 'The background is dark too, so the whole photo becomes one big block of shadow. Remove the background first.', note: 'The shadow is a dark rectangle' },
  { id: 'bad-faded', ok: false, title: 'A faded, low-contrast picture', text: 'Light greys are not dark enough to count as shadow, so almost nothing is left. Raise the contrast first.', note: 'Almost no shadow' },
  { id: 'bad-thinlines', ok: false, title: 'Thin outlines', text: 'Hairlines are too thin to print, so they cast only a few broken lines. Use filled shapes instead of outlines.', note: 'Matches your picture 4%' },
];

export function PictureGuide({ videoUrl }: { videoUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="linkish pg-open" onClick={() => { setOpen(true); track('guide_open', 'Which pictures work best'); }}>
        <span aria-hidden>?</span> Which pictures work best?
      </button>
      {open && createPortal(<GuideDialog videoUrl={videoUrl} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function GuideDialog({ videoUrl, onClose }: { videoUrl?: string | null; onClose(): void }) {
  const videoId = youtubeId(videoUrl);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return (
    <dialog ref={ref} className="pg" onClose={onClose} aria-labelledby="pg-h">
      <div className="pg-in">
        <header className="pg-head">
          <div>
            <p className="eyebrow">Shadow lamp pictures</p>
            <h2 id="pg-h">Which pictures work best?</h2>
            <p className="pg-lede">The lamp turns the dark parts of your picture into shadow and lets light through the rest. A clear shape on a plain or transparent background works best. Each example below shows the picture and the real shadow this tool makes from it.</p>
          </div>
          <button type="button" className="pg-x" onClick={() => ref.current?.close()} aria-label="Close">×</button>
        </header>

        {videoId && (
          <div className="pg-yt">
            <p className="pg-yt-h"><b>Watch: how to make a great shadow lamp</b><small>Removing a background, making an SVG, and what every setting does (2:35)</small></p>
            <YouTubeEmbed id={videoId} title="How to make a shadow lamp" where="picture-guide" />
          </div>
        )}

        <div className="pg-grid">
          {EXAMPLES.map((x) => (
            <figure key={x.id} className={`pg-card ${x.ok ? 'ok' : 'no'}`}>
              <div className="pg-pics">
                <img src={`/guides/shadow-lamp/${x.id}-in.webp`} alt={`Picture: ${x.title.toLowerCase()}`} loading="lazy" />
                <span className="pg-arrow" aria-hidden>→</span>
                <img src={`/guides/shadow-lamp/${x.id}-shadow.webp`} alt={`The shadow it makes: ${x.note.toLowerCase()}`} loading="lazy" />
              </div>
              <figcaption>
                <span className="pg-mark" aria-label={x.ok ? 'Works well' : 'Does not work well'}>{x.ok ? '✓' : '✕'}</span>
                <span><b>{x.title}</b>{x.text}<small>{x.note}</small></span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="pg-tips">
          <h3>Getting your picture ready</h3>
          <ul>
            <li><b>Use a PNG, JPG or SVG file.</b> Other formats (WebP, HEIC from iPhones, GIF) are not accepted; save or export as PNG or JPG first.</li>
            <li><b>Remove the background of a photo.</b> Free tools such as remove.bg, Canva or Photoroom do it in one click. Download the result as a PNG with a transparent background and upload that.</li>
            <li><b>Or turn it into an SVG.</b> A vector converter traces the shape into clean, sharp edges. Upload the SVG as it is.</li>
            <li><b>Plain background?</b> Choose “Solid cut-out (remove a plain background)” under “How to read it”.</li>
            <li><b>Too much or too little shadow?</b> Move the “Darkness cut-off” slider, or tick “Swap light and shadow” for a white shape on a dark background.</li>
            <li><b>Crop close to the subject</b> and avoid lines thinner than a pencil line at full size.</li>
          </ul>
        </div>
      </div>
    </dialog>
  );
}
