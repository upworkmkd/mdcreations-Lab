// Cookie names shared by the browser tracker and the server.
export const CONSENT_COOKIE = 'mdl_consent';   // 'all' | 'essential'
export const VISITOR_COOKIE = 'mdl_vid';       // one id per browser, kept for a year (only with consent)
export const SESSION_COOKIE = 'mdl_sid';       // one id per visit, ends after 30 idle minutes
export const SESSION_MINUTES = 30;
export const CONSENT_VERSION = '2026-10';

export type Consent = 'all' | 'essential';
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
