import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import UAParser from 'ua-parser-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { CONSENT_COOKIE, NOTRACK_COOKIE } from '@/lib/consent';

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor|curl|wget|python-requests|axios|node-fetch|vercel-screenshot/i;
const VISIT = /^[a-z0-9-]{8,40}$/i;
const str = (v: unknown, n: number) => (typeof v === 'string' && v ? v.slice(0, n) : null);
const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : null);

// Cookieless page counts for visitors who have not accepted analytics cookies.
// Stores no IP, no city, no browser string and no lasting id: only the page, the referring domain,
// country, device type and browser/system names.
export async function POST(req: Request) {
  const none = new NextResponse(null, { status: 204 });
  if (!supabaseConfigured()) return none;
  const raw = await req.text();
  if (raw.length > 4000) return none;
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return none; }
  const visit = str(b.visit, 40);
  if (!visit || !VISIT.test(visit)) return none;
  const db = supabaseAdmin();

  // they accepted cookies during this visit: full tracking has it now, so drop the anonymous copy
  if (b.upgrade === true) { await db.from('anon_views').delete().eq('visit', visit); return none; }

  const jar = await cookies();
  if (jar.get(CONSENT_COOKIE)?.value === 'all' || jar.get(NOTRACK_COOKIE)) return none;   // full tracking, or the shop owner
  if (req.headers.get('sec-gpc') === '1' || req.headers.get('dnt') === '1') return none;  // the browser asks not to be tracked
  const ua = req.headers.get('user-agent') ?? '';
  if (BOT.test(ua)) return none;

  const type = b.type === 'leave' ? 'leave' : 'pageview';
  const path = str(b.path, 300);
  if (!path || !path.startsWith('/') || path.startsWith('/admin')) return none;
  let referrer = str(b.ref, 300);
  try { referrer = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : null; } catch { referrer = null; }
  const p = new UAParser(ua).getResult();
  await db.from('anon_views').insert({
    visit, type, path, title: type === 'pageview' ? str(b.title, 200) : null,
    referrer, utm_source: str(b.utm, 100),
    country: req.headers.get('x-vercel-ip-country'), device_type: p.device.type ?? 'desktop', browser: p.browser.name ?? null, os: p.os.name ?? null,
    seconds: type === 'leave' ? int(b.seconds, 86400) : null, scroll: type === 'leave' ? int(b.scroll, 100) : null,
  });
  return none;
}
