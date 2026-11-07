import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { FlipMaker } from '@/components/flip/flip-maker';

export const metadata: Metadata = pageMeta({
  title: 'Flip Picture Maker – Two Pictures in One 3D Print (3MF)',
  absoluteTitle: true,
  description: 'Make a 3D printed flip picture: one picture from the left, another from the right. Words or photos, a colour 3MF for the AMS, STL files and a stand.',
  path: '/tools/flip-picture/make',
  image: '/images/hero-flip-picture.jpg',
  keywords: ['lenticular 3d print', 'flip picture 3d print', 'two images one print', 'lenticular stl generator', 'changing picture 3d print', 'ams multicolor print', 'bambu lab lenticular', 'lenticular photo gift'],
});

export default async function MakeFlip({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await makerContext('flip-picture', (await searchParams).design);
  return (
    <KitPage slug="flip-picture" editing={c.saved?.name} name="Flip Picture" title="Two pictures, one print" note={previewNote(c.live, 'Free to try. Choose words or a picture for each side and turn the preview. The printable files are built when you download.')}>
      <FlipMaker {...c.buy} saved={c.saved} />
    </KitPage>
  );
}
