import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { LithoMaker } from '@/components/litho/litho-maker';

export const metadata: Metadata = pageMeta({
  title: 'Make a Lithophane Online – Photo to STL, Free Preview',
  absoluteTitle: true,
  description: 'Turn a photo into a 3D printable lithophane: flat or curved panel, cylinder lamp with base, heart or moon lamp with stand. Live 3D and backlit preview.',
  path: '/tools/lithophane/make',
  keywords: ['lithophane maker online', 'image to lithophane', 'lithophane lamp stl', 'lithophane maker', 'photo to lithophane', 'lithophane stl generator', 'cylinder lithophane lamp', 'moon lamp lithophane', 'heart lithophane'],
});

export default async function MakeLithophane({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await makerContext('lithophane', (await searchParams).design);
  return (
    <KitPage slug="lithophane" editing={c.saved?.name} name="Lithophane Maker" title="Make a lithophane" note={previewNote(c.live, 'Free to try. We keep a copy of your photo for 10 days to improve the tool, unless you untick the box under the upload; the printable files are built when you download.')}>
      <LithoMaker {...c.buy} saved={c.saved} />
    </KitPage>
  );
}
