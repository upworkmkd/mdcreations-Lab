/* Emails for printed orders: the receipt with the shipping address, the shop's "print this" alert,
 * "it's on its way" and "delivered". Same look as the download emails (see order-emails.ts). */
import { C, MONO, SANS, SERIF, button, dateIn, esc, frame, orderNo, paidLine, row, type OrderMailData } from '@/lib/emails/order-emails';
import { shipLines, type ShipTo } from '@/lib/ship';

export type PrintMailData = OrderMailData & { shipTo: ShipTo | null; courier?: string | null; trackingNo?: string | null; fileReady?: boolean };

const eyebrow = (t: string, color: string = C.light) => `<div style="font:500 11px/1.4 ${MONO}; letter-spacing:.18em; text-transform:uppercase; color:${color};">&#9679;&nbsp; ${t}</div>`;
const label = (t: string) => `<div style="font:500 11px/1.4 ${MONO}; letter-spacing:.14em; text-transform:uppercase; color:${C.ink3}; padding-bottom:6px;">${t}</div>`;
const address = (s: ShipTo | null) => shipLines(s).map(esc).join('<br>');
const first = (d: PrintMailData) => d.customerName.trim().split(/\s+/)[0] || '';
const accountUrl = (d: PrintMailData) => `${d.siteUrl}/account#orders`;

function hero(d: PrintMailData, o: { eyebrow: string; title: string; lede: string; cta?: [string, string] }) {
  return `
    <tr><td class="px" style="background:${C.olive}; padding:40px 40px 36px;">
      ${eyebrow(o.eyebrow)}
      <h1 class="h1" style="margin:14px 0 0; font:400 36px/1.15 ${SERIF}; color:#ffffff;">${o.title}</h1>
      <p style="margin:14px 0 0; font:400 16px/1.6 ${SANS}; color:#e6e7dc;">${o.lede}</p>
      ${o.cta ? `<div style="padding-top:26px;">${button(o.cta[0], o.cta[1])}</div>` : ''}
    </td></tr>`;
}

function addressBox(d: PrintMailData, heading = 'Posting to') {
  return `
    <tr><td class="px" style="padding:6px 40px 26px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper3}; border:1px solid ${C.line}; border-radius:4px;">
        <tr><td style="padding:16px 20px; font:400 15px/1.6 ${SANS}; color:${C.ink};">${label(heading)}${address(d.shipTo)}</td></tr>
      </table>
    </td></tr>`;
}

/** The steps, with the current one lit: Paid · Printing · Shipped · Delivered. */
function steps(at: number) {
  const names = ['Paid', 'Printing', 'Shipped', 'Delivered'];
  return `
    <tr><td class="px" style="padding:26px 40px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${names.map((n, i) => `<td align="center" style="width:25%; padding:0 2px;">
          <div style="height:4px; border-radius:2px; background:${i <= at ? C.olive : C.line};"></div>
          <div style="padding-top:8px; font:500 10.5px/1.3 ${MONO}; letter-spacing:.08em; text-transform:uppercase; color:${i <= at ? C.ink : C.ink3};">${n}</div>
        </td>`).join('')}
      </tr></table>
    </td></tr>`;
}

const foot = (d: PrintMailData) => `
    Questions about your order? Just reply to this email or write to <a href="mailto:${d.supportEmail}" style="color:${C.ink2};">${d.supportEmail}</a>.<br>
    ${d.socials.map((s) => `<a href="${s.url}" style="color:${C.ink2}; text-decoration:none; font-weight:600;">${s.name}</a>`).join(' &nbsp;·&nbsp; ')}<br><br>
    <span style="color:${C.ink3};">MD Creations · Printed in India by MD Creations · <a href="${d.siteUrl}" style="color:${C.ink3};">${d.siteUrl.replace(/^https?:\/\//, '')}</a><br>
    You are getting this email because you placed order #${orderNo(d.orderId)}.</span>`;

const textAddress = (d: PrintMailData) => shipLines(d.shipTo).map((l) => `  ${l}`).join('\n');

