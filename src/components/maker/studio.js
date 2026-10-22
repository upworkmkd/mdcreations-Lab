/* The Shadow Lamp Maker's editor: reads the picture, lets the visitor place it, and draws the predicted shadow.
 * Plain DOM code on purpose - it redraws canvases on every pointer move and does not need React for that.
 * mountStudio() wires everything inside `root` and returns an api the React wrapper uses for checkout. */
import { DEFAULTS, PLATE, edt, gaussBlur, label, maskToBytes } from '../../lib/lamp/raster.js';

const PW = 704, SPAN = 1760;              // preview pixels and the wall width they cover (mm)

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/* ---------- picture -> silhouette ---------- */
function decode(src, done, fail) {
  const im = new Image();
  im.onload = () => {
    // big pictures are scaled down to 1400 px; small ones are scaled up to 1200 px so dots and fine lines keep clean edges
    const big = Math.max(im.naturalWidth, im.naturalHeight), sc = big > 1400 ? 1400 / big : big < 1200 ? 1200 / big : 1;
    const w = Math.max(8, Math.round(im.naturalWidth * sc)), h = Math.max(8, Math.round(im.naturalHeight * sc));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    let clear = 0, extreme = 0, chroma = 0; const hist = new Float64Array(256);
    for (let i = 0; i < w * h; i++) { const a = d[4 * i + 3]; if (a < 250) clear++; const l = (d[4 * i] * 299 + d[4 * i + 1] * 587 + d[4 * i + 2] * 114) / 1000; hist[l | 0]++; if (l < 60 || l > 200) extreme++; chroma += Math.max(d[4 * i], d[4 * i + 1], d[4 * i + 2]) - Math.min(d[4 * i], d[4 * i + 1], d[4 * i + 2]); }
    let sum = 0; const tot = w * h; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sb = 0, wb = 0, best = 0, lo = 128, hi = 128;
    for (let i = 0; i < 256; i++) { wb += hist[i]; if (!wb) continue; const wf = tot - wb; if (!wf) break; sb += i * hist[i]; const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) ** 2; if (v > best * 1.0005) { best = v; lo = hi = i; } else if (v > best * 0.9995) hi = i; }
    const thr = Math.max(1, Math.min(254, Math.round((lo + hi) / 2) + 1));
    // background brightness = median along the border; for dark art on a light ground, set the cut-off
      // part-way from Otsu towards the background so faint grey dots and splashes are kept
      const border = []; for (let x = 0; x < w; x += 3) border.push(d[4 * x], d[4 * ((h - 1) * w + x)]); for (let y = 0; y < h; y += 3) border.push(d[4 * y * w], d[4 * (y * w + w - 1)]);
      border.sort((a, b) => a - b); const bg = border[border.length >> 1];
      const lvl = bg > thr + 30 ? Math.min(bg - 14, Math.round(thr + 0.6 * (bg - thr))) : thr;
      const grey = chroma / (w * h) < 14;                     // a black-and-white or grey picture: line art or a silhouette
      // Every picture is read by darkness: dark parts become shadow, light parts let the light through. Photos keep
      // their inner detail (faces, beards, spokes) this way, instead of turning into one solid cut-out. Clean art
      // gets the Otsu cut-off; a photo gets the middle grey (128), which reads faces and clothes the way people expect.
      const art = extreme > 0.9 * w * h || grey;
      done({ img, w, h, otsu: art ? lvl : 128, mode: clear > 0.02 * w * h ? 'alpha' : 'art' });
  };
  im.onerror = fail;
  im.src = src;
}
const levelFor = (mode, otsu) => (mode === 'art' ? otsu : mode === 'photo' ? 38 : 128);

