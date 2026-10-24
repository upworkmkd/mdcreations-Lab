import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// A form token: the time the form was shown, signed by the server. A bot that posts straight away, replays an old
// form or makes one up is turned away without the visitor ever seeing a puzzle.
const MIN_MS = 3_000, MAX_MS = 6 * 3600_000;
const secret = () => process.env.FEEDBACK_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'mdl-dev-feedback';
const sign = (ts: string) => createHmac('sha256', secret()).update(`feedback:${ts}`).digest('base64url');

export function feedbackToken() { const ts = String(Date.now()); return `${ts}.${sign(ts)}`; }

export function checkToken(token: unknown): 'ok' | 'fast' | 'bad' {
  if (typeof token !== 'string') return 'bad';
  const [ts, sig] = token.split('.');
  if (!ts || !sig || !/^\d{13}$/.test(ts)) return 'bad';
  const want = Buffer.from(sign(ts)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return 'bad';
  const age = Date.now() - Number(ts);
  if (age < MIN_MS) return 'fast';
  return age > MAX_MS ? 'bad' : 'ok';
}

/** Cloudflare Turnstile, only when its keys are set (TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY). */
export async function turnstileOk(response: unknown, ip: string | null) {
  const key = process.env.TURNSTILE_SECRET_KEY;
  if (!key) return true;
  if (typeof response !== 'string' || !response) return false;
  try {
    const body = new URLSearchParams({ secret: key, response, ...(ip ? { remoteip: ip } : {}) });
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return Boolean(((await r.json()) as { success?: boolean }).success);
  } catch { return false; }
}

/** Looks like spam: many links, or the same character over and over. */
export function looksSpammy(text: string) {
  const links = (text.match(/https?:\/\/|www\.|\.(ru|xyz|top|click|link)\b/gi) ?? []).length;
  return links > 2 || /(.)\1{14,}/.test(text);
}