/* ------------------------------------------------------------------ receipt: "we will print it" */
export function printReceiptEmail(d: PrintMailData) {
  const subject = `Order confirmed: your printed ${d.toolName} · #${orderNo(d.orderId)}`;
  const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${hero(d, { eyebrow: 'Order confirmed', title: `Thank you${first(d) ? `, ${esc(first(d))}` : ''}.`,
      lede: `We will print your ${esc(d.toolName)} design <b style="color:#ffffff; font-weight:600;">&ldquo;${esc(d.designName)}&rdquo;</b>, put it together by hand and post it to you. We will email you as soon as it is on its way.`,
      cta: [accountUrl(d), 'See your order &rarr;'] })}
    ${steps(0)}
    <tr><td class="px" style="padding:22px 40px 8px;">
      ${label('Order details')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('Order', `<span style="font-family:${MONO};">#${orderNo(d.orderId)}</span>`)}
        ${row('Date', esc(dateIn(d.createdAt)))}
        ${row('Item', `${esc(d.toolName)}, printed`)}
        ${row('Design', esc(d.designName))}
        ${row('Paid', `<b style="font-weight:600;">${esc(paidLine(d))}</b><br><span style="font-size:13px; color:${C.ink3};">Shipping included</span>`, true)}
      </table>
    </td></tr>
    ${addressBox(d)}
    <tr><td class="px" style="padding:0 40px 32px; font:400 14px/1.65 ${SANS}; color:${C.ink2};">
      Each piece is printed to order, so please allow a few days for printing and then the post. Spotted a mistake in the address? Just reply to this email today.
    </td></tr>
  </table>`;
  const text = [
    `Thank you${first(d) ? `, ${first(d)}` : ''}.`, ``,
    `We will print your ${d.toolName} design "${d.designName}", put it together and post it to you. We will email you when it is on its way.`, ``,
    `Order:  #${orderNo(d.orderId)}`, `Date:   ${dateIn(d.createdAt)}`, `Paid:   ${paidLine(d)} (shipping included)`, ``,
    `Posting to:`, textAddress(d), ``,
    `Your order: ${accountUrl(d)}`, `Spotted a mistake in the address? Reply to this email today.`, ``, `MD Creations · ${d.siteUrl}`,
  ].join('\n');
  return { subject, html: frame({ preheader: `We will print “${d.designName}” and post it to you.`, body, foot: foot(d), siteUrl: d.siteUrl }), text };
}

/* ------------------------------------------------------------------ to the shop: "print this" */
export function printAlertEmail(d: PrintMailData) {
  const test = d.how === 'admin';
  const adminUrl = `${d.siteUrl}/admin/print-orders/${d.orderId}`;
  const subject = `${test ? 'Test print order' : `Print order ${d.amount}`} · ${d.toolName} · ${d.shipTo?.city ?? ''} ${d.shipTo?.pin ?? ''}`.replace(/\s+/g, ' ').trim();
  const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="background:${C.deep}; padding:30px 40px;">
      ${eyebrow(test ? 'Admin test · print order' : 'New print order')}
      <div class="h1" style="margin:10px 0 0; font:400 40px/1.1 ${SERIF}; color:#ffffff;">${esc(test ? 'Test order' : d.amount)}</div>
      <p style="margin:8px 0 0; font:400 15px/1.5 ${SANS}; color:#d9dbcd;">${esc(d.toolName)} &middot; &ldquo;${esc(d.designName)}&rdquo; &middot; to print and post</p>
    </td></tr>
    <tr><td class="px" style="padding:26px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('Customer', `${esc(d.customerName || '—')}<br><a href="mailto:${esc(d.customerEmail)}" style="color:${C.olive};">${esc(d.customerEmail)}</a>`)}
        ${row('Order', `<span style="font-family:${MONO};">#${orderNo(d.orderId)}</span>`)}
        ${row('When', esc(dateIn(d.createdAt)))}
        ${row('Paid', esc(paidLine(d)))}
        ${row('Files', d.fileReady ? 'Built: download them from the order page' : '<span style="color:#9b3b2a;">Not built yet: rebuild from the order page</span>', true)}
      </table>
    </td></tr>
    ${addressBox(d, 'Ship to')}
    <tr><td class="px" style="padding:0 40px 34px;">
      <table role="presentation" class="stack" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding:0 10px 10px 0;">${button(adminUrl, 'Open the order', true)}</td>
        <td style="padding:0 0 10px;">${button(`mailto:${esc(d.customerEmail)}?subject=${encodeURIComponent(`Your MD Creations order #${orderNo(d.orderId)}`)}`, 'Reply to customer')}</td>
      </tr></table>
    </td></tr>
  </table>`;
  const text = [
    `${test ? 'ADMIN TEST · ' : ''}NEW PRINT ORDER: ${d.amount || 'test'}`, `${d.toolName} · "${d.designName}"`, ``,
    `Customer: ${d.customerName || '—'} <${d.customerEmail}>`, `Order:    #${orderNo(d.orderId)}`, `When:     ${dateIn(d.createdAt)}`, ``,
    `Ship to:`, textAddress(d), ``, `Open the order (files, status): ${adminUrl}`,
  ].join('\n');
  return { subject, html: frame({ preheader: `Print and post “${d.designName}” to ${d.shipTo?.city ?? 'the customer'}.`, body, foot: `Sent to the order alert addresses in <a href="${d.siteUrl}/admin/settings" style="color:${C.ink2};">Admin &rarr; Settings</a>.`, siteUrl: d.siteUrl }), text };
}

/* ------------------------------------------------------------------ "it's on its way" */
export function printShippedEmail(d: PrintMailData) {
  const via = d.courier || 'India Post';
  const subject = `Your ${d.toolName} is on its way · #${orderNo(d.orderId)}`;
  const tracking = d.trackingNo
    ? row('Tracking number', `<span style="font-family:${MONO};">${esc(d.trackingNo)}</span>`, true)
    : '';
  const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${hero(d, { eyebrow: 'Shipped', title: 'It&rsquo;s on its way.',
      lede: `Your printed ${esc(d.toolName)} &ldquo;${esc(d.designName)}&rdquo; has left our workshop and is with ${esc(via)}.${d.trackingNo ? '' : ' It usually arrives within a week.'}`,
      cta: [accountUrl(d), 'See your order &rarr;'] })}
    ${steps(2)}
    <tr><td class="px" style="padding:22px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('Order', `<span style="font-family:${MONO};">#${orderNo(d.orderId)}</span>`)}
        ${row('Sent by', esc(via), !d.trackingNo)}
        ${tracking}
      </table>
    </td></tr>
    ${addressBox(d)}
    <tr><td class="px" style="padding:0 40px 32px; font:400 14px/1.65 ${SANS}; color:${C.ink2};">
      ${d.trackingNo && /india ?post|speed ?post/i.test(via) ? `You can follow it on <a href="https://www.indiapost.gov.in" style="color:${C.olive}; font-weight:600;">indiapost.gov.in</a> with the number above. ` : ''}If it has not reached you in 10 days, reply to this email and we will look into it.
    </td></tr>
  </table>`;
  const text = [
    `It's on its way.`, ``, `Your printed ${d.toolName} "${d.designName}" has left our workshop and is with ${via}.`,
    d.trackingNo ? `Tracking number: ${d.trackingNo}` : 'It usually arrives within a week.', ``, `Posting to:`, textAddress(d), ``,
    `Your order: ${accountUrl(d)}`, `Not there in 10 days? Reply to this email.`, ``, `MD Creations · ${d.siteUrl}`,
  ].filter((l) => l !== null).join('\n');
  return { subject, html: frame({ preheader: `Your printed ${d.toolName} is with ${via}.`, body, foot: foot(d), siteUrl: d.siteUrl }), text };
}

