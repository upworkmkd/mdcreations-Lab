import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';

/** Tutorial videos shown in the tools' help (Admin → Settings → Tutorial videos). Empty until a link is saved. */
export type Guides = { shadowVideo: string };

export async function getGuides(): Promise<Guides> {
  if (!supabaseConfigured()) return { shadowVideo: '' };
  try {
    const { data } = await supabaseAdmin().from('site_settings').select('value').eq('key', 'guides').maybeSingle();
    const v = (data?.value ?? {}) as Partial<Guides>;
    return { shadowVideo: typeof v.shadowVideo === 'string' ? v.shadowVideo : '' };
  } catch { return { shadowVideo: '' }; }
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
