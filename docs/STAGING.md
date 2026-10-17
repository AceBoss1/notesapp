# Staging: a copy of the site to try changes on before members see them

Today every merge to `main` goes straight to the live site, and the only database is the live one. This is the plan for a
staging copy, and what's already built for it.

## Already in place
- **CI on every pull request** (`.github/workflows/ci.yml`): types, the settings list (`docs:settings --check`), every
  test suite (rules, Notes Life, messages, mentions, digest, authors, shared store, link previews), then a production build
  that is started and checked by the **smoke test** (`tests/smoke`, Playwright, phone and desktop): the main pages open
  without script errors, `life.` shows Notes Life under its own name, server-only writes refuse strangers, a forged
  unsubscribe link does nothing.
- The smoke test can point at any address: `SMOKE_BASE_URL=https://… npm run test:smoke`.
- `staging` is a branch CI already watches.

## Demo data on your computer
`scripts/seed-demo.ts` fills the Firestore and Auth emulators with a small #NotesApp (people with badges, journals on
topics, store items, this week's visits, a bookable publisher, one publisher without payouts, and a signed-in reader with
interests: reader@demo.notesapp / demo-password-1). It refuses to run without `FIRESTORE_EMULATOR_HOST`, so it never
touches live data. Point the site at the emulators with `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and
`NEXT_PUBLIC_AUTH_EMULATOR_HOST=127.0.0.1:9099`; this is how the phone and desktop screenshots are taken before shipping.
If a `NEXT_PUBLIC_` switch seems ignored, delete `.next` and start the dev server again.

## To set up (owner, about an hour)
1. **A second Firebase project**, `notesapp-staging` (Firebase console → Add project). Turn on Authentication (email and
   password) and Firestore. Deploy the rules to it: `npx firebase-tools@13 deploy --only firestore --project notesapp-staging`.
   Make a service account key for it (Project settings → Service accounts).
2. **Vercel → Settings → Environment Variables → Preview**, scoped to the `staging` branch: the `NEXT_PUBLIC_FIREBASE_*`
   values and `FIREBASE_SERVICE_ACCOUNT_KEY` of the staging project, Paystack and Paylony **test** keys, Dojah sandbox,
   no `RESEND_API_KEY` (so staging never emails anyone; bells still arrive), `WEEKLY_DIGEST` unset. Everything else from
   `docs/ENVIRONMENT.md` as needed. Leave `NEXT_PUBLIC_ROOT_DOMAIN` unset: a preview's own `*.vercel.app` address is used.
3. **Vercel → Settings → Git**: make sure Preview deployments are on for `staging` (`vercel.json` only switches off
   `claude/*` branches). Optionally give it a fixed address: Domains → `staging.notesapp.tech` → Git branch `staging`.
4. **Some data**: sign up two test members on staging, publish a journal, add a store item. (A seed script can come later.)
5. **GitHub → Settings → Secrets and variables → Actions**: add `STAGING_URL` (the staging address) to run the smoke test
   against staging from CI once it exists (add `SMOKE_BASE_URL: ${{ vars.STAGING_URL }}` to a job on the `staging` branch).

## How a release goes once it's set up
1. Work is merged into `staging` first (a pull request into `staging`, not `main`). CI runs; Vercel builds the staging copy.
2. Try it on staging, on a phone and a computer. Run `SMOKE_BASE_URL=<staging> npm run test:smoke`.
3. Then a pull request from `staging` into `main`: the live site.
4. Firestore rules: deploy to staging first (`--project notesapp-staging`), then live.

## What staging never does
Charge real money, email or message real people, or read live data. If a change needs live data to test, export a small,
anonymised sample instead.
