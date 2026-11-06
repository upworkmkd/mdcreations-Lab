/* "Edit design": a saved design opened again in its maker. Shared by the browser makers (no server code here). */
import { useEffect, useRef } from 'react';
import { decodeRle } from '@/lib/layers/rle.js';
import { loadImage } from '@/lib/mesh/image-grid';
import { b64ToBytes } from '@/lib/mesh/b64.js';

/** A design from the account, handed to its maker. settings is null for designs saved before editing existed. */
export type SavedDesign = { id: string; name: string; settings: Record<string, unknown> | null; params: Record<string, unknown> };

type Pic = CanvasImageSource & { width: number; height: number };

/** The settings to restore: the saved ones, else what can be rebuilt from the build params (older designs). */
export function restoreFrom<T>(saved: SavedDesign | null | undefined, fromParams: (p: Record<string, unknown>) => Partial<T> | null): Partial<T> | null {
  if (!saved) return null;
  if (saved.settings) return saved.settings as Partial<T>;
  try { return fromParams(saved.params ?? {}); } catch { return null; }
}

/**
 * A picture as a small data URL, to keep with the settings. JPEG unless it has see-through parts (then PNG, which some
 * tools read). Shrinks until it fits in `budget` characters so the save stays well under the request limit.
 */
export function pictureUrl(img: Pic, max = 1400, budget = 1_400_000): string {
  let side = max;
  for (let k = 0; k < 6; k++) {
    const s = Math.min(1, side / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
    const a = g.getImageData(0, 0, w, h).data; let alpha = false;
    for (let i = 3; i < a.length; i += 4 * 7) if (a[i] < 250) { alpha = true; break; }
    const url = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
    if (url.length <= budget) return url;
    side = Math.round(side * 0.72);
  }
  return '';
}

const urls = new WeakMap<object, string>();
/** pictureUrl, worked out once per picture (getDesign may be called more than once). */
export function savedPicture(img: Pic | null | undefined): string | null {
  if (!img) return null;
  let u = urls.get(img); if (u == null) { u = pictureUrl(img); urls.set(img, u); }
  return u || null;
}

/** Loads the saved picture once, when the maker opens, and hands it to `apply`. */
export function useRestoredPicture(url: string | null | undefined, apply: (im: HTMLImageElement) => void) {
  const done = useRef(false), fn = useRef(apply);
  useEffect(() => { fn.current = apply; });
  useEffect(() => {
    if (!url || done.current) return; done.current = true;
    loadImage(url).then((im) => { urls.set(im, url); fn.current(im); }).catch(() => {});
  }, [url]);
}

/** A grey picture from a saved grid (one byte per sample, rows top to bottom). */
export function grayUrl(b64: string, w: number, h: number): string {
  const v = b64ToBytes(b64), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!, im = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const x = v[i] ?? 0; im.data[i * 4] = x; im.data[i * 4 + 1] = x; im.data[i * 4 + 2] = x; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

/** A black-on-white picture from a saved shape (1 = shape), rows top to bottom unless flipY. */
export function maskUrl(bytes: Uint8Array, w: number, h: number, { flipY = false, pad = 0 } = {}): string {
  const c = document.createElement('canvas'); c.width = w + 2 * pad; c.height = h + 2 * pad;
  const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  const im = g.getImageData(0, 0, c.width, c.height);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bytes[(flipY ? h - 1 - y : y) * w + x]) {
    const k = 4 * ((y + pad) * c.width + x + pad); im.data[k] = im.data[k + 1] = im.data[k + 2] = 0;
  }
  g.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

/** A shape saved run-length encoded (encodeRle). */
export const rleBytes = (b64: string, n: number): Uint8Array => decodeRle(b64, n) as Uint8Array;

/** Plain values from untyped JSON. */
export const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
