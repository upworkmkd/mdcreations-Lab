/* Web Mercator helpers for the map picker and the elevation tiles (256 px tiles). */
export const TILE = 256;
export const lonToX = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
export const latToY = (lat: number, z: number) => { const s = Math.sin((lat * Math.PI) / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z; };
export const xToLon = (x: number, z: number) => (x / (TILE * 2 ** z)) * 360 - 180;
export const yToLat = (y: number, z: number) => { const n = Math.PI - (2 * Math.PI * y) / (TILE * 2 ** z); return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
/** Metres per pixel at a latitude and zoom. */
export const mPerPx = (lat: number, z: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

export const ELEV_URL = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
export const MAP_URL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
/** Sentinel-2 cloudless 2016 by EOX (CC BY 4.0): free for commercial use with credit. About 10 m per pixel. */
export const SAT_URL = (z: number, x: number, y: number) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`;
export const SAT_MAX_ZOOM = 14;
export const SAT_CREDIT = 'Sentinel-2 cloudless – s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016)';

const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => rej(new Error('tile')); im.src = src; });

/**
 * Elevation (metres) on an n × m grid covering the box [x0, y0] – [x1, y1] given in pixels at zoom `z`.
 * Picks a tile zoom with enough detail, stitches the tiles and samples them bilinearly.
 */
export async function fetchElevation(z: number, x0: number, y0: number, x1: number, y1: number, n: number, m: number) {
  let ze = z; while (ze < 14 && ((x1 - x0) * 2 ** (ze - z)) < n * 1.2) ze++;
  while (ze > 1 && ((x1 - x0) * 2 ** (ze - z)) > n * 3) ze--;
  const f = 2 ** (ze - z), X0 = x0 * f, Y0 = y0 * f, X1 = x1 * f, Y1 = y1 * f, max = 2 ** ze;
  const tx0 = Math.floor(X0 / TILE), ty0 = Math.floor(Y0 / TILE), tx1 = Math.floor((X1 - 1e-6) / TILE), ty1 = Math.floor((Y1 - 1e-6) / TILE);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 36) throw new Error('That area is too large to fetch at once.');
  const W = (tx1 - tx0 + 1) * TILE, H = (ty1 - ty0 + 1) * TILE, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const jobs: Promise<void>[] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (ty < 0 || ty >= max) continue;
    const wx = ((tx % max) + max) % max;
    jobs.push(load(ELEV_URL(ze, wx, ty)).then((im) => g.drawImage(im, (tx - tx0) * TILE, (ty - ty0) * TILE)));
  }
  await Promise.all(jobs);
  const d = g.getImageData(0, 0, W, H).data;
  const at = (x: number, y: number) => { const i = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4; return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768; };
  const out = new Int16Array(n * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const px = X0 + ((X1 - X0) * i) / (n - 1) - tx0 * TILE, py = Y0 + ((Y1 - Y0) * j) / (m - 1) - ty0 * TILE;
    const xi = Math.floor(px), yi = Math.floor(py), fx = px - xi, fy = py - yi;
    const v = at(xi, yi) * (1 - fx) * (1 - fy) + at(xi + 1, yi) * fx * (1 - fy) + at(xi, yi + 1) * (1 - fx) * fy + at(xi + 1, yi + 1) * fx * fy;
    out[j * n + i] = Math.max(-32000, Math.min(32000, Math.round(v)));
  }
  return { elev: out, zoom: ze };
}

/**
 * The satellite picture's colour (RGB, 3 bytes per sample) on the same n × m grid as fetchElevation, for colouring
 * the model. Uses tiles up to SAT_MAX_ZOOM.
 */
export async function fetchImagery(z: number, x0: number, y0: number, x1: number, y1: number, n: number, m: number) {
  let ze = z; while (ze < SAT_MAX_ZOOM && ((x1 - x0) * 2 ** (ze - z)) < n * 1.5) ze++;
  while (ze > 1 && ((x1 - x0) * 2 ** (ze - z)) > n * 4) ze--;
  const f = 2 ** (ze - z), X0 = x0 * f, Y0 = y0 * f, X1 = x1 * f, Y1 = y1 * f, max = 2 ** ze;
  const tx0 = Math.floor(X0 / TILE), ty0 = Math.floor(Y0 / TILE), tx1 = Math.floor((X1 - 1e-6) / TILE), ty1 = Math.floor((Y1 - 1e-6) / TILE);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 49) throw new Error('That area is too large to fetch at once.');
  const W = (tx1 - tx0 + 1) * TILE, H = (ty1 - ty0 + 1) * TILE, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const jobs: Promise<void>[] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (ty < 0 || ty >= max) continue;
    jobs.push(load(SAT_URL(ze, ((tx % max) + max) % max, ty)).then((im) => g.drawImage(im, (tx - tx0) * TILE, (ty - ty0) * TILE)));
  }
  await Promise.all(jobs);
  // each sample is the average of the pixels around it, so a sample is not one random tree or roof
  const step = Math.max(1, Math.round((X1 - X0) / (n - 1) / 2));
  const d = g.getImageData(0, 0, W, H).data, out = new Uint8Array(n * m * 3);
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const px = Math.round(X0 + ((X1 - X0) * i) / (n - 1) - tx0 * TILE), py = Math.round(Y0 + ((Y1 - Y0) * j) / (m - 1) - ty0 * TILE);
    let r = 0, gg = 0, b = 0, k = 0;
    for (let dy = -step; dy <= step; dy += step) for (let dx = -step; dx <= step; dx += step) {
      const x = Math.min(W - 1, Math.max(0, px + dx)), y = Math.min(H - 1, Math.max(0, py + dy)), q = (y * W + x) * 4;
      r += d[q]; gg += d[q + 1]; b += d[q + 2]; k++;
    }
    const o = (j * n + i) * 3; out[o] = r / k; out[o + 1] = gg / k; out[o + 2] = b / k;
  }
  return out;
}
