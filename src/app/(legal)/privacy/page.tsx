import type { Metadata } from 'next';
import { Legal } from '@/components/legal';
import { SUPPORT_EMAIL } from '@/lib/env';
export const metadata: Metadata = { title: 'Privacy', description: 'How MD Creations Labs handles your account, designs and payment data.', alternates: { canonical: '/privacy' } };
export default function Page() {
  return (
    <Legal title="Privacy" updated="24 October 2026">
      <h2>What we keep</h2>
      <ul>
        <li>Your name, email address and password (stored securely by our login provider, Supabase).</li>
        <li>The designs you buy: a black-and-white outline of your picture, your settings and a small preview.</li>
        <li>Your orders, payment references and download history.</li>
      </ul>
      <p>We keep a smaller copy of the pictures you load into the tools for 10 days, unless you untick the box under the upload (see below). Card and UPI details are handled by Razorpay and never reach us.</p>
      <h2 id="pictures">Pictures you load into the tools</h2>
      <p>Under every upload box there is a box that is ticked to start with: “Keep a copy of my picture for 10 days to help improve this tool”. While it is ticked, we keep a smaller copy (at most 1200 pixels across) of each picture you load, along with the tool you used and the file name. We look at them only to see how real pictures work in the tools and to make the tools better. They are stored privately, are never public or shown to search engines, are seen only by the MD Creations team, and are deleted automatically after 10 days.</p>
      <p><b>To keep your pictures only in your browser, untick the box before you upload.</b> If you untick it just after uploading, the copy of that picture is deleted straight away. Your choice is remembered on this browser. To have a picture removed sooner, write to us.</p>
      <h2>Why</h2>
      <p>To build and deliver your files, let you download them again, answer support questions and meet tax and accounting rules.</p>
      <h2>Cookies</h2>
      <p><b>Essential cookies</b> keep you signed in and remember your cookie choice. Prices are shown in rupees in India and in US dollars elsewhere, based on the country your connection comes from. The site cannot work without them.</p>
      <p><b>Analytics cookies</b> are used only if you press “Accept all”. They give your browser a random ID so we can see how the site is used across visits: the pages you open, the buttons you press and the settings you change in the tools, how long you stay, where you came from (the referring site or campaign), your browser, device, screen size and language, your IP address and the approximate place it points to (city and country). If you have an account, or create one later, this activity is linked to your account. We never record passwords or email fields. Pictures you load into the tools are kept only as described above. We use this only to understand and improve MD Creations Labs; we do not sell it or use it for advertising.</p>
      <p>You can change your choice at any time with “Cookie settings” at the bottom of every page. Choosing “Essential only” stops the analytics cookies straight away. Analytics records, with or without cookies, are deleted automatically after 10 days. We also use Vercel Web Analytics, which counts visits without cookies.</p>
      <p><b>Without analytics cookies</b> we still count page views anonymously: the page, the website that sent you (its domain only), your country, the type of device and the names of your browser and system. No cookie is set, no IP address or city is kept, and nothing links one visit to the next. Browsers that send a “Do Not Track” or Global Privacy Control signal are not counted at all.</p>
      <h2>Your choices</h2>
      <p>Ask us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for a copy of your data or to delete your account. Order records we must keep for tax purposes are kept for the period the law requires.</p>
    </Legal>
  );
}
