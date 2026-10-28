import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/consent';
import { PICTURES_BUCKET } from '@/lib/pictures.server';

// A shared picture, for admins only. Never cached and never indexed (the bucket itself is private).
const PRIVATE = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow, noarchive, noimageindex', 'Referrer-Policy': 'no-referrer' };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getViewer();
  if (!me || me.role !== 'admin') return new NextResponse('Not found', { status: 404, headers: PRIVATE });
  if (!UUID_RE.test(id)) return new NextResponse('Not found', { status: 404, headers: PRIVATE });
  const db = supabaseAdmin();
  const { data: row } = await db.from('shared_pictures').select('storage_path, name, tool').eq('id', id).maybeSingle();
  if (!row) return new NextResponse('Not found', { status: 404, headers: PRIVATE });
  const { data, error } = await db.storage.from(PICTURES_BUCKET).download(row.storage_path);
  if (error || !data) return new NextResponse('Not found', { status: 404, headers: PRIVATE });
  const ext = row.storage_path.split('.').pop() ?? 'jpg', dl = new URL(req.url).searchParams.has('download');
  return new NextResponse(data, { headers: { ...PRIVATE, 'Content-Type': data.type || 'image/jpeg',
    'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="${(row.name || row.tool).replace(/[^\w .-]+/g, '_')}.${ext}"` } });
}
