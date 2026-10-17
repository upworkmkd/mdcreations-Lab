export type Currency = 'INR' | 'USD';
export const CURRENCIES: Currency[] = ['INR', 'USD'];
export const isCurrency = (v: unknown): v is Currency => v === 'INR' || v === 'USD';

export function formatMoney(amountMinor: number, currency: Currency) {
  const major = amountMinor / 100;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency', currency, minimumFractionDigits: Number.isInteger(major) ? 0 : 2, maximumFractionDigits: 2,
  }).format(major);
}
