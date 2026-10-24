import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { NameMaker } from '@/components/name/name-maker';

export const metadata: Metadata = pageMeta({
  title: 'Name Keychain, Name Sign & Cake Topper STL Maker – Hindi, Punjabi, Tamil & More',
  absoluteTitle: true,
  description: 'Make a 3D printable name keychain, desk or wall name sign, or cake topper in English, Hindi, Marathi, Punjabi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam or Urdu. Two-colour STL files.',
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
