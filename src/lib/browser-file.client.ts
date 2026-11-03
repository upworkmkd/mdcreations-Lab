'use client';
import { useEffect, useState } from 'react';

/** Must match MAX_FILE_B64 in src/lib/kits/browser-file.server.ts. */
export const MAX_FILE_B64 = 3_500_000;

async function gzipB64(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * The finished model, gzipped and base64-encoded, for "Order it printed" on the free browser tools.
 * Rebuilt (in the background) whenever the model changes; `tooBig` when it would not fit in one request.
 */
export function usePackedModel(make: (() => Uint8Array) | null) {
  const [state, setState] = useState<{ for: unknown; file: string | null; tooBig: boolean }>({ for: null, file: null, tooBig: false });
  useEffect(() => {
    if (!make) return;
    let ok = true;
    const t = setTimeout(() => {
      gzipB64(make()).then((file) => { if (ok) setState({ for: make, file: file.length <= MAX_FILE_B64 ? file : null, tooBig: file.length > MAX_FILE_B64 }); }).catch(() => {});
    }, 400);
    return () => { ok = false; clearTimeout(t); };
  }, [make]);
  const fresh = make != null && state.for === make;
  return { file: fresh ? state.file : null, tooBig: fresh && state.tooBig };
}
