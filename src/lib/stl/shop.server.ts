import 'server-only';
import { cache } from 'react';
import { supabaseAdmin, FILES_BUCKET } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { zipFiles } from '@/lib/lamp/mesh.server.js';
import { productLicenseText } from '@/lib/license';
import { asciiToBinaryStl } from './binary';
import { PUBLIC_COLUMNS, lines, paragraphs, type AdminProduct, type PublicProduct } from './product';

export const IMAGES_BUCKET = 'stl-images';
/** Private home of a product's files: products/<id>/parts/<name>.stl and products/<id>/package/<slug>.zip (lab-files). */
export const partsPrefix = (id: string) => `products/${id}/parts/`;
export const isProductPath = (p: string | null | undefined) => Boolean(p && p.startsWith('products/'));

export function imageUrl(path: string) {
  return supabaseAdmin().storage.from(IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Live products for the shop, in their order. Never includes the private paths. */
export const liveProducts = cache(async (): Promise<PublicProduct[]> => {
  if (!supabaseConfigured()) return [];
  const { data } = await supabaseAdmin().from('stl_products').select(PUBLIC_COLUMNS).eq('status', 'live').order('sort').order('created_at', { ascending: false });
  return (data ?? []) as unknown as PublicProduct[];
});

/** One product by its address. Drafts and hidden ones only for the admin (preview). */
export const productBySlug = cache(async (slug: string, admin = false): Promise<(PublicProduct & { parts: string[] }) | null> => {
  if (!supabaseConfigured()) return null;
  const { data } = await supabaseAdmin().from('stl_products').select(`${PUBLIC_COLUMNS}, files`).eq('slug', slug).maybeSingle();
  if (!data) return null;
  const p = data as unknown as AdminProduct;
  if (p.status !== 'live' && !admin) return null;
  const { files, ...rest } = p;
  return { ...rest, parts: (files ?? []).map((f) => f.name) };   // names only: the paths stay on the server
});

export async function adminProduct(id: string): Promise<AdminProduct | null> {
  const { data } = await supabaseAdmin().from('stl_products').select('*').eq('id', id).maybeSingle();
  return (data as AdminProduct | null) ?? null;
}

/**
 * Builds the download zip from the uploaded parts: every STL (as binary STL), a README with the assembly, hardware and
 * print notes, the license and the feature picture. Stored once, privately; each buyer gets a signed link to it.
 */
export async function buildPackage(id: string) {
  const db = supabaseAdmin();
  const p = await adminProduct(id);
  if (!p) throw new Error('Product not found.');
  if (!p.files.length) throw new Error('Upload the STL files first.');
  const files: { name: string; data: Uint8Array }[] = [];
  const folder = p.slug.replace(/-/g, '_');
  for (const f of p.files) {
    const { data, error } = await db.storage.from(FILES_BUCKET).download(f.path);
    if (error || !data) throw new Error(`Could not read ${f.name}: ${error?.message ?? 'missing'}`);
    files.push({ name: `${folder}/STL/${f.name}`, data: asciiToBinaryStl(new Uint8Array(await data.arrayBuffer()), `${p.title} - ${f.name}`) });
  }
  const hw = p.hardware.filter((h) => h.item);
  const readme = [
    `${p.title}`, `MD Creations - https://labs.themdcreations.com/stl-files/${p.slug}`, '',
    ...paragraphs(p.description).flatMap((x) => [x, '']),
    ...(p.specs.length ? ['DETAILS', ...p.specs.map(([k, v]) => `  ${k}: ${v}`), ''] : []),
    `PARTS (${p.files.length} STL files, in the STL folder)`, ...p.files.map((f) => `  - ${f.name}`), '',
    ...(hw.length ? ['HARDWARE YOU NEED', ...hw.map((h) => `  - ${h.item}${h.qty ? ` x ${h.qty}` : ''}${h.note ? ` (${h.note})` : ''}`), ''] : []),
    ...(p.assembly ? ['ASSEMBLY', ...lines(p.assembly).map((s, i) => `  ${i + 1}. ${s}`), ''] : []),
    ...(p.print_notes ? ['PRINTING', ...lines(p.print_notes).map((s) => `  - ${s}`), ''] : []),
    'LICENSE: print and sell the printed models as you like. Please do not share or resell the STL files.',
    'The full terms are in LICENSE.txt. Questions or a missing part: hello@themdcreations.com',
  ];
  files.push({ name: `${folder}/README.txt`, data: new TextEncoder().encode(readme.join('\r\n')) });
  files.push({ name: `${folder}/LICENSE.txt`, data: new TextEncoder().encode(productLicenseText({ design: p.title }).replace(/\n/g, '\r\n')) });
  const feature = p.images[0];
  if (feature) {
    const { data } = await db.storage.from(IMAGES_BUCKET).download(feature.path);
    if (data) files.push({ name: `${folder}/preview.${feature.path.split('.').pop() ?? 'jpg'}`, data: new Uint8Array(await data.arrayBuffer()) });
  }
  const zip = zipFiles(files) as Uint8Array;
  const path = `products/${p.id}/package/${folder}_stl_files.zip`;
  const up = await db.storage.from(FILES_BUCKET).upload(path, zip, { contentType: 'application/zip', upsert: true });
  if (up.error) throw new Error('Could not store the zip: ' + up.error.message);
  await db.from('stl_products').update({ package_path: path, package_bytes: zip.length, package_built_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', p.id);
  return { path, bytes: zip.length, parts: p.files.length };
}
