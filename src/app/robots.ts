import type { MetadataRoute } from 'next';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/admin', '/auth/', '/login', '/signup', '/forgot', '/feedback/', '/review/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
