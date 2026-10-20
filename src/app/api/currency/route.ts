import { NextResponse } from 'next/server';
import { isCurrency } from '@/lib/money';

// Remembers a visitor's own currency choice for 30 days, together with the country it was made in:
// if they later visit from another country, the currency follows their location again.
export async function POST(req: Request) {
  const form = await req.formData();
  const cur = form.get('currency'), back = String(form.get('back') || '/');
  const res = NextResponse.redirect(new URL(back.startsWith('/') ? back : '/', req.url), 303);
  const country = req.headers.get('x-vercel-ip-country') ?? '';
  if (isCurrency(cur)) res.cookies.set('cur', `${cur}|${country}`, { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' });
  return res;
}
