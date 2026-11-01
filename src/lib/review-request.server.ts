import { itemOf } from '@/lib/stl/product';
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SITE_URL } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';

/* The review link in a "how did it turn out?" email: signed for one order, so the customer can rate it, write a
 * few words and add photos without signing in. */

const secret = () => process.env.FEEDBACK_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'mdl-dev-feedback';
export const reviewToken = (orderId: string) => createHmac('sha256', secret()).update(`review:${orderId}`).digest('base64url').slice(0, 32);
export function reviewTokenOk(orderId: string, t: unknown) {
  if (typeof t !== 'string') return false;
  const want = Buffer.from(reviewToken(orderId)), got = Buffer.from(t);
  return want.length === got.length && timingSafeEqual(want, got);
}
export const reviewUrl = (orderId: string, stars?: number) => `${SITE_URL}/review/${orderId}?t=${reviewToken(orderId)}${stars ? `&r=${stars}` : ''}`;

/** The order behind a review link, and the review its customer already wrote (one per customer). */
export async function reviewContext(orderId: string) {
  const db = supabaseAdmin();
  const { data: o } = await db.from('orders').select('id, user_id, tool_slug, kind, status, print_status, created_at, designs(name, preview), stl_products(title, images)').eq('id', orderId).maybeSingle();
  if (!o) return null;
  const [{ data: who }, { data: review }] = await Promise.all([
    db.from('profiles').select('email, full_name').eq('id', o.user_id).maybeSingle(),
    db.from('testimonials').select('id, rating, body, name, place, status').eq('user_id', o.user_id).eq('source', 'site').maybeSingle(),
  ]);
  const { data: photos } = review ? await db.from('review_photos').select('id, status').eq('testimonial_id', review.id).order('sort') : { data: [] };
  const it = itemOf(o), d = it.name ? { name: it.name, preview: it.preview } : null;   // a design, or an STL shop product
  return { order: o, design: d, who, review, photos: photos ?? [] };
}
