/* The two emails sent when an order is ready: a receipt for the customer, and a note for the shop.
 * Plain tables and inline styles so they look the same in Gmail, Outlook and Apple Mail, light or dark.
 * Colours from the site: olive #424532, stone paper #ebebe3, lamp light #f1c47e. */

export type OrderMailData = {
	orderId: string;
	createdAt: string;
	customerName: string;
	customerEmail: string;
	userId: string;
	toolName: string;
	toolSlug: string;
	designName: string;
	amount: string;            // "₹299", "$5", or "" when nothing was paid
	how: 'razorpay' | 'plan' | 'free' | 'admin';
	planName?: string | null;
	method?: string | null;    // card, upi, netbanking …
	paymentId?: string | null;
	siteUrl: string;
	supportEmail: string;
	feedbackUrl: (rating?: number) => string;
	socials: readonly { name: string; url: string }[];
};

export const C = { olive: '#424532', olive2: '#676e47', deep: '#2c2e21', paper: '#ebebe3', paper3: '#f7f7f2', line: '#cbcdbd', ink: '#20221a', ink2: '#555846', ink3: '#7b7e69', light: '#f1c47e' };
export const SERIF = "Georgia, 'Cormorant Garamond', 'Times New Roman', serif";
export const SANS = "'Hanken Grotesk', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
export const MONO = "'IBM Plex Mono', Menlo, Consolas, monospace";

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const orderNo = (id: string) => id.slice(0, 8).toUpperCase();
export const dateIn = (s: string) => new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const METHOD: Record<string, string> = { card: 'Card', upi: 'UPI', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later' };

export function paidLine(d: OrderMailData) {
	if (d.how === 'plan') return `Included in your ${d.planName ? `${d.planName} ` : ''}plan`;
	if (d.how === 'admin') return 'Free (admin test order)';
	if (d.how === 'free' || !d.amount) return 'Free';
	return `${d.amount}${d.method ? ` · ${METHOD[d.method] ?? d.method}` : ''}`;
}

/** The outer frame: stone paper around a light card, logo on top, small print below. */
export function frame(o: { preheader: string; body: string; foot: string; siteUrl: string }) {
	return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>MD Creations Labs</title>
<style>
  @media (max-width: 620px) { .px { padding-left: 22px !important; padding-right: 22px !important; } .h1 { font-size: 30px !important; } .stack td { display: block !important; width: 100% !important; } }
  a { color: ${C.olive}; }
</style>
</head>
<body style="margin:0; padding:0; background:${C.paper}; -webkit-font-smoothing:antialiased;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${C.paper};">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:28px 12px 40px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;">
      <tr><td align="center" style="padding:0 0 18px;">
        <a href="${o.siteUrl}" style="text-decoration:none;">
          <img src="${o.siteUrl}/brand/logo-1024.png" width="64" height="64" alt="MD Creations" style="display:block; border:0; width:64px; height:64px; border-radius:50%;">
        </a>
        <div style="font:500 11px/1.4 ${MONO}; letter-spacing:.2em; text-transform:uppercase; color:${C.ink3}; padding-top:10px;">MD Creations&nbsp;Labs</div>
      </td></tr>
      <tr><td style="background:#ffffff; border:1px solid ${C.line}; border-radius:6px; overflow:hidden;">
        ${o.body}
      </td></tr>
      <tr><td class="px" style="padding:22px 36px 0; font:400 12px/1.65 ${SANS}; color:${C.ink3}; text-align:center;">
        ${o.foot}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export const row = (k: string, v: string, last = false) => `
  <tr>
    <td style="padding:11px 0; ${last ? '' : `border-bottom:1px solid ${C.line};`} font:500 11px/1.4 ${MONO}; letter-spacing:.12em; text-transform:uppercase; color:${C.ink3}; width:38%; vertical-align:top;">${k}</td>
    <td style="padding:11px 0; ${last ? '' : `border-bottom:1px solid ${C.line};`} font:400 15px/1.5 ${SANS}; color:${C.ink}; text-align:right; vertical-align:top;">${v}</td>
  </tr>`;

export const button = (href: string, label: string, dark = false) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-radius:3px; background:${dark ? C.olive : C.light};">
      <a href="${href}" style="display:inline-block; padding:14px 26px; font:600 15px/1 ${SANS}; color:${dark ? '#ffffff' : C.deep}; text-decoration:none; border-radius:3px;">${label}</a>
    </td>
  </tr></table>`;

/* ------------------------------------------------------------------ to the customer */
export function customerOrderEmail(d: OrderMailData) {
	const first = d.customerName.trim().split(/\s+/)[0] || '';
	const filesUrl = `${d.siteUrl}/account#files`;
	const faces: [number, string, string][] = [[1, '😞', 'Not good'], [2, '🙁', 'Could be better'], [3, '😐', 'Okay'], [4, '🙂', 'Good'], [5, '😍', 'Loved it']];
	const stl = d.toolSlug === 'stl';   // an STL shop purchase: ready-made files, nothing was built from a design
	const subject = stl ? `Your STL files for ${d.designName} are ready · Order ${orderNo(d.orderId)}` : `Your ${d.toolName} files are ready · Order ${orderNo(d.orderId)}`;

	const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="background:${C.olive}; padding:40px 40px 36px;">
      <div style="font:500 11px/1.4 ${MONO}; letter-spacing:.18em; text-transform:uppercase; color:${C.light};">&#9679;&nbsp; Order confirmed</div>
      <h1 class="h1" style="margin:14px 0 0; font:400 36px/1.15 ${SERIF}; color:#ffffff;">Thank you${first ? `, ${esc(first)}` : ''}.</h1>
      <p style="margin:14px 0 0; font:400 16px/1.6 ${SANS}; color:#e6e7dc;">${stl
        ? `The STL files for <b style="color:#ffffff; font-weight:600;">&ldquo;${esc(d.designName)}&rdquo;</b> are waiting in your account, with the assembly guide and print settings.`
        : `Your ${esc(d.toolName)} design <b style="color:#ffffff; font-weight:600;">&ldquo;${esc(d.designName)}&rdquo;</b> is built and waiting in your account, ready to slice and print.`}</p>
      <div style="padding-top:26px;">${button(filesUrl, 'Download your files &rarr;')}</div>
    </td></tr>

    <tr><td class="px" style="padding:32px 40px 8px;">
      <div style="font:500 11px/1.4 ${MONO}; letter-spacing:.14em; text-transform:uppercase; color:${C.ink3}; padding-bottom:6px;">Order details</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('Order', `<span style="font-family:${MONO};">#${orderNo(d.orderId)}</span>`)}
        ${row('Date', esc(dateIn(d.createdAt)))}
        ${row('Tool', esc(d.toolName))}
        ${row('Design', esc(d.designName))}
        ${row('Paid', `<b style="font-weight:600;">${esc(paidLine(d))}</b>`, true)}
      </table>
    </td></tr>

    <tr><td class="px" style="padding:20px 40px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper3}; border:1px solid ${C.line}; border-radius:4px;">
        <tr><td style="padding:18px 20px; font:400 14px/1.65 ${SANS}; color:${C.ink2};">
          <b style="color:${C.ink}; font-weight:600;">Before you print:</b> open the README inside the zip. It has the print settings we recommend for this design.
          Your files stay in <a href="${filesUrl}" style="color:${C.olive}; font-weight:600;">your account</a>, so you can download them again any time.
        </td></tr>
      </table>
    </td></tr>

    <tr><td class="px" style="border-top:1px solid ${C.line}; padding:30px 40px 34px; text-align:center;">
      <h2 style="margin:0; font:400 26px/1.2 ${SERIF}; color:${C.ink};">How was your order?</h2>
      <p style="margin:8px 0 18px; font:400 14px/1.6 ${SANS}; color:${C.ink2};">One tap tells us. Every note is read, and it shapes what we build next.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
        ${faces.map(([n, f, label]) => `
        <td align="center" style="padding:0 4px;">
          <a href="${d.feedbackUrl(n)}" title="${label}" style="display:block; width:54px; padding:10px 0 8px; border:1px solid ${C.line}; border-radius:4px; background:${C.paper3}; text-decoration:none;">
            <span style="display:block; font-size:26px; line-height:1;">${f}</span>
            <span style="display:block; padding-top:6px; font:500 9px/1.2 ${MONO}; letter-spacing:.04em; text-transform:uppercase; color:${C.ink3};">${n}/5</span>
          </a>
        </td>`).join('')}
      </tr></table>
      <p style="margin:16px 0 0; font:400 13px/1.6 ${SANS};"><a href="${d.feedbackUrl()}" style="color:${C.olive}; font-weight:600;">Or write us a few words &rarr;</a></p>
    </td></tr>
  </table>`;

	const foot = `
    Questions about your order? Just reply to this email or write to <a href="mailto:${d.supportEmail}" style="color:${C.ink2};">${d.supportEmail}</a>.<br>
    ${d.socials.map((s) => `<a href="${s.url}" style="color:${C.ink2}; text-decoration:none; font-weight:600;">${s.name}</a>`).join(' &nbsp;·&nbsp; ')}<br><br>
    <span style="color:${C.ink3};">MD Creations Labs · Design tools for 3D printing · <a href="${d.siteUrl}" style="color:${C.ink3};">${d.siteUrl.replace(/^https?:\/\//, '')}</a><br>
    You are getting this email because you placed order #${orderNo(d.orderId)}.</span>`;

	const text = [
		`Thank you${first ? `, ${first}` : ''}.`,
		``,
		stl ? `The STL files for "${d.designName}" are waiting in your account.` : `Your ${d.toolName} design "${d.designName}" is built and waiting in your account.`,
		`Download your files: ${filesUrl}`,
		``,
		`Order:  #${orderNo(d.orderId)}`,
		`Date:   ${dateIn(d.createdAt)}`,
		`Tool:   ${d.toolName}`,
		`Design: ${d.designName}`,
		`Paid:   ${paidLine(d)}`,
		``,
		`Before you print, open the README inside the zip for the print settings we recommend.`,
		``,
		`How was your order? Tell us here: ${d.feedbackUrl()}`,
		``,
		`Questions? Reply to this email or write to ${d.supportEmail}.`,
		`MD Creations Labs · ${d.siteUrl}`,
	].join('\n');

	return { subject, html: frame({ preheader: stl ? `The STL files for “${d.designName}” are ready to download.` : `Your ${d.toolName} design “${d.designName}” is ready to download.`, body, foot, siteUrl: d.siteUrl }), text };
}

/* ------------------------------------------------------------------ to the shop */
export function adminOrderEmail(d: OrderMailData) {
	const test = d.how === 'admin';
	const headline = d.how === 'razorpay' && d.amount ? d.amount : d.how === 'plan' ? 'Plan download' : test ? 'Test order' : 'Free order';
	const subject = `${test ? '' : ''}New order ${d.amount && d.how === 'razorpay' ? `${d.amount} ` : ''}· ${d.toolName} · ${d.customerName || d.customerEmail}`;
	const how = { razorpay: 'Razorpay', plan: `Plan${d.planName ? ` (${d.planName})` : ''}`, free: 'Free tool', admin: 'Admin test (not charged)' }[d.how];

	const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="background:${C.deep}; padding:30px 40px;">
      <div style="font:500 11px/1.4 ${MONO}; letter-spacing:.18em; text-transform:uppercase; color:${C.light};">&#9679;&nbsp; ${test ? 'Admin test order' : 'New order'}</div>
      <div class="h1" style="margin:10px 0 0; font:400 40px/1.1 ${SERIF}; color:#ffffff;">${esc(headline)}</div>
      <p style="margin:8px 0 0; font:400 15px/1.5 ${SANS}; color:#d9dbcd;">${esc(d.toolName)} &middot; &ldquo;${esc(d.designName)}&rdquo;</p>
    </td></tr>
    <tr><td class="px" style="padding:26px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('Customer', `${esc(d.customerName || '—')}<br><a href="mailto:${esc(d.customerEmail)}" style="color:${C.olive};">${esc(d.customerEmail)}</a>`)}
        ${row('Order', `<span style="font-family:${MONO};">#${orderNo(d.orderId)}</span>`)}
        ${row('When', esc(dateIn(d.createdAt)))}
        ${row('Paid by', esc(how + (d.method ? ` · ${METHOD[d.method] ?? d.method}` : '')))}
        ${d.paymentId ? row('Payment', `<span style="font-family:${MONO}; font-size:13px;">${esc(d.paymentId)}</span>`) : ''}
        ${row('Files', 'Built and in the customer&rsquo;s account', true)}
      </table>
    </td></tr>
    <tr><td class="px" style="padding:20px 40px 34px;">
      <table role="presentation" class="stack" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding:0 10px 10px 0;">${button(`${d.siteUrl}/admin/users/${d.userId}`, 'Open customer', true)}</td>
        <td style="padding:0 10px 10px 0;">${button(`mailto:${esc(d.customerEmail)}?subject=${encodeURIComponent(`Your MD Creations Labs order #${orderNo(d.orderId)}`)}`, 'Reply to customer')}</td>
        <td style="padding:0 0 10px;">${button(`${d.siteUrl}/admin/orders`, 'All orders')}</td>
      </tr></table>
    </td></tr>
  </table>`;
	const foot = `Sent to the order alert addresses in <a href="${d.siteUrl}/admin/settings" style="color:${C.ink2};">Admin &rarr; Settings</a>.`;
	const text = [
		`${test ? 'ADMIN TEST ORDER' : 'NEW ORDER'}: ${headline}`,
		`${d.toolName} · "${d.designName}"`,
		``,
		`Customer: ${d.customerName || '—'} <${d.customerEmail}>`,
		`Order:    #${orderNo(d.orderId)}`,
		`When:     ${dateIn(d.createdAt)}`,
		`Paid by:  ${how}${d.method ? ` · ${d.method}` : ''}`,
		d.paymentId ? `Payment:  ${d.paymentId}` : '',
		``,
		`Customer: ${d.siteUrl}/admin/users/${d.userId}`,
		`Reply:    mailto:${d.customerEmail}`,
		`Orders:   ${d.siteUrl}/admin/orders`,
	].filter((l) => l !== null).join('\n');
	return { subject, html: frame({ preheader: `${headline} from ${d.customerName || d.customerEmail} for ${d.toolName}.`, body, foot, siteUrl: d.siteUrl }), text };
}
