import { NextResponse } from 'next/server';
import { isCurrency } from '@/lib/money';

// Remembers the visitor's currency choice for a year.
export async function POST(req: Request) {
  const form = await req.formData();
  const cur = form.get('currency'), back = String(form.get('back') || '/');
  const res = NextResponse.redirect(new URL(back.startsWith('/') ? back : '/', req.url), 303);
  if (isCurrency(cur)) res.cookies.set('cur', cur, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
