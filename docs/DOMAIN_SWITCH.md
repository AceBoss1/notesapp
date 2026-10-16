# Moving #NotesApp to notesapp.tech

The site's address is one setting on Vercel, `NEXT_PUBLIC_ROOT_DOMAIN` (`lib/host.ts`). Unset, it is `notesapp.name.ng`.
Nothing else needs changing in the code:

- `www.<root>` is the main site, and the live site's own address (`SITE_URL`) always follows the root. A leftover
  `NEXT_PUBLIC_SITE_URL` is ignored on the live site (it only counts for `localhost` and `*.vercel.app` previews).
- **Every subdomain of the root is ours**: `app.` (the app address), `life.` (Notes Life), `mcp.`, and any we add later.
- **Every other domain added to the Vercel project** (the old root, a domain we buy later, `notesapp.ng` …) is sent
  permanently (308) to the same page on the root, keeping its subdomain: `life.notesapp.name.ng/partners` →
  `life.notesapp.tech/partners`, `notesapp.name.ng` → `www.notesapp.tech`. `notesapp.ng` goes to `app.<root>`.
  The one exception is a domain a member has connected as their own (Business and Enterprise custom domains), which keeps
  showing their site.
- `/api/*` keeps working on every domain, so webhooks and sign-in callbacks registered with an old address don't break while
  each provider is updated.
- `media.` subdomains are never redirected: every picture and video already stored points at `media.notesapp.name.ng`.

To add another domain later: add it in Vercel → Domains, nothing else. It redirects to the root by itself.

Why: the .tech No Excuses Fund (applications close 15 Dec 2026) needs the product's **primary** website live on .tech
when we apply, not a redirect to it, and kept there for 24 months after any award.

## Order of work

Do the steps in this order. Steps 1 to 3 can happen days before the switch; nothing changes for members until step 4.

### 1. Register and point the domain
- [ ] Register `notesapp.tech` **in the company's name** (or a named founder's). Turn on auto-renew.
- [ ] Vercel → Project → Settings → Domains: add `notesapp.tech`, `www.notesapp.tech`, `app.notesapp.tech`,
      `life.notesapp.tech` (and `mcp.notesapp.tech` if it is used). Set the DNS records Vercel shows
      (A `76.76.21.21` for the apex, CNAME `cname.vercel-dns.com` for the others). Every subdomain has to be added to
      Vercel to reach the site; a wildcard `*.notesapp.tech` covers future ones but needs the domain on Vercel's nameservers.
- [ ] Keep all the `notesapp.name.ng` domains on the Vercel project. They must keep resolving so the redirects work.

### 2. Allow the new address where people sign in
- [ ] Firebase console → Authentication → Settings → **Authorised domains**: add `www.notesapp.tech`, `notesapp.tech`,
      `app.notesapp.tech`, `life.notesapp.tech`. Keep the old ones.
- [ ] Firebase → Authentication → Templates: if the action link (email verification, password reset) is set to a custom
      address on `notesapp.name.ng`, change it to `https://www.notesapp.tech/auth/action`. Old links still work (they redirect).
- [ ] Dojah dashboard: add the new address to the widget's allowed domains, if the dashboard has that list.

### 3. Email (can stay on the old domain at first)
Email is a separate setting so the website can move before mail does.
- [ ] Resend → Domains: add `notesapp.tech` and add its SPF, DKIM and DMARC records in DNS. Wait until it shows **Verified**.
- [ ] Set up a mailbox for `hello@notesapp.tech` (forwarding to the current inbox is fine).
- [ ] Then, in Vercel: `EMAIL_FROM` → `#NotesApp <hello@notesapp.tech>` (or the address you use now, on the new domain),
      `NEXT_PUBLIC_CONTACT_EMAIL` → `hello@notesapp.tech`, and if set, `SUPPORT_EMAIL`, `REPORTS_EMAIL`, `VAPID_SUBJECT`
      (`mailto:hello@notesapp.tech`).

### 4. Switch (the actual move)
- [ ] Vercel → Settings → Environment Variables (Production): `NEXT_PUBLIC_ROOT_DOMAIN` = `notesapp.tech`.
- [ ] `NEXT_PUBLIC_SITE_URL`: change it to `https://www.notesapp.tech` or delete it. (An old value pointing at
      `notesapp.name.ng` is ignored once the root changes, but it's clearer to fix it.)
- [ ] Redeploy (`NEXT_PUBLIC_*` values are built in, so a redeploy is required).
- [ ] Check: `https://www.notesapp.name.ng/pricing` lands on `https://www.notesapp.tech/pricing`; sign in on
      `www.notesapp.tech` and on `app.notesapp.tech`; open `life.notesapp.tech`.

### 5. Update every provider's callback (the same day)
Each of these is registered with a full address. They keep working on the old address (step 4 leaves `/api/*` alone),
but move them now so nothing depends on it.
- [ ] **Paystack** dashboard → Settings → API keys & webhooks: webhook URL → `https://www.notesapp.tech/api/paystack/webhook`.
      (The checkout callback address is worked out per payment, so nothing else to change.)
- [ ] **Paylony** dashboard: webhook → `https://www.notesapp.tech/api/paylony/webhook` (also shown on Admin → Paylony).
- [ ] **Dojah** dashboard: webhook → `https://www.notesapp.tech/api/dojah/webhook`.
- [ ] **LinkedIn** developer app → Auth → redirect URLs: add `https://www.notesapp.tech/api/social/callback/linkedin`.
- [ ] **X** developer app → User authentication settings → callback URI: add `https://www.notesapp.tech/api/social/callback/x`;
      website URL → `https://www.notesapp.tech`.
- [ ] **cron-job.org**: change the job to `GET https://www.notesapp.tech/api/cron/reminders` (same `Authorization` header).
- [ ] **Granola** (team hub): nothing to do. The app registers itself again with the new callback the next time someone connects.
- [ ] **Enterprise custom domains**: nothing to change for members (their CNAME is `cname.vercel-dns.com` either way).

### 6. After the switch
- [ ] Google Search Console: add `notesapp.tech` and use **Change of address** from `notesapp.name.ng`. Submit
      `https://www.notesapp.tech/sitemap.xml`.
- [ ] Update the address on LinkedIn, X, Facebook, the email signature, the pitch deck and partner materials.
- [ ] Tell members (a short changelog entry and a banner are enough). Expect two things:
  - people are **signed out once**: browsers keep sign-in per address;
  - installed apps and device notifications belong to the old address: members open `app.notesapp.tech`, install again and turn
    notifications on again. Email and bell notifications are unaffected.
- [ ] Leave the old domain registered and pointed at Vercel for at least two years (old links, emails and QR codes).

## For the fund (not code)
- The .tech site must be the real product, not a landing page, from the day we apply until the decision, and for 24 months
  after any award (terms 2.6 and 9.3).
- The domain must be registered to the company or a named founder.
