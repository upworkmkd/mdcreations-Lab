import type { Currency } from '@/lib/money';

/**
 * The "regular" price shown crossed out next to a tool's price: the price set in Admin → Tools and prices, raised by
 * the sale percentage from Admin → Settings → Sale. Only shown, never charged. Rupees round to a whole rupee, dollars
 * to a whole cent. null when there is no sale (0 %) or no price.
 */
export function regularPrice(amountMinor: number | null | undefined, percent: number, currency: Currency): number | null {
  if (amountMinor == null || amountMinor <= 0 || !(percent > 0)) return null;
  const raised = amountMinor * (1 + percent / 100);
  return currency === 'INR' ? Math.ceil(raised / 100) * 100 : Math.ceil(raised);
}

export const SALE_MAX = 90;
