'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Tris, extrude, maskPolys } from '@/lib/mesh/mesh.js';

/* The assembled lamp in 3D, and the lamp on a wall at night with the LED lit and its shadow cast by the real walls.
 * Lamp frame (mm): the wall is z = 0, z points into the room, x right, y up; the LED axis is the origin. */

type Img = { w: number; h: number; data: Uint8Array };
export type LampPanel = { id: string; Lo: number; Lb: number; V0: number; all: Img; allRes: number };
export type LampData = {
  panels: LampPanel[]; apex: number; withBase: boolean;
  plate: null | { img: Img; W: number; H: number; hole: number; combined: boolean; plateColor: string; artColor: string };
};

const G = { baseX: 60, baseY: 75, T: 3, ledge: 10, plateZ: 22 };
const WALL_COLOUR = '#424532';

/** One wall as a solid, in its own frame: s along the wall, v up from the ledge, t into the lamp (0 = outer face). */
function panelTris(p: LampPanel) {
  const r = p.allRes, cols = Math.round(p.Lo / r), bandRows = Math.round(p.V0 / r), rows = bandRows + p.all.h;
  const m = new Uint8Array(cols * rows);
  const b0 = Math.round((p.Lo - p.Lb) / 2 / r), b1 = cols - b0;
  for (let y = 0; y < bandRows; y++) for (let x = b0; x < b1; x++) m[(rows - 1 - y) * cols + x] = 1;          // the plain band at the foot
  for (let y = 0; y < p.all.h; y++) for (let x = 0; x < Math.min(cols, p.all.w); x++) if (p.all.data[y * p.all.w + x]) m[(rows - 1 - bandRows - y) * cols + x] = 1;
  const t = new Tris(); extrude(t, maskPolys(m, cols, rows, r, r * 0.4, 0), 0, G.T);
  const tris = t.done(), H = rows * r;
  // maskPolys centres the grid: x -> s, y -> v - H/2, z -> t
  for (let i = 0; i < tris.length; i += 3) tris[i + 1] += H / 2;
  return tris;
}

function toLamp(id: string, tris: Float32Array) {
  const o = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 3) {
    const s = tris[i], v = tris[i + 1], t = tris[i + 2], z = G.ledge + v;
    let x: number, y: number;
    if (id === 'top') { x = s; y = G.baseY - t; } else if (id === 'bottom') { x = -s; y = -G.baseY + t; }
    else if (id === 'right') { x = G.baseX - t; y = -s; } else { x = -G.baseX + t; y = s; }
    o[i] = x; o[i + 1] = y; o[i + 2] = z;
  }
  return o;
}

function plateTexture(pl: NonNullable<LampData['plate']>) {
  const c = document.createElement('canvas'); c.width = pl.img.w; c.height = pl.img.h;
  const g = c.getContext('2d')!; g.fillStyle = pl.plateColor; g.fillRect(0, 0, c.width, c.height);
  const im = g.getImageData(0, 0, c.width, c.height), n = parseInt(pl.artColor.slice(1), 16);
  for (let y = 0; y < pl.img.h; y++) for (let x = 0; x < pl.img.w; x++) if (pl.img.data[y * pl.img.w + x]) {
    const k = 4 * ((pl.img.h - 1 - y) * pl.img.w + x); im.data[k] = n >> 16; im.data[k + 1] = (n >> 8) & 255; im.data[k + 2] = n & 255;
  }
  g.putImageData(im, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; return tex;
}

const disposeMat = (m: THREE.Material | THREE.Material[] | undefined) => { for (const x of Array.isArray(m) ? m : m ? [m] : []) { const t = (x as THREE.MeshStandardMaterial).map; if (t) t.dispose(); x.dispose(); } };

function glowSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,205,1)'); gr.addColorStop(0.25, 'rgba(255,214,150,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  return new THREE.Sprite(m);
}

