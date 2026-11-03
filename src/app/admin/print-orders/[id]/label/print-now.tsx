'use client';
export function PrintNow() {
  return <p className="label-actions"><button type="button" className="btn" onClick={() => window.print()}>Print label</button></p>;
}