// o: { mode, level, invert, gaps, smooth } -> binary mask, smoothing radius, field, bounding box and a dark cut-out for quick drawing
function readPicture(img, w, h, o) {
  const d = img.data, m = new Uint8Array(w * h), lv = o.level;
  if (o.mode === 'alpha') { for (let i = 0; i < w * h; i++) m[i] = d[4 * i + 3] > lv ? 1 : 0; }
  else if (o.mode === 'art') { for (let i = 0; i < w * h; i++) { const a = d[4 * i + 3] / 255, l = ((d[4 * i] * 299 + d[4 * i + 1] * 587 + d[4 * i + 2] * 114) / 1000) * a + 255 * (1 - a); m[i] = l < lv ? 1 : 0; } }
  else {
    const rs = [], gs = [], bs = [];
    const take = (i) => { rs.push(d[4 * i]); gs.push(d[4 * i + 1]); bs.push(d[4 * i + 2]); };
    for (let x = 0; x < w; x += 2) { take(x); take((h - 1) * w + x); } for (let y = 0; y < h; y += 2) { take(y * w); take(y * w + w - 1); }
    const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; }, br = med(rs), bg = med(gs), bb = med(bs);
    const like = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) like[i] = Math.max(Math.abs(d[4 * i] - br), Math.abs(d[4 * i + 1] - bg), Math.abs(d[4 * i + 2] - bb)) <= lv ? 1 : 0;
    const stack = new Int32Array(w * h); let sp = 0; m.fill(1);
    const seed = (i) => { if (like[i] && m[i]) { m[i] = 0; stack[sp++] = i; } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); } for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (sp) { const i = stack[--sp], x = i % w; if (x > 0) seed(i - 1); if (x < w - 1) seed(i + 1); if (i >= w) seed(i - w); if (i < w * (h - 1)) seed(i + w); }
    if (o.gaps) {
      const inner = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) inner[i] = like[i] && m[i] ? 1 : 0;
      const L = label(inner, w, h), cnt = new Int32Array(L.n + 1), min = Math.max(60, 0.0004 * w * h);
      for (let i = 0; i < w * h; i++) cnt[L.lab[i]]++;
      for (let i = 0; i < w * h; i++) if (L.lab[i] && cnt[L.lab[i]] >= min) m[i] = 0;
    }
  }
  if (o.invert) for (let i = 0; i < w * h; i++) m[i] = 1 - m[i];
  const sigma = 0.6 + (o.smooth / 10) * Math.max(w, h) / 700;
  const field = gaussBlur(Float32Array.from(m), w, h, sigma);
  let x0 = w, x1 = -1, y0 = h, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (field[y * w + x] > 0.5) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const empty = n < 20 || n > 0.98 * w * h;
  const mc = document.createElement('canvas'); mc.width = w; mc.height = h;
  const g = mc.getContext('2d'), id = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { id.data[4 * i] = 22; id.data[4 * i + 1] = 23; id.data[4 * i + 2] = 17; id.data[4 * i + 3] = Math.max(0, Math.min(255, (field[i] - 0.5) * 6 * 255 + 128)); }
  g.putImageData(id, 0, 0);
  return { m, sigma, field, empty, bbox: empty ? { x0: 0, x1: w - 1, y0: 0, y1: h - 1 } : { x0, x1, y0, y1 }, maskCanvas: mc };
}

