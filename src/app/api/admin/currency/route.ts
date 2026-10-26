import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth.server';
import { ADMIN_CURRENCY_COOKIE } from '@/lib/catalog.server';
import { isCurrency } from '@/lib/money';

// Admins only: show the site in another currency to test prices and checkout. 'auto' goes back to the visitor's location.
export async function POST(req: Request) {
  const me = await getViewer();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { currency } = (await req.json().catch(() => ({}))) as { currency?: string };
  const res = NextResponse.json({ ok: true, currency: isCurrency(currency) ? currency : 'auto' });
  if (isCurrency(currency)) res.cookies.set(ADMIN_CURRENCY_COOKIE, currency, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  else res.cookies.set(ADMIN_CURRENCY_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
