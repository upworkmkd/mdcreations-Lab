import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { IllusionMaker } from '@/components/illusion/illusion-maker';

export const metadata: Metadata = pageMeta({
  title: 'Two-Name Illusion Maker – 3D Print Two Names in One (STL)',
  absoluteTitle: true,
  description: 'Type two names and get one 3D printable sculpture that reads one name from the front and the other from the side. Colour 3MF and STL files.',
  path: '/tools/name-illusion/make',
  image: '/images/hero-name-illusion.jpg',
  keywords: ['two name illusion stl', 'name illusion 3d print', 'dual name sculpture', 'ambigram 3d print', 'two names one sculpture', 'couple name gift 3d print', 'name illusion generator', 'wedding gift stl'],
});

export default async function MakeIllusion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await makerContext('name-illusion', (await searchParams).design);
  return (
    <KitPage slug="name-illusion" editing={c.saved?.name} name="Two-Name Illusion" title="Two names, one sculpture" note={previewNote(c.live, 'Free to try. Type two names and turn the preview: one name from the front, the other from the side. The printable files are built when you download.')}>
      <IllusionMaker {...c.buy} saved={c.saved} />
    </KitPage>
  );
}
