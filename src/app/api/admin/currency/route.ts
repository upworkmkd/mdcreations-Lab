import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth.server';
import { ADMIN_CURRENCY_COOKIE, ADMIN_PAY_COOKIE } from '@/lib/catalog.server';
import { isCurrency } from '@/lib/money';

// Admins only: show the site in another currency to test prices and checkout. 'auto' goes back to the visitor's location.
export async function POST(req: Request) {
  const me = await getViewer();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { currency, payments } = (await req.json().catch(() => ({}))) as { currency?: string; payments?: string };
  const opts = { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' };
  // "Admin orders": 'real' goes through Razorpay like a customer, 'free' skips payment (the default)
  if (payments === 'real' || payments === 'free') {
    const res = NextResponse.json({ ok: true, payments });
    if (payments === 'real') res.cookies.set(ADMIN_PAY_COOKIE, '1', opts); else res.cookies.set(ADMIN_PAY_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }
  const res = NextResponse.json({ ok: true, currency: isCurrency(currency) ? currency : 'auto' });
  if (isCurrency(currency)) res.cookies.set(ADMIN_CURRENCY_COOKIE, currency, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  else res.cookies.set(ADMIN_CURRENCY_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