export function mountStudio(root, hooks) {
  const ac = new AbortController(), on = (el, ev, fn, opt) => el.addEventListener(ev, fn, Object.assign({ signal: ac.signal }, opt || {}));
  const $ = (id) => root.querySelector('#' + id);
  const state = { img: null, w: 0, h: 0, m: null, sigma: 1, field: null, bbox: null, view: { cx: 0, cy: 0, mmPerPx: 1, mirror: false },
                  result: null, jobId: 0, doneId: 0, maskCanvas: null, isExample: true, empty: false, otsu: 128 };
  const plate = { own: null, view: { cx: 0, cy: 0, mmPerPx: 1, mirror: false }, fitMm: 1, dirty: true };
  let wallFresh = false, wallsDirty = true, alive = true;

  function loadImage(src, name, example) {
    decode(src, (p) => {
      if (!alive) return;
      state.img = p.img; state.w = p.w; state.h = p.h; state.otsu = p.otsu; state.isExample = !!example;
      $('fname').textContent = name;
      $('name').value = name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 _-]+/g, ' ').trim().slice(0, 40) || 'Design';
      $('mode').value = p.mode; $('invert').checked = false;
      syncMode(true); buildMask(true);
    }, () => { $('fname').textContent = 'That file could not be read as a picture.'; });
  }
  function syncMode(reset) {
    const m = $('mode').value, lv = $('level');
    $('levelLab').textContent = m === 'art' ? 'Darkness cut-off' : m === 'photo' ? 'Background tolerance' : 'Transparency cut-off';
    if (reset) lv.value = levelFor(m, state.otsu);
    $('gapsRow').hidden = m !== 'photo'; out();
  }
  function buildMask(refit) {
    const { w, h } = state;
    const r = readPicture(state.img, w, h, { mode: $('mode').value, level: +$('level').value, invert: $('invert').checked, gaps: $('gaps').checked, smooth: +$('smooth').value });
    Object.assign(state, { m: r.m, sigma: r.sigma, field: r.field, empty: r.empty, bbox: r.bbox, maskCanvas: r.maskCanvas });
    const t = $('thumb').getContext('2d'); t.clearRect(0, 0, 128, 128);
    const s = Math.min(128 / w, 128 / h); t.drawImage(r.maskCanvas, (128 - w * s) / 2, (128 - h * s) / 2, w * s, h * s);
    if (!plate.own) { if (refit) plateFit(true); else plate.dirty = true; }
    if (refit) autoFit(); else { clampView(); syncSize(); schedule(); }
    drawQuick(); drawPlate();
  }

  /* ---------- cover plate ---------- */
  const pcv = $('plateCv'), pctx = pcv.getContext('2d'), PK = pcv.width / PLATE.W, tint = document.createElement('canvas');
  tint.width = pcv.width; tint.height = pcv.height;
  const plateSrc = () => plate.own || state;
  function plateFit(quiet) {
    const src = plateSrc(), P = PLATE, b = src.bbox; if (!b) return;
    plate.fitMm = Math.min((P.W - 2 * P.inset - 3) / (b.x1 - b.x0 + 1), (P.H - 2 * P.inset - 3) / (b.y1 - b.y0 + 1));
    plate.view = { cx: (b.x0 + b.x1 + 1) / 2, cy: (b.y0 + b.y1 + 1) / 2, mmPerPx: plate.fitMm, mirror: false };
    plate.dirty = true; syncPlateSize();
    if (!quiet) { drawPlate(); schedule(true); }
  }
  function syncPlateSize() { const pc = Math.round(plate.view.mmPerPx / plate.fitMm * 100); $('plateSize').value = Math.max(20, Math.min(250, pc)); $('plateSizeOut').textContent = pc + '%'; }
  function plateOpts() { return { style: $('plateStyle').value, lineW: +$('plateLine').value, gap: +$('plateGap').value, combined: $('plateKind').value === 'combined', plateColor: $('plateCol').value, artColor: $('artCol').value }; }
  const PLATE_DEF = '#3a3d2c', ART_DEF = '#e9c78f';
  let PLATE_BG = PLATE_DEF, ART = ART_DEF;
  const HINT_SEPARATE = 'Drag the picture on the plate to place it. Two prints, no colour change: a 2 mm plate with the picture sunk 1 mm deep, and the picture itself, 1 mm thick, which presses in.';
  const HINT_COMBINED = 'Drag the picture on the plate to place it. One print with an AMS: a flat 2 mm plate with the picture inlaid in its top 0.6 mm, so it looks drawn on. You get a 3MF that opens in Bambu Studio with both colours ready to map to your filaments, plus the two parts as STLs. No AMS? Choose Two prints.';
  function plateColours() {
    const comb = $('plateKind').value === 'combined';
    $('plateColours').hidden = !comb;
    PLATE_BG = comb ? $('plateCol').value : PLATE_DEF; ART = comb ? $('artCol').value : ART_DEF;
    $('plateHint').textContent = comb ? HINT_COMBINED : HINT_SEPARATE;
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function drawPlate() {
    const P = PLATE, W = pcv.width, H = pcv.height, src = plateSrc();
    pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.fillStyle = PLATE_BG; pctx.fillRect(0, 0, W, H);
    const r = state.result && state.result.plate;
    if (r && !plate.dirty) {                       // the pieces that will be printed
      const im = r.img, c = document.createElement('canvas'); c.width = im.w; c.height = im.h;
      const g = c.getContext('2d'), id = g.createImageData(im.w, im.h);
      const ac = hexRgb(ART);
      for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) {
        const k = 4 * ((im.h - 1 - y) * im.w + x);
        if (im.data[y * im.w + x]) { id.data[k] = ac[0]; id.data[k + 1] = ac[1]; id.data[k + 2] = ac[2]; id.data[k + 3] = 255; }
      }
      g.putImageData(id, 0, 0);
      pctx.imageSmoothingEnabled = true; pctx.drawImage(c, 0, 0, W, H);
    } else if (src.maskCanvas) {                   // instant stand-in while the pieces are worked out
      const g = tint.getContext('2d'), v = plate.view, sc = v.mmPerPx * PK;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
      g.translate(W / 2, H / 2); g.scale(sc, sc); g.drawImage(src.maskCanvas, -v.cx, -v.cy);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = ART; g.fillRect(0, 0, W, H);
      pctx.globalAlpha = 0.6; pctx.drawImage(tint, 0, 0); pctx.globalAlpha = 1;
    }
    pctx.fillStyle = PLATE_BG; pctx.beginPath(); pctx.arc(W / 2, H / 2, (P.hole / 2 + P.ring) * PK, 0, 6.3); pctx.fill();
    pctx.fillStyle = '#16170f'; pctx.beginPath(); pctx.arc(W / 2, H / 2, P.hole / 2 * PK, 0, 6.3); pctx.fill();
    if (wallFresh && state.result) drawResult(); else drawQuick();
  }
  function readPlate() {
    const o = plate.own; if (!o) return;
    Object.assign(o, readPicture(o.img, o.w, o.h, { mode: $('pMode').value, level: +$('pLevel').value, invert: $('pInvert').checked, gaps: true, smooth: 12 }));
    $('pLevelOut').textContent = $('pLevel').value;
  }
  function syncPlateUi() {
    const onp = $('plateOn').checked;
    $('plateBody').hidden = !onp; $('plateHint').hidden = !onp;
    $('plateRead').hidden = !plate.own; $('plateSame').hidden = !plate.own;
    $('plateName').textContent = plate.own ? plate.own.name : 'Using the shadow picture';
    $('plateLineRow').hidden = $('plateStyle').value !== 'outline'; $('plateLineOut').textContent = (+$('plateLine').value).toFixed(1) + ' mm';
  }
  function tagsInto(host, list) {
    host.textContent = '';
    for (const [txt, w] of list) { const sp = document.createElement('span'); sp.className = 'tag' + (w ? ' w' : ''); sp.textContent = txt; host.append(sp); }
  }
  function describePlate(r) {
    if (!r) return tagsInto($('plateTags'), []);
    const comb = $('plateKind').value === 'combined';
    tagsInto($('plateTags'), r.pieces ? [[comb ? 'picture inlaid flat, 3MF with 2 colours' : r.pieces + (r.pieces === 1 ? ' piece to press in' : ' pieces to press in'), !comb && r.pieces > 12], [Math.round(r.W) + ' × ' + Math.round(r.H) + ' × 2 mm plate']] : [['Nothing of the picture lands on the plate', true]]);
  }

  /* ---------- placement ---------- */
  function opts() {
    return { Vmax: +$('vmax').value, minSolid: +$('thin').value, apex: +$('apex').value, struts: $('loose').value === 'struts', backing: $('loose').value === 'backing', cornerWrap: $('wrap').checked, ribs: $('ribs').checked, leftCutouts: $('cuts').checked };
  }
  function limits() { const o = opts(), D = DEFAULTS, H = o.apex + D.ledge; return { dark: H / (o.apex - D.V1), reach: H / (o.apex - o.Vmax), bx: D.baseX, by: D.baseY }; }
  function autoFit() {
    // centre the picture on the lamp and make it as big as the lamp can throw it (up to about 1.1 m tall)
    const { w, h, bbox } = state, L = limits();
    const cx = state.empty ? w / 2 : (bbox.x0 + bbox.x1 + 1) / 2, cy = state.empty ? h / 2 : (bbox.y0 + bbox.y1 + 1) / 2;
    const reachX = L.bx * L.reach * 0.96 / Math.max((bbox.x1 - bbox.x0 + 1) / 2, 1), reachY = L.by * L.reach * 0.96 / Math.max((bbox.y1 - bbox.y0 + 1) / 2, 1);
    const fitAll = Math.min(reachX, reachY), nice = 1100 / Math.max(bbox.y1 - bbox.y0 + 1, (bbox.x1 - bbox.x0 + 1) * 0.9);
    state.view.cx = cx; state.view.cy = cy; state.view.mmPerPx = Math.min(fitAll, nice);
    syncSize(); schedule(); drawQuick();
  }
  function clampView() { const v = state.view; v.cx = Math.max(-state.w, Math.min(2 * state.w, v.cx)); v.cy = Math.max(-state.h, Math.min(2 * state.h, v.cy)); }
  function figureHeightMm() { return (state.bbox.y1 - state.bbox.y0 + 1) * state.view.mmPerPx; }
  function syncSize() { const cm = figureHeightMm() / 10; $('size').value = Math.max(30, Math.min(200, cm)); $('sizeOut').textContent = Math.round(cm) + ' cm'; }

  /* ---------- drawing the wall ---------- */
  const wall = $('wall'), ctx = wall.getContext('2d');
  const glow = (() => { const lut = new Float32Array(PW * PW); const H = 85 / (SPAN / PW);
    for (let y = 0; y < PW; y++) for (let x = 0; x < PW; x++) { const dx = x + 0.5 - PW / 2, dy = y + 0.5 - PW / 2, r2 = dx * dx + dy * dy; lut[y * PW + x] = Math.min(1, 1.5 * Math.pow(H * H / (H * H + r2), 0.55) + 0.04); }
    return lut; })();
  const LIT = [250, 222, 170], DEEP = [44, 46, 33], SHADE = [24, 25, 18];
  function paintWall(shadow, ideal) {
    const id = ctx.createImageData(PW, PW), d = id.data, showDiff = $('diff').checked;
    for (let i = 0; i < PW * PW; i++) {
      const g = glow[i];
      let r = DEEP[0] + (LIT[0] - DEEP[0]) * g, gr = DEEP[1] + (LIT[1] - DEEP[1]) * g, b = DEEP[2] + (LIT[2] - DEEP[2]) * g;
      const s = shadow ? shadow[i] : 0;
      if (s) { r = SHADE[0] + 8 * g; gr = SHADE[1] + 7 * g; b = SHADE[2] + 5 * g; }
      if (showDiff && ideal && s !== 2) {
        if (s && !ideal[i]) { r = 214; gr = 92; b = 58; } else if (!s && ideal[i]) { r = 92; gr = 150; b = 210; }
      }
      d[4 * i] = r; d[4 * i + 1] = gr; d[4 * i + 2] = b; d[4 * i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }
  function drawLampAndGuides() {
    const L = limits(), k = PW / SPAN, c = PW / 2;
    if ($('guides').checked) {
      ctx.save(); ctx.lineWidth = 1.5; ctx.font = '500 12px "IBM Plex Mono", ui-monospace, monospace';
      ctx.setLineDash([6, 5]); ctx.strokeStyle = '#f6e3bfaa';
      ctx.strokeRect(c - L.bx * L.dark * k, c - L.by * L.dark * k, 2 * L.bx * L.dark * k, 2 * L.by * L.dark * k);
      ctx.setLineDash([2, 6]); ctx.strokeStyle = '#f6e3bf77';
      ctx.strokeRect(c - L.bx * L.reach * k, c - L.by * L.reach * k, 2 * L.bx * L.reach * k, 2 * L.by * L.reach * k);
      ctx.setLineDash([]); ctx.fillStyle = '#f6e3bfcc';
      ctx.fillText('always dark', c - L.bx * L.dark * k + 4, c + L.by * L.dark * k + 15);
      ctx.fillText('shadow reaches this far', Math.max(6, c - L.bx * L.reach * k + 4), Math.max(14, c - L.by * L.reach * k + 15));
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = '#676e47'; ctx.strokeStyle = '#2c2e21'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(c - L.bx * k, c - L.by * k, 2 * L.bx * k, 2 * L.by * k); ctx.fill(); ctx.stroke();
    if ($('plateOn').checked) { const P = PLATE; ctx.drawImage(pcv, c - P.W / 2 * k, c - P.H / 2 * k, P.W * k, P.H * k); }
    ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.arc(c, c, 7.5 * k + 2, 0, 6.3); ctx.fill();
    ctx.restore();
  }
  function drawQuick() {
    if (!state.maskCanvas) return;
    paintWall(null, null);
    const v = state.view, k = PW / SPAN, s = v.mmPerPx * k;
    ctx.save(); ctx.translate(PW / 2, PW / 2); ctx.scale(v.mirror ? -s : s, s); ctx.drawImage(state.maskCanvas, -v.cx, -v.cy); ctx.restore();
    drawLampAndGuides();
  }
  function drawResult() {
    const r = state.result; if (!r) return drawQuick();
    paintWall(r.shadow, r.ideal); drawLampAndGuides();
  }

  /* ---------- working out the walls (in a worker) ---------- */
  let worker = null, timer = 0, busy = false, queued = false, sent = { walls: true, plate: true };
  try {
    worker = new Worker('/lamp-worker.js?v=2');
    worker.onmessage = (e) => finish(e.data);
    worker.onerror = () => { busy = false; setChip('Preview unavailable', false); note('placeNote', 'The preview could not start in this browser. Please try a current version of Chrome, Safari, Edge or Firefox.', false); };
  } catch (e) { worker = null; }
  function schedule(onlyPlate) { clearTimeout(timer); if (!onlyPlate) { wallsDirty = true; wallFresh = false; } setChip('Updating', true); hooks.onReady(false); timer = setTimeout(run, 350); }
  function run() {
    if (!state.field || !worker || !alive) return;
    if (busy) { queued = true; return; }
    busy = true; queued = false;
    const job = { id: ++state.jobId, field: state.field.slice(), w: state.w, h: state.h, view: Object.assign({}, state.view), opts: opts(), previewW: PW, previewSpan: SPAN };
    const tr = [job.field.buffer];
    job.onlyPlate = !wallsDirty && !!state.result; job.keepPlate = !plate.dirty && !!(state.result && state.result.plate);
    sent = { walls: wallsDirty, plate: plate.dirty }; wallsDirty = false; plate.dirty = false;
    if ($('plateOn').checked && plateSrc().field && !job.keepPlate) {
      const o = plate.own;
      job.plate = { field: o ? o.field.slice() : null, w: o ? o.w : 0, h: o ? o.h : 0, view: Object.assign({}, plate.view), opts: plateOpts() };
      if (o) tr.push(job.plate.field.buffer);
    }
    worker.postMessage(job, tr);
  }
  function finish(r) {
    if (!alive) return;
    busy = false;
    if (queued || r.id !== state.jobId || r.error) { wallsDirty = wallsDirty || sent.walls; plate.dirty = plate.dirty || sent.plate; }
    if (queued || r.id !== state.jobId) { run(); return; }
    if (r.error) { setChip('Could not build this one', false); note('placeNote', 'This picture could not be turned into walls (' + r.error + '). Try another reading mode or position.', false); return; }
    const prev = state.result;
    if (r.onlyPlate) r = Object.assign({}, prev, { id: r.id, plate: r.plate, keepPlate: r.keepPlate });
    if (r.keepPlate) r.plate = $('plateOn').checked && prev ? prev.plate : null;
    state.result = r; state.doneId = r.id; wallFresh = true;
    drawPlate(); renderPanels(r); describe(r); describePlate(r.plate);
    setChip(state.isExample ? 'Example' : 'Ready', false);
    hooks.onReady(!state.empty);
    if (hooks.onResult) hooks.onResult(lampData());
  }
  /** What the 3D views need: the walls as they will stand, the plate and where the light sits. */
  function lampData() {
    const r = state.result; if (!r) return null;
    const pl = $('plateOn').checked && r.plate ? r.plate : null;
    return { panels: r.panels, apex: +$('apex').value, withBase: $('withBase').checked,
      plate: pl && { img: pl.img, W: pl.W, H: pl.H, hole: pl.hole, combined: $('plateKind').value === 'combined', plateColor: PLATE_BG, artColor: ART } };
  }
  function setChip(t, isBusy) { const c = $('chip'); c.textContent = t; c.classList.toggle('busy', !!isBusy); }
  function note(id, text, ok) { const n = $(id); n.hidden = !text; n.textContent = text || ''; n.classList.toggle('ok', !!ok); }
  function describe(r) {
    let lost = 0, extra = 0, tot = 0;
    for (let i = 0; i < r.shadow.length; i++) { if (r.shadow[i] === 2) continue; if (r.ideal[i]) { tot++; if (!r.shadow[i]) lost++; } else if (r.shadow[i]) extra++; }
    // how much of the picture the real shadow reproduces: shared shadow over everything that is shadow in either one
    const match = tot ? (tot - lost) / (tot + extra) : 0;
    $('readout').textContent = r.widthMm ? 'shadow ' + Math.round(r.widthMm / 10) + ' × ' + Math.round(r.heightMm / 10) + ' cm' + (tot ? ' · matches your picture ' + (match * 100).toFixed(1) + '%' : '') : '';
    const bars = r.panels.reduce((a, p) => a + p.stats.struts, 0);
    const msgs = [];
    if (state.empty) msgs.push('No clear figure was found. Change how the picture is read in step 1.');
    else {
      if (tot && lost / tot > 0.02) msgs.push('Part of the picture is outside the reach of the lamp or too fine to print, and will be missing. Make the shadow smaller, or tick "Show what changes" to see where.');
      if (tot && extra / tot > 0.04) msgs.push('The lamp casts a dark block around itself that is wider than the figure here. Make the shadow bigger or move the lamp into a wider part of the body.');
      const dots = r.panels.reduce((a, p) => a + (p.stats.floating || 0), 0), dropped = r.panels.reduce((a, p) => a + p.stats.removedIslands, 0);
      if (bars) msgs.push(bars + (bars === 1 ? ' loose piece gets' : ' loose pieces get') + ' a thin support bar, which shows as a fine line in the shadow.' + (bars >= 3 ? ' For dots and splashes without lines, choose "Keep every dot on a clear layer" under Loose pieces.' : ''));
      if (dots) msgs.push(dots + (dots === 1 ? ' loose piece is' : ' loose pieces are') + ' held by a 0.6 mm clear layer on the outside of the walls. Print the first 0.6 mm of each wall in clear (transparent) filament, then change to an opaque colour.');
      if (!dots && !bars && dropped > 4 && $('loose').value === 'drop') msgs.push(dropped + ' loose pieces are left out.');
    }
    note('placeNote', msgs.join(' '), false);
  }
  const NAMES = { top: 'Top', right: 'Right', left: 'Left', bottom: 'Bottom' };
  function renderPanels(r) {
    const host = $('panels'); host.textContent = '';
    for (const p of r.panels) {
      const el = document.createElement('div'); el.className = 'panel';
      const t = document.createElement('div'); t.className = 't';
      const b = document.createElement('b'); b.textContent = p.n + ' · ' + NAMES[p.id];
      const sp = document.createElement('span'); sp.textContent = p.Lo + ' × ' + Math.round(p.top) + ' mm';
      t.append(b, sp);
      const c = document.createElement('canvas'); c.width = 600; c.height = 288;
      const g = c.getContext('2d'), k = 600 / 156, base = 288 - 6;
      if (r.backing) {                                                                       // the clear layer behind everything
        const top = Math.min(r.vmax, p.top + 1.5);
        g.fillStyle = 'rgba(120, 170, 190, 0.22)'; g.strokeStyle = 'rgba(80, 130, 150, 0.6)'; g.lineWidth = 1;
        g.fillRect(300 - p.Lo / 2 * k, base - top * k, p.Lo * k, (top - p.V0) * k); g.strokeRect(300 - p.Lo / 2 * k, base - top * k, p.Lo * k, (top - p.V0) * k);
      }
      g.fillStyle = '#424532';
      g.fillRect(300 - p.Lb / 2 * k, base - p.V0 * k, p.Lb * k, p.V0 * k + 0.5);           // the straight band at the foot
      const im = p.img, ic = document.createElement('canvas'); ic.width = im.w; ic.height = im.h;
      const ig = ic.getContext('2d'), id = ig.createImageData(im.w, im.h);
      for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.data[y * im.w + x]) { const q = 4 * ((im.h - 1 - y) * im.w + x); id.data[q] = 66; id.data[q + 1] = 69; id.data[q + 2] = 50; id.data[q + 3] = 255; }
      ig.putImageData(id, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(ic, 300 - p.Lo / 2 * k, base - (p.V0 + im.h * p.res) * k, im.w * p.res * k, im.h * p.res * k);
      const tags = document.createElement('div'); tags.className = 'tags';
      const list = [];
      if (p.fins.length) list.push([p.fins.length + (p.fins.length === 1 ? ' corner piece' : ' corner pieces') + ', up to ' + Math.ceil(Math.max(...p.fins.map((f) => f.height))) + ' mm tall']);
      if (p.stats.struts) list.push([p.stats.struts + (p.stats.struts === 1 ? ' support bar' : ' support bars'), true]);
      if (p.stats.floating) list.push([p.stats.floating + (p.stats.floating === 1 ? ' piece' : ' pieces') + ' on the clear layer']);
      if (p.stats.removedIslands) list.push([p.stats.removedIslands + (p.stats.removedIslands === 1 ? ' speck dropped' : ' specks dropped')]);
      if (!list.length) list.push(['one piece']);
      tagsInto(tags, list);
      el.append(t, c, tags); host.append(el);
    }
  }

  /* ---------- what checkout needs ---------- */
  function designPayload() {
    const r = state.result; if (!r || state.doneId !== state.jobId || !state.m) return null;
    const pic = (o) => ({ w: o.w, h: o.h, sigma: o.sigma, mask: b64(maskToBytes(o.m)) });
    const on = $('plateOn').checked;
    return {
      v: 1,
      name: ($('name').value.replace(/[^A-Za-z0-9 _-]+/g, ' ').trim() || 'Design'),
      shadow: Object.assign(pic(state), { view: Object.assign({}, state.view) }),
      opts: opts(),
      plate: on ? { own: plate.own ? pic(plate.own) : null, view: Object.assign({}, plate.view), opts: plateOpts() } : null,
      withBase: $('withBase').checked,
    };
  }
  function previewJpeg() {
    const c = document.createElement('canvas'); c.width = 480; c.height = 480;
    c.getContext('2d').drawImage(wall, 0, 0, 480, 480);
    return c.toDataURL('image/jpeg', 0.82);
  }

  /* ---------- wiring ---------- */
  function out() { $('levelOut').textContent = $('level').value; $('smoothOut').textContent = (+$('smooth').value / 10).toFixed(1); $('vmaxOut').textContent = (+$('vmax').value).toFixed(1) + ' mm'; $('thinOut').textContent = (+$('thin').value).toFixed(2) + ' mm'; $('apexOut').textContent = (+$('apex').value).toFixed(1) + ' mm'; $('plateGapOut').textContent = (+$('plateGap').value).toFixed(2) + ' mm'; }
  let maskTimer = 0;
  const remask = () => { out(); clearTimeout(maskTimer); maskTimer = setTimeout(() => buildMask(false), 120); };
  on($('mode'), 'change', () => { syncMode(true); out(); buildMask(true); });
  on($('level'), 'input', remask); on($('smooth'), 'input', remask); on($('invert'), 'change', () => buildMask(true));
  on($('gaps'), 'change', () => buildMask(false));
  on($('size'), 'input', () => { state.view.mmPerPx = +$('size').value * 10 / (state.bbox.y1 - state.bbox.y0 + 1); $('sizeOut').textContent = $('size').value + ' cm'; drawQuick(); schedule(); });
  on($('mirror'), 'change', () => { state.view.mirror = $('mirror').checked; drawQuick(); schedule(); });
  on($('fit'), 'click', autoFit);
  for (const id of ['vmax', 'thin', 'apex']) on($(id), 'input', () => { out(); drawQuick(); schedule(); });
  for (const id of ['loose', 'wrap', 'ribs', 'cuts']) on($(id), 'change', () => schedule());
  on($('guides'), 'change', drawResult); on($('diff'), 'change', drawResult);
  const plateChanged = () => { plate.dirty = true; syncPlateUi(); drawPlate(); schedule(true); };
  for (const id of ['plateKind', 'plateCol', 'artCol']) on($(id), 'input', () => { plateColours(); drawPlate(); if (state.result) describePlate(state.result.plate); if (hooks.onResult) hooks.onResult(lampData()); });
  plateColours();
  on($('plateOn'), 'change', plateChanged); on($('plateStyle'), 'change', plateChanged); on($('plateLine'), 'input', plateChanged);
  on($('plateSize'), 'input', () => { plate.view.mmPerPx = plate.fitMm * +$('plateSize').value / 100; $('plateSizeOut').textContent = $('plateSize').value + '%'; plateChanged(); });
  on($('plateFit'), 'click', () => plateFit(false));
  on($('platePick'), 'click', () => $('plateFile').click());
  const takePlateFile = (f) => {
    if (!f || !/^image\//.test(f.type)) { $('plateName').textContent = 'Choose a picture file (PNG, JPG or WebP).'; return; }
    const rd = new FileReader();
    rd.onload = () => decode(rd.result, (p) => {
      plate.own = { img: p.img, w: p.w, h: p.h, otsu: p.otsu, name: f.name };
      $('pMode').value = p.mode; $('pLevel').value = levelFor(p.mode, p.otsu); $('pInvert').checked = false;
      readPlate(); syncPlateUi(); plateFit(false);
    }, () => { $('plateName').textContent = 'That file could not be read as a picture.'; });
    rd.readAsDataURL(f);
  };
  on($('plateFile'), 'change', (e) => takePlateFile(e.target.files[0]));
  on($('plateSame'), 'click', () => { plate.own = null; $('plateFile').value = ''; syncPlateUi(); plateFit(false); });
  on($('pMode'), 'change', () => { $('pLevel').value = levelFor($('pMode').value, plate.own ? plate.own.otsu : 128); readPlate(); plateFit(false); });
  let pTimer = 0;
  on($('pLevel'), 'input', () => { $('pLevelOut').textContent = $('pLevel').value; clearTimeout(pTimer); pTimer = setTimeout(() => { readPlate(); plateChanged(); }, 120); });
  on($('pInvert'), 'change', () => { readPlate(); plateFit(false); });
  const pbox = $('platebox'); let pdrag = null;
  on(pbox, 'pointerdown', (e) => { pbox.setPointerCapture(e.pointerId); pdrag = [e.clientX, e.clientY]; pbox.classList.add('dragging'); });
  on(pbox, 'pointermove', (e) => {
    if (!pdrag) return;
    const mmPerCss = PLATE.W / pbox.clientWidth, v = plate.view;
    v.cx -= (e.clientX - pdrag[0]) * mmPerCss / v.mmPerPx; v.cy -= (e.clientY - pdrag[1]) * mmPerCss / v.mmPerPx; pdrag = [e.clientX, e.clientY];
    plate.dirty = true; drawPlate(); schedule(true);
  });
  const pup = () => { pdrag = null; pbox.classList.remove('dragging'); };
  on(pbox, 'pointerup', pup); on(pbox, 'pointercancel', pup);
  on(pbox, 'wheel', (e) => { e.preventDefault(); plate.view.mmPerPx *= Math.exp(-e.deltaY * 0.0012); syncPlateSize(); plate.dirty = true; drawPlate(); schedule(true); }, { passive: false });
  on($('plateGap'), 'input', () => { out(); plateChanged(); });
  on($('pick'), 'click', () => $('file').click());
  const takeFile = (f) => { if (!f || !/^image\//.test(f.type)) { $('fname').textContent = 'Choose a picture file (PNG, JPG or WebP).'; return; } const rd = new FileReader(); rd.onload = () => loadImage(rd.result, f.name, false); rd.readAsDataURL(f); };
  on($('file'), 'change', (e) => takeFile(e.target.files[0]));
  const drop = $('drop');
  for (const el of [drop, $('wallbox')]) {
    on(el, 'dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    on(el, 'dragleave', () => drop.classList.remove('over'));
    on(el, 'drop', (e) => { e.preventDefault(); drop.classList.remove('over'); takeFile(e.dataTransfer.files[0]); });
  }
  on(window, 'paste', (e) => { const it = [...(e.clipboardData ? e.clipboardData.files : [])][0]; if (it) takeFile(it); });
  const box = $('wallbox'), pts = new Map(); let pinch = 0;
  on(box, 'pointerdown', (e) => { box.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); box.classList.add('dragging'); pinch = 0; });
  on(box, 'pointermove', (e) => {
    if (!pts.has(e.pointerId) || !state.bbox) return;
    const prev = pts.get(e.pointerId), mmPerCss = SPAN / box.clientWidth, v = state.view; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { v.cx -= (e.clientX - prev[0]) * mmPerCss / v.mmPerPx * (v.mirror ? -1 : 1); v.cy -= (e.clientY - prev[1]) * mmPerCss / v.mmPerPx; clampView(); }
    else { const a = [...pts.values()], dist = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch) { v.mmPerPx *= dist / pinch; syncSize(); } pinch = dist; }
    drawQuick(); schedule();
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; if (!pts.size) box.classList.remove('dragging'); };
  on(box, 'pointerup', up); on(box, 'pointercancel', up);
  on(box, 'wheel', (e) => { if (!state.bbox) return; e.preventDefault(); state.view.mmPerPx *= Math.exp(-e.deltaY * 0.0012); syncSize(); drawQuick(); schedule(); }, { passive: false });

  out(); syncPlateUi(); paintWall(null, null); drawLampAndGuides();
  loadImage(hooks.sample, hooks.sampleName || 'Example', true);

  return {
    designPayload, previewJpeg,
    loadExample(src, name) { loadImage(src, name, true); },
    destroy() { alive = false; ac.abort(); clearTimeout(timer); clearTimeout(maskTimer); clearTimeout(pTimer); if (worker) worker.terminate(); },
    _state: state,
  };
}
