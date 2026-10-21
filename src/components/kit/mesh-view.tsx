'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type ViewPart = { tris: Float32Array; color: string; opacity?: number; offset?: [number, number, number] };

/**
 * A small 3D viewer for the tools: drag to turn, scroll or pinch to zoom. z is up.
 * `fitKey` changes when the model should be re-framed (a new size), not on every small edit.
 */
export function MeshView({ parts, fitKey, light = 'studio', backlight = false, className, height = 460 }: { parts: ViewPart[]; fitKey?: string; light?: 'studio' | 'soft'; backlight?: boolean; className?: string; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const st = useRef<{ r?: THREE.WebGLRenderer; scene?: THREE.Scene; cam?: THREE.PerspectiveCamera; group?: THREE.Group; az: number; el: number; zoom: number; dist: number; target: THREE.Vector3; dirty: boolean; fit?: string; back?: THREE.PointLight; alive: boolean }>({ az: -0.6, el: 0.55, zoom: 1, dist: 300, target: new THREE.Vector3(), dirty: true, alive: true });

  useEffect(() => {
    const el = box.current; if (!el) return;
    const s = st.current; s.alive = true;
    let r: THREE.WebGLRenderer;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { el.textContent = '3D preview is not available in this browser.'; return; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputEncoding = THREE.sRGBEncoding;
    el.appendChild(r.domElement); r.domElement.style.touchAction = 'none'; r.domElement.style.display = 'block';
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.5, 20000), group = new THREE.Group();
    cam.up.set(0, 0, 1); scene.add(group);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x777a6c, 0.75));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.6); d1.position.set(-1, -1.4, 2); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.22); d2.position.set(1.2, 1, 0.6); scene.add(d2);
    const back = new THREE.PointLight(0xfff1d6, 0, 0); scene.add(back); s.back = back;
    Object.assign(s, { r, scene, cam, group });
    const size = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h, false); r.domElement.style.width = '100%'; r.domElement.style.height = '100%'; cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); s.dirty = true; };
    const ro = new ResizeObserver(size); ro.observe(el); size();
    const pts = new Map<number, [number, number]>(); let pinch = 0;
    const down = (e: PointerEvent) => { r.domElement.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const a = [...pts.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch) s.zoom = Math.min(4, Math.max(0.2, s.zoom * (pinch / d))); pinch = d; }
      else { s.az -= dx * 0.008; s.el = Math.min(1.5, Math.max(-1.5, s.el + dy * 0.008)); }
      s.dirty = true;
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); s.zoom = Math.min(4, Math.max(0.2, s.zoom * Math.exp(e.deltaY * 0.0012))); s.dirty = true; };
    r.domElement.addEventListener('pointerdown', down); r.domElement.addEventListener('pointermove', move);
    r.domElement.addEventListener('pointerup', up); r.domElement.addEventListener('pointercancel', up);
    r.domElement.addEventListener('wheel', wheel, { passive: false });
    const loop = () => {
      if (!s.alive) return;
      if (s.dirty) {
        s.dirty = false; const d = s.dist * s.zoom;
        cam.position.set(s.target.x + d * Math.cos(s.el) * Math.sin(s.az), s.target.y - d * Math.cos(s.el) * Math.cos(s.az), s.target.z + d * Math.sin(s.el));
        cam.lookAt(s.target); r.render(scene, cam);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { s.alive = false; ro.disconnect(); for (const m of group.children as THREE.Mesh[]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } r.dispose(); r.domElement.remove(); };
  }, []);

  useEffect(() => {
    const s = st.current, g = s.group; if (!g) return;
    for (const m of [...g.children] as THREE.Mesh[]) { g.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    const bb = new THREE.Box3();
    for (const p of parts) {
      if (!p.tris.length) continue;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p.tris, 3)); geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color).convertSRGBToLinear(), roughness: 0.78, metalness: 0, flatShading: true, transparent: p.opacity != null && p.opacity < 1, opacity: p.opacity ?? 1, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geo, mat); if (p.offset) m.position.set(...p.offset); g.add(m); geo.computeBoundingBox(); const b = geo.boundingBox!.clone(); if (p.offset) b.translate(new THREE.Vector3(...p.offset)); bb.union(b);
    }
    if (!bb.isEmpty() && (fitKey === undefined || fitKey !== s.fit)) {
      s.fit = fitKey; const c = new THREE.Vector3(), sz = new THREE.Vector3(); bb.getCenter(c); bb.getSize(sz);
      s.target.copy(c); s.dist = Math.max(sz.x, sz.y, sz.z) * 2.3 + 10;
    }
    if (s.back) { s.back.intensity = backlight ? 1.6 : 0; const c = new THREE.Vector3(); if (!bb.isEmpty()) bb.getCenter(c); s.back.position.copy(c); }
    s.dirty = true;
  }, [parts, fitKey, backlight]);

  return <div ref={box} className={`meshview ${className ?? ''}`} style={{ height }} data-light={light} />;
}
