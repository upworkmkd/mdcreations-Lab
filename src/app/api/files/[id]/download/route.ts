import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin, FILES_BUCKET } from '@/lib/supabase/admin';
import { trackServer } from '@/lib/track.server';

// Hands out a one-minute signed link to a file the visitor owns, and logs the download.
export async function GET(req: Request, ctx: RouteContext<'/api/files/[id]/download'>) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL(`/login?next=/account`, req.url));

  const { data: file } = await supabase.from('files').select('id, user_id, name, storage_path').eq('id', id).maybeSingle();
  if (!file || file.user_id !== auth.user.id) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

  const db = supabaseAdmin();
  const { data: link, error } = await db.storage.from(FILES_BUCKET).createSignedUrl(file.storage_path, 60, { download: file.name });
  if (error || !link) return NextResponse.json({ error: 'The file could not be opened. Please try again.' }, { status: 500 });
  await db.from('downloads').insert({ file_id: file.id, user_id: auth.user.id });
  await trackServer('download', { name: file.name, userId: auth.user.id, props: { fileId: file.id } });
  return NextResponse.redirect(link.signedUrl, 303);
}
