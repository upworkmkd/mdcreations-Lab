'use client';
import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { asciiToBinaryStl } from '@/lib/stl/binary';
import { fmtBytes, publicImageUrl, type AdminProduct, type ProductFile, type ProductImage } from '@/lib/stl/product';
import { addFiles, buildZip, createProduct, fileUploadUrl, imageUploadUrl, removeFile, saveImages, saveProduct, type FormState } from './actions';

const major = (v: number | null) => (v == null ? '' : String(v / 100));
const Msg = ({ s }: { s: FormState }) => (s?.ok ? <span className="msg ok">{s.ok}</span> : s?.error ? <span className="msg err">{s.error}</span> : null);

export function NewProduct() {
  const [state, run, pending] = useActionState<FormState, FormData>(createProduct, null);
  return (
    <form action={run} className="adm-inline" style={{ alignItems: 'center' }}>
      <input name="title" className="input" placeholder="Name of the design, e.g. Willys Jeep Scale Model" style={{ flex: 1, minWidth: 260 }} required minLength={2} maxLength={120} />
      <button className="btn small" disabled={pending}>{pending ? 'Adding…' : 'Add design'}</button>
      <Msg s={state} />
    </form>
  );
}

/* ------------------------------------------------------------------ text, prices, status, SEO */
export function DetailsForm({ p }: { p: AdminProduct }) {
  const [state, run, pending] = useActionState<FormState, FormData>(saveProduct, null);
  const [seoT, setSeoT] = useState(p.seo_title), [seoD, setSeoD] = useState(p.seo_description);
  return (
    <form action={run} className="adm-set adm-stl-form">
      <input type="hidden" name="id" value={p.id} />
      <div className="adm-stl-2">
        <label className="lbl">Name<input name="title" className="input" defaultValue={p.title} required maxLength={120} /></label>
        <label className="lbl">Address<span className="adm-slug"><span>/stl-files/</span><input name="slug" className="input" defaultValue={p.slug} maxLength={80} /></span></label>
      </div>
      <label className="lbl">One line under the name<input name="subtitle" className="input" defaultValue={p.subtitle} maxLength={200} placeholder="What it is, in one sentence" /></label>
      <label className="lbl">Description<textarea name="description" className="input" rows={7} defaultValue={p.description} maxLength={8000} />
        <small className="muted">Paragraphs separated by an empty line.</small></label>
      <label className="lbl">Assembly steps<textarea name="assembly" className="input" rows={7} defaultValue={p.assembly} maxLength={8000} />
        <small className="muted">One step per line; they are numbered on the page.</small></label>
      <label className="lbl">Hardware needed<textarea name="hardware" className="input mono" rows={4} defaultValue={p.hardware.map((h) => [h.item, h.qty, h.note].join(' | ').replace(/( \| )+$/, '')).join('\n')} />
        <small className="muted">One per line: <code>item | quantity | note</code>, e.g. <code>M3 x 10 mm screws | 8 | for the chassis</code>. Leave it empty if nothing is needed.</small></label>
      <label className="lbl">Print notes<textarea name="print_notes" className="input" rows={4} defaultValue={p.print_notes} maxLength={4000} />
        <small className="muted">One tip per line: material, layer height, supports, orientation.</small></label>
      <label className="lbl">Details table<textarea name="specs" className="input mono" rows={5} defaultValue={p.specs.map(([k, v]) => `${k}: ${v}`).join('\n')} />
        <small className="muted">One per line: <code>Label: value</code>, e.g. <code>Length: 223 mm</code>.</small></label>

      <fieldset className="adm-stl-prices">
        <legend>Prices</legend>
        <label className="adm-money"><span>STL files ₹</span><input name="price_inr" className="input" inputMode="decimal" defaultValue={major(p.price_inr)} placeholder="not sold" /></label>
        <label className="adm-money"><span>STL files $</span><input name="price_usd" className="input" inputMode="decimal" defaultValue={major(p.price_usd)} placeholder="not sold" /></label>
        <label className="adm-money"><span>Printed and posted ₹</span><input name="print_price_inr" className="input" inputMode="decimal" defaultValue={major(p.print_price_inr)} placeholder="not offered" /></label>
        <small className="muted">Tax included. Empty = not offered in that currency; 0 = free download (sign-in still needed). Printed: India only, shipping included.</small>
      </fieldset>

      <div className="adm-stl-2">
        <label className="lbl">Status
          <select name="status" className="input" defaultValue={p.status}>
            <option value="draft">Draft (only you)</option><option value="live">Live in the shop</option><option value="hidden">Hidden (buyers keep their files)</option>
          </select></label>
        <label className="lbl">Order in the shop<input name="sort" type="number" className="input" defaultValue={p.sort} /><small className="muted">Lower comes first.</small></label>
      </div>

      <fieldset className="adm-stl-seo">
        <legend>Google</legend>
        <label className="lbl">Title<input name="seo_title" className="input" value={seoT} onChange={(e) => setSeoT(e.target.value)} maxLength={120} />
          <small className={`muted${seoT.length > 65 ? ' warn' : ''}`}>{seoT.length}/60 characters. Put the main search words first, e.g. “Willys Jeep STL”.</small></label>
        <label className="lbl">Description<textarea name="seo_description" className="input" rows={3} value={seoD} onChange={(e) => setSeoD(e.target.value)} maxLength={300} />
          <small className={`muted${seoD.length > 160 ? ' warn' : ''}`}>{seoD.length}/155 characters. Shown under the title in Google results.</small></label>
        <label className="lbl">Keywords<input name="keywords" className="input" defaultValue={p.keywords.join(', ')} /><small className="muted">Comma separated, the words people search for.</small></label>
        <div className="adm-serp" aria-label="How it may look in Google">
          <span className="u">labs.themdcreations.com › stl-files › {p.slug}</span>
          <span className="t">{seoT || p.title}</span>
          <span className="d">{seoD || p.subtitle}</span>
        </div>
      </fieldset>

      <div className="adm-inline" style={{ alignItems: 'center' }}>
        <button className="btn small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        <Msg s={state} />
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ pictures */
/** Scales a photo down to 1800 px on the long side as JPEG (keeps PNG for transparency), so pages stay quick. */
async function shrink(file: File): Promise<{ blob: Blob; ext: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name} is not a JPG, PNG or WebP picture.`);
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  if (k === 1 && file.size < 900_000) return { blob: file, ext: file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg' };
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const png = file.type === 'image/png';
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), png ? 'image/png' : 'image/jpeg', 0.88));
  return { blob, ext: png ? 'png' : 'jpg' };
}

export function ImagesManager({ id, images: initial }: { id: string; images: ProductImage[] }) {
  const router = useRouter();
  const [images, setImages] = useState(initial);
  const [state, setState] = useState<FormState>(null);
  const [busy, setBusy] = useState('');
  const dirty = JSON.stringify(images) !== JSON.stringify(initial);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const added: ProductImage[] = [];
    try {
      for (const [i, f] of [...list].entries()) {
        setBusy(`Uploading ${i + 1} of ${list.length}…`);
        const { blob, ext } = await shrink(f);
        const u = await imageUploadUrl(id, ext);
        if ('error' in u) throw new Error(u.error);
        const { error } = await supabaseBrowser().storage.from('stl-images').uploadToSignedUrl(u.path, u.token, blob, { contentType: blob.type });
        if (error) throw new Error(error.message);
        added.push({ path: u.path, alt: '' });
      }
      const next = [...images, ...added];
      setImages(next);
      setState(await saveImages(id, next)); router.refresh();
    } catch (e) { setState({ error: e instanceof Error ? e.message : 'Upload failed.' }); }
    setBusy('');
  };
  const move = (i: number, to: number) => setImages((a) => { const b = [...a]; const [x] = b.splice(i, 1); b.splice(to, 0, x); return b; });
  const save = async () => { setBusy('Saving…'); setState(await saveImages(id, images)); setBusy(''); router.refresh(); };

  return (
    <div className="adm-set">
      <p className="muted adm-help">The first picture is the feature image: on the shop grid, at the top of the page and when the link is shared. Use a clear render of the finished model; add angles, the parts laid out and close-ups after it.</p>
      {images.length > 0 && (
        <ol className="adm-stl-imgs">
          {images.map((im, i) => (
            <li key={im.path}>
              <img src={publicImageUrl(im.path)} alt="" />
              {i === 0 && <span className="adm-stl-feat">Feature</span>}
              <input className="input" value={im.alt} placeholder="Describe the picture (for Google)" maxLength={160}
                onChange={(e) => setImages((a) => a.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)))} />
              <div className="adm-stl-imgacts">
                {i > 0 && <button type="button" className="linkish" onClick={() => move(i, 0)}>Make feature</button>}
                {i > 0 && <button type="button" className="linkish" onClick={() => move(i, i - 1)} aria-label="Move earlier">←</button>}
                {i < images.length - 1 && <button type="button" className="linkish" onClick={() => move(i, i + 1)} aria-label="Move later">→</button>}
                <button type="button" className="linkish danger" onClick={() => setImages((a) => a.filter((_, k) => k !== i))}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="adm-inline" style={{ alignItems: 'center' }}>
        <label className="btn small ghost">{busy || 'Add pictures'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={Boolean(busy)} onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} /></label>
        {dirty && <button type="button" className="btn small" onClick={save} disabled={Boolean(busy)}>Save order and captions</button>}
        <Msg s={state} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ STL files */
export function FilesManager({ id, files, pkg, stale }: { id: string; files: ProductFile[]; pkg: { name: string; bytes: number; at: string | null } | null; stale: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(null);
  const [busy, setBusy] = useState('');
  const [pending, start] = useTransition();
  const total = files.reduce((n, f) => n + f.bytes, 0);

  const upload = async (list: FileList | null) => {
    const picked = [...(list ?? [])].filter((f) => /\.stl$/i.test(f.name));
    if (!picked.length) { setState({ error: 'Choose .stl files.' }); return; }
    const done: ProductFile[] = [];
    try {
      for (const [i, f] of picked.entries()) {
        setBusy(`Uploading ${i + 1} of ${picked.length}: ${f.name}`);
        // text STLs (Fusion's default) become binary: about five times smaller, same model
        const bin = asciiToBinaryStl(new Uint8Array(await f.arrayBuffer()), f.name);
        const u = await fileUploadUrl(id, f.name);
        if ('error' in u) throw new Error(u.error);
        const { error } = await supabaseBrowser().storage.from('lab-files').uploadToSignedUrl(u.path, u.token, new Blob([bin as BlobPart], { type: 'model/stl' }), { contentType: 'model/stl', upsert: true });
        if (error) throw new Error(`${f.name}: ${error.message}`);
        done.push({ name: u.name, path: u.path, bytes: bin.length });
      }
    } catch (e) { setState({ error: e instanceof Error ? e.message : 'Upload failed.' }); }
    if (done.length) { setState(await addFiles(id, done)); router.refresh(); }
    setBusy('');
  };

  return (
    <div className="adm-set">
      <p className="muted adm-help">Upload every part as STL (you can pick them all at once). They are stored privately and never shown on the site. Then build the download zip: the parts, a README with the assembly, hardware and print notes, the license and the feature picture. Buyers download that zip.</p>
      <div className="adm-inline" style={{ alignItems: 'center' }}>
        <label className="btn small ghost">{busy || 'Upload STL files'}<input type="file" accept=".stl,model/stl" multiple hidden disabled={Boolean(busy)} onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} /></label>
        <button type="button" className="btn small" disabled={!files.length || pending || Boolean(busy)} onClick={() => start(async () => { setState(await buildZip(id)); router.refresh(); })}>
          {pending ? 'Building the zip…' : pkg ? 'Rebuild the download zip' : 'Build the download zip'}</button>
        <Msg s={state} />
      </div>
      {pkg ? <p className={`adm-stl-pkg${stale ? ' stale' : ''}`}>{stale ? 'Files changed: rebuild the zip so buyers get them. ' : 'Ready: '}<b>{pkg.name}</b> · {fmtBytes(pkg.bytes)}</p>
        : files.length ? <p className="adm-stl-pkg stale">No download zip yet: build it before setting the design live.</p> : null}
      {files.length > 0 && (
        <details className="adm-stl-files" open={files.length <= 12}>
          <summary>{files.length} STL files · {fmtBytes(total)}</summary>
          <ul>{files.map((f) => (
            <li key={f.path}><span>{f.name}</span><span className="id">{fmtBytes(f.bytes)}</span>
              <button type="button" className="linkish danger" disabled={pending} onClick={() => { if (confirm(`Remove ${f.name}?`)) start(async () => { setState(await removeFile(id, f.path)); router.refresh(); }); }}>Remove</button></li>
          ))}</ul>
        </details>
      )}
    </div>
  );
}
