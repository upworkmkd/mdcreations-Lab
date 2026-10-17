'use client';
import { usePathname } from 'next/navigation';
import type { Currency } from '@/lib/money';

export function CurrencySwitch({ current }: { current: Currency }) {
  const back = usePathname() || '/';
  return (
    <form action="/api/currency" method="post" className="cur-switch" aria-label="Currency">
      <input type="hidden" name="back" value={back} />
      {(['INR', 'USD'] as const).map((c) => (
        <button key={c} name="currency" value={c} aria-pressed={c === current} title={c === 'INR' ? 'Indian rupees' : 'US dollars'}>{c === 'INR' ? '₹ INR' : '$ USD'}</button>
      ))}
    </form>
  );
}
