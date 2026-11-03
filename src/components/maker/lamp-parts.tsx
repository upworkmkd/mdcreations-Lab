'use client';
import { useMemo } from 'react';
import { WhatYouGet, type GetPart } from '@/components/kit/what-you-get';
import { panelTris, type LampData } from './lamp-view';

/** "What you get" for a shadow lamp: the walls of this design, its cover plate, the parts every lamp shares and the electronics. */
export function LampParts({ data }: { data: LampData | null }) {
  // the walls lying flat as they print, side by side
  const walls = useMemo(() => {
    if (!data?.panels.length) return null;
    const flat = data.panels.map((p) => panelTris(p));
    const n = flat.reduce((a, t) => a + t.length, 0), out = new Float32Array(n); let o = 0, y = 0;
    for (const t of flat) {
      let lo = Infinity, hi = -Infinity; for (let i = 1; i < t.length; i += 3) { lo = Math.min(lo, t[i]); hi = Math.max(hi, t[i]); }
      for (let i = 0; i < t.length; i += 3) { out[o + i] = t[i]; out[o + i + 1] = t[i + 1] - lo + y; out[o + i + 2] = t[i + 2]; }
      o += t.length; y += hi - lo + 6;
    }
    return out;
  }, [data]);
  // the cover plate: the picture in its colour on the plate colour
  const plate = useMemo(() => {
    const pl = data?.plate; if (!pl) return null;
    const c = document.createElement('canvas'), S = 256; c.width = S; c.height = S;
    const g = c.getContext('2d')!; g.fillStyle = '#efeee6'; g.fillRect(0, 0, S, S);
    const k = Math.min((S - 24) / pl.W, (S - 24) / pl.H), w = pl.W * k, h = pl.H * k, x0 = (S - w) / 2, y0 = (S - h) / 2;
    g.fillStyle = pl.plateColor; g.fillRect(x0, y0, w, h);
    const art = document.createElement('canvas'); art.width = pl.img.w; art.height = pl.img.h;
    const ag = art.getContext('2d')!, im = ag.createImageData(pl.img.w, pl.img.h), hex = [1, 3, 5].map((i) => parseInt(pl.artColor.slice(i, i + 2), 16));
    // the picture's rows run bottom to top
    for (let y = 0; y < pl.img.h; y++) for (let x = 0; x < pl.img.w; x++) if (pl.img.data[y * pl.img.w + x]) {
      const k = 4 * ((pl.img.h - 1 - y) * pl.img.w + x); im.data[k] = hex[0]; im.data[k + 1] = hex[1]; im.data[k + 2] = hex[2]; im.data[k + 3] = 255;
    }
    ag.putImageData(im, 0, 0);
    g.imageSmoothingQuality = 'high'; g.drawImage(art, x0, y0, w, h);
    return c.toDataURL('image/png');
  }, [data]);

  if (!data) return <p className="wyg" style={{ color: 'var(--ink-3)' }}>Upload a picture to see the parts of your lamp.</p>;
  const parts: GetPart[] = [
    { title: 'Shadow walls', count: data.panels.length, text: 'Your picture, cut into the walls so the light throws it on the wall. Printed flat, no supports.', tris: walls, color: '#7d8460', tag: 'your design' },
    ...(data.plate ? [{ title: data.plate.combined ? 'Cover plate (one plate, 2 colours)' : 'Cover plate + press-in picture', text: data.plate.combined ? 'Your picture inlaid in the plate, in two colours from one print (needs an AMS).' : 'The plate, and your picture as a second print that presses into it.', image: plate ?? undefined, tag: 'your design' }] : []),
    ...(data.withBase ? [
      { title: 'Lamp base', text: 'The box the walls stand on. Holds the battery holder and the switch, with a keyhole to hang it.', image: '/what-you-get/lamp-base.webp' },
      { title: 'Battery cover', text: 'Closes the back of the base.', image: '/what-you-get/battery-cover.webp' },
    ] : []),
    { title: 'LED post', text: `Made for this design: it holds the LED ${Math.round(data.apex)} mm from the wall, where the shadow needs the light.`, image: '/what-you-get/led-post.webp' },
  ];
  return (
    <WhatYouGet title="Everything in your lamp" meta="2 × AA cells · 5 mm LED" parts={parts}
      files={[
        { title: 'README.txt', text: 'Which wall goes where, print settings and how to put it together.' },
        { title: 'LICENSE.txt', text: 'Your commercial license: sell the lamps and the files.' },
        { title: 'Shadow preview', text: 'A picture of the shadow, for your listing or your customer.' },
      ]}
      needs={[
        { title: '2 × AA battery holder', text: 'With wires, for 2 pencil cells (3 V).' },
        { title: '2 × AA cells', text: 'Rechargeable ones work well.' },
        { title: 'Small rocker switch', text: 'On / off, clicks into the left wall (KCD11 size).' },
        { title: '5 mm LED', text: 'Warm white looks best. It sits on top of the LED post.' },
        { title: 'M2.5 × 8 mm screws', text: 'Self-tapping, to fix each wall to the base.' },
      ]} />
  );
}