export function LampView({ data, mode, height }: { data: LampData | null; mode: '3d' | 'wall'; height?: number }) {
  const [lightOn, setLightOn] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const st = useRef<{ r?: THREE.WebGLRenderer; scene?: THREE.Scene; cam?: THREE.PerspectiveCamera; lamp?: THREE.Group; light?: THREE.PointLight; amb?: THREE.AmbientLight; hemi?: THREE.HemisphereLight; key?: THREE.DirectionalLight; wall?: THREE.Mesh; glow?: THREE.Sprite; led?: THREE.Mesh; az: number; el: number; dist: number; target: THREE.Vector3; dirty: boolean }>({ az: 0.55, el: 0.35, dist: 420, target: new THREE.Vector3(0, 0, 45), dirty: true });

  // the walls only change when the design does
  const walls = useMemo(() => (data ? data.panels.map((p) => ({ id: p.id, tris: toLamp(p.id, panelTris(p)) })) : []), [data]);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const s = st.current; let live = true;
    let r: THREE.WebGLRenderer;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch { el.textContent = '3D preview is not available in this browser.'; return; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputEncoding = THREE.sRGBEncoding;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(r.domElement); r.domElement.style.display = 'block'; r.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, 1, 20000); cam.up.set(0, 1, 0);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6d705f, 0.7), key = new THREE.DirectionalLight(0xffffff, 0.55); key.position.set(-300, 400, 600);
    const amb = new THREE.AmbientLight(0xffffff, 0.03);
    const light = new THREE.PointLight(0xffd9a0, 1.6, 0, 1.2); light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048); light.shadow.camera.near = 2; light.shadow.camera.far = 6000; light.shadow.bias = -0.002;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.95 }));
    wall.receiveShadow = true;
    const led = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3dc }));
    const glow = glowSprite(); glow.scale.set(60, 60, 1);
    const lamp = new THREE.Group();
    scene.add(hemi, key, amb, light, wall, lamp, led, glow);
    Object.assign(s, { r, scene, cam, lamp, light, amb, hemi, key, wall, glow, led });
    const size = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h, false); r.domElement.style.width = '100%'; r.domElement.style.height = '100%'; cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); s.dirty = true; };
    const ro = new ResizeObserver(size); ro.observe(el); size();
    const pts = new Map<number, [number, number]>(); let pinch = 0;
    const down = (e: PointerEvent) => { r.domElement.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const a = [...pts.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); if (pinch) s.dist = Math.min(8000, Math.max(120, s.dist * (pinch / d))); pinch = d; }
      else { s.az -= dx * 0.006; s.el = Math.min(1.45, Math.max(-1.45, s.el + dy * 0.006)); }
      s.dirty = true;
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; };
    const wheel = (e: WheelEvent) => { e.preventDefault(); s.dist = Math.min(8000, Math.max(120, s.dist * Math.exp(e.deltaY * 0.0012))); s.dirty = true; };
    r.domElement.addEventListener('pointerdown', down); r.domElement.addEventListener('pointermove', move);
    r.domElement.addEventListener('pointerup', up); r.domElement.addEventListener('pointercancel', up);
    r.domElement.addEventListener('wheel', wheel, { passive: false });
    const loop = () => {
      if (!live) return;
      if (s.dirty) {
        s.dirty = false;
        // orbit in front of the wall: az turns left/right, el tilts up/down; the camera stays on the room side
        const d = s.dist, el2 = s.el, az = s.az;
        cam.position.set(s.target.x + d * Math.cos(el2) * Math.sin(az), s.target.y + d * Math.sin(el2), s.target.z + d * Math.cos(el2) * Math.cos(az));
        cam.lookAt(s.target); r.render(scene, cam);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => {
      live = false; ro.disconnect();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); disposeMat(m.material); });
      r.dispose(); r.domElement.remove();
    };
  }, []);

  // rebuild the lamp when the design changes
  useEffect(() => {
    const s = st.current, g = s.lamp; if (!g || !data) return;
    for (const o of [...g.children]) { g.remove(o); const m = o as THREE.Mesh; m.geometry?.dispose(); disposeMat(m.material); }
    const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(WALL_COLOUR).convertSRGBToLinear(), roughness: 0.7, side: THREE.DoubleSide, flatShading: true });
    for (const w of walls) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(w.tris, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, wallMat); m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    // base (a simple stand-in for the printed base), plate and LED post
    const baseMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2f3125').convertSRGBToLinear(), roughness: 0.8 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2 * G.baseX, 2 * G.baseY, G.ledge), baseMat); base.position.set(0, 0, G.ledge / 2); base.castShadow = true; g.add(base);
    if (data.plate) {
      const pl = data.plate, mat = new THREE.MeshStandardMaterial({ map: plateTexture(pl), roughness: 0.6 });
      const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(pl.plateColor).convertSRGBToLinear(), roughness: 0.6 });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(pl.W, pl.H, 2), [side, side, side, side, mat, side]);
      plate.position.set(0, 0, G.plateZ + 1); plate.castShadow = true; g.add(plate);
    }
    const ledZ = G.ledge + data.apex;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, ledZ - 3 - 3, 32), new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.5 }));
    post.rotation.x = Math.PI / 2; post.position.set(0, 0, (ledZ - 3 + 3) / 2); post.castShadow = false; g.add(post);
    // screws: two M2.5 pan heads low on every wall, where the printed walls have their holes
    const screwMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.3 });
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.5, roughness: 0.6 });
    const NORMAL: Record<string, [number, number, number]> = { top: [0, 1, 0], bottom: [0, -1, 0], right: [1, 0, 0], left: [-1, 0, 0] };
    for (const p of data.panels) {
      const hs = p.id === 'top' || p.id === 'bottom' ? 30 : 40, nrm = new THREE.Vector3(...NORMAL[p.id]);
      for (const sgn of [-1, 1]) {
        const at = toLamp(p.id, new Float32Array([sgn * hs, 9.25, 0]));
        const head = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 1.3, 24), screwMat);
        head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
        head.position.set(at[0], at[1], at[2]).addScaledVector(nrm, 0.65); head.castShadow = true; g.add(head);
        const slot = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 0.6), slotMat);
        slot.quaternion.copy(head.quaternion); slot.position.copy(head.position).addScaledVector(nrm, 0.5); g.add(slot);
      }
    }
    // the rocker switch, in its notch at the foot of the left wall (wall 3)
    const sw = new THREE.Group(), bodyMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5 });
    const rockerMat = new THREE.MeshStandardMaterial({ color: lightOn ? 0xb3262d : 0x1d1d1d, roughness: 0.45 });
    sw.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 14.2, 11.6), bodyMat));
    const rocker = new THREE.Mesh(new THREE.BoxGeometry(2.4, 12, 9.4), rockerMat); rocker.position.x = -1.4; rocker.rotation.y = lightOn ? 0.12 : -0.12; sw.add(rocker);
    sw.position.set(-G.baseX - 0.6, (17.86 + 32.06) / 2, G.ledge + 6.05); g.add(sw);
    s.led!.position.set(0, 0, ledZ); s.glow!.position.set(0, 0, ledZ); s.light!.position.set(0, 0, ledZ);
    s.dirty = true;
  }, [walls, data, lightOn]);

  // daylight studio for the 3D view, a dark room lit only by the LED for the wall view
  useEffect(() => {
    const s = st.current; if (!s.scene) return;
    const wallView = mode === 'wall';
    s.scene.background = new THREE.Color(wallView ? '#0d0e0a' : '#dcddd2');
    // with the light off, the wall view is a dim room so the lamp itself can still be seen
    s.hemi!.intensity = wallView ? (lightOn ? 0.04 : 0.35) : 0.75; s.key!.intensity = wallView ? (lightOn ? 0 : 0.25) : 0.6; s.amb!.intensity = wallView ? 0.02 : 0.05;
    s.light!.intensity = lightOn ? (wallView ? 1.8 : 0.35) : 0; s.light!.castShadow = wallView && lightOn;
    s.wall!.visible = wallView; s.glow!.visible = wallView && lightOn;
    (s.led!.material as THREE.MeshBasicMaterial).color.set(lightOn ? (wallView ? 0xfff6e2 : 0xfff0c8) : 0xcfcabb);
    if (s.scene.background instanceof THREE.Color && wallView) s.scene.background.set(lightOn ? '#0d0e0a' : '#55574a');
    s.dirty = true;
  }, [mode, lightOn]);
  // a fresh view of the lamp or the wall each time the view changes
  useEffect(() => {
    const s = st.current;
    if (mode === 'wall') { s.target.set(0, 0, 0); s.az = 0.18; s.el = -0.08; s.dist = 2600; }
    else { s.target.set(0, 0, 40); s.az = 0.6; s.el = 0.35; s.dist = 430; }
    s.dirty = true;
  }, [mode]);

  return (
    <div className="lampviewwrap">
      <div ref={box} className="lampview" style={height ? { height } : undefined} />
      <button type="button" className={`lampswitch${lightOn ? ' on' : ''}`} aria-pressed={lightOn} onClick={() => setLightOn((v) => !v)}>
        <span className="rocker" aria-hidden="true" />{lightOn ? 'Light on' : 'Light off'}
      </button>
    </div>
  );
}
