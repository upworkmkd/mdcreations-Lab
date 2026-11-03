'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin, FILES_BUCKET } from '@/lib/supabase/admin';
import { IMAGES_BUCKET, adminProduct, buildPackage, partsPrefix } from '@/lib/stl/shop.server';
import { cleanPartName } from '@/lib/stl/binary';
import type { Hardware, ProductFile, ProductImage } from '@/lib/stl/product';

export type FormState = { ok?: string; error?: string } | null;
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const done = (id: string, slug?: string) => {
  revalidatePath('/admin/stl'); revalidatePath(`/admin/stl/${id}`); revalidatePath('/stl-files');
  if (slug) revalidatePath(`/stl-files/${slug}`);
};
/** "199" or "199.00" → 19900 (minor units); empty → null. */
function money(v: FormDataEntryValue | null, min = 0): number | null | 'bad' {
  const s = String(v ?? '').trim(); if (!s) return null;
  const n = Number(s); if (!Number.isFinite(n) || n < min || n > 1_000_000) return 'bad';
  return Math.round(n * 100);
}

export async function createProduct(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const title = String(form.get('title') ?? '').trim().slice(0, 120);
  if (title.length < 2) return { error: 'Give it a name.' };
  const db = supabaseAdmin();
  let slug = slugify(title) || 'design';
  const { data: clash } = await db.from('stl_products').select('id').eq('slug', slug).maybeSingle();
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await db.from('stl_products').insert({ title, slug, seo_title: `${title} – 3D Print STL Files` }).select('id').single();
  if (error || !data) return { error: error?.message.includes('stl_products') ? `${error.message}. Did you run the STL shop SQL migration?` : error?.message ?? 'Could not create it.' };
  revalidatePath('/admin/stl');
  redirect(`/admin/stl/${data.id}`);
}

