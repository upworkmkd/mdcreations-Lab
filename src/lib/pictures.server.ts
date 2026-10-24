import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Private bucket for pictures visitors chose to share. Nothing in it is public. */
export const PICTURES_BUCKET = 'lab-pictures';
export const KEEP_DAYS = 10;

/** Removes shared pictures older than 10 days: the files and their rows. Never throws. */
export async function purgeExpiredPictures() {
  try {
    const db = supabaseAdmin();
    const { data } = await db.rpc('expired_pictures', { p_days: KEEP_DAYS, p_limit: 200 });
    const rows = (data ?? []) as { id: string; storage_path: string }[];
    if (!rows.length) return 0;
    await db.storage.from(PICTURES_BUCKET).remove(rows.map((r) => r.storage_path));
    await db.from('shared_pictures').delete().in('id', rows.map((r) => r.id));
    return rows.length;
  } catch { return 0; }
}

/** What the first bytes say the file is; the browser's own label is not trusted. */
export function sniffImage(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
