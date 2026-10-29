'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth.server';
import { emailHistory, followupDraft, sendFollowup, type Draft, type FollowKind, type HistoryRow } from '@/lib/followup.server';
import { UUID_RE } from '@/lib/consent';

/** The draft and the customer's email history, for the follow-up window. */
export async function loadFollowup(kind: FollowKind, id: string): Promise<{ draft: Draft; history: HistoryRow[] } | { error: string }> {
  const me = await requireAdmin();
  if (!UUID_RE.test(id) || !['order', 'subscription', 'review'].includes(kind)) return { error: 'Bad request.' };
  const draft = await followupDraft(kind, id, me.name);
  if (!draft) return { error: 'This customer has no email address.' };
  const history = await emailHistory({ userId: draft.userId, email: draft.to });
  return { draft, history };
}

export async function sendFollowupAction(kind: FollowKind, id: string, subject: string, body: string): Promise<{ ok?: string; error?: string }> {
  const me = await requireAdmin();
  if (!UUID_RE.test(id) || !['order', 'subscription', 'review'].includes(kind)) return { error: 'Bad request.' };
  const s = subject.replace(/\s+/g, ' ').trim().slice(0, 200), b = body.replace(/\r/g, '').trim().slice(0, 8000);
  if (s.length < 3) return { error: 'Write a subject.' };
  if (b.length < 10) return { error: 'Write a message.' };
  const r = await sendFollowup(kind, id, s, b, me.id);
  revalidatePath('/admin', 'layout');
  return r.ok ? { ok: `Sent to ${r.to}.` } : { error: r.error };
}
