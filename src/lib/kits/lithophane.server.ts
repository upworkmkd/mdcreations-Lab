/* Server kit for the Lithophane Maker: rebuilds the files from the saved brightness grid. */
import 'server-only';
import type { Kit } from './types';
import { packKit } from './pack.server';
import { parseLithoDesign, type LithoDesign } from '@/lib/litho/design';
import { buildLitho, gridFor } from '@/lib/litho/build.js';
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
    ...(p.stand && p.shape === 'cylinder' ? ['', 'LAMP BASE', '  The lithophane sits on the shelf inside the lip. Put a tea light or LED puck under the opening.'] : []),
    ...(p.stand && p.shape === 'moon' ? ['', 'STAND', '  The moon sits on the stand with the collar inside its opening. A tea light or LED puck goes inside the collar.'] : []),
  ];
  return packKit({ name: d.name, kind: 'lithophane', parts: r.parts.map((q: { file: string; tris: Float32Array }) => ({ file: q.file, tris: q.tris })), readme, preview, license });
}

export const kit: Kit | null = { parse: parseLithoDesign, build: build as Kit['build'] };
