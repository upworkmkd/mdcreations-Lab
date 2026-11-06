import 'server-only';
import { getViewer } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { KeptPicture, SavedDesign } from '@/lib/saved-design';
import { PICTURES_BUCKET } from '@/lib/pictures.server';

/** Pictures that could be ours: kept for this user and tool in the day before the design was saved. */
const KEPT_TOOLS: Record<string, { picture: string; plate?: string }> = { 'shadow-lamp': { picture: 'shadow-lamp', plate: 'shadow-lamp-plate' } };
const clean = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Older designs kept only what the files are built from (for a lamp, the black-and-white shadow). When the visitor
 * ticked "Keep a copy of my picture", the picture they uploaded is still with us for 10 days: find it, so the maker
 * can show the real picture again. The one whose file name matches the design name wins, else the latest before it.
 */
async function keptPicture(userId: string, tool: string, before: string, name: string): Promise<KeptPicture | null> {
  const db = supabaseAdmin(), t = new Date(before).getTime();
  const { data } = await db.from('shared_pictures').select('name, storage_path, created_at').eq('user_id', userId).eq('tool', tool)
    .lte('created_at', new Date(t + 60_000).toISOString()).gte('created_at', new Date(t - 86400_000).toISOString()).order('created_at', { ascending: false }).limit(10);
  if (!data?.length) return null;
  const want = clean(name), row = data.find((r) => want && clean(r.name) === want) ?? data[0];
  const { data: blob } = await db.storage.from(PICTURES_BUCKET).download(row.storage_path);
  if (!blob) return null;
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return { url: `data:${type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`, name: row.name || 'Your picture' };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The design to open for editing (?design=<id> on a maker page): the viewer's own design made with this tool.
 * Admins can open anyone's, to help a customer. Anything else gives null and the maker starts fresh.
 */
export async function loadSavedDesign(slug: string, id: unknown): Promise<SavedDesign | null> {
  const raw = Array.isArray(id) ? id[0] : id;
  if (typeof raw !== 'string' || !UUID.test(raw)) return null;
  const viewer = await getViewer(); if (!viewer) return null;
  let q = supabaseAdmin().from('designs').select('id, user_id, tool_slug, name, params, settings, created_at').eq('id', raw).eq('tool_slug', slug);
  if (viewer.role !== 'admin') q = q.eq('user_id', viewer.id);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;
  const settings = (data.settings as SavedDesign['settings']) ?? null, params = (data.params as SavedDesign['params']) ?? {};
  let kept: SavedDesign['kept'] = null;
  const k = KEPT_TOOLS[slug];
  if (!settings && k) {
    const ownPlate = Boolean((params.plate as { own?: unknown } | null)?.own);
    const [picture, plate] = await Promise.all([
      keptPicture(data.user_id, k.picture, data.created_at, data.name).catch(() => null),
      ownPlate && k.plate ? keptPicture(data.user_id, k.plate, data.created_at, '').catch(() => null) : null,
    ]);
    kept = picture || plate ? { picture, plate } : null;
  }
  return { id: data.id, name: data.name, settings, params, kept };
}
