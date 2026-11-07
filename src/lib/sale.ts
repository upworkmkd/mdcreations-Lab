import type { Currency } from '@/lib/money';

/** The biggest discount that can be set (at 100 % the regular price would be endless). */
export const SALE_MAX = 95;

/**
 * The "regular" price shown crossed out next to a tool's price. The price set in Admin → Tools and prices is the sale
 * price, and the percentage from Admin → Settings → Sale is the discount off the regular price:
 *   regular = sale / (1 - discount / 100)      e.g. ₹199 at 80.08 % off → ₹999
 * Only shown, never charged. Rupees round to a whole rupee, dollars to a whole cent. null when there is no sale (0 %)
 * or no price.
 */
export function regularPrice(amountMinor: number | null | undefined, percent: number, currency: Currency): number | null {
  if (amountMinor == null || amountMinor <= 0 || !(percent > 0)) return null;
  const regular = amountMinor / (1 - Math.min(percent, SALE_MAX) / 100);
  return currency === 'INR' ? Math.round(regular / 100) * 100 : Math.round(regular);
}
