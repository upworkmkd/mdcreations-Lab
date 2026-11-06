import 'server-only';
import { getViewer } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { SavedDesign } from '@/lib/saved-design';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The design to open for editing (?design=<id> on a maker page): the viewer's own design made with this tool.
 * Admins can open anyone's, to help a customer. Anything else gives null and the maker starts fresh.
 */
export async function loadSavedDesign(slug: string, id: unknown): Promise<SavedDesign | null> {
  const raw = Array.isArray(id) ? id[0] : id;
  if (typeof raw !== 'string' || !UUID.test(raw)) return null;
  const viewer = await getViewer(); if (!viewer) return null;
  let q = supabaseAdmin().from('designs').select('id, user_id, tool_slug, name, params, settings').eq('id', raw).eq('tool_slug', slug);
  if (viewer.role !== 'admin') q = q.eq('user_id', viewer.id);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, settings: (data.settings as SavedDesign['settings']) ?? null, params: (data.params as SavedDesign['params']) ?? {} };
}
