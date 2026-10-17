import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, serverEnv } from '@/lib/env';

/** Service-role client. Bypasses row level security - only use it after checking who is asking. */
export function supabaseAdmin() {
  return createClient(SUPABASE_URL, serverEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Read-only client for public data (tools and prices); no cookies, so pages stay cacheable. */
export function supabasePublic() {
  return createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(4000) }) },
  });
}

export const FILES_BUCKET = 'lab-files';
