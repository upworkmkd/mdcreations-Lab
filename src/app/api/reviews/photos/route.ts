import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { sniffImage } from '@/lib/pictures.server';
import { MAX_REVIEW_PHOTOS } from '@/lib/review-photos';
import { trackServer } from '@/lib/track.server';

const noStore = { 'Cache-Control': 'no-store' };
const REVIEW_BUCKET = 'review-photos';
const MAX_BYTES = 3 * 1024 * 1024;

/** A photo for the signed-in customer's own review. It waits for the shop to approve it. */
export async function POST(req: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: 'Not set up yet.' }, { status: 503, headers: noStore });
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401, headers: noStore });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: noStore }); }
  const file = form.get('file');
  if (!(file instanceof Blob) || file.size < 100) return NextResponse.json({ error: 'Choose a photo.' }, { status: 400, headers: noStore });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That photo is too big (3 MB at most).' }, { status: 413, headers: noStore });
  const bytes = new Uint8Array(await file.arrayBuffer()), type = sniffImage(bytes);
  if (!type) return NextResponse.json({ error: 'That is not a JPG, PNG or WebP photo.' }, { status: 415, headers: noStore });

  const db = supabaseAdmin();
  const { data: review } = await db.from('testimonials').select('id').eq('user_id', v.id).eq('source', 'site').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!review) return NextResponse.json({ error: 'Write your review first, then add photos.' }, { status: 409, headers: noStore });
  const { count } = await db.from('review_photos').select('id', { count: 'exact', head: true }).eq('testimonial_id', review.id).neq('status', 'hidden');
  if ((count ?? 0) >= MAX_REVIEW_PHOTOS) return NextResponse.json({ error: `Up to ${MAX_REVIEW_PHOTOS} photos per review.` }, { status: 409, headers: noStore });

  const id = crypto.randomUUID(), ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${review.id}/${id}.${ext}`;
  const up = await db.storage.from(REVIEW_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (up.error) return NextResponse.json({ error: 'Could not save the photo. Please try again.' }, { status: 500, headers: noStore });
  const w = Number(form.get('w')) || null, h = Number(form.get('h')) || null;
  const { error } = await db.from('review_photos').insert({ id, testimonial_id: review.id, user_id: v.id, storage_path: path, width: w, height: h, bytes: bytes.length, sort: count ?? 0 });
  if (error) { await db.storage.from(REVIEW_BUCKET).remove([path]); return NextResponse.json({ error: 'Could not save the photo. Did the reviews migration run?' }, { status: 500, headers: noStore }); }
  await trackServer('review_photo', { name: 'Photo added to a review', userId: v.id, props: { review: review.id } });
  revalidatePath('/admin/reviews'); revalidatePath('/account');
  return NextResponse.json({ ok: true, id }, { headers: noStore });
}

/** The customer removes one of their own photos. */
export async function DELETE(req: Request) {
  const v = await getViewer();
  if (!v) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401, headers: noStore });
  const id = new URL(req.url).searchParams.get('id') ?? '';
  const db = supabaseAdmin();
  const { data: p } = await db.from('review_photos').select('id, storage_path').eq('id', id).eq('user_id', v.id).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore });
  await db.storage.from(REVIEW_BUCKET).remove([p.storage_path]);
  await db.from('review_photos').delete().eq('id', p.id);
  revalidatePath('/account'); revalidatePath('/admin/reviews');
  return NextResponse.json({ ok: true }, { headers: noStore });
}
