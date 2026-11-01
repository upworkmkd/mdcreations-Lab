import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminProduct } from '@/lib/stl/shop.server';
import { Card, PageHead, ago } from '../../ui';
import { DetailsForm, FilesManager, ImagesManager } from '../forms';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;   // building the download zip reads every STL
export const metadata = { title: 'STL design' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditStl({ params }: PageProps<'/admin/stl/[id]'>) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const p = await adminProduct(id);
  if (!p) notFound();
  const stale = Boolean(p.package_path && !p.package_built_at);   // files changed since the zip was built
  return (
    <>
      <PageHead title={p.title} sub={<><Link href="/admin/stl">← STL files</Link> · {p.status} · updated {ago(p.updated_at)} · <Link href={`/stl-files/${p.slug}`} target="_blank">{p.status === 'live' ? 'View in the shop ↗' : 'Preview the page ↗'}</Link></>} />
      <div className="adm-stl">
        <div>
          <Card title="Details, prices and SEO"><DetailsForm p={p} /></Card>
        </div>
        <div>
          <Card title="Pictures"><ImagesManager id={p.id} images={p.images} /></Card>
          <Card title="STL files (private)">
            <FilesManager id={p.id} files={p.files} pkg={p.package_path ? { name: p.package_path.split('/').pop()!, bytes: p.package_bytes ?? 0, at: p.package_built_at } : null} stale={Boolean(stale)} />
          </Card>
        </div>
      </div>
    </>
  );
}
