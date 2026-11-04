'use client';
import { track } from '@/components/tracker';

/** The free sample lamp (MD Creations logo): every STL file of a real download, to see what you get before buying. */
export const SAMPLE_ZIP = '/samples/md-creations-shadow-lamp-sample.zip';

export function SampleLink({ where, className = 'sample-link' }: { where: string; className?: string }) {
  return (
    <a className={className} href={SAMPLE_ZIP} download onClick={() => track('sample_download', 'Shadow lamp sample', { where })}>
      <span className="sample-ic" aria-hidden>↓</span>
      <span><b>Download a free sample lamp</b><small>The MD Creations logo lamp: walls, cover plate, base, LED post and README, as in a real download (STL, zip, 0.6 MB)</small></span>
    </a>
  );
}
