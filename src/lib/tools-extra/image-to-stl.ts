/* Catalogue entry for the free Image to STL converter. */
import type { Tool, ToolSeo } from '@/lib/tools';

export const tool: Tool | null = {
  slug: 'image-to-stl',
  name: 'Image to STL Converter',
  short: 'Any PNG, JPG or SVG to a printable STL: raised logos, keychains, stamps and heightmap reliefs.',
  lede: 'Convert a picture into a 3D printable STL in your browser. Logos, silhouettes, drawings and text become a raised shape on a plate, an outline base, a round coaster or a keychain; photos become a heightmap relief. Free, no account, and your picture is never uploaded.',
  status: 'live',
  makePath: '/tools/image-to-stl/make',
  index: '15',
  image: '/images/hero-image-to-stl.jpg',
  free: true,
  slide: { title: 'Any picture, printable.', lede: 'PNG, JPG and SVG to STL: raised logos, keychains, stamps and reliefs. Free, made in your browser.' },
  youGet: [
    'A binary STL that opens in any slicer, and a two-colour 3MF for Bambu Studio and OrcaSlicer',
    'Raised shape mode for logos, silhouettes and drawings, with straight, clean sides',
    'Heightmap relief mode for photos: dark or light parts stand higher',
    'Plate, outline, round coaster or no base, plus a keychain hole and a mirror for stamps',
    'Background removal, darkness cut-off, line thickening and speck clean-up',
  ],
  steps: [
    { title: 'Upload a picture', text: 'A PNG, JPG, SVG or WebP: a logo, a silhouette, a drawing, a name or a photo. It stays on your device.' },
    { title: 'Choose what to make', text: 'A raised shape (with a plate, an outline base, a coaster or a keychain hole) or a heightmap relief. Set the size and height and watch the 3D preview.' },
    { title: 'Download and print', text: 'One STL, ready to slice, or a 3MF with the base and the shape in two colours. Print it flat.' },
  ],
  specsTitle: 'The converter',
  specs: [
    ['Pictures', 'PNG, JPG, SVG, WebP, GIF, BMP (transparent PNGs too)'],
    ['Modes', 'Raised shape (extrude) or heightmap relief'],
    ['Size', '15 to 300 mm wide, shape 0.4 to 20 mm high'],
    ['Bases', 'Rounded plate, outline, round coaster or none, with a keychain hole'],
    ['Files', 'Binary STL, or a two-colour 3MF'],
    ['Price', 'Free, no account, no watermark'],
  ],
  faq: [
    { q: 'How do I convert an image to STL?', a: 'Upload the picture, choose “Raised shape” for a logo, silhouette or drawing, or “Heightmap relief” for a photo, set the width and height, and press Download STL. The file is made in your browser in a second or two.' },
    { q: 'Is this image to STL converter free?', a: 'Yes, completely free, with no account, no watermark and no limit. You may sell what you print.' },
    { q: 'Is my picture uploaded?', a: 'No. The conversion runs in your browser, so the picture never leaves your device.' },
    { q: 'Which pictures convert best?', a: 'A clear dark shape on a plain light background, or a PNG with a transparent background. Remove the background of a photo first (remove.bg or Canva do it free) if you want just the subject raised. For a photo with shading, use Heightmap relief.' },
    { q: 'What is the difference between a raised shape and a heightmap?', a: 'A raised shape takes the outline of your picture and lifts it straight up, like a cookie cutter or a sign: perfect for logos, names and silhouettes. A heightmap turns every shade into a height, so a photo becomes a textured relief, like a carved plaque.' },
    { q: 'Can I convert PNG, JPG and SVG to STL?', a: 'Yes. PNG (including transparent PNGs), JPG, SVG, WebP, GIF and BMP all work. iPhone HEIC photos need saving as JPG first.' },
    { q: 'How do I make a two-colour print?', a: 'Download the 3MF: Bambu Studio and OrcaSlicer open it with the base and the raised shape as two colours. With one nozzle, use the STL and add a filament change at the height shown under the preview.' },
    { q: 'Can I make a keychain or a rubber-stamp style print?', a: 'Yes. Set a keychain hole size for a ring hole above the shape, and tick Mirror for stamps so the print comes out the right way round.' },
  ],
};

export const seo: ToolSeo | null = {
  title: 'Image to STL Converter (Free) – PNG, JPG & SVG to STL Online',
  description: 'Free image to STL converter: turn a PNG, JPG or SVG into a 3D printable STL. Raised logos, keychains, stamps and heightmap reliefs, made in your browser.',
  keywords: [
    'image to stl', 'image to stl converter', 'png to stl', 'jpg to stl', 'svg to stl', 'picture to stl', 'photo to stl',
    'convert image to stl free', 'image to 3d model for 3d printing', 'logo to stl', '2d image to 3d print', 'heightmap to stl',
    'png to stl keychain', 'image to stl online free', 'jpeg to stl converter', 'drawing to stl', 'image to stl bambu lab', 'logo keychain stl',
  ],
};
