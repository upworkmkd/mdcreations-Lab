#!/usr/bin/env node
/* SEO check for every page in the sitemap (plus llms.txt and robots.txt).
 *   npm run seo:check                      checks http://localhost:3000 (run `npm run dev` or `npm start` first)
 *   npm run seo:check -- https://labs.themdcreations.com
 * Fails (exit 1) when a page has no title, description or canonical, or not exactly one <h1>; warns on lengths. */
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const CANON = 'https://labs.themdcreations.com';

const sm = await (await fetch(`${base}/sitemap.xml`)).text();
const paths = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(CANON, '') || '/');
const attr = (html, re) => html.match(re)?.[1]?.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"') ?? null;
let errors = 0, warnings = 0;

for (const path of paths) {
  const r = await fetch(base + path);
  const html = await r.text();
  const title = attr(html, /<title>([^<]*)<\/title>/);
  const desc = attr(html, /<meta name="description" content="([^"]*)"/);
  const kw = attr(html, /<meta name="keywords" content="([^"]*)"/);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  const og = attr(html, /<meta property="og:image" content="([^"]*)"/);
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  const ld = (html.match(/application\/ld\+json/g) ?? []).length;
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  const err = [], warn = [];
  if (r.status !== 200) err.push(`status ${r.status} (listed in the sitemap)`);
  if (!title) err.push('no <title>'); else if (title.length > 65) warn.push(`title ${title.length} characters (Google shows about 60)`);
  if (!desc) err.push('no description'); else if (desc.length > 160) warn.push(`description ${desc.length} characters (aim for 120-160)`); else if (desc.length < 70) warn.push(`description only ${desc.length} characters`);
  if (!canonical) err.push('no canonical link');
  if (h1 !== 1) err.push(`${h1} <h1> headings (should be 1)`);
  if (noindex) err.push('marked noindex but listed in the sitemap');
  if (!kw) warn.push('no keywords');
  if (!og) warn.push('no share image (og:image)');
  if (!ld) warn.push('no structured data (JSON-LD)');
  errors += err.length; warnings += warn.length;
  const mark = err.length ? '✗' : warn.length ? '!' : '✓';
  console.log(`${mark} ${path}${title ? `  ·  ${title}` : ''}`);
  for (const e of err) console.log(`    error: ${e}`);
  for (const w of warn) console.log(`    warn:  ${w}`);
}

for (const f of ['/robots.txt', '/llms.txt']) {
  const r = await fetch(base + f);
  console.log(`${r.ok ? '✓' : '✗'} ${f} (${r.status})`);
  if (!r.ok) errors++;
}
console.log(`\n${paths.length} pages · ${errors} errors · ${warnings} warnings`);
process.exit(errors ? 1 : 0);
