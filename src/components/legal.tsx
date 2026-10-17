export function Legal({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="wrap">
      <div className="page-title" style={{ borderBottom: 0, paddingBottom: 0 }}>
        <p className="eyebrow">{updated ? `Last updated ${updated}` : 'MD Creations Labs'}</p>
        <h1>{title}</h1>
      </div>
      <div className="prose">{children}</div>
    </div>
  );
}
