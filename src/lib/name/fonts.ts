/* Fonts for the name maker, grouped by script. All are Google Fonts loaded on demand. */
export type FontChoice = { family: string; weight: number; label: string };
export type Script = { id: string; label: string; sample: string; fonts: FontChoice[] };

export const SCRIPTS: Script[] = [
  { id: 'latin', label: 'English (Latin)', sample: 'Aarav', fonts: [
    { family: 'Poppins', weight: 800, label: 'Poppins Bold' }, { family: 'Baloo 2', weight: 800, label: 'Baloo (rounded)' },
    { family: 'Pacifico', weight: 400, label: 'Pacifico (script)' }, { family: 'Lobster', weight: 400, label: 'Lobster (script)' },
    { family: 'Great Vibes', weight: 400, label: 'Great Vibes (wedding script)' }, { family: 'Bebas Neue', weight: 400, label: 'Bebas Neue (tall caps)' },
    { family: 'Fredoka', weight: 700, label: 'Fredoka (playful)' }, { family: 'Cinzel', weight: 800, label: 'Cinzel (classic)' },
  ] },
  { id: 'deva', label: 'हिन्दी / मराठी (Devanagari)', sample: 'आरव', fonts: [
    { family: 'Baloo 2', weight: 800, label: 'Baloo 2' }, { family: 'Noto Sans Devanagari', weight: 800, label: 'Noto Sans' },
    { family: 'Yatra One', weight: 400, label: 'Yatra One' }, { family: 'Rozha One', weight: 400, label: 'Rozha One' }, { family: 'Kalam', weight: 700, label: 'Kalam (handwritten)' },
  ] },
  { id: 'guru', label: 'ਪੰਜਾਬੀ (Gurmukhi)', sample: 'ਸਿਮਰਨ', fonts: [
    { family: 'Baloo Paaji 2', weight: 800, label: 'Baloo Paaji 2' }, { family: 'Noto Sans Gurmukhi', weight: 800, label: 'Noto Sans' }, { family: 'Mukta Mahee', weight: 800, label: 'Mukta Mahee' },
  ] },
  { id: 'gujr', label: 'ગુજરાતી (Gujarati)', sample: 'આરવ', fonts: [{ family: 'Baloo Bhai 2', weight: 800, label: 'Baloo Bhai 2' }, { family: 'Noto Sans Gujarati', weight: 800, label: 'Noto Sans' }] },
  { id: 'beng', label: 'বাংলা (Bengali)', sample: 'অনন্যা', fonts: [{ family: 'Baloo Da 2', weight: 800, label: 'Baloo Da 2' }, { family: 'Noto Sans Bengali', weight: 800, label: 'Noto Sans' }, { family: 'Hind Siliguri', weight: 700, label: 'Hind Siliguri' }] },
  { id: 'taml', label: 'தமிழ் (Tamil)', sample: 'அனு', fonts: [{ family: 'Baloo Thambi 2', weight: 800, label: 'Baloo Thambi 2' }, { family: 'Noto Sans Tamil', weight: 800, label: 'Noto Sans' }, { family: 'Catamaran', weight: 800, label: 'Catamaran' }] },
  { id: 'telu', label: 'తెలుగు (Telugu)', sample: 'శ్రీ', fonts: [{ family: 'Baloo Tammudu 2', weight: 800, label: 'Baloo Tammudu 2' }, { family: 'Noto Sans Telugu', weight: 800, label: 'Noto Sans' }] },
  { id: 'knda', label: 'ಕನ್ನಡ (Kannada)', sample: 'ಅನು', fonts: [{ family: 'Baloo Tamma 2', weight: 800, label: 'Baloo Tamma 2' }, { family: 'Noto Sans Kannada', weight: 800, label: 'Noto Sans' }] },
  { id: 'mlym', label: 'മലയാളം (Malayalam)', sample: 'അനു', fonts: [{ family: 'Baloo Chettan 2', weight: 800, label: 'Baloo Chettan 2' }, { family: 'Noto Sans Malayalam', weight: 800, label: 'Noto Sans' }] },
  { id: 'orya', label: 'ଓଡ଼ିଆ (Odia)', sample: 'ଅନୁ', fonts: [{ family: 'Baloo Bhaina 2', weight: 800, label: 'Baloo Bhaina 2' }, { family: 'Noto Sans Oriya', weight: 800, label: 'Noto Sans' }] },
  { id: 'arab', label: 'اردو (Urdu)', sample: 'عائشہ', fonts: [{ family: 'Noto Nastaliq Urdu', weight: 700, label: 'Nastaliq' }, { family: 'Lateef', weight: 700, label: 'Lateef' }] },
];
