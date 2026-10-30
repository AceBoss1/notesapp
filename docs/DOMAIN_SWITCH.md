# Moving #NotesApp to naapp.tech

**Every domain on the Vercel project shows the site under its own name.** There are no redirects between our domains:
`life.notesapp.name.ng` shows Notes Life and the address bar keeps saying `life.notesapp.name.ng`; `life.naapp.tech`
shows the same thing as `life.naapp.tech`. It is one deployment, so the content is identical everywhere.

- **Every subdomain works the same way on every domain**: `www.` the main site, `app.` the app address, `life.` Notes Life,
  and `mcp.` or any new one the main site. Links between them stay on the visitor's domain (Play on `life.notesapp.name.ng`
  opens `www.notesapp.name.ng/life/play`). `notesapp.ng` opens the app, as before.
- **A domain added to Vercel later works by itself**, with no code change: it is served as ours once middleware has checked it
  isn't a member's own domain (Business and Enterprise custom domains keep showing the member's site).
- **One setting picks the primary address**: `NEXT_PUBLIC_ROOT_DOMAIN` (`lib/host.ts`; unset = `notesapp.name.ng`). It is
  the address used by everything that leaves the site: emails, share links, API docs, webhooks, sign-in callbacks, and
  search engines (on every other domain each page sends an HTTP `rel=canonical` header naming the primary address, so
  Google doesn't see copies). `SITE_URL` always follows it on the live site; `NEXT_PUBLIC_SITE_URL` only counts for
  `localhost` and `*.vercel.app` previews.
- Payments bring the buyer back to the domain they paid on.
- Sign-in is kept per domain by browsers, so someone who uses both domains signs in on each once. Members who stay on
  `notesapp.name.ng` notice nothing: they stay signed in and their installed app and notifications keep working.
- `media.notesapp.name.ng` (pictures and videos) doesn't change.

To add another domain later: add it (and its subdomains) in Vercel → Domains. Nothing else.

Why: the .tech No Excuses Fund (applications close 15 Dec 2026) needs the product's **primary** website live on .tech
when we apply, not a redirect to it, and kept there for 24 months after any award. "Primary" in their terms is where the
product is offered and where **our own marketing and links point**, so after the switch every link we publish should use
`naapp.tech`; the old domain keeps working quietly for people who already use it.

## Order of work

Do the steps in this order. Steps 1 to 3 can happen days before the switch; nothing changes for members until step 4.

### 1. Register and point the domain
- [ ] Register `naapp.tech` **in the company's name** (or a named founder's). Turn on auto-renew.
- [ ] Vercel → Project → Settings → Domains: add `naapp.tech`, `www.naapp.tech`, `app.naapp.tech`,
      `life.naapp.tech` (and `mcp.naapp.tech` if it is used). Set the DNS records Vercel shows
      (A `76.76.21.21` for the apex, CNAME `cname.vercel-dns.com` for the others). Every subdomain has to be added to
      Vercel to reach the site; a wildcard `*.naapp.tech` covers future ones but needs the domain on Vercel's nameservers.
- [ ] Keep all the `notesapp.name.ng` domains on the Vercel project. They keep serving the site under their own name.

### 2. Allow the new address where people sign in
- [ ] Firebase console → Authentication → Settings → **Authorised domains**: add `www.naapp.tech`, `naapp.tech`,
      `app.naapp.tech`, `life.naapp.tech`. Keep the old ones.
- [ ] Firebase → Authentication → Templates: if the action link (email verification, password reset) is set to a custom
      address on `notesapp.name.ng`, change it to `https://www.naapp.tech/auth/action`. Old links still work (the old address still serves the page).
- [ ] Dojah dashboard: add the new address to the widget's allowed domains, if the dashboard has that list.

### 3. Email (can stay on the old domain at first)
Email is a separate setting so the website can move before mail does.
- [ ] Resend → Domains: add `naapp.tech` and add its SPF, DKIM and DMARC records in DNS. Wait until it shows **Verified**.
- [ ] Set up a mailbox for `hello@naapp.tech` (forwarding to the current inbox is fine).
- [ ] Then, in Vercel: `EMAIL_FROM` → `#NotesApp <hello@naapp.tech>` (or the address you use now, on the new domain),
      `NEXT_PUBLIC_CONTACT_EMAIL` → `hello@naapp.tech`, and if set, `SUPPORT_EMAIL`, `REPORTS_EMAIL`, `VAPID_SUBJECT`
      (`mailto:hello@naapp.tech`).

### 4. Switch (the actual move)
- [ ] Vercel → Settings → Environment Variables (Production): `NEXT_PUBLIC_ROOT_DOMAIN` = `naapp.tech`.
- [ ] `NEXT_PUBLIC_SITE_URL`: change it to `https://www.naapp.tech` or delete it. (An old value pointing at
      `notesapp.name.ng` is ignored once the root changes, but it's clearer to fix it.)
- [ ] Redeploy (`NEXT_PUBLIC_*` values are built in, so a redeploy is required).
- [ ] Check: `https://www.naapp.tech` and `https://app.naapp.tech` open the site and you can sign in on both;
      `https://life.naapp.tech` opens Notes Life; `https://www.notesapp.name.ng` still works and stays on its own address;
      emails now link to `naapp.tech`.

### 5. Update every provider's callback (the same day)
Each of these is registered with a full address. They keep working on the old address (it still serves the whole site), but move them now so the primary address is used.
- [ ] **Paystack** dashboard → Settings → API keys & webhooks: webhook URL → `https://www.naapp.tech/api/paystack/webhook`.
      (The checkout callback address is worked out per payment, so nothing else to change.)
- [ ] **Paylony** dashboard: webhook → `https://www.naapp.tech/api/paylony/webhook` (also shown on Admin → Paylony).
- [ ] **Dojah** dashboard: webhook → `https://www.naapp.tech/api/dojah/webhook`.
- [ ] **LinkedIn** developer app → Auth → redirect URLs: add `https://www.naapp.tech/api/social/callback/linkedin`.
- [ ] **X** developer app → User authentication settings → callback URI: add `https://www.naapp.tech/api/social/callback/x`;
      website URL → `https://www.naapp.tech`.
- [ ] **cron-job.org**: change the job to `GET https://www.naapp.tech/api/cron/reminders` (same `Authorization` header).
- [ ] **Granola** (team hub): nothing to do. The app registers itself again with the new callback the next time someone connects.
- [ ] **Enterprise custom domains**: nothing to change for members (their CNAME is `cname.vercel-dns.com` either way).

### 6. After the switch
- [ ] Google Search Console: add `naapp.tech` and use **Change of address** from `notesapp.name.ng`. Submit
      `https://www.naapp.tech/sitemap.xml`.
- [ ] Update the address on LinkedIn, X, Facebook, the email signature, the pitch deck and partner materials.
- [ ] Tell members the new address (a changelog entry is enough). Nobody is signed out: the old address keeps working. People who
      start using `naapp.tech` sign in there once, and install the app again from `app.naapp.tech` if they want it on
      the new address.
- [ ] Keep the old domain registered and on Vercel (old links, emails, QR codes, installed apps).

## For the fund (not code)
- The .tech site must be the real product, not a landing page, from the day we apply until the decision, and for 24 months
  after any award (terms 2.6 and 9.3).
- The domain must be registered to the company or a named founder.
