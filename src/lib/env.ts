/* Environment variables, read in one place so a missing one gives a clear message. */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'hello@themdcreations.com';
export const SOCIALS = [
  { name: 'Instagram', handle: '@mdcreationsbymanoj', url: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? 'https://www.instagram.com/mdcreationsbymanoj/' },
  { name: 'YouTube', handle: '@Mdcreationsbymanoj', url: process.env.NEXT_PUBLIC_YOUTUBE_URL ?? 'https://www.youtube.com/@Mdcreationsbymanoj' },
  { name: 'Snapchat', handle: 'MD Creations', url: process.env.NEXT_PUBLIC_SNAPCHAT_URL ?? 'https://snapchat.com/t/XOf17wzT' },
] as const;
export const INSTAGRAM_URL = SOCIALS[0].url;

export const supabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export function serverEnv(name: 'SUPABASE_SECRET_KEY' | 'RAZORPAY_KEY_ID' | 'RAZORPAY_KEY_SECRET' | 'RAZORPAY_WEBHOOK_SECRET') {
  const v = name === 'SUPABASE_SECRET_KEY' ? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to .env.local (or the Vercel project settings).`);
  return v;
}
