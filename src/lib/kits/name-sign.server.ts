/* Server kit for the Name Sign & Keychain Maker: rebuilds the parts from the saved text mask. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parseNameDesign, type NameDesign } from '@/lib/name/design';
import { buildName } from '@/lib/name/build.js';
import { decodeRle } from '@/lib/layers/rle.js';

const KIND: Record<string, string> = { keychain: 'keychain', sign: 'name sign', topper: 'cake topper' };

async function build(d: NameDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const mask = decodeRle(d.mask, d.w * d.h);
  const r = buildName(d.p, { mask, w: d.w, h: d.h });
  const p = d.p, two = p.letterT > 0;
  const readme = [
    `Text: ${d.text}${d.font ? `   Font: ${d.font}` : ''}`,
    `Size: ${r.size.map((v: number) => v.toFixed(1)).join(' x ')} mm`, '',
    'FILES', '  *_base.stl      the backing' + (p.mode === 'keychain' ? ' with the key ring hole' : p.mode === 'topper' ? ' with the cake stakes' : ''), ...(two ? ['  *_letters.stl   the raised letters'] : []), '',
    'PRINTING',
    two ? '  Two colours (AMS, MMU): load both files as one object with two parts.' : '  One colour: print base.stl.',
    two ? `  One nozzle: print both together and change filament at ${p.baseT.toFixed(2)} mm.` : '',
    '  No supports needed. 0.2 mm layers, 3 walls.',
    p.mode === 'topper' ? '  Cake toppers: use food-safe filament (PLA from a food-safe supplier), or wrap the stakes in food film.' : '',
  ].filter((l) => l !== '');
  const parts = [{ file: 'base', tris: r.base }, ...(two ? [{ file: 'letters', tris: r.letters }] : [])];
  return packKit({ name: d.name, kind: KIND[p.mode], parts, readme, preview, license });
}

export const kit: Kit | null = { parse: parseNameDesign, build: build as Kit['build'] };
