import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { SALE_MAX } from '@/lib/sale';

/** The sale percentage from Admin → Settings → Sale (0 = no sale). Read once per request. */
export const getSalePercent = cache(async (): Promise<number> => {
  if (!supabaseConfigured()) return 0;
  try {
    const { data } = await supabaseAdmin().from('site_settings').select('value').eq('key', 'sale').maybeSingle();
    const p = Number((data?.value as { percent?: unknown } | null)?.percent ?? 0);
    return Number.isFinite(p) && p > 0 ? Math.min(SALE_MAX, p) : 0;
  } catch { return 0; }
});
