/* Reads print time and filament weight from a sliced file: G-code (Bambu Studio, OrcaSlicer, PrusaSlicer, Cura)
 * or a sliced 3MF (.gcode.3mf from Bambu Studio / Orca). Runs in the browser; nothing is uploaded. */

export type SliceInfo = { seconds?: number; grams?: number[]; source: string };

const PLA_G_PER_M = 2.98;  // 1.75 mm PLA

function parseDuration(s: string): number | undefined {
  let t = 0, hit = false;
  for (const [, v, u] of s.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/gi)) { hit = true; t += Number(v) * ({ d: 86400, h: 3600, m: 60, s: 1 } as Record<string, number>)[u.toLowerCase()]; }
  return hit ? t : undefined;
}
const nums = (s: string) => s.split(/[,;]/).map((x) => Number(x.trim())).filter((x) => Number.isFinite(x) && x > 0);

export function parseGcodeText(text: string): SliceInfo | null {
  const info: SliceInfo = { source: 'G-code' };
  let m: RegExpMatchArray | null;
  if ((m = text.match(/;\s*model printing time:\s*([^;\n]+)/i))) info.seconds = parseDuration(m[1]);
  if (info.seconds == null && (m = text.match(/;\s*total estimated time:\s*([^;\n]+)/i))) info.seconds = parseDuration(m[1]);
  if (info.seconds == null && (m = text.match(/;\s*estimated printing time \(normal mode\)\s*=\s*([^\n]+)/i))) info.seconds = parseDuration(m[1]);
  if (info.seconds == null && (m = text.match(/^;TIME:(\d+(?:\.\d+)?)/m))) info.seconds = Number(m[1]);
  if (info.seconds == null && (m = text.match(/;\s*PRINT\.TIME\s*:?\s*(\d+)/i))) info.seconds = Number(m[1]);
  if ((m = text.match(/;\s*filament used \[g\]\s*=\s*([^\n]+)/i))) info.grams = nums(m[1]);
  else if ((m = text.match(/;\s*total filament weight \[g\]\s*:\s*([^\n]+)/i))) info.grams = nums(m[1]);
  else if ((m = text.match(/;\s*total filament used \[g\]\s*=\s*([^\n]+)/i))) info.grams = nums(m[1]);
  else if ((m = text.match(/^;Filament used:\s*([^\n]+)/m))) info.grams = nums(m[1].replace(/m/g, '')).map((x) => +(x * PLA_G_PER_M).toFixed(2));
  return info.seconds != null || info.grams?.length ? info : null;
}

/* ---- tiny zip reader (stored + deflate) for 3MF files */
async function inflate(data: Uint8Array) {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
async function unzipEntries(buf: ArrayBuffer, want: (name: string) => boolean) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), out = new Map<string, Uint8Array>();
  let e = -1; for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Not a zip file');
  let p = dv.getUint32(e + 16, true); const count = dv.getUint16(e + 10, true);
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    if (want(name)) {
      const ln = dv.getUint16(loc + 26, true), lx = dv.getUint16(loc + 28, true), start = loc + 30 + ln + lx, raw = u8.subarray(start, start + csize);
      out.set(name, method === 0 ? raw : await inflate(raw));
    }
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

export async function readSlicedFile(file: File): Promise<SliceInfo | null> {
  const low = file.name.toLowerCase();
  if (low.endsWith('.3mf')) {
    const files = await unzipEntries(await file.arrayBuffer(), (n) => /slice_info\.config$/i.test(n) || /plate_\d+\.gcode$/i.test(n));
    const cfg = [...files.entries()].find(([n]) => /slice_info\.config$/i.test(n))?.[1];
    if (cfg) {
      const x = new TextDecoder().decode(cfg);
      const plates = [...x.matchAll(/<plate>([\s\S]*?)<\/plate>/g)].map((m) => m[1]);
      let seconds = 0, gramsBy: number[] = [], hit = false;
      for (const pl of plates.length ? plates : [x]) {
        const t = pl.match(/key="prediction"\s+value="(\d+(?:\.\d+)?)"/); if (t) { seconds += Number(t[1]); hit = true; }
        const fl = [...pl.matchAll(/<filament\b[^>]*\bused_g="([\d.]+)"[^>]*>/g)].map((m) => Number(m[1]));
        if (fl.length) { fl.forEach((g, i) => (gramsBy[i] = (gramsBy[i] ?? 0) + g)); hit = true; }
        else { const w = pl.match(/key="weight"\s+value="([\d.]+)"/); if (w) { gramsBy = [(gramsBy[0] ?? 0) + Number(w[1])]; hit = true; } }
      }
      if (hit) return { seconds: seconds || undefined, grams: gramsBy.filter((g) => g > 0), source: `3MF${plates.length > 1 ? `, ${plates.length} plates` : ''}` };
    }
    const g = [...files.entries()].find(([n]) => /\.gcode$/i.test(n))?.[1];
    if (g) return parseGcodeText(headTail(new TextDecoder().decode(g)));
    return null;
  }
  // G-code: the numbers sit in comments near the start or the end
  const head = await file.slice(0, 300_000).text(), tail = file.size > 300_000 ? await file.slice(Math.max(300_000, file.size - 600_000)).text() : '';
  return parseGcodeText(head + '\n' + tail);
}
const headTail = (s: string) => (s.length > 900_000 ? s.slice(0, 300_000) + '\n' + s.slice(-600_000) : s);
