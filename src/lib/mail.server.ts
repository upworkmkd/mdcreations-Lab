import 'server-only';
import { SUPPORT_EMAIL } from '@/lib/env';

/* Sends email through whichever service is set up in the environment:
 *   Resend  – RESEND_API_KEY                                   (https://resend.com, free for 3,000 emails a month)
 *   SMTP    – SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS        (your mailbox host, Gmail with an app password, Brevo …)
 * The sender is EMAIL_FROM, e.g. "MD Creations Labs <orders@themdcreations.com>"; replies go to the support address.
 * With neither set, nothing is sent and the email is logged as skipped. */

export type Mail = { to: string | string[]; subject: string; html: string; text: string; replyTo?: string };
export type MailResult = { ok: true; id: string | null } | { ok: false; skipped?: boolean; error: string };

export function mailProvider(): 'resend' | 'smtp' | null {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_HOST) return 'smtp';
  return null;
}
export const mailFrom = () => process.env.EMAIL_FROM || `MD Creations Labs <${SUPPORT_EMAIL}>`;

export async function sendMail(m: Mail): Promise<MailResult> {
  const to = (Array.isArray(m.to) ? m.to : [m.to]).filter(Boolean);
  if (!to.length) return { ok: false, skipped: true, error: 'No address to send to.' };
  const provider = mailProvider();
  if (!provider) return { ok: false, skipped: true, error: 'Email is not set up (add RESEND_API_KEY or SMTP_HOST).' };
  const replyTo = m.replyTo || SUPPORT_EMAIL;
  try {
    if (provider === 'resend') {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: mailFrom(), to, subject: m.subject, html: m.html, text: m.text, reply_to: replyTo }),
        signal: AbortSignal.timeout(15_000),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!r.ok) return { ok: false, error: `Resend: ${j.message || r.statusText}` };
      return { ok: true, id: j.id ?? null };
    }
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(process.env.SMTP_PORT || 587);
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 20_000,
    });
    const info = await t.sendMail({ from: mailFrom(), to, subject: m.subject, html: m.html, text: m.text, replyTo });
    return { ok: true, id: info.messageId ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 400) };
  }
}
