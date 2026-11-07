/* Server kit for the 360° Shadow Lantern: rebuilds the wall (bridges included) and the base from the picture band. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { decodeRle } from '@/lib/layers/rle.js';
import { BASE, buildLantern, lanternSize, onBed, upsideDown, wallMask } from '@/lib/lantern/build.js';
import { parseLanternDesign, type LanternDesign } from '@/lib/lantern/design';

async function build(d: LanternDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const S = lanternSize(d.p), band = decodeRle(d.band, d.w * d.h);
  const wm = wallMask(band, S.w, d.h, S.top, S.bottom);
  const L = buildLantern(wm.mask, S.w, S.h, d.p, 0.7);
  const post = (L.led - 1) - (L.top - BASE.plate);
  const readme = [
    `Lantern: ${d.p.diameter} mm across, ${d.p.height} mm tall, ${d.p.wall} mm wall. The LED sits ${(L.led - L.top).toFixed(0)} mm above the base plate.`,
    wm.bridges ? `${wm.bridges} floating bits of the picture got thin bridges so they stay in place.` : '', '',
    'FILES',
    '  *_shell.stl      the lantern wall with the picture cut through',
    '  *_base.stl       the base: a plate with a groove for the shell, on an open skirt for the battery and the charger',
    `  *_led-post.stl   the LED post (${post.toFixed(0)} mm), pushed into the hole in the middle of the plate`,
    '',
    'PRINTING (no supports for any part)',
    '  - Shell: standing up, as it is in the file. A dark, opaque filament (black, dark grey, brown):',
    '    light must only pass through the cut-outs. 0.2 mm layers, 2-3 walls, 0.4 mm nozzle.',
    '  - Base: as it is in the file, upside down (plate on the bed, open side up). Any colour.',
    '  - LED post: standing up. Any colour.',
    '',
    'WHAT YOU NEED',
    '  - A bare 5 mm warm white LED. A tiny bright point gives sharp shadows; diffused tea lights make them blurry.',
    '  - A TP4056 USB Type-C charging module (the 28 x 17 mm board) and a small lithium battery',
    '    (a flat 3.7 V LiPo, 500-1200 mAh, or an 18650 cell that fits across the base).',
    `  - ${d.p.rocker === false ? 'An on/off switch if you want one (the base has no switch hole), or leave the LED on the battery.' : 'A KCD11 mini rocker switch (13 x 9 mm), which snaps into the second hole.'}`,
    '  - A resistor for the LED (about 22-47 ohm for a warm white LED on 3.7-4.2 V), a little wire, hot glue or super glue.',
    '',
    'PUTTING IT TOGETHER',
    '  1. Push the LED post into the plate from the top until it is flush with the underside; glue it.',
    '  2. Feed the LED wires down through the post. Seat the LED on top of the post (a drop of glue holds it).',
    '  3. Turn the base over. Glue the charging module under the plate at the front, with its Type-C port pushed',
    '     into the port hole in the skirt, so a cable plugs in from outside.',
    '  4. Wire it: battery to B+ / B- on the module; OUT+ through the switch and the resistor to the LED (+, the long leg),',
    '     LED (-) to OUT-. Glue the battery and the wires under the plate. The underside stays open.',
    '  5. Stand the shell in the groove of the plate (a dot of glue if you like). Charge it from any USB-C phone charger.',
    '',
    'SHOWING IT',
    '  Put it in the middle of a room or a table, switch off the lights: the picture goes all the way round the walls.',
    '  Light walls 1-2 m away work best; the further the wall, the bigger and softer the picture.',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
  return packKit({
    name: d.name, kind: '360 shadow lantern', readme, preview, license,
    parts: [{ file: 'shell', tris: onBed(L.shell) }, { file: 'base', tris: upsideDown(L.base) }, { file: 'led-post', tris: onBed(L.post) }],
  });
}

export const kit: Kit = { parse: parseLanternDesign, build: build as Kit['build'] };
