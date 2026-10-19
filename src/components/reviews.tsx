import { supabasePublic } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/env';
import { toolBySlug } from '@/lib/tools';

type Review = { id: string; name: string; place: string | null; rating: number; body: string; verified: boolean; tool_slug: string | null; created_at: string };

async function published(tool?: string) {
  if (!supabaseConfigured()) return [];
  try {
    let q = supabasePublic().from('testimonials').select('id, name, place, rating, body, verified, tool_slug, created_at').eq('status', 'published');
    if (tool) q = q.eq('tool_slug', tool);
    const { data } = await q.order('created_at', { ascending: false }).limit(9);
    return (data ?? []) as Review[];
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
