/* Turns a picture into a grid of brightness values (0 = black, 1 = white), in the browser. */

export type Framing = { zoom: number; x: number; y: number };   // zoom ≥ 1, x / y from -1 to 1 (pan)

/** Draws the image to fill a w × h box (cover), zoomed and panned. */
export function drawCover(g: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, w: number, h: number, f: Framing = { zoom: 1, x: 0, y: 0 }) {
  const s = Math.max(w / img.width, h / img.height) * f.zoom, dw = img.width * s, dh = img.height * s;
  g.drawImage(img, (w - dw) / 2 - (f.x * (dw - w)) / 2, (h - dh) / 2 - (f.y * (dh - h)) / 2, dw, dh);
}

/** Brightness grid (row 0 = top). Transparent parts count as white. */
export function grayGrid(img: CanvasImageSource & { width: number; height: number }, w: number, h: number, f?: Framing): Uint8Array {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.imageSmoothingQuality = 'high';
  drawCover(g, img, w, h, f);
  const d = g.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.round(0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]);
  return out;
}

/** Simple brightness / contrast / gamma adjustments on a byte grid. */
export function adjust(src: Uint8Array, { brightness = 0, contrast = 0, gamma = 1, invert = false }: { brightness?: number; contrast?: number; gamma?: number; invert?: boolean }) {
  const lut = new Uint8Array(256), k = (1 + contrast) / (1 - Math.min(0.99, contrast));
  for (let v = 0; v < 256; v++) {
    let x = v / 255; x = (x - 0.5) * k + 0.5 + brightness; x = Math.min(1, Math.max(0, x)); x = Math.pow(x, 1 / gamma); if (invert) x = 1 - x;
    lut[v] = Math.round(x * 255);
  }
  const out = new Uint8Array(src.length); for (let i = 0; i < src.length; i++) out[i] = lut[src[i]]; return out;
}

/** Loads a demo or uploaded picture by URL. */
export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
