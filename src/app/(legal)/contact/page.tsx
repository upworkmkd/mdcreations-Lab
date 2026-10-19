import type { Metadata } from 'next';
import { Legal } from '@/components/legal';
import { SUPPORT_EMAIL, SOCIALS } from '@/lib/env';
export const metadata: Metadata = { title: 'Contact', description: 'Contact MD Creations for help with Labs tools, custom shadow lamps and printed orders.', alternates: { canonical: '/contact' } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const plan = (await searchParams).plan;
  const planName = plan === 'standard' ? 'Standard' : plan === 'starter' ? 'Starter' : null;
  return (
    <Legal title="Contact">
      {planName && (
        <div className="msg ok" style={{ marginTop: 18 }}>
          <b>Interested in the {planName} plan?</b> Email us at <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${planName} plan`)}&body=${encodeURIComponent(`Hi, I would like the ${planName} plan.\n\nMy account email: \nWhat I make: \n`)}`}>{SUPPORT_EMAIL}</a> or send us a DM, with the email of your Labs account and what you make. We will set you up and reply within one working day.
        </div>
      )}
      <p>We are a small studio and read every message. Expect a reply within one working day.</p>
      <h2>Email</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
      <h2>Social</h2>
      <p>Send us a DM for custom lamps and printed orders.</p>
      <ul>{SOCIALS.map((x) => <li key={x.name}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.name}</a> {x.handle}</li>)}</ul>
      <h2>Business</h2>
      <p>MD Creations<br />{process.env.NEXT_PUBLIC_BUSINESS_ADDRESS ?? 'India'}</p>
    </Legal>
  );
}
