import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fulfilOrder } from '@/lib/fulfil.server';

export const maxDuration = 60;

// Lets a buyer retry building the files of a paid order (for example after a time-out).
export async function POST(_req: Request, ctx: RouteContext<'/api/orders/[id]/fulfil'>) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  const { data: order } = await supabase.from('orders').select('id, status').eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  try {
    return NextResponse.json({ fileId: await fulfilOrder(order.id) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
