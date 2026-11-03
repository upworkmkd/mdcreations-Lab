/* Print cost maths. Everything is per plate (one print job) first, then split over the pieces on that plate. */

export type Money = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD';
export const MONEY: Record<Money, { symbol: string; locale: string; label: string }> = {
  INR: { symbol: '₹', locale: 'en-IN', label: '₹ Indian rupee' },
  USD: { symbol: '$', locale: 'en-US', label: '$ US dollar' },
  EUR: { symbol: '€', locale: 'de-DE', label: '€ Euro' },
  GBP: { symbol: '£', locale: 'en-GB', label: '£ British pound' },
  AUD: { symbol: 'A$', locale: 'en-AU', label: 'A$ Australian dollar' },
  CAD: { symbol: 'C$', locale: 'en-CA', label: 'C$ Canadian dollar' },
};

export type Filament = { name: string; pricePerKg: number; grams: number };
export type Inputs = {
  money: Money;
  hours: number; minutes: number; pieces: number;
  filaments: Filament[];
  printerPrice: number; lifeHours: number; maintPerHour: number;
  watts: number; kwhRate: number;
  failPct: number;
  prepMin: number; postMin: number; labourRate: number;
  packaging: number; other: number;
  marginPct: number; feePct: number; taxPct: number;
};

export const DEFAULTS: Record<'INR' | 'OTHER', Omit<Inputs, 'money'>> = {
  INR: {
    hours: 4, minutes: 30, pieces: 1,
    filaments: [{ name: 'PLA', pricePerKg: 1000, grams: 120 }],
    printerPrice: 35000, lifeHours: 10000, maintPerHour: 2,
    watts: 100, kwhRate: 8,
    failPct: 5,
    prepMin: 10, postMin: 15, labourRate: 200,
    packaging: 30, other: 0,
    marginPct: 40, feePct: 0, taxPct: 18,
  },
  OTHER: {
    hours: 4, minutes: 30, pieces: 1,
    filaments: [{ name: 'PLA', pricePerKg: 20, grams: 120 }],
    printerPrice: 400, lifeHours: 10000, maintPerHour: 0.03,
    watts: 100, kwhRate: 0.16,
    failPct: 5,
    prepMin: 10, postMin: 15, labourRate: 15,
    packaging: 0.5, other: 0,
    marginPct: 40, feePct: 0, taxPct: 0,
  },
};
export const defaultsFor = (money: Money): Inputs => ({ money, ...structuredClone(DEFAULTS[money === 'INR' ? 'INR' : 'OTHER']) });

/** Typical average draw while printing PLA. A plug-in power meter gives your exact number. */
export const PRINTERS: { name: string; watts: number }[] = [
  { name: 'Bambu Lab A1 mini', watts: 80 },
  { name: 'Bambu Lab A1', watts: 95 },
  { name: 'Bambu Lab P1S / P1P', watts: 110 },
  { name: 'Bambu Lab X1 Carbon', watts: 120 },
  { name: 'Bambu Lab H2D', watts: 200 },
  { name: 'Prusa MK4 / MK4S', watts: 80 },
  { name: 'Prusa Core One', watts: 110 },
  { name: 'Creality Ender 3 V3 / SE', watts: 110 },
  { name: 'Creality K1 / K1C', watts: 150 },
  { name: 'Elegoo Neptune 4', watts: 120 },
  { name: 'Resin printer (small)', watts: 50 },
];

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export type Result = {
  hours: number; pieces: number;
  material: number; depreciation: number; depPerHour: number; maintenance: number; electricity: number; kwh: number;
  failures: number; labour: number;
  plateCost: number;            // everything that happens once per print job
  pieceMaking: number;          // plate cost split per piece
  packaging: number; other: number;
  pieceCost: number;            // full cost of one piece
  profit: number; beforeFees: number; fee: number; priceExTax: number; tax: number; price: number;
  machinePerHour: number; grams: number;
};

