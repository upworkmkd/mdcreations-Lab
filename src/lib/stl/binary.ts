/* STL helpers shared by the browser (admin upload) and the server (packaging). */

/** True when the bytes look like a binary STL (its size matches the triangle count in the header). */
export function isBinaryStl(b: Uint8Array) {
  if (b.length < 84) return false;
  const n = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(80, true);
  return 84 + n * 50 === b.length;
}

/** Text (ASCII) STL to binary STL: about five times smaller, and what every slicer reads fastest. */
export function asciiToBinaryStl(b: Uint8Array, name = 'MD Creations'): Uint8Array {
  if (isBinaryStl(b)) return b;
  const text = new TextDecoder().decode(b);
  const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
  const v: number[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) v.push(+m[1], +m[2], +m[3]);
  if (!v.length || v.length % 9) throw new Error('This does not look like an STL file.');
  const n = v.length / 9, out = new Uint8Array(84 + n * 50), dv = new DataView(out.buffer);
  out.set(new TextEncoder().encode(name.slice(0, 79)), 0);
  dv.setUint32(80, n, true);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50, a = t * 9;
    // facet normal from the corners (slicers recompute it anyway)
    const ux = v[a + 3] - v[a], uy = v[a + 4] - v[a + 1], uz = v[a + 5] - v[a + 2], wx = v[a + 6] - v[a], wy = v[a + 7] - v[a + 1], wz = v[a + 8] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    for (let k = 0; k < 9; k++) dv.setFloat32(o + 12 + k * 4, v[a + k], true);
  }
  return out;
}

/** A tidy file name for a part: letters, digits, spaces, dashes; always ending in .stl. */
export function cleanPartName(name: string) {
  const base = name.replace(/\.stl$/i, '').replace(/[^A-Za-z0-9 _.-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'part';
  return `${base}.stl`;
}
