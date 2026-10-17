export function AuthShell({ children, quote }: { children: React.ReactNode; quote?: string }) {
  return (
    <div className="auth">
      <div className="side" aria-hidden><p>{quote ?? 'A picture, a little light, and a wall.'}</p></div>
      <div className="panel"><div className="box">{children}</div></div>
    </div>
  );
}
