import { NextResponse } from 'next/server';
import { runAutomation } from '@/lib/automation.server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * The daily email job (review requests and follow-ups, as set in Admin → Settings). Vercel runs it on the schedule
 * in vercel.json and sends "Authorization: Bearer <CRON_SECRET>"; any other caller is turned away.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  const r = await runAutomation({ trigger: 'cron' });
  return NextResponse.json(r);
}
