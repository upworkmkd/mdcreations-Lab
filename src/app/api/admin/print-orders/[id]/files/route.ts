import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth.server';
import { supabaseAdmin, FILES_BUCKET } from '@/lib/supabase/admin';
import { UUID_RE } from '@/lib/consent';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

// The files of a printed order, for the shop to print. Admins only.
export async function GET(_req: Request, ctx: RouteContext<'/api/admin/print-orders/[id]/files'>) {
  const me = await getViewer();
  const { id } = await ctx.params;
  if (!me || me.role !== 'admin' || !UUID_RE.test(id)) return new NextResponse('Not found', { status: 404, headers: PRIVATE });
  const db = supabaseAdmin();
  const { data: o } = await db.from('orders').select('print_file').eq('id', id).eq('kind', 'print').maybeSingle();
  if (!o?.print_file) return new NextResponse('The files have not been built yet.', { status: 404, headers: PRIVATE });
  const { data, error } = await db.storage.from(FILES_BUCKET).download(o.print_file);
  if (error || !data) return new NextResponse('Could not read the files.', { status: 500, headers: PRIVATE });
  const name = `print-${id.slice(0, 8).toUpperCase()}-${o.print_file.split('/').pop()}`;
  return new NextResponse(data.stream(), { headers: { ...PRIVATE, 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"` } });
}
