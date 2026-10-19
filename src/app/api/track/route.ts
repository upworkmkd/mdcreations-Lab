import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import UAParser from 'ua-parser-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { CONSENT_COOKIE, CONSENT_VERSION, SESSION_COOKIE, UUID_RE, VISITOR_COOKIE } from '@/lib/consent';

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|axios|node-fetch|vercel-screenshot/i;
const str = (v: unknown, n: number) => (typeof v === 'string' && v ? v.slice(0, n) : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const head = (h: Headers, k: string) => { const v = h.get(k); if (!v) return null; try { return decodeURIComponent(v); } catch { return v; } };

type InEvent = { type?: unknown; name?: unknown; path?: unknown; title?: unknown; props?: unknown; ts?: unknown };

// Receives batches of activity from the browser tracker (fetch or sendBeacon). Only runs for visitors who accepted analytics cookies.
export async function POST(req: Request) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 204 });
  const jar = await cookies();
  if (jar.get(CONSENT_COOKIE)?.value !== 'all') return new NextResponse(null, { status: 204 });
  const vid = jar.get(VISITOR_COOKIE)?.value, sid = jar.get(SESSION_COOKIE)?.value;
  if (!vid || !sid || !UUID_RE.test(vid) || !UUID_RE.test(sid)) return new NextResponse(null, { status: 204 });

  const ua = req.headers.get('user-agent') ?? '';
  if (BOT.test(ua)) return new NextResponse(null, { status: 204 });

  const raw = await req.text();
  if (raw.length > 100_000) return new NextResponse(null, { status: 413 });
  let body: { events?: InEvent[]; ctx?: Record<string, unknown>; session?: Record<string, unknown> };
  try { body = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }

  const events = (Array.isArray(body.events) ? body.events : []).slice(0, 80).flatMap((e) => {
    const type = str(e?.type, 32); if (!type) return [];
    let props = e.props && typeof e.props === 'object' ? e.props : {};
    if (JSON.stringify(props).length > 3000) props = { truncated: true };
    return [{ type, name: str(e.name, 160), path: str(e.path, 500), title: str(e.title, 200), props, ts: str(e.ts, 40) }];
  });
  if (!events.length) return new NextResponse(null, { status: 204 });

  // who: signed-in account, if any (read from the session cookie, no network call)
  let uid: string | null = null;
  try { const { data } = await (await createClient()).auth.getClaims(); uid = (data?.claims?.sub as string) ?? null; } catch { /* anonymous */ }

  const h = req.headers;
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
  const p = new UAParser(ua).getResult();
  const c = body.ctx ?? {}, s = body.session ?? {};
  const payload = {
    vid, sid, uid, ip, consent: CONSENT_VERSION,
    country: head(h, 'x-vercel-ip-country'), region: head(h, 'x-vercel-ip-country-region'), city: head(h, 'x-vercel-ip-city'),
    lat: Number(h.get('x-vercel-ip-latitude')) || null, lon: Number(h.get('x-vercel-ip-longitude')) || null,
    ua: ua.slice(0, 500), browser: p.browser.name ?? null, browser_version: p.browser.version ?? null,
    os: p.os.name ?? null, os_version: p.os.version ?? null, device_type: p.device.type ?? 'desktop',
    device_vendor: p.device.vendor ?? null, device_model: p.device.model ?? null,
    ctx: {
      lang: str(c.lang, 20), langs: str(c.langs, 120), tz: str(c.tz, 60) ?? head(h, 'x-vercel-ip-timezone'),
      screen: str(c.screen, 20), viewport: str(c.viewport, 20), dpr: num(c.dpr), scheme: str(c.scheme, 10),
      touch: typeof c.touch === 'boolean' ? c.touch : null, cores: num(c.cores), memory: num(c.memory), net: str(c.net, 20),
    },
    session: {
      referrer: str(s.referrer, 500), landing: str(s.landing, 500), utm_source: str(s.utm_source, 100), utm_medium: str(s.utm_medium, 100),
      utm_campaign: str(s.utm_campaign, 100), utm_term: str(s.utm_term, 100), utm_content: str(s.utm_content, 100),
    },
    events,
  };
  const { error } = await supabaseAdmin().rpc('track_ingest', { p: payload });
  if (error) console.error('track_ingest', error.message);
  return new NextResponse(null, { status: 204 });
}
