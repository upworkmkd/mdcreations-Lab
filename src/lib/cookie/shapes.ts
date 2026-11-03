/* Ready-made shapes for cutters and stencils, drawn on a canvas (black = shape). */
export type Preset = 'heart' | 'star' | 'circle' | 'flower' | 'moon' | 'person' | 'rangoli' | 'lotus' | 'mandala';
export const PRESETS: [Preset, string][] = [['heart', 'Heart'], ['star', 'Star'], ['circle', 'Circle'], ['flower', 'Flower'], ['moon', 'Crescent moon'], ['person', 'Gingerbread person'], ['lotus', 'Lotus'], ['mandala', 'Rangoli mandala'], ['rangoli', 'Rangoli flower (solid shapes)']];

export function drawPreset(kind: Preset, S = 600): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.fillStyle = '#000'; g.strokeStyle = '#000';
  const m = S / 2;
  g.beginPath();
  if (kind === 'heart') {
    g.moveTo(m, S * 0.88); g.bezierCurveTo(S * 0.2, S * 0.6, S * 0.02, S * 0.42, S * 0.12, S * 0.24); g.bezierCurveTo(S * 0.22, S * 0.05, S * 0.45, S * 0.08, m, S * 0.25);
    g.bezierCurveTo(S * 0.55, S * 0.08, S * 0.78, S * 0.05, S * 0.88, S * 0.24); g.bezierCurveTo(S * 0.98, S * 0.42, S * 0.8, S * 0.6, m, S * 0.88); g.fill();
  } else if (kind === 'star') {
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? S * 0.2 : S * 0.47; g.lineTo(m + r * Math.cos(a), m + 0.04 * S + r * Math.sin(a)); } g.closePath(); g.fill();
  } else if (kind === 'circle') { g.arc(m, m, S * 0.46, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'flower') { for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; g.moveTo(m, m); g.arc(m + S * 0.25 * Math.cos(a), m + S * 0.25 * Math.sin(a), S * 0.2, 0, Math.PI * 2); } g.fill(); g.beginPath(); g.arc(m, m, S * 0.25, 0, Math.PI * 2); g.fill(); }
  else if (kind === 'moon') { g.arc(m, m, S * 0.45, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(m + S * 0.2, m - S * 0.1, S * 0.38, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; const d = g.getImageData(0, 0, S, S); for (let i = 3; i < d.data.length; i += 4) if (d.data[i] < 128) { d.data[i - 3] = d.data[i - 2] = d.data[i - 1] = 255; d.data[i] = 255; } g.putImageData(d, 0, 0); }
  else if (kind === 'person') {
    g.arc(m, S * 0.2, S * 0.14, 0, Math.PI * 2); g.fill();
    const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
    rr(S * 0.3, S * 0.3, S * 0.4, S * 0.38, S * 0.08);
    g.save(); g.translate(m, S * 0.38); for (const s of [-1, 1]) { g.save(); g.rotate(s * -0.45); rr(s > 0 ? S * 0.12 : -S * 0.42, -S * 0.06, S * 0.3, S * 0.12, S * 0.06); g.restore(); } g.restore();
    for (const s of [-1, 1]) { g.save(); g.translate(m + s * S * 0.1, S * 0.62); g.rotate(s * -0.18); rr(-S * 0.07, 0, S * 0.14, S * 0.3, S * 0.07); g.restore(); }
    g.fillStyle = '#fff'; for (const [x, y, r] of [[m - S * 0.05, S * 0.18, 0.018], [m + S * 0.05, S * 0.18, 0.018], [m, S * 0.4, 0.02], [m, S * 0.48, 0.02], [m, S * 0.56, 0.02]]) { g.beginPath(); g.arc(x, y, S * r, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#fff'; g.lineWidth = S * 0.012; g.beginPath(); g.arc(m, S * 0.21, S * 0.06, 0.2, Math.PI - 0.2); g.stroke();
  } else if (kind === 'lotus') {
    const petal = (a: number, len: number, wid: number) => { g.save(); g.translate(m, S * 0.72); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(wid, -len * 0.55, 0, -len); g.quadraticCurveTo(-wid, -len * 0.55, 0, 0); g.fill(); g.restore(); };
    for (const a of [-1.15, 1.15]) petal(a, S * 0.42, S * 0.14); for (const a of [-0.6, 0.6]) petal(a, S * 0.55, S * 0.16); petal(0, S * 0.62, S * 0.17);
    g.beginPath(); g.ellipse(m, S * 0.76, S * 0.34, S * 0.08, 0, 0, Math.PI * 2); g.fill();
  } else if (kind === 'mandala') {
    // line-art mandala: the lines are printed, the spaces between them are cut for the powder
    g.lineWidth = S * 0.016; g.lineJoin = 'round'; g.lineCap = 'round';
    const ring = (r: number) => { g.beginPath(); g.arc(m, m, S * r, 0, Math.PI * 2); g.stroke(); };
    const at = (r: number, a: number): [number, number] => [m + S * r * Math.cos(a), m + S * r * Math.sin(a)];
    const petal = (a: number, r0: number, r1: number, wid: number) => {
      const [x0, y0] = at(r0, a), [x1, y1] = at(r1, a), mid = (r0 + r1) / 2, [cx1, cy1] = at(mid, a + wid), [cx2, cy2] = at(mid, a - wid);
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx1, cy1, x1, y1); g.quadraticCurveTo(cx2, cy2, x0, y0); g.stroke();
    };
    const dot = (r: number, a: number, d: number) => { const [x, y] = at(r, a); g.beginPath(); g.arc(x, y, S * d, 0, Math.PI * 2); g.fill(); };
    // every petal runs from one ring to the next, so the printed lines all hold together
    ring(0.045); ring(0.11); ring(0.2); ring(0.32); ring(0.42);
    for (let i = 0; i < 6; i++) petal((i / 6) * Math.PI * 2, 0.045, 0.11, 0.5);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; petal(a, 0.11, 0.2, 0.34); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; petal(a, 0.2, 0.32, 0.24); dot(0.26, a + Math.PI / 12, 0.012); }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + Math.PI / 16; petal(a, 0.32, 0.42, 0.17); }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; petal(a, 0.42, 0.49, 0.13); }
    dot(0, 0, 0.018);
  } else {
    // rangoli: rings of petals, dots and a flower in the middle
    g.lineWidth = S * 0.012;
    for (let i = 0; i < 12; i++) { g.save(); g.translate(m, m); g.rotate((i * Math.PI) / 6); g.beginPath(); g.ellipse(0, -S * 0.33, S * 0.045, S * 0.11, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    for (let i = 0; i < 24; i++) { const a = (i * Math.PI) / 12; g.beginPath(); g.arc(m + S * 0.46 * Math.cos(a), m + S * 0.46 * Math.sin(a), S * 0.018, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 8; i++) { g.save(); g.translate(m, m); g.rotate((i * Math.PI) / 4 + Math.PI / 8); g.beginPath(); g.moveTo(0, -S * 0.07); g.quadraticCurveTo(S * 0.06, -S * 0.15, 0, -S * 0.21); g.quadraticCurveTo(-S * 0.06, -S * 0.15, 0, -S * 0.07); g.fill(); g.restore(); }
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; g.beginPath(); g.arc(m + S * 0.235 * Math.cos(a), m + S * 0.235 * Math.sin(a), S * 0.022, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(m, m, S * 0.045, 0, Math.PI * 2); g.fill();
  }
  return c;
}
