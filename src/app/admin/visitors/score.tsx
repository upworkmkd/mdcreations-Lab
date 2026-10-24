/** How far a visitor got, 0-100: pages and clicks a little, a picture or a saved design more, checkout, sign-up, payment and downloads the most. */
export function ScoreBadge({ n }: { n: number }) {
  const k = n >= 50 ? 'hot' : n >= 20 ? 'warm' : 'cold';
  return <span className={`adm-score ${k}`} title={`Score ${n} of 100 (${k})`}><b>{n}</b>{k}</span>;
}
