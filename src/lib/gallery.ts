/* Shadow-lamp examples shown on the site. Every shadow here was worked out by the maker from the picture next to it,
 * and the "render" pictures are ray-traced from the files it generated. Add photos of real prints the same way:
 * put the file in /public/images/gallery and add an entry with kind: 'photo'. */

export type GalleryItem = { src: string; title: string; note: string; kind: 'shadow' | 'render' | 'photo'; example?: string };

export const LAMP_GALLERY: GalleryItem[] = [
  { src: '/images/gallery/prod-owl.jpg', title: 'Night owl', note: 'Lamp on the wall', kind: 'render', example: 'owl' },
  { src: '/images/gallery/tree.jpg', title: 'Tree on a hill', note: 'Fine branches and leaves', kind: 'shadow', example: 'tree' },
  { src: '/images/gallery/temple.jpg', title: 'Temple', note: 'Tiers as slits of light', kind: 'shadow', example: 'temple' },
  { src: '/images/gallery/prod-mahadev.jpg', title: 'Mahadev, lit', note: 'Lamp on the wall', kind: 'render', example: 'mahadev' },
  { src: '/images/gallery/cat.jpg', title: 'Cat and moon', note: 'A loose moon on a support bar', kind: 'shadow', example: 'cat' },
  { src: '/images/gallery/elephant.jpg', title: 'Elephant', note: 'Trunk raised', kind: 'shadow', example: 'elephant' },
  { src: '/images/gallery/prod-temple.jpg', title: 'Temple, lit', note: 'Lamp on the wall', kind: 'render', example: 'temple' },
  { src: '/images/gallery/lotus.jpg', title: 'Lotus', note: 'Petals over water', kind: 'shadow', example: 'lotus' },
  { src: '/images/gallery/mountains.jpg', title: 'Mountains', note: 'Pines, peaks and birds', kind: 'shadow', example: 'mountains' },
  { src: '/images/gallery/stag.jpg', title: 'Stag', note: 'Antlers carried on the top wall', kind: 'shadow', example: 'stag' },
  { src: '/images/gallery/prod-tree.jpg', title: 'Tree, olive filament', note: 'Lamp on the wall', kind: 'render', example: 'tree' },
  { src: '/images/gallery/owl.jpg', title: 'Owl', note: 'Eyes as rings of light', kind: 'shadow', example: 'owl' },
  { src: '/images/gallery/mahadev.jpg', title: 'Mahadev', note: 'Seated figure with trishul', kind: 'shadow', example: 'mahadev' },
];

export const EXAMPLES = [
  { id: 'tree', name: 'Tree' }, { id: 'owl', name: 'Owl' }, { id: 'temple', name: 'Temple' }, { id: 'cat', name: 'Cat & moon' },
  { id: 'elephant', name: 'Elephant' }, { id: 'lotus', name: 'Lotus' }, { id: 'mountains', name: 'Mountains' }, { id: 'stag', name: 'Stag' },
  { id: 'mahadev', name: 'Mahadev' },
];

export const KIND_LABEL: Record<GalleryItem['kind'], string> = {
  shadow: 'Shadow worked out by the maker',
  render: 'Rendered from the generated files',
  photo: 'Printed lamp',
};
