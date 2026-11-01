import { getCatalog } from '@/lib/catalog.server';
import { getPlans } from '@/lib/plans.server';
import { liveProducts } from '@/lib/stl/shop.server';
import { formatMoney } from '@/lib/money';
import { TOOL_SEO } from '@/lib/seo';
import { LICENSE_POINTS, PRODUCT_LICENSE_POINTS } from '@/lib/license';
import { CANONICAL_URL as SITE_URL, SUPPORT_EMAIL } from '@/lib/env';

/* /llms.txt: a plain summary of the site for AI assistants (ChatGPT, Gemini, Perplexity, Claude …), in the llms.txt
 * format (https://llmstxt.org). Built from the live catalogue, so a tool switched on in the admin appears here
 * within the hour, with its real price, and hidden tools never do. */
export const revalidate = 3600;

const money = (m: number | undefined, c: 'INR' | 'USD') => (m == null ? null : formatMoney(m, c));

export async function GET() {
  const [tools, plans, products] = await Promise.all([getCatalog(), getPlans().catch(() => []), liveProducts().catch(() => [])]);
  const live = tools.filter((t) => t.status === 'live');
  const soon = tools.filter((t) => t.status === 'coming_soon');

  const toolLine = (t: (typeof live)[number]) => {
    const price = t.free ? 'free, no account needed'
      : [money(t.prices.INR, 'INR'), money(t.prices.USD, 'USD')].filter(Boolean).join(' / ') + ' per design (free to try and preview)';
    const desc = TOOL_SEO[t.slug]?.description ?? t.lede;
    return `- [${t.name}](${SITE_URL}${t.makePath ?? `/tools/${t.slug}`}): ${desc} Price: ${price}. About the tool: ${SITE_URL}/tools/${t.slug}`;
  };

  const lines = [
    '# MD Creations Labs',
    '',
    '> Online 3D printing tools that run in the browser. Upload a picture or type some text, see a live 3D preview, and download print-ready STL files for any FDM 3D printer (Bambu Lab, Prusa, Creality and others). Made by MD Creations, a 3D printing studio in India. Every download includes a commercial license.',
    '',
    'Key facts:',
    '- Nothing to install: every tool runs in a web browser on a computer or phone.',
    '- Trying a tool and previewing the result is free; paid tools charge per design, or a monthly plan covers all tools.',
    '- Several tools are completely free with no account (marked below).',
    '- Prices are shown in Indian rupees (INR) in India and US dollars (USD) elsewhere; payment is by Razorpay (UPI, cards, net banking).',
    '- Some designs can also be ordered printed and posted within India.',
    `- Support: ${SUPPORT_EMAIL}`,
    '',
    '## Tools',
    '',
    ...live.map(toolLine),
    '',
    ...(soon.length ? ['## Coming soon', '', ...soon.map((t) => `- [${t.name}](${SITE_URL}/tools/${t.slug}): ${TOOL_SEO[t.slug]?.description ?? t.lede}`), ''] : []),
    '## Plans',
    '',
    ...plans.filter((p) => p.status === 'live').map((p) => {
      const price = [money(p.prices.INR, 'INR'), money(p.prices.USD, 'USD')].filter(Boolean).join(' / ');
      return `- ${p.name}: ${price} a month, ${p.daily_limit ? `${p.daily_limit} designs a day` : 'unlimited designs'} across every paid tool.`;
    }),
    `- Details: ${SITE_URL}/pricing`,
    '',
    ...(products.length ? ['## STL files shop', '', `Ready-made designs by MD Creations, sold as STL downloads (or printed and posted in India): ${SITE_URL}/stl-files`, '',
      ...products.map((p) => `- [${p.title}](${SITE_URL}/stl-files/${p.slug}): ${p.subtitle}${p.price_inr != null ? ` Price: ${[money(p.price_inr, 'INR'), money(p.price_usd ?? undefined, 'USD')].filter(Boolean).join(' / ')}.` : ''}`), ''] : []),
    '## License',
    '',
    'Files made with the tools come with a commercial license:',
    ...LICENSE_POINTS.map((x) => `- ${x}`),
    `- Full text: ${SITE_URL}/license`,
    ...(products.length ? ['', 'Designs bought in the STL files shop have their own license:', ...PRODUCT_LICENSE_POINTS.map((x) => `- ${x}`)] : []),
    '',
    '## Optional',
    '',
    `- [Contact](${SITE_URL}/contact)`,
    `- [Refunds and cancellations](${SITE_URL}/refunds)`,
    `- [Terms of use](${SITE_URL}/terms)`,
    `- [Privacy](${SITE_URL}/privacy)`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
