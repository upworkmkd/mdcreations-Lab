/* A personal, hand-written note in the site's frame: the follow-up emails the shop writes from the admin.
 * Deliberately simple (no big banner): it should read like a person wrote it, because one did. */
import { C, SANS, esc, frame } from '@/lib/emails/order-emails';

/** Plain text to HTML: paragraphs on blank lines, line breaks kept, web addresses made into links. */
export function textToHtml(text: string) {
  const link = (s: string) => s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, (u) => `<a href="${u}" style="color:${C.olive}; font-weight:600;">${u}</a>`);
  return text.trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px; font:400 16px/1.65 ${SANS}; color:${C.ink};">${link(esc(p)).replace(/\n/g, '<br>')}</p>`).join('');
}

export function noteEmail(o: { subject: string; body: string; siteUrl: string; supportEmail: string; preheader?: string }) {
  const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="padding:36px 40px 20px;">${textToHtml(o.body)}</td></tr>
  </table>`;
  const foot = `MD Creations · <a href="${o.siteUrl}" style="color:${C.ink3};">${o.siteUrl.replace(/^https?:\/\//, '')}</a><br>Just reply to this email to write back.`;
  const first = o.body.trim().split('\n').find((l) => l.trim() && !/^(hi|hello|dear)\b/i.test(l.trim())) ?? o.subject;
  return { subject: o.subject, html: frame({ preheader: o.preheader ?? first.slice(0, 140), body, foot, siteUrl: o.siteUrl }), text: `${o.body.trim()}\n\n—\nMD Creations · ${o.siteUrl}` };
}
