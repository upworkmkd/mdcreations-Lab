/* Shipping addresses for printed orders. India only for now: Indian states and union territories, 6-digit PIN code,
 * 10-digit mobile number. Used by the order form in the browser and checked again on the server. */

export type ShipTo = { name: string; phone: string; line1: string; line2: string; city: string; state: string; pin: string; country: 'IN' };
export const EMPTY_SHIP: ShipTo = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pin: '', country: 'IN' };

export const IN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** Tidies what was typed and says what is missing or wrong, field by field. */
export function checkShipTo(raw: unknown): { ok: true; value: ShipTo } | { ok: false; errors: Partial<Record<keyof ShipTo, string>> } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const phone = clean(r.phone, 20).replace(/[\s-]/g, '').replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, '');
  const v: ShipTo = {
    name: clean(r.name, 80), phone, line1: clean(r.line1, 120), line2: clean(r.line2, 120),
    city: clean(r.city, 60), state: clean(r.state, 60), pin: clean(r.pin, 10).replace(/\s/g, ''), country: 'IN',
  };
  const e: Partial<Record<keyof ShipTo, string>> = {};
  if (v.name.length < 2) e.name = 'Who should we send it to?';
  if (!/^[6-9]\d{9}$/.test(v.phone)) e.phone = 'A 10-digit mobile number, for the postman.';
  if (v.line1.length < 4) e.line1 = 'House number, building and street.';
  if (v.city.length < 2) e.city = 'Town or city.';
  if (!(IN_STATES as readonly string[]).includes(v.state)) e.state = 'Choose the state.';
  if (!/^[1-9]\d{5}$/.test(v.pin)) e.pin = 'A 6-digit PIN code.';
  return Object.keys(e).length ? { ok: false, errors: e } : { ok: true, value: v };
}

/** The address as lines, for emails and the admin. */
export function shipLines(s: Partial<ShipTo> | null | undefined): string[] {
  if (!s) return [];
  return [s.name, s.line1, s.line2, [s.city, s.state].filter(Boolean).join(', ') + (s.pin ? ` – ${s.pin}` : ''), 'India', s.phone ? `Phone: +91 ${s.phone}` : '']
    .filter((l): l is string => Boolean(l && l.trim()));
}

export const PRINT_STATUS: Record<string, { label: string; note: string }> = {
  to_print: { label: 'To print', note: 'Paid. We will print it soon.' },
  printing: { label: 'Printing', note: 'On the printer and being assembled.' },
  shipped: { label: 'Shipped', note: 'On its way by post.' },
  delivered: { label: 'Delivered', note: 'Delivered. Enjoy it!' },
  cancelled: { label: 'Cancelled', note: 'Cancelled.' },
};
