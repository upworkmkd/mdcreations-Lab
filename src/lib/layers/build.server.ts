import 'server-only';
import * as Core from './core.js';
import { decodeRle } from './rle.js';
import { zipFiles } from '@/lib/lamp/mesh.server.js';
import { licenseText } from '@/lib/license';
import type { LayerDesign } from './design';

type Layer = { kind: 'frame' | 'colour' | 'back'; cls: number; mask: Uint8Array | null; t: number; area: number; loose: number; hex: string; fil: string; tris?: Float32Array };

const DENSITY = 1.24 / 1000;   // PLA, g per mm³
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Rebuilds the layers from the saved colour map and packs the paid download. Same maths as the studio preview. */
export async function buildLayerZip(d: LayerDesign, preview?: Uint8Array | null, license?: { owner?: string; orderId?: string }) {
  const P = { ...d.p, fit: 'cover' } as Record<string, unknown> & LayerDesign['p'];
  const G = Core.buildGrid(P, d.aspect);
  if (G.nx !== d.nx || G.ny !== d.ny) throw new Error('This design was saved with different settings. Please open it in the studio again.');
  const n = G.nx * G.ny;
  const cls = decodeRle(d.cls, n);
  const areas = new Uint32Array(d.K);
  for (let i = 0; i < n; i++) { const c = cls[i]; if (c !== 255) { if (c >= d.K) throw new Error('Bad layer data.'); areas[c]++; } }
  const C = { cls, K: d.K, palette: d.colors.map((h) => Core.hexToRgb(h)), areas, bgIndex: -1 };
  const order = d.order.filter((k) => areas[k] > 0);
  if (!order.length) throw new Error('This design has no layers.');
  const M = Core.buildMasks(C, G, order, P);
  const a = G.s * G.s, layers: Layer[] = [];
  if (G.hasFrame && P.frameLayer) layers.push({ kind: 'frame', cls: -1, mask: null, t: P.frameThickness, area: G.frameCount * a, loose: 0, hex: P.frameColor, fil: Core.nearestFilament(Core.hexToRgb(P.frameColor)).name });
  order.forEach((c, k) => {
    const back = k === order.length - 1, info = M.info[k], hex = d.colors[c];
    layers.push({ kind: back ? 'back' : 'colour', cls: c, mask: M.masks[k], t: back ? P.backThickness : P.thickness, area: info.areaPx * a, loose: info.loose, hex, fil: Core.nearestFilament(Core.hexToRgb(hex)).name });
  });
  const pins = P.pins === 'off' ? [] : Core.findPins(G, P.pinDia);
  layers.forEach((ly, i) => {
    ly.tris = Core.layerMesh(G, ly.mask, { t: ly.t, tol: P.tol, pins: P.pins === 'through' || i > 0 ? pins : [], pinR: P.pinDia / 2 }).tris;
  });

  const prefix = slug(d.name) || 'sculpture';
  const fileOf = (ly: Layer, i: number) => `${prefix}_L${String(i + 1).padStart(2, '0')}_${ly.kind === 'frame' ? 'frame_' : ly.kind === 'back' ? 'back_' : ''}${slug(ly.fil)}.stl`;
  const files: { name: string; data: Uint8Array }[] = [];
  layers.forEach((ly, i) => files.push({ name: fileOf(ly, i), data: new Uint8Array(Core.toSTL([{ tris: ly.tris, mirror: P.mirror }], fileOf(ly, i))) }));
  if (P.incRef) {
    const parts: { tris: Float32Array; dz: number }[] = []; let z = 0;
    for (let i = layers.length - 1; i >= 0; i--) { parts.push({ tris: layers[i].tris!, dz: z }); z += layers[i].t; }
    files.push({ name: `${prefix}_assembled_colour_reference_do_not_print.stl`, data: new Uint8Array(Core.toSTL(parts, 'assembled reference')) });
  }
  const total = layers.reduce((s, l) => s + l.t, 0), g = (ly: Layer) => ly.area * ly.t * DENSITY;
  const L: string[] = [];
  L.push(`${d.name} - layered sculpture`, 'Made with MD Creations Labs - labs.themdcreations.com', '',
    `Size: ${G.W.toFixed(0)} x ${G.H.toFixed(0)} mm, ${total.toFixed(1)} mm deep, ${layers.length} layers`, '', 'LAYERS (front to back)');
  layers.forEach((ly, i) => L.push(`  L${String(i + 1).padStart(2, '0')}  ${(ly.kind === 'frame' ? 'Frame' : ly.kind === 'back' ? 'Back plate' : 'Colour').padEnd(11)}${ly.hex}  closest filament: ${ly.fil.padEnd(11)}${ly.t.toFixed(1)} mm  about ${g(ly).toFixed(1)} g${ly.loose ? `  (${ly.loose} loose piece${ly.loose > 1 ? 's' : ''})` : ''}  ${fileOf(ly, i)}`));
  L.push('', 'PRINTING', '  - Print every layer flat, one colour per layer, 100% infill. No supports.', '  - 0.2 mm layer height works well. Keep each thickness a multiple of your layer height.',
    P.mirror ? '  - These files are MIRRORED. The side on the build plate is the display face.' : '  - These files are not mirrored. The top surface of each print is the display face.',
    '  - Thin parts break easily. Let the plate cool before lifting each layer.');
  L.push('', 'ASSEMBLY', '  1. Start with the last layer (the back plate) face up.', '  2. Add the layers in reverse number order, finishing with L01 on top.', '  3. A drop of glue near the frame is enough. Each layer is solid wherever the layer above it is.');
  if (pins.length) L.push(`  4. Push short pieces of 1.75 mm filament through the ${pins.length} pin holes to line the layers up.`);
  if (layers.some((l) => l.loose)) L.push('', 'LOOSE PIECES', '  Some layers have small islands that are not joined to the rest of the layer.', '  Glue them onto the layer below, using the preview image as a map.');
  L.push('', 'COMMERCIAL LICENSE: you may print, sell the printed pieces, and sell or share these files,', 'as they are or modified. The full terms are in LICENSE.txt in this zip.', '');
  files.push({ name: 'README.txt', data: new TextEncoder().encode(L.join('\r\n')) });
  files.push({ name: 'LICENSE.txt', data: new TextEncoder().encode(licenseText({ design: d.name, ...license }).replace(/\n/g, '\r\n')) });
  if (preview && preview.length) files.push({ name: `${prefix}_preview.jpg`, data: preview });
  return { zip: zipFiles(files), fileName: `${prefix.replace(/-/g, '_')}_layered_sculpture.zip`, layers: layers.length };
}