/* ------------------------------------------------------------------ delivered, with the feedback faces */
export function printDeliveredEmail(d: PrintMailData) {
  const faces: [number, string][] = [[1, '😞'], [2, '🙁'], [3, '😐'], [4, '🙂'], [5, '😍']];
  const subject = `Delivered: your ${d.toolName} · how do you like it?`;
  const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${hero(d, { eyebrow: 'Delivered', title: `Enjoy it${first(d) ? `, ${esc(first(d))}` : ''}.`,
      lede: `Your printed ${esc(d.toolName)} &ldquo;${esc(d.designName)}&rdquo; has been delivered. We hope it looks just the way you imagined.` })}
    ${steps(3)}
    <tr><td class="px" style="padding:26px 40px 34px; text-align:center;">
      <h2 style="margin:0; font:400 26px/1.2 ${SERIF}; color:${C.ink};">How do you like it?</h2>
      <p style="margin:8px 0 18px; font:400 14px/1.6 ${SANS}; color:${C.ink2};">One tap tells us. A photo of it in its new home would make our day too: just reply with it.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
        ${faces.map(([n, f]) => `
        <td align="center" style="padding:0 4px;">
          <a href="${d.feedbackUrl(n)}" style="display:block; width:54px; padding:10px 0 8px; border:1px solid ${C.line}; border-radius:4px; background:${C.paper3}; text-decoration:none;">
            <span style="display:block; font-size:26px; line-height:1;">${f}</span>
            <span style="display:block; padding-top:6px; font:500 9px/1.2 ${MONO}; color:${C.ink3};">${n}/5</span>
          </a>
        </td>`).join('')}
      </tr></table>
    </td></tr>
  </table>`;
  const text = [`Delivered.`, ``, `Your printed ${d.toolName} "${d.designName}" has been delivered.`, ``, `How do you like it? ${d.feedbackUrl()}`, ``, `MD Creations · ${d.siteUrl}`].join('\n');
  return { subject, html: frame({ preheader: `Your printed ${d.toolName} has been delivered.`, body, foot: foot(d), siteUrl: d.siteUrl }), text };
}
