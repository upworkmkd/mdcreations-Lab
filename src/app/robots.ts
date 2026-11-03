import type { MetadataRoute } from 'next';
import { CANONICAL_URL as SITE_URL } from '@/lib/env';

// Pages that are private or useless in search results.
const PRIVATE = ['/api/', '/account', '/admin', '/auth/', '/login', '/signup', '/forgot', '/feedback/', '/review/'];

// AI search and assistant crawlers, named so they are welcome explicitly (some sites block them by default):
// ChatGPT search and browsing, Perplexity, Gemini (Google-Extended), Claude, Apple Intelligence, Microsoft Copilot (Bing), DuckDuckGo.
const AI_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'Applebot-Extended', 'Applebot', 'bingbot', 'DuckAssistBot', 'meta-externalagent', 'MistralAI-User', 'cohere-ai'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: ['/', '/llms.txt'], disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
