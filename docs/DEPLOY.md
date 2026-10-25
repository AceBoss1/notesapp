# Deploying, checking and fixing

Settings for each environment are in `docs/ENVIRONMENT.md`; staging is in `docs/STAGING.md`; moving the address is in
`docs/DOMAIN_SWITCH.md`.

## Deploy checklist (after merging a change that touches rules or indexes)
1. `firebase deploy --only firestore` — publishes `firestore.rules` and the TTL policies in `firestore.indexes.json`
   (`errorLogs`, `webhookDeliveries`, `apiIdempotency`, `videoUploads`, plus older ones). If it offers to delete the
   `adSeen`/`seen` field overrides, answer **N**. **Pending as of 16 Oct:** the rules that let Notes Life presence use the
   Digital Witch hub (`dw`) are merged but not deployed.
2. Before deploying rules or changing the economy: `npm run test:rules` (54 tests), `npm run test:life` (Notes Life economy,
   prints `ALL OK`), `npm run test:messages` (message edits), `npm run test:mentions` (@mention bells) and `npm run test:digest`
   (weekly digest). Each starts the Firestore emulator and needs Java. `npm run test:preview` checks link-preview safety
   (no emulator; needs port 80).
3. cron-job.org: `GET https://www.<root>/api/cron/reminders` (today `www.notesapp.name.ng`) every 15 min with `Authorization: Bearer $CRON_SECRET`, and
   `GET /api/status` every 5 min (so incidents are detected without visitors).
4. Media bucket CORS from `scripts/r2-cors.json` on **both** R2 buckets (browser PUTs go straight to R2).

## Where to look when something's wrong
`/status` (live checks: database, auth, uploads, media, **digital downloads**, **developer API**, **custom domains**, payments, email,
identity, scheduled jobs) · `/admin/errors` (grouped errors, 30-day retention) · `/admin/traction` (numbers for decks) ·
`/admin/payments` (held/failed payouts) · `/admin/api-access` (API access and domains) · `/admin/paylony` (Paylony keys and webhook) ·
Firebase console → Firestore → Query insights (reads by collection) · Vercel → Logs, and Usage (Fluid Active CPU, build minutes).

## Scripts (`scripts/`)
`set-admin-claims.mjs` · `set-founder-tier.mjs` · `fix-founder-profiles.mjs` · `move-suspensions.mjs` · `strip-user-emails.mjs` ·
`dojah-subscribe.mjs` / `dojah-test-event.mjs` · `seed-journals-from-notes.mjs` · `migrate-to-own-infra.mjs` ·
`clean-orphan-videos.mjs` (monthly). Each prints a dry run first; pass `--apply` to write.

---

A deployable Next.js app: the public marketing site plus a working
demo of the core loop — a native booking calendar, a per-professional
brand store, and full engagement (comments, likes, shares). It reads
and writes **the exact same Firestore data Precheks already has** —
same `notes`, `users`, `usernames`, and `settings` collections, same
Firebase Auth project, same security rules. Nothing about Firestore
changes for this demo. #NotesApp is a second, differently-branded UI
over data Precheks already owns; "journal" is what this UI calls a
note, nothing more.

## If a key leaks

A key found in the code, a log, a screenshot or a chat (the CI job `secrets` fails on one in the git history):

1. Rotate it first, at the service that issued it (Firebase service account, Paystack, Paylony, Resend, Cloudflare R2 or Stream,
   Upstash, Anthropic, NKENNEAi, the Discord webhook), and put the new value in Vercel's environment variables, marked Sensitive.
2. Redeploy, then check the old key no longer works.
3. Remove it from the code. A key already in the git history stays readable there: rotating it, not rewriting history, is what
   makes it harmless.
4. Note what leaked, when and how in the team hub, and check the service's logs for use of the old key.
