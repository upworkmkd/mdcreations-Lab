import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

export type Viewer = { id: string; email: string; name: string; role: 'user' | 'admin' };

export async function getViewer(): Promise<Viewer | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: prof } = await supabase.from('profiles').select('full_name, role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: data.user.email ?? '', name: prof?.full_name || '', role: prof?.role === 'admin' ? 'admin' : 'user' };
}

export async function requireViewer(next: string) {
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(next)}`);
  return v;
}

export async function requireAdmin() {
  const v = await requireViewer('/admin');
  if (v.role !== 'admin') redirect('/account');
  return v;
}
