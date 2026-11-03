/* "How did it turn out?": the personal note the shop writes, then five stars and a button that open the review
 * page (rating, a few words, photos). Same frame as the other emails. */
import { C, MONO, SANS, SERIF, button, esc, frame } from '@/lib/emails/order-emails';
import { textToHtml } from '@/lib/emails/note-email';

export function reviewRequestEmail(o: { subject: string; body: string; siteUrl: string; reviewUrl: (stars?: number) => string; preview?: string | null; designName?: string | null }) {
  const stars = [1, 2, 3, 4, 5];
  const html = frame({
    preheader: 'One tap on a star, a few words and a photo, if you have a minute.',
    siteUrl: o.siteUrl,
    foot: `MD Creations · <a href="${o.siteUrl}" style="color:${C.ink3};">${o.siteUrl.replace(/^https?:\/\//, '')}</a><br>Just reply to this email to write back.`,
    body: `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="padding:36px 40px 8px;">${textToHtml(o.body)}</td></tr>
    <tr><td class="px" style="padding:4px 40px 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper3}; border:1px solid ${C.line}; border-radius:6px;">
        <tr><td align="center" style="padding:26px 20px 28px;">
          <div style="font:500 11px/1.4 ${MONO}; letter-spacing:.16em; text-transform:uppercase; color:${C.ink3};">How did it turn out?</div>
          <h2 style="margin:8px 0 16px; font:400 26px/1.2 ${SERIF}; color:${C.ink};">Tap a star to start your review</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
            ${stars.map((n) => `<td style="padding:0 3px;"><a href="${o.reviewUrl(n)}" title="${n} of 5" style="display:block; font-size:34px; line-height:1; color:#c08a1e; text-decoration:none;">&#9733;</a></td>`).join('')}
          </tr></table>
          <p style="margin:14px 0 20px; font:400 14px/1.6 ${SANS}; color:${C.ink2};">A photo of your print helps other makers most${o.designName ? `, and we would love to see &ldquo;${esc(o.designName)}&rdquo;` : ''}.</p>
          ${button(o.reviewUrl(), 'Write a review with photos &rarr;', true)}
          <p style="margin:14px 0 0; font:400 12px/1.5 ${SANS}; color:${C.ink3};">No sign-in needed: the link is just for you.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>`,
  });
  return { subject: o.subject, html, text: `${o.body.trim()}\n\nWrite a review with photos: ${o.reviewUrl()}\n\n—\nMD Creations · ${o.siteUrl}` };
}
