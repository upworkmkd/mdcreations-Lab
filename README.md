# MD Creations Labs

Browser tools that turn pictures into print-ready 3D files. Next.js 16 on Vercel, Supabase (Postgres, auth, storage) and Razorpay.

Live tool: **Shadow Lamp Maker**. Coming soon: Statue Maker, Layered Sculpture Maker, STL Repair.

## How it fits together

| Part | Where |
| --- | --- |
| Pages | `src/app` – landing, `/tools/[slug]` info pages, `/tools/shadow-lamp/make`, auth, `/account`, `/admin`, policies |
| Preview engine (browser, free) | `src/lib/lamp/raster.js` + `src/components/maker/lamp.worker.js` – decides what each wall keeps and predicts the shadow. **No meshes.** |
| File builder (server, paid) | `src/lib/lamp/mesh.server.js`, `build.server.ts` – builds the STL walls, cover plate and zip. Never sent to the browser. |
| Payments | `src/app/api/checkout`, `api/payments/verify`, `api/webhooks/razorpay`, `src/lib/razorpay.server.ts` |
| Delivery | `src/lib/fulfil.server.ts` builds the zip into the private `lab-files` bucket; `api/files/[id]/download` hands out a 60-second signed link |
| Database | `supabase/migrations/20261008000000_init.sql` – tables, row level security, storage bucket, seed prices |
| Visitor tracking | `supabase/migrations/20261019000000_visitors.sql` – visitors, visits, activity events, reviews, admin stats |

The browser sends only a black-and-white run-length mask of the picture (tens of KB) plus the placement. The server rebuilds the identical field and the paid files from it, so preview and files always match.

## One-time setup

### 1. Supabase
1. Create a project at supabase.com (region: Mumbai, `ap-south-1`).
2. SQL Editor → paste and run `supabase/migrations/20261008000000_init.sql`, then `supabase/migrations/20261019000000_visitors.sql`.
3. Authentication → URL Configuration:
   - Site URL: `https://labs.themdcreations.com`
   - Redirect URLs: `https://labs.themdcreations.com/auth/callback`, `http://localhost:3000/auth/callback`
4. Authentication → Emails: keep "Confirm email" on. For real customers, set up custom SMTP (Resend, Zoho, Brevo…); the built-in sender is rate-limited.
5. Project Settings → API Keys: copy the **publishable** key and the **secret** key.

### 2. Razorpay
1. Dashboard → Account & Settings → API Keys → generate (test mode first).
2. Dashboard → Account & Settings → Webhooks → add `https://labs.themdcreations.com/api/webhooks/razorpay`, events `payment.captured` and `order.paid`, choose a secret.
3. For USD: Account & Settings → International payments → activate. Until it is approved, leave the USD price empty in /admin (the site then sells in INR only).

### 3. Environment variables
Copy `.env.example` to `.env.local` (and add the same values in Vercel → Project → Settings → Environment Variables).

### 4. Run
```bash
npm install
npm run dev        # http://localhost:3000
```
`npm run dev` and `npm run build` first bundle the preview worker into `public/lamp-worker.js`.

### 5. Make yourself admin
Sign up on the site, then in the Supabase SQL editor:
```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```
`/admin` then shows sales and lets you change each tool's status and prices. Admins download their own designs free.

### 6. Deploy on Vercel
1. Push this folder to a GitHub repo and import it in Vercel (framework: Next.js; build command `npm run build`).
2. Add the environment variables.
3. Domains → add `labs.themdcreations.com`, then at your DNS provider add a `CNAME` record `labs` → `cname.vercel-dns.com`.
4. Selling on Vercel needs the **Pro** plan (Hobby is for non-commercial use). Generating a zip takes 2–6 s; routes allow up to 60 s.

## Adding the next tool
1. Add it to `src/lib/tools.ts` (words) and to the `tools` table (status/prices).
2. Build its page under `src/app/tools/<slug>/make`, post a design to `/api/designs` with `tool: '<slug>'`, and add a builder branch in `src/lib/fulfil.server.ts`.
