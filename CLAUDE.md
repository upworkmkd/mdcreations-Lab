@AGENTS.md

# MD Creations Labs: rules for every change

## SEO is part of every new page

A page is not done until its SEO is done. For every new public page (a tool, a maker page, a shop product, a landing page):

1. **Metadata** through `pageMeta()` in `src/lib/seo.tsx`:
   - `title`: what people actually search for, about 50–60 characters. Tool pages use `absoluteTitle: true`.
   - `description`: 120–160 characters, says what the page does and what you get (STL files, free or paid).
   - `keywords`: 8–18 real search phrases, including Indian-market phrases where they fit (Hindi names, Diwali, UPI, INR).
   - `path`: gives the canonical link and the share URL. Pass `image` when the page has its own picture.
   - Private pages (account, admin, sign-in, checkout results) use `NOINDEX` instead and stay out of the sitemap.
2. **Exactly one `<h1>`**, and real text on the page (what it is, how it works, questions), not just a widget.
3. **Structured data (JSON-LD)** with `JsonLd`:
   - tool info page: `WebApplication` with offers, `BreadcrumbList`, `FAQPage` (already in `src/app/tools/[slug]/page.tsx`);
   - maker page: rendered by `KitPage` (or `makerLd()` for pages that do not use it);
   - shop product: `Product` with offers, `BreadcrumbList`, `FAQPage`.
4. **Sitemap**: add the page to `src/app/sitemap.ts` if it is not picked up from the catalogue already.
5. **AI assistants**: `/llms.txt` (`src/app/llms.txt/route.ts`) lists live tools, plans and shop products from the database. A new kind of page (not a tool or a product) needs a line there.
6. **New tool**: its `seo` export in `src/lib/tools-extra/<tool>.ts` (title, description, keywords), the maker page metadata, and the home page keywords in `src/app/page.tsx`.
7. **Check it**: `npm run build && npm start`, then `npm run seo:check`. It must report 0 errors.

Do not change the titles or descriptions of the Shadow Lamp pages unless the new one is clearly better: they rank well on Google.
