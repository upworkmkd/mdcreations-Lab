'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { CONSENT_COOKIE, NOTRACK_COOKIE } from '@/lib/consent';
import { GA_ID, gaDrainServerQueue, gaDropPending, gaFlushPending, gaPageEvents } from '@/lib/ga';

type W = Window & { gtag?: (...a: unknown[]) => void; dataLayer?: unknown[]; __gaOn?: boolean };
const CHANGED = 'mdl:consent-changed';
const cookie = (n: string) => document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'))?.[1] ?? null;
const allowed = () => {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return cookie(CONSENT_COOKIE) === 'all' && !cookie(NOTRACK_COOKIE) && !n.globalPrivacyControl && n.doNotTrack !== '1';
};
const subscribe = (cb: () => void) => { addEventListener(CHANGED, cb); return () => removeEventListener(CHANGED, cb); };

/** Loads Google Analytics once the visitor has pressed "Accept all" (never on admin pages or for the shop owner). */
export function GoogleAnalytics() {
  const ok = useSyncExternalStore(subscribe, allowed, () => false);
  const pathname = usePathname();
  const admin = pathname.startsWith('/admin');

  // load gtag.js once; page views of later route changes come from GA's own history tracking
  useEffect(() => {
    if (!GA_ID) return;
    const w = window as W;
    if (!ok) { gaDropPending(); if (w.__gaOn) w.gtag?.('consent', 'update', { analytics_storage: 'denied' }); return; }
    if (admin) return;
    if (!w.__gaOn) {
      w.dataLayer = w.dataLayer || [];
      w.gtag = function gtag() { w.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
      w.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      w.gtag('js', new Date());
      w.gtag('config', GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
      const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`; document.head.append(s);
      w.__gaOn = true;
    } else w.gtag?.('consent', 'update', { analytics_storage: 'granted' });
    gaFlushPending(); gaDrainServerQueue();
  }, [ok, admin]);

  // per page: item views, and events the server left behind (sign-up, payment …); checked again every few seconds,
  // since payments finish without a page change
  useEffect(() => {
    if (!ok || admin) return;
    const t = setTimeout(() => { gaPageEvents(location.pathname, document.title); gaDrainServerQueue(); }, 400);   // the title updates just after navigation
    const iv = setInterval(() => { if (document.visibilityState === 'visible') gaDrainServerQueue(); }, 2500);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [pathname, ok, admin]);

  return null;
}
