/* Preview worker: decides what each wall keeps and predicts the shadow. It never builds printable meshes. */
import { analyse, predictShadow, plateArt, makeSampler, PAD } from '../../lib/lamp/raster.js';

function crop(mask, w, ns, nv, step) {
  // panel or plate raster -> small image (rows from the bottom up), sampled every `step` cells
  const W = Math.ceil(ns / step), H = Math.ceil(nv / step), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = mask[(PAD + y * step) * w + PAD + x * step] ? 1 : 0;
  return { w: W, h: H, data: out };
}

function plateJob(job, fallback) {
  const P = job.plate;
  const field = P.field || fallback.field, w = P.field ? P.w : fallback.w, h = P.field ? P.h : fallback.h;
  const A = plateArt(makeSampler(field, w, h, P.view), P.opts);
  return { pieces: A.pieces, areaMm2: A.areaMm2, W: A.q.W, H: A.q.H, hole: A.q.hole, img: crop(A.art, A.R.w, A.R.ns, A.R.nv, 4) };
}

self.onmessage = (e) => {
  const job = e.data;
  try {
    let plate = null;
    if (job.plate) plate = plateJob(job, job);
    if (job.onlyPlate) { self.postMessage({ id: job.id, onlyPlate: true, keepPlate: !!job.keepPlate, plate }, plate ? [plate.img.data.buffer] : []); return; }
    const sampler = makeSampler(job.field, job.w, job.h, job.view);
    const res = analyse(sampler, job.opts), p = res.params;
    const W = job.previewW, mm = job.previewSpan / W;
    const shadow = predictShadow(res, W, W, mm), ideal = new Uint8Array(W * W);
    let x0 = W, x1 = -1, y0 = W, y1 = -1;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const X = (x + 0.5 - W / 2) * mm, Y = (W / 2 - y - 0.5) * mm, k = y * W + x;
      ideal[k] = sampler(X, Y) > 0.5 ? 1 : 0;
      if (shadow[k] === 1 || shadow[k] === 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const tr = [shadow.buffer, ideal.buffer];
    const panels = res.panels.map((q) => {
      const R = q.raster;
      let top = 0;
      for (let j = R.nv - 1; j >= 0 && !top; j--) for (let i = 0; i < R.ns; i++) if (R.own[(j + PAD) * R.w + i + PAD]) { top = p.V0 + (j + 1) * R.res; break; }
      const img = crop(R.own, R.w, R.ns, R.nv, 2); tr.push(img.data.buffer);
      return { id: q.def.id, n: q.def.n, Lo: q.def.Lo, Lb: q.def.Lb, top, stats: R.stats, fins: q.fins, img, res: R.res * 2, V0: p.V0 };
    });
    if (plate) tr.push(plate.img.data.buffer);
    self.postMessage({ id: job.id, keepPlate: !!job.keepPlate, plate, panels, backing: !!p.backing, vmax: p.Vmax, shadow, ideal, W, widthMm: x1 >= x0 ? (x1 - x0 + 1) * mm : 0, heightMm: y1 >= y0 ? (y1 - y0 + 1) * mm : 0 }, tr);
  } catch (err) {
    self.postMessage({ id: job.id, error: String((err && err.message) || err) });
  }
};
