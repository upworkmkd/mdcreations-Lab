import 'server-only';
import { zipFiles } from '@/lib/lamp/mesh.server.js';
import { stlBinary } from '@/lib/mesh/mesh.js';
import { licenseText } from '@/lib/license';
import type { Built, License } from './types';

export const fileSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Packs a paid download: the STL parts, extra files, a README, the license and the preview picture. */
export function packKit({ name, kind, parts, extra = [], readme, preview, license }: {
  name: string; kind: string; parts: { file: string; tris: Float32Array }[]; extra?: { name: string; data: Uint8Array }[];
  readme: string[]; preview: Uint8Array | null; license: License;
}): Built {
  const prefix = fileSlug(name) || fileSlug(kind);
  const files: { name: string; data: Uint8Array }[] = parts.map((p) => ({ name: `${prefix}_${p.file}.stl`, data: stlBinary(p.tris, `${name} ${p.file}`) }));
  files.push(...extra);
  const head = [`${name} - ${kind}`, 'Made with MD Creations Labs - labs.themdcreations.com', ''];
  const tail = ['', 'COMMERCIAL LICENSE: you may print, sell the printed pieces, and sell or share these files,', 'as they are or modified. The full terms are in LICENSE.txt in this zip.', ''];
  files.push({ name: 'README.txt', data: new TextEncoder().encode([...head, ...readme, ...tail].join('\r\n')) });
  files.push({ name: 'LICENSE.txt', data: new TextEncoder().encode(licenseText({ design: name, ...license }).replace(/\n/g, '\r\n')) });
  if (preview && preview.length) files.push({ name: `${prefix}_preview.jpg`, data: preview });
  return { zip: zipFiles(files), fileName: `${prefix.replace(/-/g, '_')}_${fileSlug(kind).replace(/-/g, '_')}.zip` };
}

/** Readable checks for the numbers a browser sends. */
export const num = (v: unknown, lo: number, hi: number, name: string) => {
  const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`Setting “${name}” is out of range.`); return n;
};
export const pick = <T extends string>(v: unknown, opts: readonly T[], name: string): T => {
  if (!opts.includes(v as T)) throw new Error(`Setting “${name}” is not valid.`); return v as T;
};
export const cleanName = (v: unknown, fallback: string) => String(v ?? fallback).replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || fallback;
