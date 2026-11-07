'use client';
import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * A maker opened from "Edit design" is drawn in the browser only: older designs are rebuilt from their saved grids on
 * a canvas, which the server does not have, so a first draw on the server would not match.
 */
export function EditGate({ children }: { children: React.ReactNode }) {
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  return inBrowser ? <>{children}</> : <p className="muted" style={{ padding: '60px 0', textAlign: 'center' }}>Opening your design…</p>;
}
