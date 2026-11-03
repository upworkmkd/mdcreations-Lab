import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { kitFor } from '@/lib/kits.server';
import { trackServer } from '@/lib/track.server';

export const maxDuration = 30;

// Saves a design for the signed-in visitor. The body carries the picture as a run-length mask, not the picture itself.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });

  let body: { tool?: string; design?: unknown; preview?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const tool = String(body.tool ?? ''), kit = kitFor(tool);
  if (!kit) return NextResponse.json({ error: 'Unknown tool.' }, { status: 400 });

  let design;
  try { design = kit.parse(body.design); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  const preview = typeof body.preview === 'string' && body.preview.startsWith('data:image/jpeg;base64,') && body.preview.length < 400_000 ? body.preview : null;

  const { data, error } = await supabase.from('designs')
    .insert({ user_id: auth.user.id, tool_slug: tool, name: design.name, params: design, preview })
    .select('id').single();
  if (error) {
    console.error('[designs] could not save a design for', tool, error.code, error.message);
    // the tool has no row in public.tools yet: its migration has not been run in this database
    if (error.code === '23503' && /tool_slug/.test(`${error.message} ${error.details ?? ''}`))
      return NextResponse.json({ error: `This tool is not set up in the database yet. Run its migration (supabase/migrations/…_tool_${tool.replace(/-/g, '_')}.sql) in the Supabase SQL editor, then try again.` }, { status: 500 });
    return NextResponse.json({ error: `Could not save the design (${error.code ?? 'database error'}). Please try again.` }, { status: 500 });
  }
  await trackServer('design_saved', { name: design.name, userId: auth.user.id, props: { designId: data.id, tool } });
  return NextResponse.json({ id: data.id });
}
