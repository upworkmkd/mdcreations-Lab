'use client';
import { track } from '@/components/tracker';

/** The free sample lamp (the Hanuman ji example): every STL file of a real download, to see what you get before buying. */
export const SAMPLE_ZIP = '/samples/hanuman-shadow-lamp-sample.zip';

export function SampleLink({ where, className = 'sample-link' }: { where: string; className?: string }) {
  return (
    <a className={className} href={SAMPLE_ZIP} download onClick={() => track('sample_download', 'Shadow lamp sample', { where })}>
      <span className="sample-ic" aria-hidden>↓</span>
      <span><b>Download a free sample lamp</b><small>The Hanuman ji lamp: walls, cover plate (also as a two-colour 3MF for AMS printers), base, LED post and README, as in a real download (STL + 3MF, zip, 2.4 MB)</small></span>
    </a>
  );
}
