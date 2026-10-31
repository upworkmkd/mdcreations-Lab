import type { MetadataRoute } from 'next';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';
import { getCatalog } from '@/lib/catalog.server';
import { LAMP_GALLERY } from '@/lib/gallery';
import { liveProducts } from '@/lib/stl/shop.server';
import { publicImageUrl } from '@/lib/stl/product';

// Rebuilt at most every hour, so a tool switched to live (or hidden) in the admin shows up here soon after.
export const revalidate = 3600;

/**
 * Every public page Google should index. Tools follow their status in the database, not the code:
 * live tools with their maker page, coming-soon tools with their info page only, hidden tools not at all
 * (their pages answer 404, and a sitemap must not list pages that do not exist).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const u = (p: string) => `${SITE_URL}${p}`;
  const tools = await getCatalog();   // already without hidden tools
  const live = tools.filter((t) => t.status === 'live');
  const stl = await liveProducts().catch(() => []);
  return [
    { url: u('/'), changeFrequency: 'weekly', priority: 1, images: [u('/images/hero-shadow-lamp.jpg')] },
    ...tools.map((t) => ({
      url: u(`/tools/${t.slug}`), changeFrequency: 'weekly' as const, priority: t.status === 'live' ? 0.9 : 0.5,
      images: t.slug === 'shadow-lamp' ? [u(t.image), ...LAMP_GALLERY.map((g) => u(g.src))] : [u(t.image)],
    })),
    ...live.filter((t) => t.makePath).map((t) => ({ url: u(t.makePath!), changeFrequency: 'weekly' as const, priority: 0.9 })),
    { url: u('/stl-files'), changeFrequency: 'weekly' as const, priority: 0.8 },
    ...stl.map((p) => ({ url: u(`/stl-files/${p.slug}`), lastModified: p.updated_at, changeFrequency: 'weekly' as const, priority: 0.8, images: p.images.map((i) => publicImageUrl(i.path)) })),
    { url: u('/pricing'), changeFrequency: 'monthly', priority: 0.7 },
    { url: u('/license'), changeFrequency: 'yearly', priority: 0.4 },
    ...['/contact', '/terms', '/refunds', '/privacy', '/shipping'].map((p) => ({ url: u(p), changeFrequency: 'yearly' as const, priority: 0.2 })),
  ];
}
