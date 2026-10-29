/* Photos on reviews: shrunk in the browser before upload (long side 1600 px, JPEG), at most 4 per review. */
export const MAX_REVIEW_PHOTOS = 4;
const SIDE = 1600;

export async function shrinkPhoto(file: Blob): Promise<{ blob: Blob; w: number; h: number; url: string } | null> {
  const src = URL.createObjectURL(file);
  try {
    const im = new Image(); im.decoding = 'async';
    await new Promise<void>((ok, bad) => { im.onload = () => ok(); im.onerror = () => bad(new Error('decode')); im.src = src; });
    const k = Math.min(1, SIDE / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? { blob, w, h, url: URL.createObjectURL(blob) } : null;
  } catch { return null; } finally { URL.revokeObjectURL(src); }
}

export async function uploadReviewPhoto(p: { blob: Blob; w: number; h: number }): Promise<{ ok: boolean; error?: string }> {
  const f = new FormData();
  f.append('file', p.blob, 'photo.jpg'); f.append('w', String(p.w)); f.append('h', String(p.h));
  const r = await fetch('/api/reviews/photos', { method: 'POST', body: f });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  return r.ok ? { ok: true } : { ok: false, error: j.error || 'Could not upload the photo.' };
}