export function compute(x: Inputs): Result {
  const hours = n(x.hours) + n(x.minutes) / 60, pieces = Math.max(1, Math.round(n(x.pieces)) || 1);
  const grams = x.filaments.reduce((s, f) => s + n(f.grams), 0);
  const material = x.filaments.reduce((s, f) => s + (n(f.grams) / 1000) * n(f.pricePerKg), 0);
  const depPerHour = n(x.lifeHours) ? n(x.printerPrice) / n(x.lifeHours) : 0;
  const depreciation = depPerHour * hours;
  const maintenance = n(x.maintPerHour) * hours;
  const kwh = (n(x.watts) / 1000) * hours;
  const electricity = kwh * n(x.kwhRate);
  const fail = Math.min(n(x.failPct), 90) / 100;
  // a failed print wastes the filament and machine time; on average 1/(1-f) attempts per good print
  const failures = (material + depreciation + maintenance + electricity) * (fail / (1 - fail));
  const labour = ((n(x.prepMin) + n(x.postMin)) / 60) * n(x.labourRate);
  const plateCost = material + depreciation + maintenance + electricity + failures + labour;
  const pieceMaking = plateCost / pieces;
  const pieceCost = pieceMaking + n(x.packaging) + n(x.other);
  const profit = pieceCost * (n(x.marginPct) / 100);
  const beforeFees = pieceCost + profit;
  const feeRate = Math.min(n(x.feePct), 90) / 100;
  const priceExTax = beforeFees / (1 - feeRate);
  const fee = priceExTax - beforeFees;
  const tax = priceExTax * (n(x.taxPct) / 100);
  return {
    hours, pieces, material, depreciation, depPerHour, maintenance, electricity, kwh, failures, labour, plateCost, pieceMaking,
    packaging: n(x.packaging), other: n(x.other), pieceCost, profit, beforeFees, fee, priceExTax, tax, price: priceExTax + tax,
    machinePerHour: depPerHour + n(x.maintPerHour) + (n(x.watts) / 1000) * n(x.kwhRate), grams,
  };
}

export function fmt(v: number, money: Money, digits?: number) {
  const m = MONEY[money];
  const d = digits ?? (Math.abs(v) < 10 ? 2 : Math.abs(v) < 1000 ? (money === 'INR' ? 0 : 2) : 0);
  return `${m.symbol}${v.toLocaleString(m.locale, { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

/* Settings travel in the link (#...) so a quote can be shared or bookmarked. */
const KEYS: (keyof Inputs)[] = ['money', 'hours', 'minutes', 'pieces', 'printerPrice', 'lifeHours', 'maintPerHour', 'watts', 'kwhRate', 'failPct', 'prepMin', 'postMin', 'labourRate', 'packaging', 'other', 'marginPct', 'feePct', 'taxPct'];
export function toHash(x: Inputs) {
  const p = new URLSearchParams();
  for (const k of KEYS) p.set(k, String(x[k]));
  x.filaments.forEach((f, i) => p.set(`f${i}`, `${f.name.replace(/[~,]/g, ' ')}~${f.pricePerKg}~${f.grams}`));
  return p.toString();
}
export function fromHash(hash: string, fallback: Inputs): Inputs {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('hours')) return fallback;
  const money = (Object.keys(MONEY) as Money[]).includes(p.get('money') as Money) ? (p.get('money') as Money) : fallback.money;
  const out: Inputs = { ...defaultsFor(money) };
  for (const k of KEYS) { if (k === 'money') continue; const v = Number(p.get(k)); if (p.has(k) && Number.isFinite(v)) (out as Record<string, unknown>)[k] = v; }
  const fil: Filament[] = [];
  for (let i = 0; i < 8 && p.has(`f${i}`); i++) { const [name, a, b] = p.get(`f${i}`)!.split('~'); fil.push({ name: (name || 'Filament').slice(0, 30), pricePerKg: Number(a) || 0, grams: Number(b) || 0 }); }
  if (fil.length) out.filaments = fil;
  return out;
}
