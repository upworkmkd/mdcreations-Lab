import Link from 'next/link';

/** Page frame for a maker: breadcrumbs, the title, a short note, then the workbench. */
export function KitPage({ slug, name, title, note, children }: { slug: string; name: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ maxWidth: 1480 }}>
      <div style={{ padding: '30px 0 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/#tools">Tools</Link><span>/</span><Link href={`/tools/${slug}`}>{name}</Link></nav>
          <h1 className="serif" style={{ font: '500 clamp(34px, 4.4vw, 52px)/1.02 var(--serif)', marginTop: 12 }}>{title}</h1>
        </div>
        <p className="muted" style={{ maxWidth: '52ch', fontSize: 15 }}>{note}</p>
      </div>
      {children}
      <div style={{ height: 64 }} />
    </div>
  );
}

export const previewNote = (live: boolean, free = 'Free to try. Your picture stays in your browser; the printable files are built when you download.') =>
  live ? free : 'Admin preview: this tool is not live yet. Try it, download for free, and switch it to Live in Admin → Tools and prices when you are happy.';
