import 'server-only';
import { supabaseAdmin, FILES_BUCKET } from '@/lib/supabase/admin';
import { kitFor } from '@/lib/kits.server';
import { capturePayment, fetchPayment } from '@/lib/razorpay.server';
import { after } from 'next/server';
import { sendOrderEmails } from '@/lib/order-mail.server';

/** The receipt and the shop's note go out after the response, so the download is not kept waiting. */
function emailLater(orderId: string) {
  try { after(() => sendOrderEmails(orderId)); } catch { void sendOrderEmails(orderId); }
}

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

/**
 * A printed order: builds the same files, but for the shop only. They are kept privately under print/<order>/
 * (not in the customer's account) and the order moves to "To print". Idempotent. Returns ''.
 */
async function fulfilPrintOrder(order: { id: string; user_id: string; design_id: string; tool_slug: string; status: string; print_file: string | null; print_status: string | null }): Promise<string> {
  const db = supabaseAdmin();
  if (order.print_file) { emailLater(order.id); return ''; }   // built already; sends only what has not gone out yet
  const { data: design } = await db.from('designs').select('id, name, params, preview').eq('id', order.design_id).single();
  if (!design) throw new Error('The design for this order is missing.');
  try {
    const preview = typeof design.preview === 'string' && design.preview.startsWith('data:image/jpeg;base64,')
      ? new Uint8Array(Buffer.from(design.preview.slice(23), 'base64')) : null;
    const kit = kitFor(order.tool_slug);
    if (!kit) throw new Error('This tool cannot build files yet.');
    const built = await kit.build(kit.parse(design.params) as never, preview, { owner: 'MD Creations (printed order)', orderId: order.id });
    const path = `print/${order.id}/${built.fileName}`;
    const up = await db.storage.from(FILES_BUCKET).upload(path, built.zip, { contentType: 'application/zip', upsert: true });
    if (up.error) throw new Error('Could not store the files: ' + up.error.message);
    await db.from('orders').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString(), print_file: path, print_status: order.print_status ?? 'to_print', error: null }).eq('id', order.id);
    emailLater(order.id);
    return '';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // still paid and still to print: the shop sees the problem and can rebuild from the admin
    await db.from('orders').update({ error: msg.slice(0, 500), print_status: order.print_status ?? 'to_print' }).eq('id', order.id);
    emailLater(order.id);
    throw e;
  }
}

/** Builds the files for a paid order, stores them privately and returns the file id. Idempotent. */
export async function fulfilOrder(orderId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: head } = await db.from('orders').select('id, user_id, design_id, tool_slug, status, kind, print_file, print_status').eq('id', orderId).maybeSingle();
  if (head?.kind === 'print') {
    if (head.status !== 'paid' && head.status !== 'fulfilled') throw new Error('This order has not been paid.');
    return fulfilPrintOrder(head);
  }
  const existing = await db.from('files').select('id').eq('order_id', orderId).maybeSingle();
  if (existing.data) { emailLater(orderId); return existing.data.id; }   // sends only what has not gone out yet

  const { data: order, error } = await db.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error('Order not found.');
  if (order.status !== 'paid' && order.status !== 'fulfilled') throw new Error('This order has not been paid.');
  const { data: design } = await db.from('designs').select('id, name, params, preview').eq('id', order.design_id).single();
  if (!design) throw new Error('The design for this order is missing.');

  try {
    const preview = typeof design.preview === 'string' && design.preview.startsWith('data:image/jpeg;base64,')
      ? new Uint8Array(Buffer.from(design.preview.slice(23), 'base64')) : null;
    const { data: owner } = await db.from('profiles').select('email, full_name').eq('id', order.user_id).maybeSingle();
    const lic = { owner: [owner?.full_name, owner?.email ? `<${owner.email}>` : ''].filter(Boolean).join(' ') || undefined, orderId: order.id };
    const kit = kitFor(order.tool_slug);
    if (!kit) throw new Error('This tool cannot build files yet.');
    const built = await kit.build(kit.parse(design.params) as never, preview, lic);
    const path = `${order.user_id}/${order.id}/${built.fileName}`;
    const up = await db.storage.from(FILES_BUCKET).upload(path, built.zip, { contentType: 'application/zip', upsert: true });
    if (up.error) throw new Error('Could not store the files: ' + up.error.message);
    const ins = await db.from('files').upsert({
      user_id: order.user_id, order_id: order.id, design_id: design.id, tool_slug: order.tool_slug,
      name: built.fileName, storage_path: path, size_bytes: built.zip.length,
    }, { onConflict: 'order_id' }).select('id').single();
    if (ins.error || !ins.data) throw new Error('Could not save the file record.');
    await db.from('orders').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString(), error: null }).eq('id', order.id);
    emailLater(order.id);
    return ins.data.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from('orders').update({ error: msg.slice(0, 500) }).eq('id', order.id);
    throw e;
  }
}
