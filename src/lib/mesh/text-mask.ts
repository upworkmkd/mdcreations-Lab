/* Renders text to a pixel mask in the browser (any script the browser has a font for: Hindi, Punjabi, Tamil...). */

export type TextMask = { mask: Uint8Array; w: number; h: number; pxPerMm: number };

/** Loads a Google font once. Resolves when it can be drawn on a canvas (or after a timeout). */
const loaded = new Map<string, Promise<void>>();
export function loadGoogleFont(family: string, weight = 700, sample = 'Aa') {
  const key = `${family}:${weight}`;
  if (!loaded.has(key)) {
    loaded.set(key, (async () => {
      const id = 'gf-' + family.replace(/\W+/g, '-') + '-' + weight;
      if (!document.getElementById(id)) {
        const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet';
        l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}&display=block`;
        document.head.appendChild(l);
        await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 4000); });
      }
      await Promise.race([document.fonts.load(`${weight} 48px "${family}"`, sample), new Promise((r) => setTimeout(r, 5000))]);
    })());
  }
  return loaded.get(key)!;
}

/**
 * Draws `lines` of text so the tallest line is `heightMm` tall (ascender to descender of the ink),
 * at `pxPerMm` pixels per millimetre, and returns the tight mask (row 0 = top).
 */
export function textMask(lines: string[], { family, weight = 700, heightMm, pxPerMm = 8, lineGap = 0.25, align = 'center', italic = false }: {
  family: string; weight?: number; heightMm: number; pxPerMm?: number; lineGap?: number; align?: 'left' | 'center' | 'right'; italic?: boolean;
}): TextMask | null {
  const L = lines.map((s) => s.trim()).filter(Boolean);
  if (!L.length) return null;
  const probe = document.createElement('canvas').getContext('2d')!;
  const fontAt = (px: number) => `${italic ? 'italic ' : ''}${weight} ${px}px "${family}", sans-serif`;
  probe.font = fontAt(100);
  const m0 = L.map((s) => probe.measureText(s));
  const inkH = Math.max(...m0.map((m) => m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)) || 100;
  const px = (100 * heightMm * pxPerMm) / inkH;
  probe.font = fontAt(px);
  const ms = L.map((s) => probe.measureText(s));
  const rows = ms.map((m) => ({ asc: Math.ceil(m.actualBoundingBoxAscent), desc: Math.ceil(m.actualBoundingBoxDescent), l: Math.ceil(m.actualBoundingBoxLeft), r: Math.ceil(m.actualBoundingBoxRight) }));
  const pad = 4, gap = Math.round(heightMm * pxPerMm * lineGap);
  const w = Math.max(...rows.map((r) => r.l + r.r)) + pad * 2;
  const h = rows.reduce((s, r) => s + r.asc + r.desc, 0) + gap * (rows.length - 1) + pad * 2;
  if (w * h > 16e6) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = fontAt(px); g.textBaseline = 'alphabetic';
  let y = pad;
  rows.forEach((r, i) => {
    const lw = r.l + r.r, x0 = align === 'left' ? pad : align === 'right' ? w - pad - lw : (w - lw) / 2;
    g.fillText(L[i], x0 + r.l, y + r.asc); y += r.asc + r.desc + gap;
  });
  const d = g.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = d[i * 4] > 127 ? 1 : 0;
  return { mask, w, h, pxPerMm };
}
