/* Run-length coding for a layer-class map (one byte per pixel, 255 = outside the picture). */

/** Uint8Array -> base64 of [value, varint run] pairs. */
export function encodeRle(arr) {
  const out = []; let i = 0;
  while (i < arr.length) {
    const v = arr[i]; let n = 1; while (i + n < arr.length && arr[i + n] === v) n++;
    out.push(v); let r = n; while (r >= 128) { out.push((r & 127) | 128); r >>>= 7; } out.push(r);
    i += n;
  }
  const u8 = Uint8Array.from(out);
  if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
  let s = ''; for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
  return btoa(s);
}

/** base64 -> Uint8Array of exactly n values (throws if the data does not fit). */
export function decodeRle(b64, n) {
  const u8 = typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(b64, 'base64')) : Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const out = new Uint8Array(n); let o = 0, i = 0;
  while (i < u8.length) {
    const v = u8[i++]; let r = 0, sh = 0, b;
    do { if (i >= u8.length) throw new Error('Bad layer data.'); b = u8[i++]; r |= (b & 127) << sh; sh += 7; } while (b & 128 && sh < 35);
    if (o + r > n) throw new Error('Bad layer data.');
    out.fill(v, o, o + r); o += r;
  }
  if (o !== n) throw new Error('Bad layer data.');
  return out;
}
