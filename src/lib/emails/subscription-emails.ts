/* The plan emails: a welcome for the subscriber and a note for the shop. Same look as the order emails. */
import { C, MONO, SANS, SERIF, button, esc, frame, row } from '@/lib/emails/order-emails';

export type SubMailData = {
  id: string; userId: string; customerName: string; customerEmail: string; planName: string; everyTool: boolean; toolName: string | null;
  dailyLimit: number | null; price: string; renews: string | null; startedAt: string; siteUrl: string; supportEmail: string;
  socials: readonly { name: string; url: string }[]; toolCount: number; feedbackUrl: (r?: number) => string;
};

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' }) : '');
const first = (d: SubMailData) => d.customerName.trim().split(/\s+/)[0] || '';

function features(d: SubMailData) {
  return [
    d.everyTool ? `Every tool on MD Creations Labs (${d.toolCount} today), including each new one as it launches` : `The ${d.toolName ?? 'tool you chose'}`,
    d.dailyLimit == null ? 'Unlimited designs, no daily limit' : `${d.dailyLimit} designs a day in total (the count starts again at midnight, India time)`,
    'A commercial license on every file: sell the prints, changed or not',
    'Every file kept in your account, to download again any time',
    'Cancel any time from your account; the plan runs to the end of the month you paid for',
  ];
}

export function subWelcomeEmail(d: SubMailData) {
  const faces: [number, string][] = [[1, '😞'], [2, '🙁'], [3, '😐'], [4, '🙂'], [5, '😍']];
  const subject = `Welcome to the ${d.planName} plan`;
  const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="background:${C.olive}; padding:40px 40px 36px;">
      <div style="font:500 11px/1.4 ${MONO}; letter-spacing:.18em; text-transform:uppercase; color:${C.light};">&#9679;&nbsp; Plan started</div>
      <h1 class="h1" style="margin:14px 0 0; font:400 36px/1.15 ${SERIF}; color:#ffffff;">Welcome${first(d) ? `, ${esc(first(d))}` : ''}.</h1>
      <p style="margin:14px 0 0; font:400 16px/1.6 ${SANS}; color:#e6e7dc;">Your <b style="color:#fff; font-weight:600;">${esc(d.planName)} plan</b> is active. Design as much as you like and download straight away, with no payment each time.</p>
      <div style="padding-top:26px;">${button(`${d.siteUrl}/#tools`, 'Start designing &rarr;')}</div>
    </td></tr>
    <tr><td class="px" style="padding:30px 40px 6px;">
      <div style="font:500 11px/1.4 ${MONO}; letter-spacing:.14em; text-transform:uppercase; color:${C.ink3}; padding-bottom:10px;">What your plan includes</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${features(d).map((f) => `<tr><td style="width:26px; vertical-align:top; padding:6px 0; font:600 15px/1.5 ${SANS}; color:${C.olive};">&#10003;</td><td style="padding:6px 0; font:400 15px/1.5 ${SANS}; color:${C.ink};">${esc(f)}</td></tr>`).join('')}
      </table>
    </td></tr>
    <tr><td class="px" style="padding:20px 40px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('Plan', esc(d.planName))}
        ${d.price ? row('Price', `${esc(d.price)} a month`) : ''}
        ${row('Started', esc(date(d.startedAt)))}
        ${d.renews ? row('Renews', esc(date(d.renews)), true) : ''}
      </table>
    </td></tr>
    <tr><td class="px" style="padding:16px 40px 28px; font:400 14px/1.65 ${SANS}; color:${C.ink2};">
      See your plan, today&rsquo;s designs left and your files in <a href="${d.siteUrl}/account#plan" style="color:${C.olive}; font-weight:600;">your account</a>. Razorpay emails a receipt for each monthly payment.
    </td></tr>
    <tr><td class="px" style="border-top:1px solid ${C.line}; padding:30px 40px 34px; text-align:center;">
      <h2 style="margin:0; font:400 26px/1.2 ${SERIF}; color:${C.ink};">How is it working for you?</h2>
      <p style="margin:8px 0 18px; font:400 14px/1.6 ${SANS}; color:${C.ink2};">After a few designs, one tap tells us. Missing a tool or a setting? Say so: it shapes what we build next.</p>
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
  const foot = `
    Questions about your plan? Just reply to this email or write to <a href="mailto:${d.supportEmail}" style="color:${C.ink2};">${d.supportEmail}</a>.<br>
    ${d.socials.map((s) => `<a href="${s.url}" style="color:${C.ink2}; text-decoration:none; font-weight:600;">${s.name}</a>`).join(' &nbsp;·&nbsp; ')}<br><br>
    <span style="color:${C.ink3};">MD Creations Labs · <a href="${d.siteUrl}" style="color:${C.ink3};">${d.siteUrl.replace(/^https?:\/\//, '')}</a><br>You are getting this email because you started the ${esc(d.planName)} plan.</span>`;
  const text = [
    `Welcome${first(d) ? `, ${first(d)}` : ''}.`, ``, `Your ${d.planName} plan is active.`, ``, `What it includes:`, ...features(d).map((f) => `- ${f}`), ``,
    d.price ? `Price: ${d.price} a month` : '', d.renews ? `Renews: ${date(d.renews)}` : '', ``,
    `Start designing: ${d.siteUrl}/#tools`, `Your plan: ${d.siteUrl}/account#plan`, ``, `How is it working for you? ${d.feedbackUrl()}`, ``, `MD Creations Labs · ${d.siteUrl}`,
  ].join('\n');
  return { subject, html: frame({ preheader: `Your ${d.planName} plan is active: design and download as much as you like.`, body, foot, siteUrl: d.siteUrl }), text };
}

export function subAdminEmail(d: SubMailData) {
  const subject = `New plan: ${d.planName}${d.price ? ` ${d.price}/month` : ''} · ${d.customerName || d.customerEmail}`;
  const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="background:${C.deep}; padding:30px 40px;">
      <div style="font:500 11px/1.4 ${MONO}; letter-spacing:.18em; text-transform:uppercase; color:${C.light};">&#9679;&nbsp; New plan</div>
      <div class="h1" style="margin:10px 0 0; font:400 40px/1.1 ${SERIF}; color:#ffffff;">${esc(d.planName)}${d.price ? ` &middot; ${esc(d.price)}` : ''}</div>
    </td></tr>
    <tr><td class="px" style="padding:26px 40px 30px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${row('Customer', `${esc(d.customerName || '—')}<br><a href="mailto:${esc(d.customerEmail)}" style="color:${C.olive};">${esc(d.customerEmail)}</a>`)}
        ${row('Covers', esc(d.everyTool ? 'Every tool' : d.toolName ?? '—'))}
        ${row('Renews', esc(date(d.renews) || '—'), true)}
      </table>
      <div style="padding-top:20px;">${button(`${d.siteUrl}/admin/users/${d.userId}`, 'Open customer', true)}</div>
    </td></tr>
  </table>`;
  return { subject, html: frame({ preheader: subject, body, foot: `Sent to the order alert addresses in Admin &rarr; Settings.`, siteUrl: d.siteUrl }), text: `${subject}\nCustomer: ${d.customerEmail}\n${d.siteUrl}/admin/users/${d.userId}` };
}
