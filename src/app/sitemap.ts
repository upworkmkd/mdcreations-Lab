import type { MetadataRoute } from 'next';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';
import { TOOLS } from '@/lib/tools';
import { LAMP_GALLERY } from '@/lib/gallery';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (p: string) => `${SITE_URL}${p}`;
  return [
    { url: u('/'), lastModified: now, changeFrequency: 'weekly', priority: 1, images: [u('/images/hero-shadow-lamp.jpg')] },
    ...TOOLS.map((t) => ({
      url: u(`/tools/${t.slug}`), lastModified: now, changeFrequency: 'weekly' as const, priority: t.status === 'live' ? 0.9 : 0.5,
      images: t.slug === 'shadow-lamp' ? [u(t.image), ...LAMP_GALLERY.map((g) => u(g.src))] : [u(t.image)],
    })),
    ...TOOLS.filter((t) => t.status === 'live' && t.makePath).map((t) => ({ url: u(t.makePath!), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9 })),
    { url: u('/pricing'), lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: u('/license'), lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    ...['/contact', '/terms', '/refunds', '/privacy', '/shipping'].map((p) => ({ url: u(p), lastModified: now, changeFrequency: 'yearly' as const, priority: 0.2 })),
  ];
}