/** The text, prices, status and SEO of a product. */
export async function saveProduct(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get('id') ?? '');
  const db = supabaseAdmin();
  const before = await adminProduct(id);
  if (!before) return { error: 'Product not found.' };
  const title = String(form.get('title') ?? '').trim().slice(0, 120);
  const slug = slugify(String(form.get('slug') ?? '')) || slugify(title);
  if (title.length < 2) return { error: 'Give it a name.' };
  const status = String(form.get('status') ?? 'draft');
  if (!['draft', 'live', 'hidden'].includes(status)) return { error: 'Bad status.' };
  const inr = money(form.get('price_inr')), usd = money(form.get('price_usd')), pr = money(form.get('print_price_inr'), 1);
  if (inr === 'bad' || usd === 'bad') return { error: 'A download price is not a number.' };
  if (pr === 'bad') return { error: 'The printed price must be at least ₹1 (Razorpay’s minimum).' };
  if ((inr != null && inr > 0 && inr < 100) || (usd != null && usd > 0 && usd < 100)) return { error: 'Prices under 1.00 cannot be paid with Razorpay. Use 0 for free, or at least 1.' };
  // hardware: one per line, "item | qty | note"; specs: one per line, "Label: value"
  const hardware: Hardware[] = String(form.get('hardware') ?? '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0])
    .slice(0, 30).map(([item, qty = '', note = '']) => ({ item: item.slice(0, 120), qty: qty.slice(0, 20), note: note.slice(0, 200) }));
  const specs = String(form.get('specs') ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20)
    .map((l) => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim().slice(0, 40), l.slice(i + 1).trim().slice(0, 120)] : [l.slice(0, 40), '']; });
  const keywords = String(form.get('keywords') ?? '').split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 20);
  if (status === 'live') {
    if (!before.images.length) return { error: 'Add at least one picture before setting it live.' };
    if (!before.package_path) return { error: 'Upload the STL files and build the download zip before setting it live.' };
    if (inr == null && usd == null) return { error: 'Set a download price before setting it live.' };
  }
  const { error } = await db.from('stl_products').update({
    title, slug, status, subtitle: String(form.get('subtitle') ?? '').trim().slice(0, 200),
    description: String(form.get('description') ?? '').trim().slice(0, 8000), assembly: String(form.get('assembly') ?? '').trim().slice(0, 8000),
    print_notes: String(form.get('print_notes') ?? '').trim().slice(0, 4000), hardware, specs,
    price_inr: inr, price_usd: usd, print_price_inr: pr, sort: Math.round(Number(form.get('sort')) || 100),
    seo_title: String(form.get('seo_title') ?? '').trim().slice(0, 120), seo_description: String(form.get('seo_description') ?? '').trim().slice(0, 300), keywords,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return { error: error.message.includes('stl_products_slug_key') ? 'Another product already uses this address.' : error.message };
  done(id, slug); if (before.slug !== slug) revalidatePath(`/stl-files/${before.slug}`);
  return { ok: status === 'live' ? 'Saved. It is live in the shop.' : 'Saved.' };
}

/* ------------------------------------------------------------------ pictures (public bucket) */
export async function imageUploadUrl(id: string, ext: string) {
  await requireAdmin();
  const e = ['jpg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${e}`;
  const { data, error } = await supabaseAdmin().storage.from(IMAGES_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? 'Could not start the upload.' };
  return { path, token: data.token };
}
export async function saveImages(id: string, images: ProductImage[]): Promise<FormState> {
  await requireAdmin();
  const db = supabaseAdmin();
  const before = await adminProduct(id);
  if (!before) return { error: 'Product not found.' };
  const clean = images.filter((i) => typeof i.path === 'string' && i.path.startsWith(`${id}/`)).slice(0, 20).map((i) => ({ path: i.path, alt: String(i.alt ?? '').slice(0, 160) }));
  if (before.status === 'live' && !clean.length) return { error: 'A live product needs at least one picture.' };
  const { error } = await db.from('stl_products').update({ images: clean, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.message };
  const gone = before.images.map((i) => i.path).filter((p) => !clean.some((c) => c.path === p));
  if (gone.length) await db.storage.from(IMAGES_BUCKET).remove(gone);
  done(id, before.slug);
  return { ok: 'Pictures saved.' };
}

/* ------------------------------------------------------------------ STL files (private) */
export async function fileUploadUrl(id: string, name: string) {
  await requireAdmin();
  const clean = cleanPartName(name);
  const path = `${partsPrefix(id)}${clean}`;
  const { data, error } = await supabaseAdmin().storage.from(FILES_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return { error: error?.message ?? 'Could not start the upload.' };
  return { path, name: clean, token: data.token };
}
export async function addFiles(id: string, added: ProductFile[]): Promise<FormState> {
  await requireAdmin();
  const db = supabaseAdmin();
  const p = await adminProduct(id);
  if (!p) return { error: 'Product not found.' };
  const ok = added.filter((f) => f.path.startsWith(partsPrefix(id)));
  const files = [...p.files.filter((f) => !ok.some((a) => a.path === f.path)), ...ok.map((f) => ({ name: f.name, path: f.path, bytes: Math.round(f.bytes) || 0 }))]
    .sort((a, b) => a.name.localeCompare(b.name));
  const { error } = await db.from('stl_products').update({ files, package_built_at: null, updated_at: new Date().toISOString() }).eq('id', id);   // the zip needs building again
  if (error) return { error: error.message };
  done(id, p.slug);
  return { ok: `${ok.length} file${ok.length === 1 ? '' : 's'} added. Build the download zip to include ${ok.length === 1 ? 'it' : 'them'}.` };
}
export async function removeFile(id: string, path: string): Promise<FormState> {
  await requireAdmin();
  const db = supabaseAdmin();
  const p = await adminProduct(id);
  if (!p || !path.startsWith(partsPrefix(id))) return { error: 'Not found.' };
  await db.storage.from(FILES_BUCKET).remove([path]);
  await db.from('stl_products').update({ files: p.files.filter((f) => f.path !== path), package_built_at: null, updated_at: new Date().toISOString() }).eq('id', id);
  done(id, p.slug);
  return { ok: 'Removed. Build the download zip again so buyers get the new set.' };
}
export async function buildZip(id: string): Promise<FormState> {
  await requireAdmin();
  try {
    const r = await buildPackage(id);
    done(id);
    return { ok: `Download zip built: ${r.parts} parts, ${(r.bytes / 1e6).toFixed(1)} MB.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not build the zip.' };
  }
}
