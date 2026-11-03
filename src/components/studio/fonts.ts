/* Fonts for the Design Studio's text: Google fonts by group, with the weights each one has. */
import { SCRIPTS } from '@/lib/name/fonts';

export type StudioFont = { family: string; weights: number[]; group: string };
const W = (family: string, weights: number[], group = 'English') => ({ family, weights, group });

const LATIN: StudioFont[] = [
  W('Poppins', [400, 600, 800]), W('Montserrat', [400, 700, 900]), W('Fredoka', [400, 600, 700]), W('Oswald', [400, 700]),
  W('Bebas Neue', [400]), W('Bungee', [400]), W('Righteous', [400]), W('Roboto Slab', [400, 700, 900]),
  W('Playfair Display', [400, 700, 900]), W('Cinzel', [400, 700, 900]), W('Lobster', [400]), W('Pacifico', [400]),
  W('Dancing Script', [400, 700]), W('Great Vibes', [400]), W('Satisfy', [400]), W('Permanent Marker', [400]),
];
// the Indian-script fonts of the name sign maker, grouped by script
const INDIAN: StudioFont[] = SCRIPTS.filter((s) => s.id !== 'latin').flatMap((s) => s.fonts.map((f) => W(f.family, f.weight === 400 ? [400] : [400, f.weight], s.label)));

export const STUDIO_FONTS: StudioFont[] = [...LATIN, ...INDIAN].filter((f, i, a) => a.findIndex((g) => g.family === f.family) === i);
export const fontByFamily = (family: string) => STUDIO_FONTS.find((f) => f.family === family) ?? STUDIO_FONTS[0];
export const WEIGHT_NAME: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi-bold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' };
/** The nearest weight the font has. */
export const nearestWeight = (f: StudioFont, w: number) => f.weights.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), f.weights[0]);
