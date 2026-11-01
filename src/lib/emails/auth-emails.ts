/* Account emails: confirm your email, a sign-in link, a password reset. Sent by the site itself (through Resend or
 * SMTP), not by Supabase, so there is no hourly limit and every one is logged. Also the templates the admin picks
 * from in Users → a user → Send email. Text is plain (paragraphs on blank lines); the link is added as a button. */
import { C, SANS, button, esc, frame } from '@/lib/emails/order-emails';
import { textToHtml } from '@/lib/emails/note-email';

export type AuthLinkKind = 'confirm' | 'login' | 'reset';
export type TemplateId = AuthLinkKind | 'blank';

export const TEMPLATES: { id: TemplateId; label: string; note: string }[] = [
  { id: 'confirm', label: 'Email confirmation', note: 'Adds a “Confirm my email” button. Opening it confirms the account and signs them in.' },
  { id: 'login', label: 'Sign-in link', note: 'Adds a “Sign in” button that signs them in without a password (and confirms the email if needed).' },
  { id: 'reset', label: 'Password reset', note: 'Adds a “Choose a new password” button. It signs them in and opens the new-password page.' },
  { id: 'blank', label: 'Blank email', note: 'Your own subject and message, sent as a personal note. Links become clickable.' },
];

export const BUTTON: Record<AuthLinkKind, string> = { confirm: 'Confirm my email', login: 'Sign in to MD Creations Labs', reset: 'Choose a new password' };

const first = (n: string) => n.trim().split(/\s+/)[0] || '';

/** The ready text for each template; the admin can edit it before sending. */
export function templateDraft(id: TemplateId, name: string, signer = ''): { subject: string; body: string } {
  const hi = `Hi ${first(name) || 'there'},`;
  const sign = `Thanks,\n${first(signer) || 'The team'}\nMD Creations`;
  switch (id) {
    case 'confirm': return {
      subject: 'Confirm your email for MD Creations Labs',
      body: [hi, 'Thanks for creating an account on MD Creations Labs. Please confirm your email address with the button below, and you are ready to buy and download files.', '[button]', 'If you did not create this account, you can ignore this email.', sign].join('\n\n'),
    };
    case 'login': return {
      subject: 'Your sign-in link for MD Creations Labs',
      body: [hi, 'Here is a link to sign in to your MD Creations Labs account, no password needed. Your designs and files are waiting in your account.', '[button]', 'If you did not ask for this, you can ignore this email.', sign].join('\n\n'),
    };
    case 'reset': return {
      subject: 'Choose a new password for MD Creations Labs',
      body: [hi, 'Use the button below to choose a new password for your MD Creations Labs account.', '[button]', 'If you did not ask for this, you can ignore this email; your password stays the same.', sign].join('\n\n'),
    };
    default: return { subject: '', body: `${hi}\n\n\n\n${sign}` };
  }
}

/** Where the button goes: the line "[button]" in the text, or the end when that line was removed. */
export const BUTTON_MARK = /^[ \t]*\[button\][ \t]*$/m;

/** An email with the text and, for account emails, the button with the link (and the address written out under it). */
export function accountEmail(o: { subject: string; body: string; siteUrl: string; link?: { href: string; label: string } }) {
  const [before, ...rest] = o.body.split(BUTTON_MARK);
  const after = rest.join('\n\n').trim();
  const btn = o.link ? `
    <tr><td class="px" style="padding:4px 40px 8px;">${button(o.link.href, esc(o.link.label), true)}</td></tr>
    <tr><td class="px" style="padding:14px 40px ${after ? '22px' : '30px'}; font:400 13px/1.6 ${SANS}; color:${C.ink3};">
      The link works once. If the button does not open, copy this address into your browser:<br>
      <a href="${o.link.href}" style="color:${C.ink2}; word-break:break-all;">${esc(o.link.href)}</a>
    </td></tr>` : '';
  const body = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="padding:36px 40px ${o.link ? '12px' : '20px'};">${textToHtml(before)}</td></tr>${btn}
    ${after ? `<tr><td class="px" style="padding:0 40px 20px;">${textToHtml(after)}</td></tr>` : ''}
  </table>`;
  const foot = `MD Creations · <a href="${o.siteUrl}" style="color:${C.ink3};">${o.siteUrl.replace(/^https?:\/\//, '')}</a><br>Just reply to this email to write back.`;
  const plain = o.body.replace(BUTTON_MARK, o.link ? `${o.link.label}: ${o.link.href}` : '').replace(/\n{3,}/g, '\n\n').trim();
  const pre = plain.split('\n').find((l) => l.trim() && !/^(hi|hello|dear)\b/i.test(l.trim())) ?? o.subject;
  const text = `${plain}${o.link && !BUTTON_MARK.test(o.body) ? `\n\n${o.link.label}: ${o.link.href}` : ''}\n\n—\nMD Creations · ${o.siteUrl}`;
  return { subject: o.subject, html: frame({ preheader: pre.slice(0, 140), body, foot, siteUrl: o.siteUrl }), text };
}

/* ------------------------------------------------------------------ placeholders in admin emails */
export type Vars = { name: string; email: string; siteUrl: string };
type Ph = { key: string; label: string; value: (v: Vars) => string };
const firstOf = (v: Vars) => v.name.trim().split(/\s+/)[0] || 'there';

/** What the admin can write in a subject or message; each is replaced for the person the email goes to. */
export const PLACEHOLDERS: Ph[] = [
  { key: 'first_name', label: 'First name', value: firstOf },
  { key: 'name', label: 'Full name', value: (v) => v.name.trim() || firstOf(v) },
  { key: 'email', label: 'Their email', value: (v) => v.email },
  { key: 'login_url', label: 'Sign-in page', value: (v) => `${v.siteUrl}/login` },
  { key: 'signup_url', label: 'Create-account page', value: (v) => `${v.siteUrl}/signup` },
  { key: 'pricing_url', label: 'Plans and prices', value: (v) => `${v.siteUrl}/pricing` },
  { key: 'tools_url', label: 'All tools', value: (v) => `${v.siteUrl}/tools` },
  { key: 'stl_url', label: 'STL files shop', value: (v) => `${v.siteUrl}/stl-files` },
  { key: 'account_url', label: 'Their account', value: (v) => `${v.siteUrl}/account` },
];

/** Replaces the known placeholders ({first_name}, {pricing_url} …; spaces and case do not matter). */
export function fillPlaceholders(text: string, v: Vars) {
  return text.replace(/\{\s*([a-z_ ]{2,30}?)\s*\}/gi, (whole, k: string) => {
    const p = PLACEHOLDERS.find((x) => x.key === k.toLowerCase().replace(/\s+/g, '_'));
    return p ? p.value(v) : whole;
  });
}

/** Text in {braces} that is not a known placeholder: a note that was meant to be replaced by hand. */
export const unknownPlaceholders = (text: string) => [...new Set(text.match(/\{[^{}\n]{1,60}\}/g) ?? [])];
