/* Readable checks for the settings a browser sends. Used by every tool's design parser. */
export const num = (v: unknown, lo: number, hi: number, name: string) => {
  const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`Setting “${name}” is out of range.`); return n;
};
export const pick = <T extends string>(v: unknown, opts: readonly T[], name: string): T => {
  if (!opts.includes(v as T)) throw new Error(`Setting “${name}” is not valid.`); return v as T;
};
export const cleanName = (v: unknown, fallback: string) => String(v ?? fallback).replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || fallback;
