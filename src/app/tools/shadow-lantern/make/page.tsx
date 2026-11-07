import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { LanternMaker } from '@/components/lantern/lantern-maker';

export const metadata: Metadata = pageMeta({
  title: '360° Shadow Lantern Maker – Project a Scene Around the Room',
  absoluteTitle: true,
  description: 'Make a 3D printable lantern that throws a scene all around your room: stars, hearts with your names or your own picture. Rechargeable base, STL files.',
  path: '/tools/shadow-lantern/make',
  image: '/images/hero-shadow-lantern.jpg',
  keywords: ['360 shadow lamp', 'shadow lantern stl', 'star projector lamp 3d print', 'night light projector stl', 'panorama shadow lamp', 'room projector lamp diy', 'kids night light stl', 'diwali lantern 3d print', 'name heart lantern', 'rechargeable night light stl'],
});

export default async function MakeLantern({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await makerContext('shadow-lantern', (await searchParams).design);
  return (
    <KitPage slug="shadow-lantern" editing={c.saved?.name} name="360° Shadow Lantern" title="Light up the whole room" note={previewNote(c.live, 'Free to try. Pick a scene or upload a picture and see it on the walls all the way round. The printable files are built when you download.')}>
      <LanternMaker {...c.buy} saved={c.saved} />
    </KitPage>
  );
}
