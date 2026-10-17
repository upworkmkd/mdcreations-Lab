import type { Metadata } from 'next';
import { CANONICAL_URL as SITE_URL, SOCIALS, SUPPORT_EMAIL } from '@/lib/env';

export const SITE_NAME = 'MD Creations Labs';
const DEFAULT_IMAGE = '/images/hero-shadow-lamp.jpg';

/** Search titles and descriptions per tool: what people actually type into Google. */
export const TOOL_SEO: Record<string, { title: string; description: string; keywords: string[] }> = {
  'shadow-lamp': {
    title: 'Shadow Lamp Maker – Turn Any Picture into a 3D Printable Shadow Lamp (STL)',
    description: 'Make a custom shadow lamp from your own picture. Upload a silhouette or photo, preview the exact shadow on the wall, and download print-ready STL files: walls, base and an inlaid cover plate.',
    keywords: ['shadow lamp maker', 'shadow lamp STL', 'custom shadow lamp', '3D printed shadow lamp', 'photo to shadow lamp', 'shadow lamp generator', 'wall shadow lamp', 'silhouette lamp STL', 'shadow projection lamp', '3D print lamp file'],
  },
  statue: {
    title: 'Statue Maker – Turn Photos into a 3D Printable Statue or Bust (STL)',
    description: 'Coming soon: turn a set of photos into a solid, watertight 3D printable statue, bust or figurine with a flat base, sized for your printer.',
    keywords: ['photo to statue', 'photo to 3D model', '3D printable bust', 'statue STL maker', 'figurine from photo'],
  },
  'layered-sculpture': {
    title: 'Layered Sculpture Maker – Stacked Slice Art & Topographic Layers (STL, SVG, DXF)',
    description: 'Coming soon: slice any 3D model or picture into numbered, keyed layers you can 3D print or laser cut and stack into a sculpture or topographic wall art.',
    keywords: ['layered sculpture', 'slice 3D model into layers', 'stacked slice sculpture', 'topographic layer art', 'slicer for laser cut layers'],
  },
  'stl-repair': {
    title: 'STL Repair – Fix Holes, Flipped Normals and Non-Manifold Meshes Online',
    description: 'Coming soon: find and fix the mesh errors that make slicers complain. Close holes, fix flipped faces and remove duplicate shells, with a report of every fix.',
    keywords: ['STL repair', 'fix STL file online', 'repair non manifold mesh', 'STL hole fix', 'watertight STL'],
  },
};

export function pageMeta({ title, description, path, image = DEFAULT_IMAGE, keywords, noindex, absoluteTitle }: {
  title: string; description: string; path: string; image?: string; keywords?: string[]; noindex?: boolean; absoluteTitle?: boolean;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: SITE_NAME, url, title, description, images: [{ url: image, width: 1920, height: 1080, alt: title }], locale: 'en_IN' },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true, 'max-image-preview': 'large' },
  };
}

export const NOINDEX: Metadata = { robots: { index: false, follow: false } };

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: 'MD Creations', url: SITE_URL, logo: `${SITE_URL}/brand/logo-1024.png`,
      email: SUPPORT_EMAIL, sameAs: SOCIALS.map((s) => s.url) },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, name: SITE_NAME, url: SITE_URL, publisher: { '@id': `${SITE_URL}/#org` }, inLanguage: 'en' },
  ],
});

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
