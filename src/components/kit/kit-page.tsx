import Link from 'next/link';
import { JsonLd, makerLd } from '@/lib/seo';
import { toolBySlug } from '@/lib/tools';
import { EditGate } from './edit-gate';

/** Page frame for a maker: breadcrumbs, the title, a short note, then the workbench. */
export function KitPage({ slug, name, title, note, editing, children }: { slug: string; name: string; title: string; note: string; editing?: string | null; children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ maxWidth: 1480 }}>
      <JsonLd data={makerLd(slug, name, toolBySlug(slug)?.makePath ?? `/tools/${slug}/make`)} />
      <div style={{ padding: '30px 0 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/tools">Tools</Link><span>/</span><Link href={`/tools/${slug}`}>{name}</Link></nav>
          <h1 className="serif" style={{ font: '500 clamp(34px, 4.4vw, 52px)/1.02 var(--serif)', marginTop: 12 }}>{title}</h1>
        </div>
        <p className="muted" style={{ maxWidth: '52ch', fontSize: 15 }}>{note}</p>
      </div>
      {editing != null && <EditingBanner name={editing} slug={slug} />}
      {editing != null ? <EditGate>{children}</EditGate> : children}
      <div style={{ height: 64 }} />
    </div>
  );
}

export const previewNote = (live: boolean, free = 'Free to try. We keep a copy of your picture for 10 days to improve the tool, unless you untick the box under the upload; the printable files are built when you download.') =>
  live ? free : 'Admin preview: this tool is not live yet. Try it, download for free, and switch it to Live in Admin → Tools and prices when you are happy.';

/** Shown over a maker opened from "Edit design" in the account. */
export function EditingBanner({ name, slug }: { name: string; slug: string }) {
  return (
    <p className="msg ok edit-banner" role="status">
      <span><b>Editing “{name}”</b> with the settings you saved. Change anything, then download: the new files are a new design (charged like any design, or from your plan). Your earlier files stay in <Link href="/account#files">your account</Link>.</span>
      <Link href={toolBySlug(slug)?.makePath ?? `/tools/${slug}/make`} className="linkish">Start a new design instead</Link>
    </p>
  );
}
