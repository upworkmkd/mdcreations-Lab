/* Layered Sculpture Studio, the browser side: picture in, colour layers out, 3D preview.
 * Ported from the standalone studio. The paid files are rebuilt on the server from designPayload(). */
/* eslint-disable */
import * as THREE from 'three';
import * as Core from '@/lib/layers/core.js';
import { encodeRle } from '@/lib/layers/rle.js';

export function mountLayerStudio(root, opts = {}) {
  const $ = (s, r) => (r || root).querySelector(s);
  const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v === false || v == null) continue; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); } for (const c of kids) if (c != null) e.append(c); return e; };
  const hasTHREE = true;
  const cleanups = [];
  let alive = true;
  const on = (target, ev, fn, o) => { target.addEventListener(ev, fn, o); cleanups.push(() => target.removeEventListener(ev, fn, o)); };

  const DEF = {
    fit: 'cover', zoom: 1, panX: 0, panY: 0, rotate: 0, flipH: false, brightness: 0, contrast: 0, saturation: 0, gamma: 1, blur: 0, invert: false,
    mode: 'colour', colors: 7, tonalBalance: 0.5, shadow: '#161616', highlight: '#f4f4f2', snap: false, transparent: 'layer', bgColor: '#f4f4f2',
    order: 'loose', manual: null, smooth: 0.6, despeckle: 1.5, loose: 'limit', looseMax: 2, looseArea: 6,
    width: 200, ratio: '1:1', outer: 'square', radius: 0, window: 'circle', border: 6, frameLayer: true, frameColor: '#161616',
    thickness: 1, backThickness: 0.6, frameThickness: 1, pins: 'off', pinDia: 1.9, res: 520, tol: 0.05,
    shade: true, backdrop: 'auto', mirror: false, incRef: false, prefix: 'sculpture',
  };
  const ST = { A: 0, B: 1, C: 2, E: 3, V: 9 };
  const mm = (v) => (+v).toFixed(1) + ' mm', pct = (v) => (v > 0 ? '+' : '') + Math.round(v);
  const SHAPE_OPTS = Object.entries(Core.SHAPES);
  const SCHEMA = [
    { title: 'Picture', open: true, items: [
      { k: 'fit', t: 'seg', label: 'Fit in the window', st: 'A', opts: [['cover', 'Fill'], ['contain', 'Show all']] },
      { k: 'zoom', t: 'range', label: 'Zoom', min: 0.4, max: 5, step: 0.01, st: 'A', fmt: (v) => v.toFixed(2) + '×' },
      { k: 'panX', t: 'range', label: 'Move left / right', min: -1.5, max: 1.5, step: 0.01, st: 'A', fmt: (v) => pct(v * 100) },
      { k: 'panY', t: 'range', label: 'Move up / down', min: -1.5, max: 1.5, step: 0.01, st: 'A', fmt: (v) => pct(-v * 100) },
      { k: 'rotate', t: 'range', label: 'Rotate', min: -180, max: 180, step: 1, st: 'A', fmt: (v) => v + '°' },
      { k: 'flipH', t: 'check', label: 'Flip left to right', st: 'A' },
      { k: 'brightness', t: 'range', label: 'Brightness', min: -100, max: 100, step: 1, st: 'A', fmt: pct },
      { k: 'contrast', t: 'range', label: 'Contrast', min: -100, max: 100, step: 1, st: 'A', fmt: pct },
      { k: 'saturation', t: 'range', label: 'Saturation', min: -100, max: 100, step: 1, st: 'A', fmt: pct },
      { k: 'gamma', t: 'range', label: 'Midtones', min: 0.4, max: 2.5, step: 0.01, st: 'A', fmt: (v) => v.toFixed(2) },
      { k: 'blur', t: 'range', label: 'Soften picture', min: 0, max: 4, step: 0.1, st: 'A', fmt: mm },
      { k: 'invert', t: 'check', label: 'Invert colours', st: 'A' },
    ] },
    { title: 'Colours', open: true, items: [
      { k: 'mode', t: 'seg', label: 'Palette from', st: 'B', opts: [['colour', 'Picture colours'], ['tonal', 'Light to dark']] },
      { k: 'colors', t: 'range', label: 'Number of colours', min: 2, max: 12, step: 1, st: 'B', fmt: (v) => String(v) },
      { k: 'shadow', t: 'color', label: 'Darkest colour', st: 'B', show: (p) => p.mode === 'tonal' },
      { k: 'highlight', t: 'color', label: 'Lightest colour', st: 'B', show: (p) => p.mode === 'tonal' },
      { k: 'tonalBalance', t: 'range', label: 'Even steps / even areas', min: 0, max: 1, step: 0.01, st: 'B', fmt: (v) => Math.round(v * 100) + '%', show: (p) => p.mode === 'tonal' },
      { k: 'snap', t: 'check', label: 'Snap to common filament colours', st: 'C' },
      { k: 'transparent', t: 'select', label: 'See-through parts of a PNG', st: 'B', opts: [['layer', 'Become a background layer'], ['cut', 'Are cut away (silhouette)']] },
      { k: 'bgColor', t: 'color', label: 'Background layer colour', st: 'B', show: (p) => p.transparent === 'layer' },
      { k: '_resetColours', t: 'button', label: 'Reset colour edits', act: () => { S.overrides = {}; invalidate('C'); } },
    ] },
    { title: 'Layer order', open: true, items: [
      { k: 'order', t: 'select', label: 'Which colour sits in front', st: 'C', opts: [['loose', 'Fewest loose pieces'], ['small', 'Small details in front'], ['dark', 'Dark in front'], ['light', 'Light in front'], ['large', 'Large areas in front'], ['manual', 'My own order']] },
      { k: '_reverse', t: 'button', label: 'Reverse the order', act: () => { P.manual = S.order.slice().reverse(); P.order = 'manual'; refreshControls(); invalidate('C'); } },
      { k: '_h1', t: 'note', label: 'Use the arrows on each layer to move it. Every layer is solid wherever a layer in front of it is, so the stack supports itself.' },
    ] },
    { title: 'Clean-up', items: [
      { k: 'smooth', t: 'range', label: 'Smooth edges', min: 0, max: 4, step: 0.1, st: 'B', fmt: mm },
      { k: 'despeckle', t: 'range', label: 'Remove specks under', min: 0, max: 30, step: 0.5, st: 'B', fmt: (v) => v.toFixed(1) + ' mm²' },
      { k: 'loose', t: 'select', label: 'Loose pieces', st: 'C', opts: [['limit', 'Keep only the biggest few'], ['keep', 'Keep them all (glue in place)'], ['small', 'Drop the small ones'], ['all', 'Drop all of them']] },
      { k: 'looseMax', t: 'range', label: 'Most loose pieces per layer', min: 0, max: 6, step: 1, st: 'C', fmt: (v) => String(v), show: (p) => p.loose === 'limit' },
      { k: 'looseArea', t: 'range', label: 'Small means under', min: 1, max: 150, step: 1, st: 'C', fmt: (v) => v + ' mm²', show: (p) => p.loose === 'small' },
      { k: '_h2', t: 'note', label: 'A loose piece is an island not joined to the rest of its layer, so it has to be glued in place. A dropped piece shows the colour of the layer behind it. Tip: “Light in front” or “Fewest loose pieces” order usually needs the fewest.' },
    ] },
    { title: 'Shape and frame', open: true, items: [
      { k: 'width', t: 'range', label: 'Width', min: 60, max: 300, step: 1, st: 'A', fmt: (v) => v + ' mm' },
      { k: 'ratio', t: 'select', label: 'Proportions', st: 'A', opts: [['1:1', 'Square 1:1'], ['4:5', 'Portrait 4:5'], ['3:4', 'Portrait 3:4'], ['2:3', 'Portrait 2:3'], ['9:16', 'Portrait 9:16'], ['5:4', 'Landscape 5:4'], ['4:3', 'Landscape 4:3'], ['3:2', 'Landscape 3:2'], ['16:9', 'Landscape 16:9'], ['image', 'Same as the picture']] },
      { k: 'outer', t: 'select', label: 'Outer shape', st: 'A', opts: SHAPE_OPTS },
      { k: 'radius', t: 'range', label: 'Corner radius', min: 0, max: 60, step: 1, st: 'A', fmt: (v) => v + ' mm', show: (p) => p.outer === 'square' || p.window === 'square' },
      { k: 'window', t: 'select', label: 'Picture window', st: 'A', opts: [['match', 'Same as outer shape']].concat(SHAPE_OPTS) },
      { k: 'border', t: 'range', label: 'Frame width', min: 0, max: 40, step: 0.5, st: 'A', fmt: mm },
      { k: 'frameLayer', t: 'check', label: 'Frame is its own front layer', st: 'C' },
      { k: 'frameColor', t: 'color', label: 'Frame colour', st: 'E', show: (p) => p.frameLayer },
    ] },
    { title: 'Thickness and fit', items: [
      { k: 'thickness', t: 'range', label: 'Colour layers', min: 0.4, max: 3, step: 0.1, st: 'C', fmt: mm },
      { k: 'backThickness', t: 'range', label: 'Back plate', min: 0.4, max: 3, step: 0.1, st: 'C', fmt: mm },
      { k: 'frameThickness', t: 'range', label: 'Frame layer', min: 0.4, max: 5, step: 0.1, st: 'C', fmt: mm, show: (p) => p.frameLayer },
      { k: 'pins', t: 'select', label: 'Alignment pin holes', st: 'C', opts: [['off', 'None'], ['hidden', 'Hidden behind the front layer'], ['through', 'Through every layer']] },
      { k: 'pinDia', t: 'range', label: 'Hole diameter', min: 1.6, max: 4, step: 0.05, st: 'C', fmt: (v) => v.toFixed(2) + ' mm', show: (p) => p.pins !== 'off' },
      { k: '_h3', t: 'note', label: 'Pin holes sit in the frame so short pieces of 1.75 mm filament line the layers up. They need a frame at least 4 mm wide.', show: (p) => p.pins !== 'off' },
    ] },
    { title: 'Detail', items: [
      { k: 'res', t: 'select', label: 'Tracing detail', st: 'A', num: true, opts: [[320, 'Draft (fast)'], [520, 'Standard'], [760, 'Fine'], [1040, 'Ultra (slow)']] },
      { k: 'tol', t: 'range', label: 'Outline simplification', min: 0.01, max: 0.25, step: 0.01, st: 'C', fmt: (v) => v.toFixed(2) + ' mm' },
      { k: 'shade', t: 'check', label: 'Depth shading in front view', st: 'E' },
      { k: 'backdrop', t: 'select', label: 'Preview backdrop', st: 'V', opts: [['auto', 'Match theme'], ['light', 'Light wall'], ['dark', 'Dark wall']] },
    ] },
  ];
  const PRESETS = [
    ['Round window', { ratio: '1:1', outer: 'square', radius: 0, window: 'circle', border: 6, frameLayer: true, mode: 'colour', colors: 7 }],
    ['Frameless tile', { outer: 'square', radius: 10, window: 'match', border: 0, mode: 'colour', colors: 6 }],
    ['Medallion', { ratio: '1:1', outer: 'circle', window: 'match', border: 7, frameLayer: true, mode: 'colour', colors: 6 }],
    ['Arch', { ratio: '3:4', outer: 'arch', window: 'match', border: 7, frameLayer: true, mode: 'colour', colors: 6 }],
    ['Black and white', { mode: 'tonal', colors: 5, shadow: '#161616', highlight: '#f4f4f2', tonalBalance: 0.5, frameColor: '#161616' }],
    ['Bold four', { mode: 'colour', colors: 4, smooth: 1.2, despeckle: 6, order: 'loose' }],
  ];

  let P = Object.assign({}, DEF);
  try { const saved = JSON.parse(localStorage.getItem('mdl.lss.v1') || 'null'); if (saved && typeof saved === 'object') for (const k in DEF) if (k in saved && typeof saved[k] === typeof DEF[k]) P[k] = saved[k]; if (saved && Array.isArray(saved.manual)) P.manual = saved.manual; } catch (e) { /* storage unavailable */ }
  const persist = () => { try { localStorage.setItem('mdl.lss.v1', JSON.stringify(P)); } catch (e) { /* ignore */ } };

  const S = { img: null, imgW: 1, imgH: 1, isSample: true, G: null, raw: null, adj: null, C: null, order: [], M: null, layers: [], overrides: {}, comp: null, gen: 0, ready: false, build: 0, view: '3d', sig: '' };
  const srcCanvas = document.createElement('canvas');

  /* ---------- sample artwork (drawn here, so the page opens with something real to show) ---------- */
  function sampleArt() {
    const c = document.createElement('canvas'); c.width = c.height = 1000; const x = c.getContext('2d');
    const band = (col, base, amp, f, ph) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 1000); x.lineTo(0, base); for (let i = 0; i <= 1000; i += 10) x.lineTo(i, base + amp * Math.sin(i * f + ph) + amp * 0.4 * Math.sin(i * f * 2.7 + ph * 2)); x.lineTo(1000, 1000); x.closePath(); x.fill(); };
    x.fillStyle = '#18204a'; x.fillRect(0, 0, 1000, 1000);
    band('#3d3378', 190, 26, 0.008, 1); band('#7c3f85', 340, 22, 0.011, 2.4); band('#e5604d', 470, 18, 0.009, 0.3); band('#f6a93b', 590, 14, 0.012, 4);
    x.fillStyle = '#fdeebd'; x.beginPath(); x.arc(520, 520, 150, 0, 7); x.fill();
    x.fillStyle = '#f6a93b'; for (const [yy, hh] of [[560, 10], [596, 14], [636, 18]]) x.fillRect(340, yy, 360, hh);
    const ridge = (col, pts) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 1000); for (const p of pts) x.lineTo(p[0], p[1]); x.lineTo(1000, 1000); x.closePath(); x.fill(); };
    ridge('#7c3f85', [[0, 640], [90, 590], [170, 630], [280, 520], [360, 600], [450, 650], [560, 610], [660, 540], [740, 600], [850, 500], [930, 570], [1000, 540]]);
    ridge('#3d3378', [[0, 720], [120, 650], [220, 700], [330, 640], [430, 720], [540, 690], [640, 730], [760, 650], [880, 710], [1000, 660]]);
    ridge('#18204a', [[0, 800], [150, 760], [320, 800], [480, 770], [640, 810], [820, 765], [1000, 800]]);
    const pine = (cx, base, h) => { x.fillStyle = '#0e1126'; for (let i = 0; i < 4; i++) { const w = h * (0.16 + i * 0.075), top = base - h + i * h * 0.2; x.beginPath(); x.moveTo(cx, top); x.lineTo(cx + w, top + h * 0.34); x.lineTo(cx - w, top + h * 0.34); x.closePath(); x.fill(); } x.fillRect(cx - h * 0.03, base - h * 0.12, h * 0.06, h * 0.14); };
    ridge('#0e1126', [[0, 880], [200, 850], [420, 885], [620, 855], [820, 890], [1000, 860]]);
    for (const [cx, b, h] of [[70, 880, 250], [165, 868, 170], [255, 872, 300], [370, 885, 150], [660, 866, 190], [760, 880, 320], [860, 886, 210], [950, 870, 270]]) pine(cx, b, h);
    return c;
  }

  /* ---------- controls ---------- */
  const ctlRefs = [];
  function makeControl(it) {
    const id = 'c-' + it.k; let wrap, input, out;
    const set = (v) => { P[it.k] = v; if (it.k === 'order' && v === 'manual' && !P.manual) P.manual = S.order.slice(); refreshControls(true); persist(); if (it.st === 'V') applyView(); else invalidate(it.st); };
    if (it.t === 'range') {
      out = el('output', { id: 'o-' + it.k, for: id });
      input = el('input', { type: 'range', id, min: it.min, max: it.max, step: it.step, oninput: () => { const v = +input.value; out.textContent = it.fmt(v); set(v); }, ondblclick: () => { input.value = DEF[it.k]; out.textContent = it.fmt(DEF[it.k]); set(DEF[it.k]); } });
      wrap = el('div', { class: 'ctl' }, el('label', { for: id, text: it.label }), out, input);
    } else if (it.t === 'select') {
      input = el('select', { id, onchange: () => set(it.num ? +input.value : input.value) }); for (const [v, l] of it.opts) input.append(el('option', { value: v, text: l }));
      wrap = el('div', { class: 'ctl' }, el('label', { for: id, text: it.label }), el('span'), input);
    } else if (it.t === 'check') {
      input = el('input', { type: 'checkbox', id, onchange: () => set(input.checked) });
      wrap = el('div', { class: 'ctl check' }, input, el('label', { for: id, text: it.label }));
    } else if (it.t === 'color') {
      input = el('input', { type: 'color', id, oninput: () => set(input.value) });
      wrap = el('div', { class: 'ctl' }, el('label', { for: id, text: it.label }), input);
    } else if (it.t === 'seg') {
      const seg = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': it.label });
      for (const [v, l] of it.opts) { const rid = id + '-' + v; seg.append(el('input', { type: 'radio', class: 'vh', name: id, id: rid, value: v, onchange: () => set(v) }), el('label', { for: rid, text: l })); }
      input = seg; wrap = el('div', { class: 'ctl' }, el('span', { class: 'lab', text: it.label }), el('span'), seg);
    } else if (it.t === 'button') {
      wrap = el('div', { class: 'ctl' }, el('button', { class: 'btn small', type: 'button', id, text: it.label, onclick: it.act, style: 'grid-column:1/-1;justify-self:start' }));
    } else { wrap = el('p', { class: 'hint', text: it.label }); }
    ctlRefs.push({ it, wrap, input, out });
    return wrap;
  }
  function refreshControls(visOnly) {
    for (const { it, wrap, input, out } of ctlRefs) {
      wrap.hidden = it.show ? !it.show(P) : false;
      if (visOnly && it.k !== 'order') continue;
      if (it.t === 'range') { input.value = P[it.k]; out.textContent = it.fmt(+P[it.k]); }
      else if (it.t === 'select') input.value = String(P[it.k]);
      else if (it.t === 'check') input.checked = !!P[it.k];
      else if (it.t === 'color') input.value = P[it.k];
      else if (it.t === 'seg') for (const r of input.querySelectorAll('input')) r.checked = r.value === P[it.k];
    }
    $('#x-prefix').value = P.prefix; $('#x-mirror').checked = P.mirror; $('#x-ref').checked = P.incRef;
  }
  function buildControls() {
    const root = $('#groups');
    for (const g of SCHEMA) { const body = el('div', { class: 'grp-body' }); for (const it of g.items) body.append(makeControl(it)); root.append(el('details', { class: 'grp', open: !!g.open }, el('summary', { text: g.title }), body)); }
    const pr = $('#presets');
    for (const [name, vals] of PRESETS) pr.append(el('button', { class: 'chip', type: 'button', text: name, onclick: () => { Object.assign(P, vals); S.overrides = {}; refreshControls(); persist(); invalidate('A'); } }));
    on($('#x-prefix'), 'input', (e) => { P.prefix = e.target.value; persist(); });
    on($('#x-mirror'), 'change', (e) => { P.mirror = e.target.checked; persist(); });
    on($('#x-ref'), 'change', (e) => { P.incRef = e.target.checked; persist(); });
  }

  /* ---------- pipeline ---------- */
  let pending = null, timer = 0, meshTimer = 0;
  function invalidate(st) { const v = ST[st]; pending = pending == null ? v : Math.min(pending, v); clearTimeout(timer); timer = setTimeout(run, 70); }
  const tick = () => new Promise((r) => setTimeout(r, 0));
  function busy(msg) { const b = $('#busy'); b.hidden = !msg; if (msg) b.textContent = msg; }

  function drawSource() {
    const G = S.G, x = srcCanvas.getContext('2d', { willReadFrequently: true }); srcCanvas.width = G.nx; srcCanvas.height = G.ny;
    x.clearRect(0, 0, G.nx, G.ny); if (!S.img) return new Uint8ClampedArray(G.nx * G.ny * 4);
    const bw = G.box.bw / G.s, bh = G.box.bh / G.s, a = (P.rotate * Math.PI) / 180, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    const rw = S.imgW * ca + S.imgH * sa, rh = S.imgW * sa + S.imgH * ca;
    const sc = (P.fit === 'contain' ? Math.min((2 * bw) / rw, (2 * bh) / rh) : Math.max((2 * bw) / rw, (2 * bh) / rh)) * P.zoom;
    x.save(); x.translate(G.nx / 2 + P.panX * bw, G.ny / 2 + P.panY * bh); x.rotate(a); x.scale(P.flipH ? -sc : sc, sc); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(S.img, -S.imgW / 2, -S.imgH / 2); x.restore();
    return x.getImageData(0, 0, G.nx, G.ny).data;
  }
  const colourOf = (ly) => (ly.kind === 'frame' ? Core.hexToRgb(P.frameColor) : S.overrides[ly.cls] ? Core.hexToRgb(S.overrides[ly.cls]) : P.snap ? Core.nearestFilament(S.C.palette[ly.cls]).rgb : S.C.palette[ly.cls]);

  async function run() {
    const st = pending; pending = null; if (st == null) return;
    const gen = ++S.gen; clearTimeout(meshTimer); busy('Tracing colours…'); await tick(); if (gen !== S.gen) return;
    try {
      if (st <= ST.A) { S.G = Core.buildGrid(P, S.imgW / S.imgH); S.raw = drawSource(); S.adj = Core.adjust(S.raw, S.G.nx, S.G.ny, P, S.G.s); }
      if (st <= ST.B) { const prevK = S.C ? S.C.K : -1; S.C = Core.classify(S.adj, S.G, P); if (S.C.K !== prevK) S.overrides = {}; }
      if (st <= ST.C) {
        S.order = Core.orderLayers(S.C, S.G, P); S.M = Core.buildMasks(S.C, S.G, S.order, P);
        const G = S.G, a = G.s * G.s, L = S.order.length, layers = [];
        if (G.hasFrame && P.frameLayer) layers.push({ kind: 'frame', cls: -1, mask: null, t: P.frameThickness, area: G.frameCount * a, loose: 0, removed: 0 });
        S.order.forEach((c, k) => { const info = S.M.info[k], back = k === L - 1; layers.push({ kind: back ? 'back' : 'colour', cls: c, k, mask: S.M.masks[k], t: back ? P.backThickness : P.thickness, area: info.areaPx * a, loose: info.loose, removed: info.removed }); });
        const sig = layers.map((l) => l.kind + l.cls).join(','); if (sig !== S.sig || S.build > layers.length || S.build < 1) S.build = layers.length; S.sig = sig;
        S.layers = layers; S.ready = false; opts.onReady && opts.onReady(false);
      }
      S.layers.forEach((ly) => { ly.rgb = colourOf(ly); ly.hex = Core.rgbToHex(ly.rgb); ly.fil = Core.nearestFilament(ly.rgb).name; });
      drawFlat(); renderList(st <= ST.C); renderFacts(); updateBuildSlider();
      if (st <= ST.C) { busy('Building 3D…'); meshTimer = setTimeout(() => buildMeshes(gen), 220); } else { recolour3D(); drawVector(); busy(''); }
    } catch (err) { console.error(err); busy(''); toast('Something went wrong while tracing this picture. Try a lower detail setting.'); }
  }

  function hiddenCount() { return S.layers.length - S.build; }
  function drawFlat() {
    if (!S.M) return; const G = S.G, sep = G.hasFrame && P.frameLayer, h = hiddenCount();
    const cols = S.layers.filter((l) => l.kind !== 'frame').map((l) => l.rgb);
    S.comp = Core.composite(S.M, G, cols, Core.hexToRgb(P.frameColor), { frameLayer: P.frameLayer, shade: P.shade, from: sep ? h - 1 : h });
    const cv = $('#flat'); cv.width = G.nx; cv.height = G.ny; cv.getContext('2d').putImageData(new ImageData(S.comp.rgba, G.nx, G.ny), 0, 0);
    const sv = $('#srcview'); sv.width = G.nx; sv.height = G.ny; const d = new Uint8ClampedArray(S.adj); for (let i = 0; i < G.nx * G.ny; i++) if (G.region[i] !== 2) d[i * 4 + 3] = G.region[i] ? 40 : 0; sv.getContext('2d').putImageData(new ImageData(d, G.nx, G.ny), 0, 0);
  }

  function drawVector() {
    // crisp front view drawn from the same outlines that go into the STL files
    if (!S.ready) return; const G = S.G, k = 1500 / Math.max(G.W, G.H), cv = $('#flat'), h = hiddenCount();
    cv.width = Math.round(G.W * k); cv.height = Math.round(G.H * k); const x = cv.getContext('2d');
    for (let i = S.layers.length - 1; i >= h; i--) {
      const ly = S.layers[i], path = new Path2D();
      const ring = (r) => { path.moveTo((r.xs[0] + G.hw) * k, (G.hh - r.ys[0]) * k); for (let j = 1; j < r.xs.length; j++) path.lineTo((r.xs[j] + G.hw) * k, (G.hh - r.ys[j]) * k); path.closePath(); };
      for (const p of ly.mesh.polys) { ring(p); for (const hl of p.holes) ring(hl); }
      if (P.shade && i < S.layers.length - 1) { x.shadowColor = 'rgba(0,0,0,0.42)'; x.shadowBlur = (0.5 + ly.t * 0.7) * k; x.shadowOffsetX = ly.t * 0.55 * k; x.shadowOffsetY = ly.t * 0.75 * k; } else { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetX = x.shadowOffsetY = 0; }
      x.fillStyle = ly.hex; x.fill(path, 'evenodd');
    }
  }

  async function buildMeshes(gen) {
    const G = S.G, pins = P.pins === 'off' ? [] : Core.findPins(G, P.pinDia); S.pins = pins;
    if (!hasTHREE) { busy(''); toast('The 3D library did not load, so files cannot be built in this view.'); return; }
    for (let i = 0; i < S.layers.length; i++) {
      if (gen !== S.gen) return; busy('Building layer ' + (i + 1) + ' of ' + S.layers.length + '…'); await tick(); if (gen !== S.gen) return;
      const ly = S.layers[i];
      ly.mesh = Core.layerMesh(G, ly.mask, { t: ly.t, tol: P.tol, pins: P.pins === 'through' || i > 0 ? pins : [], pinR: P.pinDia / 2 });
    }
    if (gen !== S.gen) return; S.ready = true; busy(''); set3D(); drawVector(); renderFacts(); opts.onReady && opts.onReady(true);
    if (P.pins !== 'off' && !pins.length) toast('No room for pin holes. Widen the frame to at least 4 mm.');
  }

  /* ---------- side panel ---------- */
  const DENSITY = 1.24 / 1000; // g per mm3, PLA
  const grams = (ly) => ly.area * ly.t * DENSITY;
  const layerName = (ly) => (ly.kind === 'frame' ? 'Frame' : ly.fil);
  function thumb(cv, ly) {
    const G = S.G, n = 46, x = cv.getContext('2d'), im = x.createImageData(n, n), sc = Math.max(G.nx, G.ny) / n, ox = (n * sc - G.nx) / 2, oy = (n * sc - G.ny) / 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const sx = Math.floor((i + 0.5) * sc - ox), sy = Math.floor((j + 0.5) * sc - oy); if (sx < 0 || sy < 0 || sx >= G.nx || sy >= G.ny) continue; const q = sy * G.nx + sx; if (G.region[q] === 1 || (ly.mask && ly.mask[q])) { const o = (j * n + i) * 4; im.data[o] = ly.rgb[0]; im.data[o + 1] = ly.rgb[1]; im.data[o + 2] = ly.rgb[2]; im.data[o + 3] = 255; } }
    x.putImageData(im, 0, 0);
  }
  function move(i, dir) {
    const off = S.layers[0] && S.layers[0].kind === 'frame' ? 1 : 0, k = i - off, j = k + dir; if (k < 0 || j < 0 || j >= S.order.length) return;
    const o = S.order.slice(); [o[k], o[j]] = [o[j], o[k]]; P.manual = o; P.order = 'manual'; refreshControls(true); persist(); invalidate('C');
  }
  function renderList(full) {
    const list = $('#list'), h = hiddenCount();
    if (full || list.children.length !== S.layers.length) {
      list.textContent = '';
      S.layers.forEach((ly, i) => {
        const cv = el('canvas', { width: 46, height: 46 }), isC = ly.kind !== 'frame', off = S.layers[0].kind === 'frame' ? 1 : 0;
        const col = el('input', { type: 'color', id: 'lc-' + i, 'aria-label': 'Print colour for layer ' + (i + 1), oninput: (e) => { if (ly.kind === 'frame') { P.frameColor = e.target.value; refreshControls(); persist(); } else S.overrides[ly.cls] = e.target.value; invalidate('E'); } });
        const ord = el('div', { class: 'ord' }, el('button', { type: 'button', text: '↑', 'aria-label': 'Move layer ' + (i + 1) + ' forward', disabled: !isC || i - off <= 0, onclick: () => move(i, -1) }), el('button', { type: 'button', text: '↓', 'aria-label': 'Move layer ' + (i + 1) + ' back', disabled: !isC || i >= S.layers.length - 1, onclick: () => move(i, 1) }));
        const li = el('li', { class: 'layer' }, cv, el('div', { style: 'min-width:0' }, el('div', { class: 'nm' }), el('div', { class: 'sub' }), el('div', { class: 'sub s2' }), el('div', { class: 'wn' })), el('div', { class: 'tools' }, col, ord));
        list.append(li);
      });
    }
    S.layers.forEach((ly, i) => {
      const li = list.children[i]; li.classList.toggle('off', i < h); thumb($('canvas', li), ly);
      const nm = $('.nm', li); nm.textContent = ''; nm.append(el('span', { text: 'L' + String(i + 1).padStart(2, '0') }), layerName(ly));
      $('.sub', li).textContent = ly.t.toFixed(1) + ' mm · ' + grams(ly).toFixed(1) + ' g'; $('.s2', li).textContent = ly.kind === 'back' ? ly.hex + ' · back' : ly.kind === 'frame' ? ly.hex + ' · ' + ly.fil : ly.hex;
      const wn = $('.wn', li), bits = []; if (ly.loose) bits.push(ly.loose + (ly.loose === 1 ? ' loose piece' : ' loose pieces')); if (ly.removed) bits.push(ly.removed + ' dropped'); wn.textContent = bits.join(' · '); wn.hidden = !bits.length;
      const c = $('input[type=color]', li); if (document.activeElement !== c) c.value = ly.hex;
    });
    const ev = $('#elev'); ev.textContent = ''; let tot = 0;
    for (const ly of S.layers) { tot += ly.t; ev.append(el('i', { style: 'height:' + Math.max(4, Math.round(ly.t * 7)) + 'px;background:' + ly.hex, title: layerName(ly) + ' ' + ly.t.toFixed(1) + ' mm' })); }
    S.total = tot; const dim = $('#elev-dim'); dim.textContent = ''; dim.append(el('span', { text: tot.toFixed(1) + ' mm' }), el('small', { text: 'front on top' }));
  }
  function renderFacts() {
    const G = S.G, f = $('#facts'); f.textContent = ''; let g = 0, loose = 0, tris = 0; for (const ly of S.layers) { g += grams(ly); loose += ly.loose; if (ly.mesh) tris += ly.mesh.tris.length / 9; }
    const add = (k, v) => f.append(el('div', {}, el('dt', { text: k }), el('dd', { text: v })));
    add('Size', Math.round(G.W) + ' × ' + Math.round(G.H) + ' mm'); add('Layers', String(S.layers.length)); add('Filament', '≈ ' + g.toFixed(0) + ' g PLA'); add('Loose pieces', String(loose));
    const foot = $('#foot'); foot.textContent = '';
    const put = (k, v) => foot.append(el('span', {}, k + ' ', el('b', { text: v })));
    put('Size', G.W.toFixed(0) + ' × ' + G.H.toFixed(0) + ' × ' + (S.total || 0).toFixed(1) + ' mm'); put('Pixel', G.s.toFixed(2) + ' mm'); put('Triangles', S.ready ? tris.toLocaleString('en-US') : 'building'); if (S.pins && S.pins.length && P.pins !== 'off') put('Pin holes', String(S.pins.length));
  }
  function updateBuildSlider() { const b = $('#v-build'), n = S.layers.length; b.max = n; b.value = S.build; $('#o-build').textContent = S.build + ' / ' + n; }

  /* ---------- 3D view ---------- */
  const V = { ok: false, az: -0.38, el: 0.2, dist: 0, zoom: 1, dirty: true, spin: false, meshes: [], explode: 0 };
  function initGL() {
    if (!hasTHREE) return;
    try {
      const cv = $('#gl'); V.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); V.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); V.r.outputEncoding = THREE.sRGBEncoding;
      V.scene = new THREE.Scene(); V.cam = new THREE.PerspectiveCamera(30, 1, 1, 8000); V.group = new THREE.Group(); V.scene.add(V.group);
      V.scene.add(new THREE.HemisphereLight(0xffffff, 0x70757c, 0.68));
      const d1 = new THREE.DirectionalLight(0xffffff, 0.56); d1.position.set(-0.8, 1.1, 1.3); V.scene.add(d1);
      const d2 = new THREE.DirectionalLight(0xffffff, 0.2); d2.position.set(1, -0.5, 0.7); V.scene.add(d2);
      V.ok = true;
      const pts = new Map(); let pinch = 0;
      on(cv, 'pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const a = [...pts.values()]; pinch = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); } });
      on(cv, 'pointermove', (e) => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (pts.size === 2) { const a = [...pts.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch) V.zoom = Core.clamp(V.zoom * (pinch / d), 0.25, 4); pinch = d; } else { V.az -= dx * 0.008; V.el = Core.clamp(V.el + dy * 0.008, -1.45, 1.45); }
        V.dirty = true; });
      const up = (e) => { pts.delete(e.pointerId); pinch = 0; }; on(cv, 'pointerup', up); on(cv, 'pointercancel', up);
      on(cv, 'wheel', (e) => { e.preventDefault(); V.zoom = Core.clamp(V.zoom * Math.exp(e.deltaY * 0.0012), 0.25, 4); V.dirty = true; }, { passive: false });
      const ro = new ResizeObserver(() => { V.resize = true; V.dirty = true; }); ro.observe($('#viewport')); cleanups.push(() => ro.disconnect());
      const loop = () => { if (!alive) return; if (V.spin && S.view === '3d') { V.az += 0.005; V.dirty = true; } if (V.dirty && S.view === '3d') render3D(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    } catch (e) { V.ok = false; }
  }
  function render3D() {
    V.dirty = false; const vp = $('#viewport'), w = vp.clientWidth, h = vp.clientHeight; if (!w || !h) return;
    if (V.resize !== false) { V.r.setSize(w, h, false); V.cam.aspect = w / h; V.cam.updateProjectionMatrix(); V.resize = false; }
    const size = S.G ? Math.max(S.G.W, S.G.H) : 200, d = ((size * 2.5) / Math.min(1, w / h)) * V.zoom;
    V.cam.position.set(d * Math.sin(V.az) * Math.cos(V.el), d * Math.sin(V.el), d * Math.cos(V.az) * Math.cos(V.el)); V.cam.lookAt(0, 0, 0);
    V.r.render(V.scene, V.cam);
  }
  function place3D() {
    const n = V.meshes.length, h = hiddenCount(); let z = 0; const zs = new Array(n);
    for (let i = n - 1; i >= 0; i--) { zs[i] = z; z += S.layers[i].t + V.explode; }
    const tot = z - V.explode; V.meshes.forEach((m, i) => { m.position.z = zs[i] - tot / 2; m.visible = i >= h; }); V.dirty = true;
  }
  function set3D() {
    if (!V.ok) return;
    for (const m of V.meshes) { V.group.remove(m); m.geometry.dispose(); m.material.dispose(); } V.meshes = [];
    for (const ly of S.layers) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(ly.mesh.tris, 3));
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, flatShading: true, side: THREE.DoubleSide }); mat.color.set(ly.hex).convertSRGBToLinear();
      const m = new THREE.Mesh(g, mat); V.group.add(m); V.meshes.push(m);
    }
    place3D();
  }
  function recolour3D() { if (!V.ok || V.meshes.length !== S.layers.length) return; S.layers.forEach((ly, i) => V.meshes[i].material.color.set(ly.hex).convertSRGBToLinear()); V.dirty = true; }
  function applyView() {
    if (S.view === '3d' && !V.ok) S.view = 'flat';
    $('#gl').hidden = S.view !== '3d'; $('#flat').hidden = S.view !== 'flat'; $('#srcview').hidden = S.view !== 'source';
    for (const b of root.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.view === S.view));
    $('#tab-3d').hidden = !V.ok; $('#m-explode').hidden = $('#m-spin').hidden = $('#v-reset').hidden = S.view !== '3d';
    const vp = $('#viewport'); if (P.backdrop === 'auto') vp.removeAttribute('data-backdrop'); else vp.setAttribute('data-backdrop', P.backdrop);
    V.dirty = true;
  }

  /* ---------- export (the paid files are built on the server from designPayload) ---------- */
  let toastT = 0; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 5200); }
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const prefix = () => slug(P.prefix) || 'sculpture';
  function previewBlob() { return new Promise((res) => { $('#flat').toBlob((b) => res(b), 'image/png'); }); }
  function classColour(k) { return S.overrides[k] ? Core.hexToRgb(S.overrides[k]) : P.snap ? Core.nearestFilament(S.C.palette[k]).rgb : S.C.palette[k]; }
  function designPayload() {
    if (!S.ready || !S.C || !S.G) return null;
    const keys = ['width', 'ratio', 'outer', 'radius', 'window', 'border', 'frameLayer', 'frameColor', 'thickness', 'backThickness', 'frameThickness', 'pins', 'pinDia', 'res', 'tol', 'loose', 'looseMax', 'looseArea', 'mirror', 'incRef'];
    const p = {}; for (const k of keys) p[k] = P[k];
    const colors = []; for (let k = 0; k < S.C.K; k++) colors.push(Core.rgbToHex(classColour(k)));
    return { name: (P.prefix || 'Sculpture').slice(0, 40), p, aspect: S.imgW / S.imgH, nx: S.G.nx, ny: S.G.ny, K: S.C.K, cls: encodeRle(S.C.cls), order: S.order.slice(), colors };
  }
  function previewJpeg() {
    const src = $('#flat'); if (!src.width) return '';
    const k = Math.min(1, 700 / Math.max(src.width, src.height)), c = document.createElement('canvas');
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  }

  /* ---------- image loading ---------- */
  function setImage(img, w, h, sample) { S.img = img; S.imgW = w; S.imgH = h; S.isSample = sample; S.overrides = {}; $('#tag-sample').hidden = !sample; invalidate('A'); }
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { toast('That file is not an image. Use a PNG, JPG or WebP.'); return; }
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { setImage(im, im.naturalWidth, im.naturalHeight, false); if (!P.prefix || P.prefix === DEF.prefix) { P.prefix = slug(file.name.replace(/\.[^.]+$/, '')).slice(0, 30) || DEF.prefix; refreshControls(); persist(); } };
    im.onerror = () => { URL.revokeObjectURL(url); toast('This image could not be opened. Try saving it as PNG first.'); };
    im.src = url;
  }
  function useSample() { const c = sampleArt(); setImage(c, c.width, c.height, true); }

  /* ---------- wire up ---------- */
  buildControls(); refreshControls(); initGL(); applyView();
  on($('#file'), 'change', (e) => { opts.onEvent && opts.onEvent('file'); loadFile(e.target.files[0]); e.target.value = ''; });
  on($('#btn-sample'), 'click', useSample);
  for (const b of root.querySelectorAll('.tabs button')) on(b, 'click', () => { S.view = b.dataset.view; applyView(); });
  on($('#v-build'), 'input', (e) => { S.build = +e.target.value; updateBuildSlider(); if (S.ready) { drawVector(); if (V.ok) place3D(); } else drawFlat(); renderList(false); });
  on($('#v-explode'), 'input', (e) => { V.explode = +e.target.value; $('#o-explode').textContent = V.explode.toFixed(1).replace('.0', '') + ' mm'; if (S.ready && V.ok) place3D(); });
  on($('#v-spin'), 'change', (e) => { V.spin = e.target.checked; });
  on($('#v-reset'), 'click', () => { V.az = -0.38; V.el = 0.2; V.zoom = 1; V.dirty = true; });
  on($('#x-png'), 'click', async () => { if (!S.comp) return; const b = await previewBlob(); if (!b) return; const a = el('a', { href: URL.createObjectURL(b), download: prefix() + '_preview.png' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  const vp = $('#viewport'); let dragN = 0;
  on(window, 'dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragN++; $('#drop').hidden = false; } });
  on(window, 'dragleave', () => { dragN = Math.max(0, dragN - 1); if (!dragN) $('#drop').hidden = true; });
  on(window, 'dragover', (e) => e.preventDefault());
  on(window, 'drop', (e) => { e.preventDefault(); dragN = 0; $('#drop').hidden = true; const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadFile(f); });
  on(window, 'paste', (e) => { const it = e.clipboardData && [...e.clipboardData.items].find((i) => i.type.startsWith('image/')); if (it) loadFile(it.getAsFile()); });
  window.__layerStudio = { S, P: () => P, V };
  if (opts.sample) { const im = new Image(); im.onload = () => setImage(im, im.naturalWidth, im.naturalHeight, true); im.onerror = useSample; im.src = opts.sample; } else useSample();

  return {
    designPayload, previewJpeg,
    isReady: () => S.ready,
    name: () => P.prefix,
    destroy() {
      alive = false; clearTimeout(timer); clearTimeout(meshTimer); S.gen++;
      for (const f of cleanups) try { f(); } catch { /* ignore */ }
      if (V.r) { for (const m of V.meshes) { m.geometry.dispose(); m.material.dispose(); } V.r.dispose(); }
      for (const id of ['#groups', '#presets', '#list', '#elev', '#elev-dim', '#facts', '#foot']) { const n = $(id); if (n) n.textContent = ''; }
      delete window.__layerStudio;
    },
  };
}
