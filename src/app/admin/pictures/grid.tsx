import Link from 'next/link';
import { ago, shortId, when } from '../ui';

export type SharedPicture = { id: string; visitor_id: string | null; user_id: string | null; tool: string; name: string | null; width: number | null; height: number | null; bytes: number | null; created_at: string };

const TOOL: Record<string, string> = { 'shadow-lamp': 'Shadow lamp', 'shadow-lamp-plate': 'Shadow lamp plate', lithophane: 'Lithophane', 'photo-relief': 'Photo relief', 'cookie-cutter': 'Rangoli / cookie cutter', 'layered-sculpture': 'Layered sculpture' };
const left = (s: string) => { const d = 10 - Math.floor((Date.now() - new Date(s).getTime()) / 86400_000); return d <= 0 ? 'deleting soon' : `${d} ${d === 1 ? 'day' : 'days'} left`; };

/** Thumbnails of shared pictures. The images come through /api/admin/pictures, which only admins can open. */
export function PictureGrid({ rows, showVisitor = false, names }: { rows: SharedPicture[]; showVisitor?: boolean; names?: Map<string, string> }) {
  if (!rows.length) return <p className="muted">No shared pictures.</p>;
  return (
    <div className="adm-pics">
      {rows.map((p) => (
        <figure key={p.id} className="adm-pic" style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a className="img" href={`/api/admin/pictures/${p.id}`} target="_blank" rel="noreferrer noopener"><img src={`/api/admin/pictures/${p.id}`} alt={p.name ?? 'Shared picture'} loading="lazy" referrerPolicy="no-referrer" /></a>
          <figcaption className="meta">
            <b title={p.name ?? ''}>{p.name || 'picture'}</b>
            <span>{TOOL[p.tool] ?? p.tool}{p.width ? ` · ${p.width}×${p.height}` : ''}</span>
            <span className="muted" title={when(p.created_at)}>{ago(p.created_at)} · {left(p.created_at)}</span>
            {showVisitor && (p.visitor_id ? <Link href={`/admin/visitors/${p.visitor_id}`}>{names?.get(p.visitor_id) ?? `Visitor ${shortId(p.visitor_id)}`}</Link> : <span className="muted">No analytics cookies</span>)}
            <a href={`/api/admin/pictures/${p.id}?download`} className="muted">Download</a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
