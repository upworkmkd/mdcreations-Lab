import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trackServer } from '@/lib/track.server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  await trackServer('signout', { name: 'Signed out', userId: (data?.claims?.sub as string) ?? null });
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', req.url), 303);
}
