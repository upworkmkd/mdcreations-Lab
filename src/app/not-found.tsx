import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="wrap page-title" style={{ borderBottom: 0, minHeight: '50vh' }}>
      <p className="eyebrow">404</p>
      <h1>Nothing on this wall.</h1>
      <p className="lede">The page you were looking for is not here.</p>
      <div className="actions"><Link className="btn" href="/">Back to Labs</Link></div>
    </div>
  );
}
