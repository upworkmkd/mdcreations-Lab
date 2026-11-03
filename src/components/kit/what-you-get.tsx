'use client';
import { useEffect, useState } from 'react';
import * as THREE from 'three';

/* "What you get": every part the download (or a printed order) contains, each with a small picture of the part made
 * from the current design, plus the other files and anything else needed to finish the piece. */

export type GetPart = {
  title: string; text: string;
  tris?: Float32Array | null; color?: string;   // drawn from the design, or…
  image?: string;                                 // …a fixed picture (parts that are the same for every design)
  count?: number; tag?: string; link?: { label: string; onClick(): void };
};
export type GetLine = { title: string; text: string; image?: string };

/* ------------------------------------------------------------------ part pictures, drawn once per part */
let R: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null;
const cache = new WeakMap<Float32Array, Map<string, string>>();
function renderer() {
  if (R) return R;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(256, 256, false); r.setPixelRatio(1); r.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50000); cam.up.set(0, 0, 1);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x77796b, 0.8));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.65); d1.position.set(-1, -1.5, 2.2); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.25); d2.position.set(1.4, 1, 0.4); scene.add(d2);
  R = { r, scene, cam }; return R;
}
function picture(tris: Float32Array, color: string) {
  const hit = cache.get(tris)?.get(color); if (hit) return hit;
  const { r, scene, cam } = renderer();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(tris, 3)); geo.computeVertexNormals(); geo.computeBoundingBox();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).convertSRGBToLinear(), roughness: 0.75, flatShading: true, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat); scene.add(m);
  const bb = geo.boundingBox!, c = new THREE.Vector3(), sz = new THREE.Vector3(); bb.getCenter(c); bb.getSize(sz);
  const big = Math.max(sz.x, sz.y, sz.z, 1), dist = big * 2.05;
  // flat parts (plates, walls, signs) are seen mostly from above, so their shapes read; tall ones from the side
  if (sz.z < 0.25 * Math.max(sz.x, sz.y)) cam.position.set(c.x - dist * 0.12, c.y - dist * 0.42, c.z + dist * 0.9);
  else if (sz.y < 0.25 * Math.max(sz.x, sz.z)) cam.position.set(c.x - dist * 0.28, c.y - dist * 0.95, c.z + dist * 0.3);   // upright panels: from the front
  else if (sz.x < 0.25 * Math.max(sz.y, sz.z)) cam.position.set(c.x - dist * 0.95, c.y - dist * 0.28, c.z + dist * 0.3);
  else cam.position.set(c.x - dist * 0.55, c.y - dist * 0.75, c.z + dist * 0.62);
  cam.lookAt(c); cam.updateProjectionMatrix();
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  scene.remove(m); geo.dispose(); mat.dispose();
  if (!cache.has(tris)) cache.set(tris, new Map()); cache.get(tris)!.set(color, url);
  return url;
}

function Thumb({ part }: { part: GetPart }) {
  const [url, setUrl] = useState<string | null>(part.image ?? null);
  useEffect(() => {
    if (part.image || !part.tris?.length) return;
    let ok = true;
    const id = requestAnimationFrame(() => { try { const u = picture(part.tris!, part.color ?? '#d9d4c4'); if (ok) setUrl(u); } catch { /* no WebGL: no picture */ } });
    return () => { ok = false; cancelAnimationFrame(id); };
  }, [part.tris, part.color, part.image]);
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="wyg-pic">{url || part.image ? <img src={url ?? part.image} alt="" /> : null}</span>;
}

export function WhatYouGet({ title = 'Everything in your download', meta, parts, files = [], needs = [], note }: {
  title?: string; meta?: string; parts: GetPart[]; files?: GetLine[]; needs?: GetLine[]; note?: React.ReactNode;
}) {
  return (
    <div className="wyg">
      <div className="wyg-head"><h3>{title}</h3>{meta && <span>{meta}</span>}</div>
      <p className="wyg-sec">3D-printed parts</p>
      <ul className="wyg-grid">
        {parts.map((p) => (
          <li key={p.title} className="wyg-card">
            <Thumb part={p} />
            <div>
              <b>{p.count && p.count > 1 ? `${p.count} × ` : ''}{p.title}{p.tag ? <em>{p.tag}</em> : null}</b>
              <p>{p.text}</p>
              {p.link && <button type="button" className="linkish" onClick={p.link.onClick}>{p.link.label}</button>}
            </div>
          </li>
        ))}
      </ul>
      {files.length > 0 && <>
        <p className="wyg-sec">Also in the download</p>
        <ul className="wyg-list">{files.map((f) => <li key={f.title}><b>{f.title}</b><span>{f.text}</span></li>)}</ul>
      </>}
      {needs.length > 0 && <>
        <p className="wyg-sec">You will also need</p>
        <ul className="wyg-grid">{needs.map((n) => (
          <li key={n.title} className="wyg-card small">
            {n.image ? <Thumb part={{ title: n.title, text: n.text, image: n.image }} /> : null}
            <div><b>{n.title}</b><p>{n.text}</p></div>
          </li>
        ))}</ul>
      </>}
      {note && <p className="wyg-note">{note}</p>}
    </div>
  );
}

/** Standard lines for every paid download. */
export const STANDARD_FILES: GetLine[] = [
  { title: 'README.txt', text: 'Print settings, orientation and the colour changes for your design.' },
  { title: 'LICENSE.txt', text: 'Your commercial license: sell the prints and the files.' },
  { title: 'Preview picture', text: 'A JPG of your design, for your listing or your records.' },
];
