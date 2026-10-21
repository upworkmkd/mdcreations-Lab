import 'server-only';
import { parseDesign } from '@/lib/lamp/design';
import { buildLampZip } from '@/lib/lamp/build.server';
import { parseLayerDesign } from '@/lib/layers/design';
import { buildLayerZip } from '@/lib/layers/build.server';

export type License = { owner?: string; orderId?: string };
export type Built = { zip: Uint8Array; fileName: string };
type Kit = { parse(design: unknown): { name: string }; build(design: never, preview: Uint8Array | null, lic: License): Promise<Built> };

/**
 * Every paid tool: how to check what the browser sends, and how to build the download on the server.
 * A new tool adds one line here.
 */
export const KITS: Record<string, Kit> = {
  'shadow-lamp': { parse: parseDesign, build: buildLampZip as Kit['build'] },
  'layered-sculpture': { parse: parseLayerDesign, build: buildLayerZip as Kit['build'] },
};

export const kitFor = (slug: string) => KITS[slug] ?? null;
