/* Server kit for the 360° Shadow Lantern: rebuilds the wall (bridges included) and the base from the picture band. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { decodeRle } from '@/lib/layers/rle.js';
import { buildLantern, lanternSize, wallMask } from '@/lib/lantern/build.js';
import { parseLanternDesign, type LanternDesign } from '@/lib/lantern/design';

async function build(d: LanternDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const S = lanternSize(d.p), band = decodeRle(d.band, d.w * d.h);
  const wm = wallMask(band, S.w, d.h, S.top, S.bottom);
  const L = buildLantern(wm.mask, S.w, S.h, d.p, 0.7);
  const readme = [
    `Lantern: ${d.p.diameter} mm across, ${d.p.height} mm tall, ${d.p.wall} mm wall. The LED sits at ${L.led.toFixed(0)} mm.`,
    wm.bridges ? `${wm.bridges} floating bits of the picture got thin bridges so they stay in place.` : '', '',
    'FILES',
    '  *_shell.stl   the lantern wall with the picture cut through',
    '  *_base.stl    the base, with a collar that keeps the shell centred and the LED post',
    '',
    'PRINTING',
    '  - Shell: standing up, as it is in the file, no supports. A dark, opaque filament (black, dark grey, brown):',
    '    light must only pass through the cut-outs. 0.2 mm layers, 2-3 walls, 0.4 mm nozzle.',
    '  - Base: flat side down, no supports. Any colour.',
    '',
    'THE LIGHT',
    '  - Use a bare 5 mm warm white LED (or a small "point" LED). A tiny bright point gives sharp shadows;',
    '    big diffused tea lights make them blurry.',
    '  - Feed the LED wires down through the post and out under the base, to a 2 x AA holder with a switch',
    '    (with a resistor if your LED needs one), or use a ready-made USB LED.',
    '  - The LED head should sit at the top of the post, in the middle of the picture band.',
    '',
    'SHOWING IT',
    '  Put it in the middle of a room or a table, switch off the lights: the picture goes all the way round the walls.',
    '  Light walls 1-2 m away work best; the further the wall, the bigger and softer the picture.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
  return packKit({ name: d.name, kind: '360 shadow lantern', parts: [{ file: 'shell', tris: L.shell }, { file: 'base', tris: L.base }], readme, preview, license });
}

export const kit: Kit = { parse: parseLanternDesign, build: build as Kit['build'] };
