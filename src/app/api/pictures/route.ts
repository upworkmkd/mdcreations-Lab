import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { getViewer } from '@/lib/auth.server';
import { trackServer, trackingIds } from '@/lib/track.server';
import { PICTURES_BUCKET, purgeExpiredPictures, sniffImage } from '@/lib/pictures.server';

const MAX_BYTES = 3 * 1024 * 1024, PER_HOUR = 20;
const TOOL_RE = /^[a-z0-9-]{1,40}$/;
const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

// Saves a copy of a picture the visitor chose to share ("Help improve this tool" ticked under the upload).
// The browser sends a shrunk JPEG; it is kept in a private bucket for 10 days and only admins can see it.
export async function POST(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503, headers: noStore });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: noStore }); }
  const file = form.get('file'), tool = String(form.get('tool') ?? ''), name = String(form.get('name') ?? '').replace(/[^\p{L}\p{N} _.-]+/gu, ' ').trim().slice(0, 120);
  if (form.get('consent') !== 'yes' || !(file instanceof Blob) || !TOOL_RE.test(tool)) return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: noStore });
  if (file.size > MAX_BYTES || file.size < 100) return NextResponse.json({ error: 'Too big' }, { status: 413, headers: noStore });
  const bytes = new Uint8Array(await file.arrayBuffer()), type = sniffImage(bytes);
  if (!type) return NextResponse.json({ error: 'Not a picture' }, { status: 415, headers: noStore });

  const h = await headers(), ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
  const db = supabaseAdmin();
  if (ip) {
    const { count } = await db.from('shared_pictures').select('id', { count: 'exact', head: true }).eq('ip', ip).gt('created_at', new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= PER_HOUR) return NextResponse.json({ error: 'Slow down' }, { status: 429, headers: noStore });
  }
  const [viewer, ids] = await Promise.all([getViewer().catch(() => null), trackingIds()]);
  let visitorId: string | null = null;
  if (ids) { const { data } = await db.from('visitors').select('id').eq('id', ids.vid).maybeSingle(); visitorId = data?.id ?? null; }

  const d = new Date(), id = crypto.randomUUID(), ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${id}.${ext}`;
  const up = await db.storage.from(PICTURES_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (up.error) return NextResponse.json({ error: 'Could not save' }, { status: 500, headers: noStore });
  const w = Number(form.get('w')) || null, hgt = Number(form.get('h')) || null;
  const { error } = await db.from('shared_pictures').insert({ id, visitor_id: visitorId, user_id: viewer?.id ?? null, tool, name: name || null, width: w, height: hgt, bytes: bytes.length, storage_path: path, ip });
  if (error) { await db.storage.from(PICTURES_BUCKET).remove([path]); return NextResponse.json({ error: 'Could not save' }, { status: 500, headers: noStore }); }
  await trackServer('picture_kept', { name: tool, userId: viewer?.id ?? null, props: { picture: id, kb: Math.round(bytes.length / 1024) } });
  void purgeExpiredPictures();
  return NextResponse.json({ ok: true }, { headers: noStore });
}
