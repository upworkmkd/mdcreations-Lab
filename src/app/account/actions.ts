'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { trackServer } from '@/lib/track.server';
import type { FormState } from '@/app/login/actions';

/**
 * A customer's review: one per account, open once they have made at least one design.
 * It waits for the shop owner to publish it; paying customers get a "Verified buyer" mark.
 */
export async function submitReview(_: FormState, form: FormData): Promise<FormState> {
  const v = await getViewer();
  if (!v) return { error: 'Please sign in again.' };
  const name = String(form.get('name') || '').trim().slice(0, 80), body = String(form.get('body') || '').trim().slice(0, 1000);
  const rating = Math.round(Number(form.get('rating')));
  if (!(rating >= 1 && rating <= 5)) return { error: 'Please choose a star rating.' };
  if (!name) return { error: 'Please add the name to show with your review.' };
  if (body.length < 10) return { error: 'Please write at least a sentence.' };
  const db = supabaseAdmin();
  const [{ count: mine }, { count: made }, { count: paid }] = await Promise.all([
    db.from('testimonials').select('id', { count: 'exact', head: true }).eq('user_id', v.id).eq('source', 'site'),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', v.id).eq('status', 'fulfilled'),
    db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', v.id).eq('status', 'fulfilled').gt('amount_minor', 0),
  ]);
  if ((mine ?? 0) > 0) return { error: 'You have already sent us a review. Thank you!' };
  if (!made) return { error: 'You can write a review once you have made your first design.' };
  const { error } = await db.from('testimonials').insert({
    user_id: v.id, name, place: String(form.get('place') || '').trim().slice(0, 80) || null, body, rating,
    tool_slug: String(form.get('tool') || 'shadow-lamp'), verified: (paid ?? 0) > 0 || (made ?? 0) > 0, source: 'site', status: 'pending',
  });
  if (error) return { error: error.code === '23505' ? 'You have already sent us a review. Thank you!' : 'Could not save your review. Please try again.' };
  await trackServer('review', { name: `${rating}★`, userId: v.id, props: { rating } });
  revalidatePath('/admin/reviews');
  // with photos to follow, the page must stay as it is until they are up (the browser sends them next)
  if (!Number(form.get('photos'))) revalidatePath('/account');
  return { ok: true, message: 'Thank you! Your review will appear on the site once we have read it.' };
}
