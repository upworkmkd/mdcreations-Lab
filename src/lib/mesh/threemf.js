// Writes a plain 3MF (core spec + materials extension colour group) with one object made of several coloured parts.
// Slicers that read 3MF colours (Bambu Studio, OrcaSlicer) open it with one filament per colour: Bambu Studio shows
// its colour-to-filament mapping dialog for standard 3MF colour groups. Other slicers still load the parts.
import { storeZip } from './mesh.js';

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
const RELS = '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';

const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const num = (v) => { const r = Math.round(v * 1e4) / 1e4; return Object.is(r, -0) ? '0' : String(r); };
const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : '#808080') + 'FF';

/** Triangle soup (x,y,z × 3 per triangle) to an indexed <mesh>. Shared corners become shared vertices. */
function meshXml(tris) {
  const index = new Map(), verts = [], faces = [];
  for (let i = 0; i < tris.length; i += 9) {
    const f = [];
    for (let k = 0; k < 3; k++) {
      const x = num(tris[i + k * 3]), y = num(tris[i + k * 3 + 1]), z = num(tris[i + k * 3 + 2]), key = x + ',' + y + ',' + z;
      let id = index.get(key);
      if (id === undefined) { id = verts.length; index.set(key, id); verts.push(`<vertex x="${x}" y="${y}" z="${z}"/>`); }
      f.push(id);
    }
    if (f[0] !== f[1] && f[1] !== f[2] && f[0] !== f[2]) faces.push(`<triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}"/>`);
  }
  return `<mesh><vertices>${verts.join('')}</vertices><triangles>${faces.join('')}</triangles></mesh>`;
}

/**
 * @param {{ name: string, tris: Float32Array|number[], color: string }[]} parts  one entry per part, colour as #rrggbb
 * @param {{ title: string, at?: [number, number] }} o  object name, and where to put it on the bed (mm)
 * @returns {Uint8Array} the .3mf file
 */
export function coloured3mf(parts, o) {
  const at = o.at || [128, 128];
  const colours = parts.map((p) => `<m:color color="${hex(p.color)}"/>`).join('');
  const objects = parts.map((p, i) => `<object id="${i + 2}" name="${esc(p.name)}" type="model" pid="1" pindex="${i}">${meshXml(p.tris)}</object>`).join('\n');
  const whole = parts.length + 2;
  const comps = parts.map((_, i) => `<component objectid="${i + 2}"/>`).join('');
  const model = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">\n'
    + `<metadata name="Title">${esc(o.title)}</metadata>\n<metadata name="Designer">MD Creations Labs</metadata>\n`
    + `<resources>\n<m:colorgroup id="1">${colours}</m:colorgroup>\n${objects}\n`
    + `<object id="${whole}" name="${esc(o.title)}" type="model"><components>${comps}</components></object>\n</resources>\n`
    + `<build><item objectid="${whole}" transform="1 0 0 0 1 0 0 0 1 ${num(at[0])} ${num(at[1])} 0"/></build>\n</model>\n`;
  const enc = new TextEncoder();
  return storeZip([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: enc.encode(RELS) },
    { name: '3D/3dmodel.model', data: enc.encode(model) },
  ]);
}
