import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { NameMaker } from '@/components/name/name-maker';

export const metadata: Metadata = pageMeta({
  title: 'Make a Name Keychain or Name Sign – Free Preview, STL',
  absoluteTitle: true,
  description: 'Make a 3D printable name keychain, name sign or cake topper in English, Hindi, Punjabi, Tamil and 7 more Indian scripts. Two-colour STL files.',
  path: '/tools/name-sign/make',
  keywords: ['name keychain stl', 'name sign 3d print', 'hindi name keychain', 'cake topper stl', 'custom name plate stl', 'punjabi name keychain'],
});

export default async function MakeName() {
  const c = await makerContext('name-sign');
  return (
    <KitPage slug="name-sign" name="Name Sign & Keychain Maker" title="Make a name keychain or sign" note={previewNote(c.live, 'Free to try. Type a name in any Indian language or English; the files are built when you download.')}>
      <NameMaker {...c.buy} />
    </KitPage>
  );
}
