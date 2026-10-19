'use server';
import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { trackServer } from '@/lib/track.server';
import type { FormState } from '@/app/login/actions';

/** A customer's review. It waits for the shop owner to publish it; buyers get a "Verified buyer" mark. */
export async function submitReview(_: FormState, form: FormData): Promise<FormState> {
  const v = await getViewer();
  if (!v) return { error: 'Please sign in again.' };
  const name = String(form.get('name') || '').trim().slice(0, 80), body = String(form.get('body') || '').trim().slice(0, 1000);
  if (!name) return { error: 'Please add the name to show with your review.' };
  if (body.length < 10) return { error: 'Please write at least a sentence.' };
  const rating = Math.min(5, Math.max(1, Number(form.get('rating')) || 5));
  const db = supabaseAdmin();
  const { count: recent } = await db.from('testimonials').select('id', { count: 'exact', head: true }).eq('user_id', v.id).gt('created_at', new Date(Date.now() - 86400_000).toISOString());
  if ((recent ?? 0) >= 3) return { error: 'Thank you! You have already sent a review today.' };
  const { count: paid } = await db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', v.id).in('status', ['paid', 'fulfilled']);
  const { error } = await db.from('testimonials').insert({
    user_id: v.id, name, place: String(form.get('place') || '').trim().slice(0, 80) || null, body, rating,
    tool_slug: 'shadow-lamp', verified: (paid ?? 0) > 0, source: 'site', status: 'pending',
  });
  if (error) return { error: 'Could not save your review. Please try again.' };
  await trackServer('review', { name: `${rating}★`, userId: v.id });
  revalidatePath('/admin/reviews');
  return { ok: true, message: 'Thank you! Your review will appear on the site once we have read it.' };
}
