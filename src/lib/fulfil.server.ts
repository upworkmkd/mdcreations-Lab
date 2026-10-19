import 'server-only';
import { supabaseAdmin, FILES_BUCKET } from '@/lib/supabase/admin';
import { parseDesign } from '@/lib/lamp/design';
import { buildLampZip } from '@/lib/lamp/build.server';
import { capturePayment, fetchPayment } from '@/lib/razorpay.server';

type OrderRow = { id: string; user_id: string; design_id: string; tool_slug: string; status: string; amount_minor: number; currency: string; provider_order_id: string | null };

/** Records a Razorpay payment against our order. Safe to call more than once for the same payment. */
export async function recordPayment(order: OrderRow, paymentId: string) {
  let pay = await fetchPayment(paymentId);
  if (pay.order_id !== order.provider_order_id) throw new Error('This payment belongs to a different order.');
  if (pay.amount !== order.amount_minor || pay.currency !== order.currency) throw new Error('The amount paid does not match the order.');
  if (pay.status === 'authorized') pay = await capturePayment(pay.id, pay.amount, pay.currency);
  if (pay.status !== 'captured') throw new Error(`Payment is ${pay.status}.`);
  const db = supabaseAdmin();
  await db.from('payments').upsert({
    order_id: order.id, user_id: order.user_id, provider_payment_id: pay.id, amount_minor: pay.amount, currency: pay.currency, status: pay.status, method: pay.method ?? null,
  }, { onConflict: 'provider_payment_id' });
  await db.from('orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'created');
}

/** Builds the files for a paid order, stores them privately and returns the file id. Idempotent. */
export async function fulfilOrder(orderId: string): Promise<string> {
  const db = supabaseAdmin();
  const existing = await db.from('files').select('id').eq('order_id', orderId).maybeSingle();
  if (existing.data) return existing.data.id;

  const { data: order, error } = await db.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error('Order not found.');
  if (order.status !== 'paid' && order.status !== 'fulfilled') throw new Error('This order has not been paid.');
  const { data: design } = await db.from('designs').select('id, name, params, preview').eq('id', order.design_id).single();
  if (!design) throw new Error('The design for this order is missing.');

  try {
    if (order.tool_slug !== 'shadow-lamp') throw new Error('This tool cannot build files yet.');
    const d = parseDesign(design.params);
    const preview = typeof design.preview === 'string' && design.preview.startsWith('data:image/jpeg;base64,')
      ? new Uint8Array(Buffer.from(design.preview.slice(23), 'base64')) : null;
    const { data: owner } = await db.from('profiles').select('email, full_name').eq('id', order.user_id).maybeSingle();
    const built = await buildLampZip(d, preview, { owner: [owner?.full_name, owner?.email ? `<${owner.email}>` : ''].filter(Boolean).join(' ') || undefined, orderId: order.id });
    const path = `${order.user_id}/${order.id}/${built.fileName}`;
    const up = await db.storage.from(FILES_BUCKET).upload(path, built.zip, { contentType: 'application/zip', upsert: true });
    if (up.error) throw new Error('Could not store the files: ' + up.error.message);
    const ins = await db.from('files').upsert({
      user_id: order.user_id, order_id: order.id, design_id: design.id, tool_slug: order.tool_slug,
      name: built.fileName, storage_path: path, size_bytes: built.zip.length,
    }, { onConflict: 'order_id' }).select('id').single();
    if (ins.error || !ins.data) throw new Error('Could not save the file record.');
    await db.from('orders').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString(), error: null }).eq('id', order.id);
    return ins.data.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from('orders').update({ error: msg.slice(0, 500) }).eq('id', order.id);
    throw e;
  }
}
