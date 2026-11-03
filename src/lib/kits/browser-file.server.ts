/* Server kit for the free tools that build their model in the browser (QR Code to STL, Image to STL).
 * Those tools have no server builder: for a printed order the browser sends the finished model itself,
 * gzipped and base64-encoded, with the settings and colours, and the shop prints from that file. */
import 'server-only';
import { gunzipSync } from 'node:zlib';
import type { Kit } from './types';
import { cleanName } from './check';
import { fileSlug } from './pack.server';
import { zipFiles } from '@/lib/lamp/mesh.server.js';
import { licenseText } from '@/lib/license';

export const MAX_FILE_B64 = 3_500_000;   // keeps the request under the 4.5 MB body limit
const MAX_MODEL = 40 * 1024 * 1024;

type Part = { name: string; color: string };
export type BrowserFileDesign = { name: string; format: 'stl' | '3mf'; file: string; parts: Part[]; notes: string[] };

function parse(x: unknown): BrowserFileDesign {
  const d = (x ?? {}) as Record<string, unknown>;
  const format = d.format === '3mf' ? '3mf' : d.format === 'stl' ? 'stl' : null;
  if (!format) throw new Error('Unknown file format.');
  const file = typeof d.file === 'string' ? d.file : '';
  if (!file || file.length > MAX_FILE_B64 || !/^[A-Za-z0-9+/=]+$/.test(file)) throw new Error('The model is missing or too big to order printed. Make it smaller or less detailed.');
  let size = 0;
  try { size = gunzipSync(Buffer.from(file, 'base64'), { maxOutputLength: MAX_MODEL }).length; } catch { throw new Error('The model file could not be read.'); }
  if (size < 84) throw new Error('The model file is empty.');
  const parts = (Array.isArray(d.parts) ? d.parts : []).slice(0, 8).map((p) => {
    const q = (p ?? {}) as Record<string, unknown>;
    return { name: cleanName(q.name, 'Part'), color: /^#[0-9a-f]{6}$/i.test(String(q.color)) ? String(q.color) : '#808080' };
  });
  const notes = (Array.isArray(d.notes) ? d.notes : []).slice(0, 30).map((n) => String(n).replace(/[\u0000-\u001f]/g, ' ').slice(0, 200));
  return { name: cleanName(d.name, 'Design'), format, file, parts, notes };
}

async function build(d: BrowserFileDesign, preview: Uint8Array | null, license: { owner?: string; orderId?: string }) {
  const prefix = fileSlug(d.name) || 'design';
  const model: Uint8Array = new Uint8Array(gunzipSync(Buffer.from(d.file, 'base64'), { maxOutputLength: MAX_MODEL }));
  const readme = [
    `${d.name} - printed order`, 'Made in the browser with MD Creations Labs - labs.themdcreations.com', '',
    d.parts.length ? 'COLOURS' : '', ...d.parts.map((p) => `  ${p.name}: ${p.color}`), d.parts.length ? '' : '',
    'SETTINGS', ...d.notes.map((n) => `  ${n}`), '',
  ];
  const files = [
    { name: `${prefix}.${d.format}`, data: model as Uint8Array },
    { name: 'README.txt', data: new TextEncoder().encode(readme.join('\r\n')) },
    { name: 'LICENSE.txt', data: new TextEncoder().encode(licenseText({ design: d.name, ...license }).replace(/\n/g, '\r\n')) },
  ];
  if (preview && preview.length) files.push({ name: `${prefix}_preview.jpg`, data: preview });
  return { zip: zipFiles(files), fileName: `${prefix.replace(/-/g, '_')}_print.zip` };
}

export const kit: Kit = { parse, build: build as Kit['build'] };
