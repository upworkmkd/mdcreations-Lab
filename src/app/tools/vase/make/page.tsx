import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import { makerContext } from '@/lib/maker-context.server';
import { KitPage, previewNote } from '@/components/kit/kit-page';
import { VaseMaker } from '@/components/vase/vase-maker';

export const metadata: Metadata = pageMeta({
  title: 'Vase & Lamp Shade Generator – Custom Vase Mode STL, Planters and Shades',
  absoluteTitle: true,
  description: 'Design a vase, planter or lamp shade with sliders: shape, twist, sides, ripples and rings. Vase-mode STL or real walls, and an E27/E14 fitting ring for shades.',
  path: '/tools/vase/make',
  keywords: ['vase generator stl', 'vase mode stl', 'lamp shade stl generator', 'planter stl generator', 'twisted vase 3d print', 'parametric vase'],
});

export default async function MakeVase() {
  const c = await makerContext('vase');
  return (
    <KitPage slug="vase" name="Vase & Lamp Shade Maker" title="Make a vase or lamp shade" note={previewNote(c.live, 'Free to try. Shape it with the sliders; the printable file is built when you download.')}>
      <VaseMaker {...c.buy} />
    </KitPage>
  );
}
