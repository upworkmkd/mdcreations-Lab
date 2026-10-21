/* The newer tools each live in their own file, so every tool can be built (and merged) on its own branch. */
import type { Tool, ToolSeo } from '@/lib/tools';
import * as lithophane from './lithophane';
import * as nameSign from './name-sign';
import * as cookieCutter from './cookie-cutter';
import * as photoRelief from './photo-relief';
import * as filamentPainting from './filament-painting';
import * as topoMap from './topo-map';
import * as vase from './vase';
import * as gridfinity from './gridfinity';
import * as printCost from './print-cost';
import * as qrCode from './qr-code';

const SLOTS: { tool: Tool | null; seo: ToolSeo | null }[] = [lithophane, nameSign, cookieCutter, photoRelief, filamentPainting, topoMap, vase, gridfinity, printCost, qrCode];
export const EXTRA_TOOLS: Tool[] = SLOTS.flatMap((s) => (s.tool ? [s.tool] : []));
export const EXTRA_SEO: Record<string, ToolSeo> = Object.fromEntries(SLOTS.flatMap((s) => (s.tool && s.seo ? [[s.tool.slug, s.seo]] : [])));
