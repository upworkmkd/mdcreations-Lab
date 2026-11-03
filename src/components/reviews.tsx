import { supabasePublic } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { toolBySlug } from '@/lib/tools';

type Review = { id: string; name: string; place: string | null; rating: number; body: string; verified: boolean; tool_slug: string | null; created_at: string; photos?: string[] };

async function published(tool?: string) {
  if (!supabaseConfigured()) return [];
  try {
    let q = supabasePublic().from('testimonials').select('id, name, place, rating, body, verified, tool_slug, created_at').eq('status', 'published');
    if (tool) q = q.eq('tool_slug', tool);
    const { data } = await q.order('created_at', { ascending: false }).limit(9);
    const rows = (data ?? []) as Review[];
    if (rows.length) {
      // approved photos of these reviews (the photos table may not exist yet: then just no photos)
      const { data: ph } = await supabasePublic().from('review_photos').select('id, testimonial_id').eq('status', 'published').in('testimonial_id', rows.map((r) => r.id)).order('sort');
      for (const r of rows) r.photos = (ph ?? []).filter((p) => p.testimonial_id === r.id).map((p) => p.id);
    }
    return rows;
  } catch { return []; }
}

/** Real customer reviews, published from the admin. Shows nothing until there is at least one. */
export async function Reviews({ tool, title = 'What makers say' }: { tool?: string; title?: string }) {
  const rows = await published(tool);
  if (!rows.length) return null;
  const avg = rows.reduce((a, r) => a + r.rating, 0) / rows.length;
  return (
    <section className="section" id="reviews">
      <div className="wrap">
        <div className="section-head">
          <h2>{title}</h2>
          <p><span className="stars" aria-hidden>★★★★★</span> {avg.toFixed(1)} out of 5 from {rows.length} review{rows.length === 1 ? '' : 's'} by people who used the tools.</p>
        </div>
        <ul className="reviews">
          {rows.map((r) => (
            <li key={r.id}>
              <span className="stars" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}<span>{'★'.repeat(5 - r.rating)}</span></span>
              {r.photos && r.photos.length > 0 && (
                <div className={`review-photos n${Math.min(r.photos.length, 4)}`}>
                  {r.photos.slice(0, 4).map((id, i) => (
                    <a key={id} href={`/api/reviews/photos/${id}`} target="_blank" rel="noopener" aria-label={`Photo ${i + 1} from ${r.name}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/reviews/photos/${id}`} alt={`Printed by ${r.name}`} loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
              <blockquote>{r.body}</blockquote>
              <footer>
                <b>{r.name}</b>
                <span>{[r.place, !tool && r.tool_slug ? toolBySlug(r.tool_slug)?.name : null].filter(Boolean).join(' · ')}</span>
                {r.verified && <span className="verified">Verified buyer</span>}
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
