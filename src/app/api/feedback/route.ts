import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { getViewer } from '@/lib/auth.server';
import { trackServer, trackingIds } from '@/lib/track.server';
import { checkToken, feedbackToken, looksSpammy, turnstileOk } from '@/lib/feedback.server';

const PER_HOUR = 5;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,24}$/;
const noStore = { 'Cache-Control': 'no-store' };
const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n) : '');

/** A fresh form token, fetched when the popup opens. */
export async function GET() {
  return NextResponse.json({ token: feedbackToken() }, { headers: noStore });
}

export async function POST(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: 'Feedback is not set up yet.' }, { status: 503, headers: noStore });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400, headers: noStore }); }
  const h = await headers(), ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;

  // the hidden "website" field is invisible to people; bots fill it in. Pretend it worked so they do not retry.
  if (clean(b.website, 200)) return NextResponse.json({ ok: true }, { headers: noStore });
  const t = checkToken(b.token);
  if (t === 'fast') return NextResponse.json({ ok: false, error: 'That was quick! Please wait a moment and send again.' }, { status: 429, headers: noStore });
  if (t !== 'ok') return NextResponse.json({ ok: false, error: 'This form has expired. Please close it and open it again.' }, { status: 400, headers: noStore });
  if (!(await turnstileOk(b.turnstile, ip))) return NextResponse.json({ ok: false, error: 'Please complete the check and send again.' }, { status: 400, headers: noStore });

  const rating = Number(b.rating);
  const message = clean(b.message, 2000), name = clean(b.name, 80), email = clean(b.email, 160).toLowerCase();
  const tool = clean(b.tool, 40), page = clean(b.page, 300);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ ok: false, error: 'Pick how you feel first.' }, { status: 400, headers: noStore });
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: 'That email address does not look right.' }, { status: 400, headers: noStore });
  if (tool && !/^[a-z0-9-]+$/.test(tool)) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400, headers: noStore });
  if (looksSpammy(`${message} ${name}`)) return NextResponse.json({ ok: false, error: 'Please remove the links and send again.' }, { status: 400, headers: noStore });

  const db = supabaseAdmin();
  if (ip) {
    const { count } = await db.from('feedback').select('id', { count: 'exact', head: true }).eq('ip', ip).gt('created_at', new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= PER_HOUR) return NextResponse.json({ ok: false, error: 'Thanks, we have your feedback already. Try again in an hour.' }, { status: 429, headers: noStore });
  }
  const [viewer, ids] = await Promise.all([getViewer().catch(() => null), trackingIds()]);
  let visitorId: string | null = null;
  if (ids) { const { data } = await db.from('visitors').select('id').eq('id', ids.vid).maybeSingle(); visitorId = data?.id ?? null; }
  const { error } = await db.from('feedback').insert({
    rating, message: message || null, name: name || viewer?.name || null, email: email || viewer?.email || null,
    tool_slug: tool || null, page: page || null, visitor_id: visitorId, user_id: viewer?.id ?? null, ip, user_agent: (h.get('user-agent') ?? '').slice(0, 400),
  });
  if (error) { console.error('feedback insert', error); return NextResponse.json({ ok: false, error: 'Could not send it just now. Please try again.' }, { status: 500, headers: noStore }); }
  await trackServer('feedback', { name: `${rating}/5${tool ? ` · ${tool}` : ''}`, userId: viewer?.id ?? null, path: page || undefined, props: { rating } });
  return NextResponse.json({ ok: true }, { headers: noStore });
}
