/* Server kit for the Lithophane Maker: rebuilds the files from the saved brightness grid. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parseLithoDesign, type LithoDesign } from '@/lib/litho/design';
import { BASE_LEN, BASE_LABEL, baseOf, buildLitho, gridFor } from '@/lib/litho/build.js';
import { b64ToBytes } from '@/lib/mesh/b64.js';

const SHAPE_NAME: Record<string, string> = { flat: 'flat panel', curved: 'curved panel', cylinder: 'cylinder lamp', heart: 'heart', moon: 'moon lamp' };

async function build(d: LithoDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const G = gridFor(d.p), gray = b64ToBytes(d.gray);
  if (gray.length !== G.w * G.h) throw new Error('The picture data does not match the settings.');
  const r = buildLitho(d.p, gray, G);
  const p = d.p;
  const readme = [
    `Shape: ${SHAPE_NAME[p.shape]}, ${r.size.filter(Boolean).map((v: number) => v.toFixed(0)).join(' x ')} mm`,
    `Thickness: ${p.minT} mm (brightest) to ${p.maxT} mm (darkest), ${G.pitch} mm detail`, '',
    'FILES', ...r.parts.map((q: { file: string; label: string }) => `  ${q.file}.stl   ${q.label}`), '',
    'PRINTING',
    '  - Use white or natural PLA. 100% infill (or 4+ walls so the whole picture is solid wall).',
    '  - 0.12 to 0.16 mm layer height gives the smoothest shading.',
    p.shape === 'flat' || p.shape === 'heart' ? '  - Print it standing up (rotate 90 degrees) for the finest detail, with a brim. Flat on the bed also works.' :
      p.shape === 'moon' ? '  - Print the moon with the opening on the bed. It needs no supports.' : '  - Print it standing on its edge, as it comes. No supports needed.',
    '  - Light it from behind with a warm LED. Hold it up to a window to check the picture.',
    ...(() => {
      const b = baseOf(p) as string, len = p.baseLen || (BASE_LEN as Record<string, number>)[b];
      const how: Record<string, string> = {
        slot: `  ${len} mm slot stand: push the bottom edge of the lithophane into the slot.`,
        wide: `  ${len} mm wide stand: heavier and steadier for big panels. Push the bottom edge into the slot.`,
        led: `  ${len} mm LED strip stand: stick a warm white LED strip (8-10 mm wide, USB) into the channel behind the slot, so it shines through the picture.`,
        arc: `  ${len} mm curved stand: follows the curve of the panel. Push the bottom edge into the slot.`,
        lamp: '  The lithophane sits on the shelf inside the lip. Put a tea light or LED puck under the opening.',
        ring: '  A low ring foot: the lithophane sits inside it. Light it from below with a tea light or LED puck.',
        stand: '  The moon sits on the stand with the collar inside its opening. A tea light or LED puck goes inside the collar.',
        pedestal: '  The moon sits on top of the hollow pedestal. Put a small LED inside; its cable can come out underneath.',
      };
      return b === 'none' ? [] : ['', `BASE: ${(BASE_LABEL as Record<string, string>)[b]}`, how[b], '  Print the base flat on its bottom, no supports.'];
    })(),
  ];
  return packKit({ name: d.name, kind: 'lithophane', parts: r.parts.map((q: { file: string; tris: Float32Array }) => ({ file: q.file, tris: q.tris })), readme, preview, license });
}

export const kit: Kit | null = { parse: parseLithoDesign, build: build as Kit['build'] };
