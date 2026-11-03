import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { StudioMaker } from '@/components/studio/studio-maker';

export const metadata: Metadata = pageMeta({
  title: 'Design Studio – Draw a Sign, Keychain or Pixel Art to STL',
  absoluteTitle: true,
  description: 'Draw a sign, keychain, coaster or pixel art in up to 4 colours in your browser and get a colour 3MF for Bambu Studio and STL files. No Blender needed.',
  path: '/tools/design-studio/make',
  image: '/images/hero-design-studio.jpg',
  keywords: ['online 3d design tool', 'draw to stl', 'pixel art stl', 'keychain designer', 'custom sign stl', 'multicolor 3mf generator', 'blender alternative for 3d printing', 'mandala coaster stl'],
});

export default async function MakeStudio() {
  const c = await makerContext('design-studio');
  return (
    <KitPage slug="design-studio" name="Design Studio" title="Design it, print it" note={previewNote(c.live, 'Free to draw and preview in 3D. Pay per design or use your plan to download the colour 3MF and STL files.')}>
      <StudioMaker {...c.buy} />
    </KitPage>
  );
}
