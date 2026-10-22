/* Server kit for the Rangoli Stencil & Cookie Cutter Maker: rebuilds the parts from the saved masks. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parseCookieDesign, type CookieDesign } from '@/lib/cookie/design';
import { buildCookie } from '@/lib/cookie/build.js';
import { decodeRle } from '@/lib/layers/rle.js';

const KIND: Record<string, string> = { cutter: 'cookie cutter', stamp: 'stamp', stencil: 'rangoli stencil' };

async function build(d: CookieDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const n = d.w * d.h, shape = decodeRle(d.shape, n), detail = d.detail ? decodeRle(d.detail, n) : null;
  const parts = buildCookie(d.p, shape, detail, d.w, d.h, d.px) as { file: string; label: string; tris: Float32Array; pieces?: number }[];
  const p = d.p;
  const readme = [`Size: about ${p.size} mm across`, '', 'FILES', ...parts.map((q) => `  *_${q.file}.stl   ${q.label}`), '', 'PRINTING'];
  if (p.mode === 'cutter') readme.push('  - Print the cutter flange-down with no supports, 0.2 mm layers, 3 walls.', '  - Use PLA or PETG. Wash by hand in warm water; do not use a dishwasher.', '  - For food, choose a filament sold as food-safe, or keep a sheet of cling film between cutter and dough.');
  if (parts.some((q) => q.file.startsWith('stamp'))) readme.push('  - The stamp prints with its details facing up. They are mirrored, so they read the right way on the cookie.', '  - Print the details in the same colour as the plate (or one file after the other), and glue the handle to the smooth back.', '  - Dust the stamp with flour or icing sugar so it does not stick.');
  if (p.mode === 'stencil') readme.push('  - Print flat at 0.2 mm, 100% infill or 4+ walls. PETG bends without cracking.', '  - Lay it on the floor or a tray and fill the cut-outs with rangoli powder, sand or icing sugar, then lift it straight up.', ...(p.islands === 'join' ? [`  - Thin ${p.bridge} mm bridges hold the inner pieces in place. Brush powder over them; the gaps close up when you lift the stencil.`] : []));
  return packKit({ name: d.name, kind: KIND[p.mode], parts: parts.map((q) => ({ file: q.file, tris: q.tris })), readme, preview, license });
}

export const kit: Kit | null = { parse: parseCookieDesign, build: build as Kit['build'] };
