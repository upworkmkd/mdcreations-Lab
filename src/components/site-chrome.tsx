'use client';
import { usePathname } from 'next/navigation';

/** Hides the public header and footer inside the admin dashboard, which has its own frame. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith('/admin')) return null;
  return <>{children}</>;
}
