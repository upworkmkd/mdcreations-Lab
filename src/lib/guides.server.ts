import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { SHADOW_TUTORIAL } from '@/lib/youtube';

/** Tutorial videos shown on the tool pages and in the makers (Admin → Settings → Tutorial videos); our own video until another link is saved. */
export type Guides = { shadowVideo: string };

export async function getGuides(): Promise<Guides> {
  if (!supabaseConfigured()) return { shadowVideo: SHADOW_TUTORIAL };
  try {
    const { data } = await supabaseAdmin().from('site_settings').select('value').eq('key', 'guides').maybeSingle();
    const v = (data?.value ?? {}) as Partial<Guides>;
    return { shadowVideo: typeof v.shadowVideo === 'string' && v.shadowVideo ? v.shadowVideo : SHADOW_TUTORIAL };
  } catch { return { shadowVideo: SHADOW_TUTORIAL }; }
}

/** A YouTube (or other https) link, cleaned; '' to remove it; null when it is not a usable link. */
export function cleanVideoUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return null;
    return u.toString().slice(0, 300);
  } catch { return null; }
}
