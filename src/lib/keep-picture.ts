/* "Help improve this tool": the visitor may let us keep a copy of the picture they upload, for 10 days.
 * Off unless they tick the box. Their answer is remembered in a cookie, so every upload box on the site agrees.
 * Browser-only module (the tools' upload handlers call offerPicture). */

const COOKIE = 'mdl_keep_pic', EVENT = 'mdl:keep-picture', MAX_SIDE = 1200;
type Pending = { blob: Blob; tool: string; name: string; sent: boolean };
let last: Pending | null = null;

export function keepOptedIn() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c === `${COOKIE}=1`);
}
export function setKeepOptIn(on: boolean) {
  document.cookie = `${COOKIE}=${on ? 1 : 0}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
  if (on && last && !last.sent) void send(last);     // ticked after choosing the picture: keep that one
}
export function onKeepChange(fn: (on: boolean) => void) {
  const h = (e: Event) => fn(Boolean((e as CustomEvent).detail));
  window.addEventListener(EVENT, h); return () => window.removeEventListener(EVENT, h);
}

/** Every picture a tool takes in goes through here. Nothing is sent unless the visitor ticked the box. */
export function offerPicture(file: Blob, tool: string, name = '') {
  if (typeof window === 'undefined' || !file || !/^image\//.test(file.type)) return;
  last = { blob: file, tool, name: name.replace(/\.[^.]+$/, ''), sent: false };
  if (keepOptedIn()) void send(last);
}

async function shrink(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const im = new Image(); im.decoding = 'async';
    await new Promise<void>((ok, bad) => { im.onload = () => ok(); im.onerror = () => bad(new Error('decode')); im.src = url; });
    const k = Math.min(1, MAX_SIDE / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);   // transparent parts on white, as the tools read them
    const out = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
    return out ? { out, w, h } : null;
  } finally { URL.revokeObjectURL(url); }
}

async function send(p: Pending) {
  p.sent = true;
  try {
    const s = await shrink(p.blob); if (!s) return;
    const f = new FormData();
    f.set('file', s.out, 'picture.jpg'); f.set('tool', p.tool); f.set('name', p.name); f.set('w', String(s.w)); f.set('h', String(s.h)); f.set('consent', 'yes');
    await fetch('/api/pictures', { method: 'POST', body: f, credentials: 'same-origin' });
  } catch { /* sharing is optional; never get in the way of the tool */ }
}
