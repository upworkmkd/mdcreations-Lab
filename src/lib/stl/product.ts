/* STL shop products: the shape of a product, and helpers the browser can use too. */
import { formatMoney, type Currency } from '@/lib/money';

export type Hardware = { item: string; qty: string; note: string };
export type ProductImage = { path: string; alt: string };
export type ProductFile = { name: string; path: string; bytes: number };
export type StlStatus = 'draft' | 'live' | 'hidden';

/** What anyone may see of a live product (never the private file paths). */
export type PublicProduct = {
  id: string; slug: string; title: string; subtitle: string; description: string; assembly: string; hardware: Hardware[];
  print_notes: string; specs: [string, string][]; images: ProductImage[]; price_inr: number | null; price_usd: number | null;
  print_price_inr: number | null; status: StlStatus; sort: number; seo_title: string; seo_description: string; keywords: string[];
  created_at: string; updated_at: string;
};
export type AdminProduct = PublicProduct & { files: ProductFile[]; package_path: string | null; package_bytes: number | null; package_built_at: string | null };

export const PUBLIC_COLUMNS = 'id, slug, title, subtitle, description, assembly, hardware, print_notes, specs, images, price_inr, price_usd, print_price_inr, status, sort, seo_title, seo_description, keywords, created_at, updated_at';

export const downloadPrice = (p: Pick<PublicProduct, 'price_inr' | 'price_usd'>, c: Currency) => (c === 'INR' ? p.price_inr : p.price_usd);
export const priceLabel = (p: Pick<PublicProduct, 'price_inr' | 'price_usd'>, c: Currency) => { const v = downloadPrice(p, c); return v == null ? null : v === 0 ? 'Free' : formatMoney(v, c); };
export const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
export const paragraphs = (s: string) => s.split(/\r?\n\s*\r?\n/).map((l) => l.trim()).filter(Boolean);
export const partCount = (files: { name: string }[]) => files.filter((f) => /\.stl$/i.test(f.name)).length;
export const fmtBytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

/** Public address of a product picture (the stl-images bucket is public). Works in the browser and on the server. */
export const publicImageUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/stl-images/${path.split('/').map(encodeURIComponent).join('/')}`;

type Embedded<T> = T | T[] | null | undefined;
const one = <T,>(v: Embedded<T>) => (Array.isArray(v) ? v[0] : v) ?? null;
/** What to show for an order or a file: the STL product's title and picture, or the customer's design. */
export function itemOf(row: { designs?: Embedded<{ name: string; preview?: string | null }>; stl_products?: Embedded<{ title: string; slug?: string; images?: ProductImage[] }> }) {
  const p = one(row.stl_products), d = one(row.designs);
  if (p) return { name: p.title, preview: p.images?.[0] ? publicImageUrl(p.images[0].path) : null, slug: p.slug ?? null, product: true };
  return { name: d?.name ?? null, preview: d?.preview ?? null, slug: null, product: false };
}
