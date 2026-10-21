'use client';
import { useEffect, useRef, useState } from 'react';
import { MAP_URL, TILE, latToY, lonToX, mPerPx, xToLon, yToLat } from '@/lib/topo/geo';

export type View = { lat: number; lon: number; zoom: number };
export type Selection = { x0: number; y0: number; x1: number; y1: number; zoom: number; metres: number };

/** A small map to choose an area: drag to move, scroll or the buttons to zoom. The frame in the middle is the model. */
export function SlippyMap({ view, onView, aspect, shape, onSelection }: { view: View; onView(v: View): void; aspect: number; shape: string; onSelection(s: Selection): void }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 420 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const z = view.zoom, cx = lonToX(view.lon, z), cy = latToY(view.lat, z);
  const s = Math.min(size.w * 0.8, size.h * 0.8 * aspect), fw = s, fh = s / aspect;
  const sel: Selection = { x0: cx - fw / 2, y0: cy - fh / 2, x1: cx + fw / 2, y1: cy + fh / 2, zoom: z, metres: fw * mPerPx(view.lat, z) };
  const key = `${sel.x0.toFixed(1)}:${sel.y0.toFixed(1)}:${sel.x1.toFixed(1)}:${z}`;
  const last = useRef('');
  useEffect(() => { if (last.current !== key) { last.current = key; onSelection(sel); } });

  const max = 2 ** z, left = cx - size.w / 2, top = cy - size.h / 2;
  const tiles: { k: string; src: string; x: number; y: number }[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
    if (ty < 0 || ty >= max) continue;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) tiles.push({ k: `${z}/${tx}/${ty}`, src: MAP_URL(z, ((tx % max) + max) % max, ty), x: tx * TILE - left, y: ty * TILE - top });
  }
  const zoomTo = (nz: number) => onView({ ...view, zoom: Math.max(2, Math.min(15, nz)) });

  return (
    <div ref={box} className="topo-map" onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx, cy }; }}
      onPointerMove={(e) => { const d = drag.current; if (!d) return; const nx = d.cx - (e.clientX - d.x), ny = d.cy - (e.clientY - d.y); onView({ zoom: z, lon: xToLon(nx, z), lat: Math.max(-84, Math.min(84, yToLat(ny, z))) }); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onWheel={(e) => { e.preventDefault(); zoomTo(z + (e.deltaY < 0 ? 1 : -1)); }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {tiles.map((t) => <img key={t.k} src={t.src} alt="" draggable={false} style={{ left: t.x, top: t.y }} />)}
      <svg className="topo-frame" width={size.w} height={size.h} aria-hidden="true">
        <defs><mask id="tm"><rect width="100%" height="100%" fill="#fff" />{frameShape(shape, size.w / 2, size.h / 2, fw, fh, '#000')}</mask></defs>
        <rect width="100%" height="100%" fill="rgba(20,22,16,.35)" mask="url(#tm)" />
        {frameShape(shape, size.w / 2, size.h / 2, fw, fh, 'none', '#fff')}
      </svg>
      <div className="topo-zoom"><button type="button" aria-label="Zoom in" onClick={() => zoomTo(z + 1)}>+</button><button type="button" aria-label="Zoom out" onClick={() => zoomTo(z - 1)}>−</button></div>
      <div className="topo-scale">{sel.metres >= 2000 ? `${(sel.metres / 1000).toFixed(sel.metres < 20000 ? 1 : 0)} km` : `${Math.round(sel.metres)} m`} across</div>
      <div className="topo-attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</div>
    </div>
  );
}

function frameShape(shape: string, cx: number, cy: number, w: number, h: number, fill: string, stroke?: string) {
  const st = stroke ? { stroke, strokeWidth: 2, strokeDasharray: '6 4' } : {};
  if (shape === 'circle') return <circle cx={cx} cy={cy} r={Math.min(w, h) / 2} fill={fill} {...st} />;
  if (shape === 'hexagon') { const R = Math.min(w, h) / 2, pts = Array.from({ length: 6 }, (_, i) => { const a = (i * Math.PI) / 3; return `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`; }).join(' '); return <polygon points={pts} fill={fill} {...st} />; }
  return <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={fill} {...st} />;
}
