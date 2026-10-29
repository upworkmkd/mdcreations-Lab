import Link from 'next/link';
import type { Metadata } from 'next';
import { designPriceRange, getCatalog, getCurrency } from '@/lib/catalog.server';
import { getPlans, currentSubscription } from '@/lib/plans.server';
import { getViewer } from '@/lib/auth.server';
import { formatMoney } from '@/lib/money';
import { pageMeta, JsonLd } from '@/lib/seo';
import { CANONICAL_URL } from '@/lib/env';
import { Subscribe } from './subscribe';

export const metadata: Metadata = pageMeta({
	title: 'Pricing – Pay per Design or a Monthly Plan',
	description: 'Try every tool free. Pay per design, or subscribe: Starter gives 10 designs a day across every tool, Standard is unlimited. Commercial license included.',
	path: '/pricing',
	keywords: ['shadow lamp maker price', 'STL generator subscription', '3D printing tools subscription', 'commercial license STL'],
});

const FEATURES: Record<string, string[]> = {
	starter: [
		'Every tool, including each new one as it launches',
		'10 designs a day in total, across all tools',
		'Commercial license on every file',
		'Sell the prints and the files, changed or not',
		'Every file kept in your account',
		'Unlimited free previews',
		'Email support',
		'Cancel any time',
	],
	standard: [
		'Every tool, including each new one as it launches',
		'Unlimited designs, no daily limit',
		'Commercial license on every file',
		'Sell the prints and the files, changed or not',
		'Priority support and early access to new tools',
		'Every file kept in your account',
		'Cancel any time',
	],
};
const BLURB: Record<string, string> = {
	starter: 'For makers who print a few designs most days.',
	standard: 'For studios and shops that design all day, with no limits.',
};

const FAQ = [
	{ q: 'What counts as a design?', a: 'Each time you build the files for a design and download the zip. Previews in the maker are always free and unlimited.' },
	{ q: 'When does the daily limit reset?', a: 'At midnight India time. Designs you do not use do not carry over.' },
	{ q: 'Which tools does each plan cover?', a: 'Both plans cover every tool, including new ones as they launch. Starter allows 10 designs a day in total across all tools; Standard has no limit.' },
	{ q: 'How do payments work?', a: 'Razorpay sets up a monthly payment on your card or UPI Autopay. The first month is charged when you subscribe, and the plan renews on the same date each month until you cancel.' },
	{ q: 'How do I cancel?', a: 'From your account, any time. Your plan keeps working until the end of the month you have paid for and then stops. Your files stay in your account.' },
	{ q: 'Can I sell what I make?', a: 'Yes. Every download, on a plan or not, comes with our commercial license: sell the printed objects and the files themselves, as they are or modified.' },
];

export default async function Pricing() {
	const [plans, currency, viewer, catalog] = await Promise.all([getPlans(), getCurrency(), getViewer(), getCatalog()]);
	const sub = viewer ? await currentSubscription(viewer.id).catch(() => null) : null;
	const tools = catalog.map((t) => ({ slug: t.slug, name: t.name, live: t.status === 'live' }));
	// each tool has its own price per design, so this card shows the range across the live tools
	const range = designPriceRange(catalog, currency);

	return (
		<>
			<JsonLd data={{
				'@context': 'https://schema.org', '@type': 'Product', name: 'MD Creations Labs plans', brand: { '@type': 'Brand', name: 'MD Creations' },
				offers: plans.filter((p) => p.prices[currency]).map((p) => ({ '@type': 'Offer', name: `${p.name} plan (monthly)`, price: (p.prices[currency]! / 100).toFixed(2), priceCurrency: currency, url: `${CANONICAL_URL}/pricing` })),
			}} />
			<div className="wrap">
				<div className="page-title" style={{ borderBottom: 0 }}>
					<p className="eyebrow">Pricing</p>
					<h1>Free to try. Pay when you download.</h1>
					<p className="lede">Design and preview as much as you like. Buy one design at a time, or take a monthly plan if you make a lot. Every file comes with a <Link href="/license">commercial license</Link>.</p>
				</div>

				{sub && (
					<p className="msg ok" style={{ marginBottom: 24 }}>You are on the <b>{plans.find((p) => p.id === sub.plan_id)?.name ?? sub.plan_id}</b> plan. <Link href="/account#plan">Manage it in your account</Link>.</p>
				)}

				<div className="plans">
					<article className="plan">
						<header><h2>Pay per design</h2><p>For a design now and then.</p></header>
						<div className="amount">{range ? (range.min === range.max ? formatMoney(range.min, currency) : <>{formatMoney(range.min, currency)}<small className="to">–</small>{formatMoney(range.max, currency)}</>) : '—'}<span>per design{range && range.min !== range.max ? ', depending on the tool' : ''}</span></div>
						<ul>
							<li>No subscription</li>
							<li>Pay only for the designs you download</li>
							<li>Commercial license on every file</li>
							<li>Every file kept in your account</li>
							<li>Unlimited free previews</li>
						</ul>
						{range && range.tools.length > 1 && (
							<details className="tool-prices">
								<summary>Price per tool</summary>
								<ul>{range.tools.map((t) => <li key={t.slug}><Link href={`/tools/${t.slug}`}>{t.name}</Link><b>{formatMoney(t.price, currency)}</b></li>)}</ul>
							</details>
						)}
						<Link href="/#tools" className="btn ghost">Start designing</Link>
					</article>

					{plans.map((p) => {
						const amount = p.prices[currency];
						const isMine = sub?.plan_id === p.id;
						return (
							<article key={p.id} className={`plan${p.id === 'starter' ? ' pick' : ''}`}>
								{p.id === 'starter' && <span className="flag">Most popular</span>}
								<header><h2>{p.name}</h2><p>{BLURB[p.id] ?? ''}</p></header>
								<div className="amount">{amount != null ? formatMoney(amount, currency) : '—'}<span>per month</span></div>
								<ul>{(FEATURES[p.id] ?? []).map((f) => <li key={f}>{f}</li>)}</ul>
								{isMine ? <Link href="/account#plan" className="btn ghost">Your plan · manage</Link>
									: p.status === 'contact' || sub ? (
										<Link href={`/contact?plan=${p.id}`} className={`btn${p.id === 'starter' ? '' : ' ghost'}`}>{sub ? 'Contact us to switch' : 'Contact us'}</Link>
									) : (
										<Subscribe plan={p.id} planName={p.name} currency={currency} tools={tools} pickTool={p.tools === 1} signedIn={Boolean(viewer)} ready={Boolean(p.ready[currency])} label={`Subscribe · ${amount != null ? formatMoney(amount, currency) : ''}/month`} />
									)}
								{p.status === 'contact' && !isMine && <p className="per">More tools are on the way. Tell us what you need and we will set you up.</p>}
							</article>
						);
					})}
				</div>
				<p className="muted" style={{ fontSize: 14, margin: '18px 0 0' }}>Prices {currency === 'INR' ? 'include GST where applicable' : 'are in US dollars'}.</p>

				<section className="section" style={{ paddingTop: 72 }}>
					<div className="section-head"><h2>Questions about plans</h2><p>Anything else? <Link href="/contact">Write to us</Link>.</p></div>
					<div className="faq">{FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
				</section>
			</div>
		</>
	);
}
