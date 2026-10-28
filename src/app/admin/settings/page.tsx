import { requireAdmin } from '@/lib/auth.server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { mailFrom, mailProvider, replyAddress } from '@/lib/mail.server';
import { getEmailSettings, getShopSettings, sampleMailData } from '@/lib/order-mail.server';
import { adminOrderEmail, customerOrderEmail } from '@/lib/emails/order-emails';
import { Card, Empty, PageHead, ago, when } from '../ui';
import { EmailSettingsForm, ShopForm, TestButton } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

const KIND: Record<string, string> = { order_customer: 'Receipt', order_admin: 'Order alert', test: 'Test', print_customer: 'Printed order receipt', print_admin: 'Print order alert', print_printing: 'Printing', print_shipped: 'Shipped', print_tracking: 'Tracking number', print_delivered: 'Delivered', print_cancelled: 'Cancelled' };

export default async function Settings() {
  const me = await requireAdmin();
  const [s, shop, log] = await Promise.all([
    getEmailSettings(),
    getShopSettings(),
    supabaseAdmin().from('email_log').select('id, kind, to_email, subject, status, error, created_at').order('created_at', { ascending: false }).limit(25),
  ]);
  const provider = mailProvider();
  const sample = sampleMailData(me.email, me.name);
  const [cust, adm] = [customerOrderEmail(sample), adminOrderEmail(sample)];
  return (
    <>
      <PageHead title="Settings" sub="Emails sent after an order. Each order is emailed once, after its files are built (paid, plan or free)." />
      <div className="adm-grid2">
        <Card title="Order emails">
          <EmailSettingsForm customer={s.customer} admin={s.admin} notify={s.notify} />
        </Card>
        <Card title="Sending">
          <dl className="adm-facts">
            <div><dt>Service</dt><dd>{provider === 'resend' ? 'Resend' : provider === 'smtp' ? `SMTP · ${process.env.SMTP_HOST}` : <span className="msg err">Not set up, so no email is sent</span>}</dd></div>
            <div><dt>From</dt><dd><code>{mailFrom()}</code></dd></div>
            <div><dt>Replies go to</dt><dd><code>{replyAddress()}</code></dd></div>
          </dl>
          {!provider && (
            <p className="muted adm-help">Add these in Vercel → Project → Settings → Environment Variables, then redeploy:<br />
              <code>RESEND_API_KEY</code> (from resend.com, after adding your domain) <b>or</b> <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>,
              and <code>EMAIL_FROM</code>, e.g. <code>MD Creations Labs &lt;orders@themdcreations.com&gt;</code>.</p>
          )}
          <div className="adm-tests">
            <TestButton kind="customer" label={`Send a sample receipt to ${me.email}`} disabled={!provider} />
            <TestButton kind="admin" label="Send a sample order alert" disabled={!provider || !s.notify.length} />
          </div>
        </Card>
      </div>

      <div className="adm-grid2">
        <Card title="Preview · receipt to the customer" action={<span className="id">{cust.subject}</span>}>
          <iframe className="adm-mail" title="Customer receipt preview" srcDoc={cust.html} sandbox="" />
        </Card>
        <Card title="Preview · alert to you" action={<span className="id">{adm.subject}</span>}>
          <iframe className="adm-mail" title="Order alert preview" srcDoc={adm.html} sandbox="" />
        </Card>
      </div>

      <Card title="Printed orders">
        <ShopForm returnAddress={shop.returnAddress} />
      </Card>

      <Card title="Recent emails" flush>
        {log.error ? <Empty>Could not read the email log: {log.error.message}. Did you run the order emails SQL migration?</Empty>
          : !log.data?.length ? <Empty>Nothing sent yet.</Empty> : (
          <div className="tbl-wrap"><table className="tbl adm-tbl">
            <thead><tr><th>When</th><th>Email</th><th>To</th><th>Status</th></tr></thead>
            <tbody>{log.data.map((l) => (
              <tr key={l.id}>
                <td title={when(l.created_at)}>{ago(l.created_at)}</td>
                <td><b>{KIND[l.kind] ?? l.kind}</b><div className="id">{l.subject}</div></td>
                <td className="id">{l.to_email}</td>
                <td><span className={`pill ${l.status === 'sent' ? 'fulfilled' : l.status === 'failed' ? 'failed' : ''}`}>{l.status}</span>{l.error && <div className="id" style={{ color: 'var(--bad)' }}>{l.error}</div>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
