'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type MeshSnap = { jpeg(maxW?: number): string };
export type ViewPart = { tris: Float32Array; color: string; opacity?: number; offset?: [number, number, number] };

/**
 * A small 3D viewer for the tools: drag to turn, scroll or pinch to zoom. z is up.
 * `fitKey` changes when the model should be re-framed (a new size), not on every small edit.
 */
export function MeshView({ parts, fitKey, light = 'studio', backlight = false, className, height = 460, snapRef, bg, steady = false }: { parts: ViewPart[]; fitKey?: string; light?: 'studio' | 'soft'; backlight?: boolean; className?: string; height?: number; snapRef?: React.RefObject<MeshSnap | null>; bg?: string; steady?: boolean }) {
  const box = useRef<HTMLDivElement>(null), bgRef = useRef(bg ?? '#dcddd2');
  useEffect(() => { bgRef.current = bg ?? '#dcddd2'; }, [bg]);
  const st = useRef<{ r?: THREE.WebGLRenderer; scene?: THREE.Scene; cam?: THREE.PerspectiveCamera; group?: THREE.Group; az: number; el: number; zoom: number; dist: number; target: THREE.Vector3; dirty: boolean; fit?: string; back?: THREE.PointLight; alive: boolean }>({ az: -0.6, el: 0.55, zoom: 1, dist: 300, target: new THREE.Vector3(), dirty: true, alive: true });

  useEffect(() => {
    const el = box.current; if (!el) return;
    const s = st.current; s.alive = true; let live = true;   // `live` belongs to this mount only (strict mode mounts twice)
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
    if (snapRef) snapRef.current = {
      jpeg(maxW = 900) {
        const d = s.zoom * s.dist; cam.position.set(s.target.x + d * Math.cos(s.el) * Math.sin(s.az), s.target.y - d * Math.cos(s.el) * Math.cos(s.az), s.target.z + d * Math.sin(s.el)); cam.lookAt(s.target); r.render(scene, cam);
        const src = r.domElement, k = Math.min(1, maxW / src.width), c = document.createElement('canvas');
        c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
        const g = c.getContext('2d')!; g.fillStyle = bgRef.current; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.85);
      },
    };
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
      if (!live) return;
      if (s.dirty) {
        s.dirty = false; const d = s.dist * s.zoom;
        cam.position.set(s.target.x + d * Math.cos(s.el) * Math.sin(s.az), s.target.y - d * Math.cos(s.el) * Math.cos(s.az), s.target.z + d * Math.sin(s.el));
        cam.lookAt(s.target); r.render(scene, cam);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { live = false; s.alive = false; if (snapRef) snapRef.current = null; ro.disconnect(); for (const m of group.children as THREE.Mesh[]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } r.dispose(); r.domElement.remove(); };
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
    if (!bb.isEmpty()) {
      const c = new THREE.Vector3(), sz = new THREE.Vector3(); bb.getCenter(c); bb.getSize(sz);
      const big = Math.max(sz.x, sz.y, sz.z), st2 = s as typeof s & { fitSize?: number };
      // steady: keep the zoom while sizes change, so a bigger piece looks bigger; re-frame only on a new fitKey
      // or when it would no longer fit (or would be tiny)
      const refit = fitKey === undefined || fitKey !== s.fit || (steady && st2.fitSize !== undefined && (big > st2.fitSize * 1.9 || big < st2.fitSize * 0.35));
      if (refit) { s.fit = fitKey; st2.fitSize = big; s.target.copy(c); s.dist = big * (steady ? 3.2 : 2.3) + 10; }   // steady views leave room to grow
      else if (steady) s.target.copy(c);
    }
    if (s.back) { s.back.intensity = backlight ? 1.6 : 0; const c = new THREE.Vector3(); if (!bb.isEmpty()) bb.getCenter(c); s.back.position.copy(c); }
    s.dirty = true;
  }, [parts, fitKey, backlight, steady]);

  return <div ref={box} className={`meshview ${className ?? ''}`} style={{ height, background: bg }} data-light={light} />;
}
