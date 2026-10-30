'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { HistoryRow } from '@/lib/followup.server';

const LABEL: Record<string, string> = {
  order_customer: 'Receipt', print_customer: 'Printed order receipt', print_printing: 'Printing started', print_shipped: 'Shipped',
  print_tracking: 'Tracking number', print_delivered: 'Delivered', print_cancelled: 'Cancelled', followup_order: 'Follow-up (order)',
  followup_subscription: 'Follow-up (plan)', sub_welcome: 'Plan welcome', review_request: 'Review request',
};
const when = (s: string) => new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** A customer's emails, newest first, each with the order (or plan) it was about. Follow-ups open to show what was written. */
export function EmailHistory({ rows, compact = false }: { rows: HistoryRow[]; compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return <p className="muted" style={{ fontSize: 14 }}>No emails yet.</p>;
  return (
    <ol className={`adm-mails${compact ? ' compact' : ''}`}>
      {rows.map((r) => (
        <li key={r.id} className={r.kind.startsWith('followup') ? 'fu' : ''}>
          <div className="adm-mails-top">
            <b>{LABEL[r.kind] ?? r.kind}{r.auto ? <span className="adm-mails-auto" title="Sent automatically by the daily email job">auto</span> : null}</b>
            <span className={`pill ${r.status === 'sent' ? 'fulfilled' : r.status === 'failed' ? 'failed' : ''}`}>{r.status}</span>
          </div>
          <p className="adm-mails-sub">{r.subject}</p>
          <p className="adm-mails-meta">
            {when(r.created_at)}
            {r.order_id && <> · <Link href={`/admin/orders/${r.order_id}`} className="adm-mails-ref" title="Order">#{r.order_id.slice(0, 8).toUpperCase()}</Link></>}
            {r.subscription_id && <> · plan</>}
          </p>
          {r.error && <p className="adm-mails-meta" style={{ color: 'var(--bad)' }}>{r.error}</p>}
          {r.body && (open === r.id
            ? <><pre className="adm-mails-body">{r.body}</pre><button type="button" className="linkish" onClick={() => setOpen(null)}>Hide</button></>
            : <button type="button" className="linkish" onClick={() => setOpen(r.id)}>Show what was written</button>)}
        </li>
      ))}
    </ol>
  );
}
