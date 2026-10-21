import 'server-only';
import { parseDesign } from '@/lib/lamp/design';
import { buildLampZip } from '@/lib/lamp/build.server';
import { parseLayerDesign } from '@/lib/layers/design';
import { buildLayerZip } from '@/lib/layers/build.server';

import type { Kit } from '@/lib/kits/types';
import { kit as lithophane } from '@/lib/kits/lithophane.server';
import { kit as nameSign } from '@/lib/kits/name-sign.server';
import { kit as cookieCutter } from '@/lib/kits/cookie-cutter.server';
import { kit as photoRelief } from '@/lib/kits/photo-relief.server';
import { kit as filamentPainting } from '@/lib/kits/filament-painting.server';
import { kit as topoMap } from '@/lib/kits/topo-map.server';
import { kit as vase } from '@/lib/kits/vase.server';
import { kit as gridfinity } from '@/lib/kits/gridfinity.server';
export type { License, Built } from '@/lib/kits/types';

/**
 * Every paid tool: how to check what the browser sends, and how to build the download on the server.
 * Newer tools fill in their own slot file in src/lib/kits/, so each can be merged on its own.
 */
export const KITS: Record<string, Kit> = {
  'shadow-lamp': { parse: parseDesign, build: buildLampZip as Kit['build'] },
  'layered-sculpture': { parse: parseLayerDesign, build: buildLayerZip as Kit['build'] },
  ...Object.fromEntries(Object.entries({ lithophane, 'name-sign': nameSign, 'cookie-cutter': cookieCutter, 'photo-relief': photoRelief, 'filament-painting': filamentPainting, 'topo-map': topoMap, vase, gridfinity }).filter((e): e is [string, Kit] => e[1] != null)),
};

export const kitFor = (slug: string) => KITS[slug] ?? null;
