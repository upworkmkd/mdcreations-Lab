import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pageMeta } from '@/lib/seo';
import { getCurrency, getTool } from '@/lib/catalog.server';
import { printOffer } from '@/lib/maker-context.server';
import { getViewer } from '@/lib/auth.server';
import { KitPage } from '@/components/kit/kit-page';
import { ImageStlMaker } from '@/components/image-stl/image-stl-maker';

export const metadata: Metadata = pageMeta({
  title: 'Convert Image to STL Online – Free PNG, JPG & SVG to STL',
  absoluteTitle: true,
  description: 'Convert a PNG, JPG or SVG to a 3D printable STL for free: raised logos, keychains, stamps, coasters and heightmap reliefs. Made in your browser, no upload.',
  path: '/tools/image-to-stl/make',
  image: '/images/hero-image-to-stl.jpg',
  keywords: ['image to stl', 'convert image to stl', 'png to stl', 'jpg to stl', 'svg to stl', 'image to stl converter online', 'logo to stl', 'picture to stl free', 'heightmap to stl', 'png to stl keychain', 'image to 3d print'],
});

export default async function ImageToStlPage() {
  const [tool, viewer, currency] = await Promise.all([getTool('image-to-stl'), getViewer(), getCurrency()]);
  if (tool?.status !== 'live' && viewer?.role !== 'admin') redirect('/tools/image-to-stl');
  return (
    <KitPage slug="image-to-stl" name="Image to STL Converter" title="Convert an image to STL"
      note="Free, no account. Upload a PNG, JPG or SVG and download a printable STL. Everything is made in your browser; your picture is never uploaded.">
      <ImageStlMaker print={printOffer(tool, currency, viewer?.role === 'admin')} signedIn={Boolean(viewer)} />
      <section className="istl-notes">
        <div>
          <h2>Which mode should I use?</h2>
          <p><b>Raised shape</b> is for logos, silhouettes, drawings, names and icons. The tool finds the shape (dark parts, light parts, everything but a plain background, or everything that is not transparent) and lifts it straight up with clean sides, on a plate, an outline base, a round coaster or on its own. It is the way to make signs, fridge magnets, keychains, stamps and two-colour plaques.</p>
          <p><b>Heightmap relief</b> is for photos and shaded art. Every shade becomes a height, so the picture turns into a textured surface you can touch. For a framed plaque with a hanging hole, see the <Link href="/tools/photo-relief">Photo Relief Maker</Link>; for a photo that glows when lit from behind, the <Link href="/tools/lithophane">Lithophane Maker</Link>.</p>
        </div>
        <div>
          <h2>Tips for a clean print</h2>
          <ul>
            <li>Start from a sharp picture with a plain or transparent background. Remove a photo&apos;s background first if you only want the subject.</li>
            <li>Keep lines at least 0.8 mm wide at the final size, or use “Thicken thin lines”.</li>
            <li>For two colours with one nozzle, add a filament change at the height shown under the preview.</li>
            <li>Want your picture as a wall shadow instead? Try the <Link href="/tools/shadow-lamp">Shadow Lamp Maker</Link>.</li>
          </ul>
        </div>
      </section>
    </KitPage>
  );
}
