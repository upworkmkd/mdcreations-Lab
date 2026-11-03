import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/consent';

/**
 * A review photo. Approved photos of published reviews are public (and cached); anything else only for admins and
 * the customer who took it. Photos live in a private bucket, so this is the only way to see them.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return new NextResponse('Not found', { status: 404 });
  const db = supabaseAdmin();
  const { data: p } = await db.from('review_photos').select('storage_path, status, user_id, testimonials(status)').eq('id', id).maybeSingle();
  if (!p) return new NextResponse('Not found', { status: 404 });
  const t = (Array.isArray(p.testimonials) ? p.testimonials[0] : p.testimonials) as { status: string } | null;
  const isPublic = p.status === 'published' && t?.status === 'published';
  if (!isPublic) {
    const v = await getViewer().catch(() => null);
    if (!v || (v.role !== 'admin' && v.id !== p.user_id)) return new NextResponse('Not found', { status: 404 });
  }
  const { data, error } = await db.storage.from('review-photos').download(p.storage_path);
  if (error || !data) return new NextResponse('Not found', { status: 404 });
  const type = p.storage_path.endsWith('.png') ? 'image/png' : p.storage_path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return new NextResponse(data.stream(), {
    headers: { 'Content-Type': type, 'Cache-Control': isPublic ? 'public, max-age=86400, stale-while-revalidate=604800' : 'private, no-store', ...(isPublic ? {} : { 'X-Robots-Tag': 'noindex' }) },
  });
}
