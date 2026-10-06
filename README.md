# #NotesApp — landing page + MVP

**Start with "Where things stand" just below — it is the current state, env vars and deploy checklist.**

**⚠ Read "Independent infrastructure migration" before this
paragraph — it's the most recent, most important architectural
change, and it contradicts what's said immediately below.** Everything
from here through the rest of this file was written while NotesApp
deliberately shared Precheks' Firebase project. As of the migration
section further down, that's no longer true — NotesApp has its own
Firestore project and its own Cloudflare R2 bucket. Treat all
"shared with Precheks" language below as history explaining *why* the
architecture looks the way it does, not as the current state of
Firestore access.

## Where things stand (updated 5 Oct 2026)

**Read this section first.** Everything below it is a chronological build log; where an older passage says something is
"not built", "demo" or "shared with Precheks", this section is the current truth.

### Live today
| Area | What exists | Where to read more |
|---|---|---|
| Publishing | Journals (rich-text composer, drafts, premium posts), follow, likes, comments, shares, co-authoring, organisation channels and teams | "Who can publish", "Organisation accounts", co-authoring in "Boosts & gifts" |
| **Video on posts** | One MP4/WebM per post (≤ 100 MB, ≤ 3 min, weekly allowance by plan), our own player, cover-image picker, server-verified uploads | "Video on posts" |
| **Share previews** | Per-post, per-store-item and per-store Open Graph cards | "Share previews (Open Graph)" |
| Booking & money | Native calendar, Paystack checkout, escrow-style holds, automatic payouts, client rescheduling/cancellation + problem reports | "Payments, payouts, rates, reminders", "Money flow" |
| Stores | Physical goods (managed stock, parcel IDs, rider links, tracking), digital downloads (private bucket, short-lived links), store boosts, official merch pre-orders | "Seller checkout and parcel tracking", "Boosts & gifts", `/store-selling` |
| Promotion | Post/item boosts, gifts, self-serve banner ads and ad share | "Boosts & gifts", "Advertiser campaigns" |
| Plans & badges | Free Standard/Basic, Pro, Business (Paystack plans), Enterprise (custom); maroon ✔, gold ✔ (endorsed; identity-checked is built but **Dojah is still on the sandbox**) | "Pro / Business plans", "Verified badge", "Dojah webhook" |
| **Enterprise** | Server-to-server API (`/api/v1`), Console, signed webhooks, `/docs`, own domain (subdomain or root) | "API, Console, Docs and custom domains" |
| Trust & ops | `/security`, `/status` (+ incidents, response times, email subscribers), `/changelog`, account export/deletion, error monitoring, traction snapshot, admin by custom claims | "Where to look when something's wrong" below |
| Company | NOTESAPP TECHNOLOGIES LTD (RC and TIN in `lib/site.ts`; SMEDAN number pending) | "Company identity" |

### Not built yet
WhatsApp reminders (plan: Meta WhatsApp Cloud API directly; booking reminders + delivery updates; needs Meta Business
verification and approved templates) · one-click social publishing · AI drafting via MCP + notetaker handoff · iOS/Android apps ·
video transcoding/streaming (we cap size and length instead) · Dojah **live** mode (README "Going live with Dojah") ·
webhook retries (one attempt, manual resend) · OAuth for third-party API apps · full sign-in on custom domains (they hop to
the main site) · Sentry (we have built-in error monitoring instead).

### Environment variables (Vercel → Settings → Environment Variables; redeploy after changing any)
| Variable | Secret? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | no | Firebase web config |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **yes** | Service-account JSON as one line; all server routes need it |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` | no / yes | Cloudflare R2 account and key id |
| `R2_SECRET_ACCESS_KEY` | **yes** | R2 secret. The R2 token must cover **both** buckets (media and private) with Object Read & Write |
| `R2_BUCKET_NAME` | no | Public media bucket (default `notesapp-media`): images, avatars, post videos |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | no | Public URL of the media bucket (e.g. `https://media.notesapp.name.ng`) |
| `CLOUDFLARE_STREAM_TOKEN` | no | Cloudflare API token with **Stream: Edit** — video lessons of view-only items and courses (uploaded with signed-URL protection; the account id is `R2_ACCOUNT_ID` unless `CLOUDFLARE_ACCOUNT_ID` is set). Without it, only PDF lessons work |
| `R2_PRIVATE_BUCKET` | no | Name of the private bucket for paid downloads (just a name, a plain variable) |
| `PAYSTACK_SECRET_KEY` | **yes** | Paystack API key (also verifies webhook signatures) |
| `NEXT_PUBLIC_SITE_URL` | no | `https://www.notesapp.name.ng` (emails, API URLs, share links) |
| `RESEND_API_KEY` | **yes** | Resend key; without it emails are skipped |
| `EMAIL_FROM`, `SUPPORT_EMAIL` | no | Sender (`#NotesApp <…>`) and where support/error alerts go (default hello@notesapp.name.ng) |
| `CRON_SECRET` | **yes** | Bearer secret for `/api/cron/reminders` |
| `AUTO_PAYOUTS` | no | `off` pauses automatic payout release |
| `AD_HASH_SALT` | no | Salt for hashing ad-visitor ids (default `notesapp`) |
| `DOJAH_APP_ID`, `DOJAH_SECRET_KEY`, `DOJAH_WEBHOOK_SECRET` | secret key / webhook secret **yes** | Dojah identity checks |
| `DOJAH_API_BASE` | no | Sandbox only — **delete for live** |
| `NEXT_PUBLIC_DOJAH_WIDGET_PERSONAL`, `_CORPORATE` | no | Dojah widget ids (sandbox now; live ids at go-live) |
| `DOJAH_AUTO_APPROVE` | no | Keep off; `true` auto-approves a gold application whose every step passed |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | token **yes** | Optional: auto-connect Enterprise custom domains and `/status` check; team id only for a team project |

Script-only (never in Vercel): `SOURCE_SERVICE_ACCOUNT`, `DEST_SERVICE_ACCOUNT` (migration), `GOOGLE_APPLICATION_CREDENTIALS`.
A copy-paste template is `.env.local.example`.

### Deploy checklist (after merging a change that touches rules or indexes)
1. `firebase deploy --only firestore` — publishes `firestore.rules` and the TTL policies in `firestore.indexes.json`
   (`errorLogs`, `webhookDeliveries`, `apiIdempotency`, `videoUploads`, plus older ones). If it offers to delete the
   `adSeen`/`seen` field overrides, answer **N**.
2. `npm run test:rules` before deploying rules (starts the Firestore emulator; needs Java) — 36 tests.
3. cron-job.org: `GET https://www.notesapp.name.ng/api/cron/reminders` every 15 min with `Authorization: Bearer $CRON_SECRET`, and
   `GET /api/status` every 5 min (so incidents are detected without visitors).
4. Media bucket CORS from `scripts/r2-cors.json` on **both** R2 buckets (browser PUTs go straight to R2).

### Where to look when something's wrong
`/status` (live checks: database, auth, uploads, media, **digital downloads**, **developer API**, **custom domains**, payments, email,
identity, scheduled jobs) · `/admin/errors` (grouped errors, 30-day retention) · `/admin/traction` (numbers for decks) ·
`/admin/payments` (held/failed payouts) · `/admin/api-access` (API access and domains) · Vercel → Logs.

### Scripts (`scripts/`)
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

## Independent infrastructure migration — separating from Precheks

**Read this before touching Firebase/R2 config in a future session —
the plan and the runbook are both here, not scattered across chat
history.** Everything above and below this section, wherever it says
"shared with Precheks" or "same Firestore project," describes the
architecture as it existed *before* this migration. NotesApp now runs
on its own independent Firebase project and its own Cloudflare R2
bucket. Precheks keeps its original project, completely untouched —
this migration only ever reads from it, never writes or deletes there.

### What changes, concretely

- **Firestore**: NotesApp gets a brand new Firebase project, created
  fresh in the Firebase Console. `lib/firebase.ts` needed **zero code
  changes** for this — it already reads every config value from env
  vars, so switching projects is purely a `.env.local` swap.
- **Media storage**: Cloudinary → Cloudflare R2. `lib/cloudinary.ts`
  is gone. `lib/upload.ts` (`uploadToR2`) replaces it, used from
  `NoteForm.tsx` exactly where `uploadToCloudinary` used to be called.
- **Going forward, NotesApp and Precheks no longer share live data.**
  This is the one architectural principle this whole project was built
  around until now — "no schema changes, NotesApp just reads Precheks'
  data" — and it's the thing actually changing today. After migration,
  a comment posted on NotesApp does *not* show up on Precheks, and
  vice versa. The two apps diverge from the migration snapshot onward.
  Worth being certain this is really the intent before running it,
  since there's no simple way back to live-shared data afterward.

### Why the upload flow works differently now

R2, unlike Cloudinary's unsigned-upload-preset pattern, has no concept
of a safe, publicly-writable upload endpoint — R2 credentials are
real AWS-style secret keys that must never reach the browser. So the
new flow is a **presigned URL**, not a direct client upload:

1. Browser calls `POST /api/upload` (a real Next.js server route now,
   `app/api/upload/route.ts`) with the file's name and content type,
   plus the signed-in user's Firebase ID token in the `Authorization`
   header.
2. The route verifies that token server-side via `firebase-admin`
   (`lib/firebase-admin.ts`) and checks the resulting email against
   the same 2-founder allowlist `isAdmin()` uses in
   `firestore.rules` — this is a **real, separate security boundary**
   now, not something Firestore rules alone can protect, since R2
   isn't Firestore and has no security-rules concept of its own.
3. If that passes, the route asks R2 for a one-time presigned `PUT`
   URL (`lib/r2.ts`, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
   — R2 is S3-compatible, so the AWS SDK works against it unchanged,
   just pointed at Cloudflare's endpoint instead of AWS's).
4. The browser uploads the file **directly to R2** using that URL —
   the file's bytes never pass through the Next.js server at all. This
   matters most for video (see "Video on posts" further down): no server bandwidth or request-body-size limit involved.

`FIREBASE_SERVICE_ACCOUNT_KEY` (the new server-only env var this
requires) is the full service-account JSON, generated from Firebase
Console → Project settings → Service accounts, pasted as one line.
Never commit it, never prefix it `NEXT_PUBLIC_` — full details in
`.env.local.example`.

### Cloudflare R2 requires a card, even for the free tier

Worth stating plainly since it surprises people: unlike Workers, KV,
or D1, R2 requires a payment method on file to activate at all, even
though you won't be charged unless you exceed the free 10GB-month /
1M-write / 10M-read allowance. There's no way around this specific
step — set a Cloudflare billing alert (e.g. at $1) as a tripwire
rather than trying to avoid adding a card entirely.

### Running the migration

`scripts/migrate-to-own-infra.mjs` — full instructions in its own
header comment, summarized here:

1. **Create the new Firebase project** (Firebase Console → Add
   project) and **the new R2 bucket** (Cloudflare dashboard → R2 →
   Create bucket) — both manual, account-level steps only you can do.
2. Get a service account key for **both** projects: the existing
   `precheks-cms` one (source) and the new one (destination).
3. `npm install` — picks up `firebase-admin` and the AWS SDK packages.
4. **Dry run first**: `npm run migrate:dry-run` — logs exactly what
   would be copied and which images would be re-uploaded, writes and
   uploads nothing. Read this output before doing anything for real.
5. `npm run migrate` — the real run. Migrates, in order: every note
   (with its `comments`, nested `commentLikes`, and `likes`
   subcollections, same document IDs preserved), then `users`,
   `follows`, `subscriptions`, `leads`, and `notifications` as flat
   collections. Any `featured_image` or `author_avatar` field pointing
   at a Cloudinary URL gets downloaded and re-uploaded to the new R2
   bucket automatically, with the note written to the destination
   using the **new** URL — this is the "transfer existing images and
   journals" part specifically asked for.
6. Update `.env.local` to point at the new Firebase project and R2
   bucket (see `.env.local.example` — every var needed is listed
   there with where to find it).
7. **Redeploy `firestore.rules` to the new project.** The file in this
   repo needs no changes to work standalone — the only Precheks
   reference left in it is Chimdinma's real email address in the admin
   allowlist, which is correct to keep, not a dependency on Precheks'
   infrastructure. Deploy the same file, just to the new project.
8. Spot-check a handful of journals and profiles load correctly with
   images showing before treating the old shared project as retired
   for NotesApp's purposes. Precheks keeps using it exactly as before
   — nothing there was touched.

**What's covered vs. what isn't:** the explicit ask was user accounts,
journals, and profiles — all covered (`users`, `notes` +
subcollections). Also migrated, since leaving them behind would
orphan them for no reason: `follows`, `subscriptions`, `leads`,
`notifications` — all NotesApp-only collections that happened to live
in the shared project, never Precheks' data to begin with.

### Video uploads — built later (see "Video on posts")

This migration shipped image upload only; the 3-images/day and 7-videos/week idea from the planning doc was not followed
literally. Video on posts now exists: one MP4/WebM per post through the same presigned-PUT pattern (the file never passes through
the server), with size, length and weekly-quota limits instead of server-side compression. Details, rules and the verification
flow are under "Video on posts" further down.

## Suspension field reconciled with Precheks' own — this was the real finding

Precheks built its own suspend feature independently, on the same
shared `users` collection, using a flat `suspended: boolean` — not the
`status: "active" | "suspended"` enum this used to be. Two apps
writing incompatible shapes to the same shared field would have meant
a user suspended via Precheks' own admin tools was invisible to
NotesApp's checks, and vice versa — silently, with no error, just
wrong behavior. Caught from a code comment in Precheks' updated
`isSuspended()` helper flagging the real field name.

**Reconciled in NotesApp's favor of Precheks' shape**, since it's
already live there: `UserProfile.suspended: boolean` is now the
canonical field both apps read and write. NotesApp's richer appeal
data — reason, appeal status, timestamps, who resolved it — stays in
the `suspension` object alongside it, same pattern as `Note.premium`:
additive, NotesApp-only, Precheks never reads or writes it, doesn't
need to know it exists.

Every place that used to check `.status === "suspended"` now checks
`.suspended === true`: `lib/users.ts` (type + both default-value
writes), `lib/moderation.ts` (`suspendUser`/`unsuspendUser`/
`getSuspendedUids`'s query), `ProfilePageClient.tsx`, `app/admin/users/page.tsx`,
and the journal detail page's suspended-author banner. Also fixed an
internal inconsistency in the rules file itself that came from the
same edit — the `users/{uid}` update rule's appeal branch still
checked `resource.data.status` after `isSuspended()` had already
moved to `.suspended`, which would have silently broken the appeal
flow (the eligibility check and the actual write-permission check
would have disagreed with each other). Both now check `.suspended`
consistently.

**If anything else about a user gets built independently on Precheks'
side in the future** — another moderation flag, another role concept
— the same class of bug is possible again. Worth checking any future
Precheks rules upload against `lib/users.ts`'s `UserProfile` type
before assuming field names match.

## Rules audit — user-combined version, 3 findings

You asked me to check your hand-combined `firestore.rules` for gaps.
Two were live bugs, fixed directly; one is a real question, left for
you to decide:

1. **Fixed — the contact form was completely broken.** The `leads`
   create rule's `hasOnly([...])` field allowlist was missing
   `'category'` — but `lib/leads.ts`'s `submitLead()` always sends one
   (`ContactForm.tsx` defaults it to `"other"`, never omits it).
   `hasOnly()` is an exact allowlist; any write containing a key
   outside it gets rejected outright. Every real submission would have
   failed silently at the rules layer. Added `'category'` to the
   allowed keys and a matching `is string` check, consistent with the
   rest of that rule's validation style.
2. **Fixed — removed a stale `/journals` collection block.** Leftover
   from before this project consolidated everything onto the shared
   `notes` collection (see "The one rule this build follows," near the
   top of this file). Nothing in the app writes to a `journals`
   collection anymore — it was dead, not harmful, but it directly
   contradicted the documented single-source-of-truth architecture and
   would mislead anyone reading the rules file cold.
3. **Not touched — needs a decision, not a fix.** The combined file
   adds an `isWriter()` helper (checks `role == 'writer'`) and lets
   whoever passes it create/update/delete their own notes
   (`authorUid == request.auth.uid`). Two things don't line up with
   the actual app today: `UserRole` in `lib/users.ts` is
   `"admin" | "staff" | "volunteer" | "reader"` — there is no
   `"writer"` value anywhere, no UI ever sets one, so `isWriter()`
   never returns true right now. And `Note` in
   `lib/firestore-notes.ts` has no `authorUid` field at all — only a
   free-text `author` display name — so even a hypothetical writer
   role couldn't satisfy `authorUid == request.auth.uid`. As written,
   this branch is syntactically valid but currently unreachable, not a
   security hole. If the intent is to actually let staff/volunteer
   publish now: say so, and I'll add `authorUid` to `Note`, wire a
   real assignable role that matches (or rename this to check `staff`/
   `volunteer` instead of `writer`), and build the composer UI for it.
   If it was just forward-scaffolding, it's fine to leave as-is, but
   it's worth knowing it does nothing yet either way.

## SEO — sitemap, robots, per-page metadata, real OG cards

None of this existed. All of it does now:

- **`app/sitemap.ts`** — static routes, every published journal
  (`getAllNotes`), every real profile (`getAllUsers`) plus both
  synthetic channels (hardcoded — `getAllUsers()` never returns them),
  and all 5 of `@notesapp`'s hardcoded posts (also hardcoded — they're
  not in Firestore either). Wrapped Firestore calls in try/catch so a
  build-time outage still ships a sitemap with the static pages.
- **`app/robots.ts`** — allows everything except `/admin`, points at
  the sitemap.
- **A real OG image** (`public/images/brand/og-default.jpg`) — none
  existed, so I built one from scratch with PIL: crimson/ink brand
  background, logo, the actual homepage headline, domain. 1200×630,
  the standard size.
- **Root layout** — title template (`"%s — #NotesApp"`), full
  OpenGraph + Twitter card blocks pointing at that image.
- **Per-page `metadata`** on every static page (`/about`, `/contact`,
  `/brand`, `/roadmap`, `/advertise`, `/merchstore`, `/booking`), and
  `generateMetadata` on every dynamic one: journal entries (real
  featured image as OG image, falls back to the default), `@notesapp`
  posts (its pitch-deck image), and profiles (real avatar, real bio).

**The non-obvious part:** `/journals`, `/u/[username]`, and
`/u/[username]/store` were all `"use client"` — and Next.js flatly
won't let a client component export `metadata` or `generateMetadata`,
by design. Fixed by splitting each into a thin async **server**
`page.tsx` (handles `generateMetadata`, including a synthetic-profile
branch for both official channels) that renders a **client**
component holding all the original interactive logic unchanged:
`JournalsPageClient.tsx`, `ProfilePageClient.tsx`, `StorePageClient.tsx`
in `components/`. Nothing about how those pages *work* changed — only
where the file boundary sits.

## Verified badge — the 4 official accounts, plus where it's headed

`✔` next to a name, wherever a name is shown prominently: profile
headers, the two channel spotlights, the founders' card, and
People/Channels directory rows. `lib/journals-directory.ts`'s
`VERIFIED_USERNAMES` covers all 4 official accounts today (both
channels, both founders) — hardcoded, since none of them go through
the real verification flow that doesn't exist yet.

The forward path is already typed: `UserProfile.verified?: boolean`
in `lib/users.ts`, currently unset by every write path, documented
inline as "where the Pro/Business-tier verification feature lands."
Nothing writes to it yet — that's a real feature (some actual
verification check) to design later, not just flipping a flag.

## User suspension, roles, and appeals

The core of this session. Three linked pieces:

**Roles.** `UserProfile.role` widened from `"admin" | "reader"` to
`"admin" | "staff" | "volunteer" | "reader"` — "staff" mirrors
Precheks' in-house writers, "volunteer" mirrors external contributing
writers. **Publishing:** both roles grant publish permission over one's
own notes (`isPublisher()` in `firestore.rules`, mirrored by `canPublish()`
in `lib/users.ts`), as does any account tier other than "standard".
Admin rights are separate: the two founder emails or a custom `admin`
claim. A client can't grant itself any of this — the role field is only
writable through the admin routes. Admins assign it from `/admin/users`.

**Suspension.** `lib/moderation.ts`: `suspendUser()`,
`unsuspendUser()`, `rejectAppeal()`, `updateUserRole()`,
`getSuspendedUids()`. A suspended account:
- Shows the locked-profile avatar (`public/images/brand/suspended-avatar.png`)
  and a "⚠ Temporarily Suspended" badge in place of the normal role
  label, on their own profile page.
- Has its published notes hidden behind a "temporarily hidden" banner
  on the journal detail page (`authorProfile?.suspended === true`
  check) — dormant in practice today since only founders can publish,
  but built and ready for when staff/volunteer publishing exists.
- Has its comments replaced with "This comment is hidden — the
  account is temporarily suspended" wherever they appear
  (`Comments.tsx`, via one `getSuspendedUids()` query up front rather
  than a per-comment lookup) — this part is fully live today, since
  any signed-up reader can already comment.
- Can't post new comments — enforced in `firestore.rules` via a new
  `isSuspended()` helper (a `get()` call on their own `users` doc),
  not just hidden in the UI.

**Deliberately NOT suspension-gated:** likes. Adding the same `get()`
check there would mean an extra Firestore read on every like, for a
much lower-stakes action than a comment. Worth revisiting if likes
ever become a real spam vector; not assumed to be one today.

**Appeals.** A suspended member sees an appeal form on their own
profile (`isOwnProfile` check via the signed-in viewer's uid) — text
box, submits via `submitAppeal()`. An admin sees pending appeals
inline in `/admin/users` with "Uphold — Unsuspend" / "Reject — Stays
Suspended" buttons. Resubmission after a rejection is allowed; there's
no cap on appeal rounds in this version.

**The security-critical part — `firestore.rules`' `users/{uid}` update
rule.** This is why this needed a real rules rewrite, not just new
client functions. The old rule let a signed-in user update their own
doc with no field restrictions at all — meaning a suspended user could
trivially write `status: "active"` back and un-suspend themselves.
The new rule allows exactly three paths: admin (anything), the member
updating only `displayName/bio/avatar/social`, or a suspended member
updating only the `suspension` map — and even then, only to set
`appealStatus: "pending"`, with `status` itself and the
admin-authored fields (`reason`, `suspendedAt`, `suspendedByUid`)
required to stay unchanged. **Redeploy `firestore.rules`** — this one
is load-bearing, not cosmetic.

## Contact form → Firestore `leads` collection

Same pattern as Precheks' own leads tab, generalized per the brief —
"it could be used in notesapp for anything to reach admins faster."
`/contact` is a real form now (`components/ContactForm.tsx`), writes
to a new `leads` collection with a `category` field (partnership,
press, investment, support, bug report, other) rather than being
investment-enquiry-specific. `/admin/leads` lists them with
read/archive/delete and a status filter.

`firestore.rules`: `leads/{leadId}` allows `create: if true` —
genuinely public write, since a visitor filling out a contact form
isn't authenticated at all, there's no author identity to restrict
creation to. Read/update/delete are admin-only.

## Third-party review — addressed

A review of the whole project raised 5 points. Where each landed:

1. **Headline promise ahead of what's built.** Agreed, and acted on
   immediately — added a "What's actually true right now" section
   (now at the top of `/roadmap`, `app/roadmap/page.tsx`; it started on
   the homepage), explicitly separating what's live from what's roadmap. Extends the
   same "demo" honesty already used on the booking calendar and
   subscribe buttons to the page that matters most for a first
   impression.
2. **Admin allowlist won't survive multi-tenant.** Correct, and
   already the stated blocker for both "open publishing to any
   professional" and now "staff/volunteer can actually publish" above.
   Documented as needing Firebase custom claims via Admin SDK — not
   built now, since it's not this session's ask, but the boundary is
   written down everywhere it's relevant so nobody retrofits a
   Firestore-field-based permission system under pressure later.
3. **MCP: ship read tools before the write tool.** Incorporated
   directly into the AI/MCP roadmap section below — `search_my_notes`
   and `get_note` before `create_draft`, with token scoping, rate
   limits, and revocation named as day-one requirements for the write
   tool specifically, not nice-to-haves.
4. **Scope check — prioritize real payments.** Fair. Noted in
   `/roadmap` and here: if one roadmap item gets built next, it should
   be Paystack/Flutterwave — "get paid" is the third word in the
   headline, and it's the one piece most directly tied to the pitch
   actually being true.
5. **Don't over-attribute errors to ad-blockers reflexively.** Fair
   epistemic point. Softened the language everywhere the
   `getCountFromServer` "unavailable" error is discussed — framed as
   "one common cause, not a confirmed diagnosis," with an explicit
   note to actually investigate if it starts happening often with real
   users, rather than reaching for the same explanation by reflex.

## "Reply as the brand" — comments as @na-notesapp

Admins (Emmanuel, Chimdinma) can now post a comment or reply as
**@na-notesapp** instead of themselves — a checkbox next to the
comment box and each reply box in `components/Comments.tsx`, visible
only to admins. The comment's `authorUid` still ends up as the real
admin's Firebase uid either way (`firestore.rules`' comment-create
rule requires `authorUid == request.auth.uid`, so it genuinely can't
be spoofed to a different identity) — only the *display* fields
(`authorUsername`, `authorDisplayName`, `authorAvatar`) change to
@na-notesapp's. Brand-authored comments get a small "Official" badge.
Delete permission is unaffected — it already checks the real
`authorUid`, which never changes.

## Site activity fix — adopted from Precheks

Two files, both now match what's shipped and working on Precheks:

- `lib/engagement.ts` — added `getRecentCommentsOnNotes()`, which
  queries each note's own `comments` subcollection individually
  (simple `orderBy`, no `where`) rather than a
  `collectionGroup + where + orderBy` combo, then merges and sorts in
  JS. Needs no composite index, unlike a collectionGroup approach
  would.
- `app/u/[username]/page.tsx` — anyone with real authored notes (a
  founder, or @na-notesapp) now shows "Recent Comments on Their
  Notes"; an ordinary reader keeps "Recent Activity" (their own
  comments elsewhere) — that framing genuinely fits a reader's profile
  better. @notesapp shows neither section — no real Firestore data
  behind it to display.

## @na-notesapp, now visible by default on /journals

It was only reachable by clicking into the Channels tab — easy to
miss entirely if nothing's been posted under it yet. Added
`components/SocialChannelSpotlight.tsx`, shown unconditionally
between the @notesapp and founders' spotlights, same as the other
two — with its own follow/subscribe buttons, stats, and a preview of
its most recent real posts once any exist.

## AI drafting via MCP + AI notetaker → draft handoff — documented, not built

**Read this before starting AI drafting work in a future session — the
mechanism is worked out below, not just the feature name.** This
expands the "AI content drafting" roadmap item into something
buildable, and connects it back to steps 7–9 of the original Value
Loop pitch deck (Capture → Refine → Publish Again) — this *is* that
loop, automated.

**The idea in one line:** a session gets transcribed automatically,
and the user's own AI — already primed with their past writing — turns
that transcript (or just a dropped-in idea) into a draft that sounds
like them, not like generic AI output.

**Part 1 — connect an AI assistant via MCP.** A user connects Claude,
Gemini, or ChatGPT directly to their #NotesApp account using [MCP
(Model Context Protocol)](https://docs.claude.com/en/docs/mcp) — the
same mechanism Claude uses to connect to any external tool. #NotesApp
would need to expose its own MCP server with tools such as:
- `search_my_notes` / `get_note` — read access to a user's own past
  published and private entries, so the AI has real context: their
  topics, structure, phrasing, the way they actually write.
- `create_draft` / `update_draft` — write access to save AI output
  as a new private draft, not publish directly. Per how MCP tool
  permissions normally work, a write action like this should require
  the user's confirmation in their AI client, not fire silently.
- `get_recent_session` — pulls in a meeting transcript/summary (Part
  2 below), if the user wants to draft from a session rather than a
  dropped-in idea.

A user generates an access token from #NotesApp's own settings (not
built yet — this is the piece that doesn't exist), pastes it into
their AI client's MCP connector setup, and from then on that AI can
read their own notes as context whenever they ask it to write
something for #NotesApp.

**The actual drafting moment:** the user drops a rough idea into a new
draft. Their connected AI calls `search_my_notes`, reads a handful of
their most relevant past entries, and finishes the piece — matching
their tone and structure — as if they'd researched and written it
themselves. This is the differentiator: not "AI writes a generic post
for you," but "AI writes the post *you* would have written, because it
actually knows how you write."

**Part 2 — AI notetaker for booked sessions.** This needed a real
answer to "where does the meeting actually happen, and how do we
guarantee a notetaker shows up" — worked out below, not hand-waved.

*Where sessions happen:* Zoom or Google Meet. #NotesApp isn't building
its own video-calling product — that's out of scope entirely. Both
have mature, well-documented APIs for programmatically creating a
meeting, which is the part #NotesApp *can* control.

*Can #NotesApp generate the session itself?* Yes, once — a
professional connects their Zoom or Google account to #NotesApp (a
one-time OAuth step in settings, not built yet). After that, every
booking auto-creates a real meeting: a Zoom API call
(`POST /users/{userId}/meetings`), or a Google Calendar event with
`conferenceData.createRequest` set (which generates a Meet link as a
side effect of creating the event). Either way, the booking confirmation
and reminder carry a real, joinable link — not a placeholder.

*Can #NotesApp guarantee Otter/Fireflies/Read AI attends?* Honestly,
only partially, and it's worth being precise about the boundary:

- **The realistic mechanism — calendar auto-join.** Otter, Fireflies,
  Fathom, and Read AI all support connecting to a user's Google/Outlook
  calendar and auto-joining any meeting on it that has a Zoom/Meet
  link — no manual invite needed. If #NotesApp creates a proper
  calendar event with a real video link (the OAuth step above), and
  the professional has *separately* connected their calendar to
  whichever notetaker they already use — on the notetaker's own
  platform, outside #NotesApp's control — the bot joins automatically.
  #NotesApp's job is narrow and achievable: make sure a real,
  calendar-visible meeting exists. It cannot control whether the
  professional has done their half of the setup, or whether the
  notetaker's service is up.
- **The tighter alternative — direct API integration.** Fireflies has
  the most developer-friendly public API for this; Otter and Read AI's
  equivalents are more enterprise-gated. Direct integration would mean
  #NotesApp holding that vendor's API key per professional and calling
  "join this specific meeting URL" itself at booking time — real
  control, but a genuine per-vendor engineering commitment. Realistic
  path: build this for one vendor first (Fireflies), not all three at
  once.

*Getting the transcript back into a draft:* also needs a real answer.
Two paths, not mutually exclusive:
1. **Webhook / Zapier bridge** — Fireflies and some Read AI/Otter
   plans can fire a webhook (or a Zapier "new transcript" trigger) when
   a transcript is ready. #NotesApp would need an endpoint to receive
   that and hand it to the MCP-connected AI automatically. This is
   real automation, but depends on the vendor's webhook support and
   plan tier.
2. **Manual paste, as the honest first version.** A simple "paste your
   meeting summary here" box that hands whatever the user pastes to
   their connected AI for drafting. Zero third-party API partnerships
   required, works with literally any notetaker (or no notetaker —
   just their own notes from the call), and still delivers the actual
   value (AI drafting in their voice from real session content). The
   automated join + automated handoff are upgrades on top of this, not
   prerequisites for it.

**The handoff — where the two parts connect:** however the meeting
summary arrives (webhook or pasted), it hands off to whichever AI the
user already connected in Part 1, which turns it into a new,
ready-to-review draft — using the same "write in my voice" mechanism,
now fed by a real session instead of a typed-in idea.

**What none of this needs to touch:** the shared `notes` collection
schema doesn't change for this — drafts created this way are ordinary
`notes` docs with `status: "draft"`, same as any manually-written one.
The new surface area is entirely: (a) an MCP server #NotesApp would
need to build and host, (b) a settings page to connect Zoom/Google and
generate/revoke MCP access tokens, and (c) either a paste-box (v1) or
webhook receivers for a specific notetaker vendor (v2), to get a
transcript into a draft.

## Search — @na-notesapp was missing from both search surfaces

Two separate gaps, not one:

- **Header search** (`components/SearchBar.tsx`) hardcoded its people
  pool as `[OFFICIAL_NOTESAPP_PROFILE, ...getAllUsers()]` — built
  before @na-notesapp existed, never updated. Now pulls from
  `CHANNEL_JOURNALS`, which includes both.
- **`/journals`' default "All" tab** only ever searched note
  title/author/categories/tags — never the People/Channels directory,
  even though the Channels tab's own search worked fine. Typing
  "na-notesapp" while on "All" (the tab everyone lands on) found
  nothing unless it happened to have a matching real note. Fixed by
  showing matching people/channels above the note results whenever
  there's an active search query on "All," not just on their own tabs.

## Two company accounts — @notesapp and @na-notesapp

Deliberately different, both documented in `lib/journals-directory.ts`:

- **@notesapp** — unchanged from before. Fully synthetic, UI-only, 5
  hardcoded posts, no comments (there's nothing in Firestore to
  comment on).
- **@na-notesapp** — new. Mirrors everything published on the official
  social handles. Also has no real login of its own, but its entries
  are **real, published notes** in the shared `notes` collection — an
  admin picks "NotesApp" from the author toggle in `NoteForm.tsx`
  (third option, alongside Chimdinma and Emmanuel) exactly like
  choosing which founder wrote something. Full engagement — comments,
  likes, shares — works normally on its notes, same as any other
  journal, because they're regular note documents.

Both are `synthetic: true` in `SYNTHETIC_JOURNALS` — `app/u/[username]/page.tsx`
checks that list before ever calling `getUserByUsername()`, since
neither has a `users` doc. Only `notesapp` skips the `/notes` fetch
entirely (`isOfficial`); `na-notesapp` (`isSocialChannel`) still fetches
and filters real notes by `author === "NotesApp"`, same mechanism the
rest of the app already uses to key notes off a display name rather
than a stored `authorUsername` field.

Both show up in `/journals`' Channels tab (`CHANNEL_JOURNALS`) and on
`/about` under "Company Accounts."

**Reserved usernames.** Nobody can register a username containing
"notesapp" — enforced in `firestore.rules`
(`usernames/{username}`'s create rule now checks
`!username.lower().matches('.*notesapp.*')`) and mirrored client-side
in `/signup` (`lib/journals-directory.ts`'s `isReservedUsername()`) for
a friendly error instead of a raw permission-denied. This has nothing
to do with @notesapp or @na-notesapp themselves — neither ever goes
through the `usernames` reservation path, since both are hardcoded.

## Firestore rules — adopted your fix, added the username rule on top

The `firestore.rules` in this repo is now based on the version you
sent back (with the working comments-count fix — a
`match /{path=**}/comments/{commentId} { allow read: if true; }`
collection-group rule, needed because a `getCountFromServer(collectionGroup(...))`
query on the admin dashboard doesn't satisfy against a rule scoped to
one note's nested `comments` subcollection at a time). Only addition on
top of your file: the reserved-username create rule above.
**Redeploy this file** — it has both your fix and the new rule.

## Assets — a persistent problem worth flagging

The core app icon (`public/images/brand/notesapp-icon.webp`) had been
wrong — a stretched 800×533 crop instead of the real square mark —
across multiple earlier sessions, silently reappearing each time
files got repackaged from an older working copy. It's now the correct
891×891 square, replaced directly in this repo. If it goes wrong
again, the fix is exactly this: get the correct file from the person
and `cp` it over `public/images/brand/notesapp-icon.webp` — don't
regenerate or re-derive it from anything else.

## @notesapp's journal — 5 real posts, still no Firestore

`/u/notesapp` now has actual content instead of an empty state:
`lib/notesapp-posts.ts` hardcodes 5 explanatory posts (Summary, The
Value Loop, How #NotesApp Works, How It Connects to Your Business,
Life Without #NotesApp), each backed by one of the pitch-deck images
in `public/images/pitch/`. `components/NotesAppPostRow.tsx` renders
them in the same left-thumbnail style as `JournalRow`, and
`app/u/notesapp/posts/[slug]/page.tsx` is a real detail page for each
— full image, body copy, a "Next" link cycling through the other 4.

This is still entirely UI-level, per the original instruction: no
`notes` collection writes, no Firestore reads for this profile at
all. `ChannelSpotlight`'s journal count now reads
`NOTESAPP_POSTS.length` (5) instead of filtering `allNotes` for an
author that will never exist there.

## Run it locally

```bash
cd notesapp-site
npm install
cp .env.local.example .env.local  # paste in the same values
                                   # you use in precheks-site/.env.local
npm run dev
```

Open http://localhost:3000

## The one rule this build follows

**No new collections, no new fields, no rules changes.** Every data
file here is either an exact copy of precheks-site's own `lib/` files
(`firestore-notes.ts`, `engagement.ts`, `users.ts`, `admin.ts`,
`useAdminAuth.ts`) or a thin UI layer on top of them:

- `/journals` and `/journals/[slug]` call `getAllNotes()` /
  `getNoteBySlug()` — the same functions, same `notes` collection,
  Precheks' site already uses at `/notes`.
- Likes, comments, and shares on a journal page are Precheks' own
  `components/Comments.tsx` and `SocialBar.tsx`, copied over and only
  reskinned (crimson instead of gold) — the logic, the Firestore
  paths, and the security rules are untouched. A comment posted here
  shows up on precheks.com.ng and vice versa, live, because it's the
  same document.
- `/u/[username]` and `/u/[username]/store` call `getUserByUsername()`
  against the real `users` collection — the same reader/admin
  accounts work on both sites without signing in twice.
- `/admin/journals*` is Precheks' own Notes CMS (`NoteForm.tsx`,
  create/edit/delete), just mounted at a different URL. Publishing
  from here is the same as publishing from Precheks' `/admin/notes`.
- `firestore.rules` in this folder is **byte-identical** to Precheks'
  live rules file — provided only so you have a copy to diff against,
  not because anything needs to change or redeploy.

The two things that genuinely are #NotesApp-only, and don't touch
Firestore at all:

- **Brand store** (`lib/store.ts`) — a hardcoded product catalogue per
  username, real links, no database involved yet.
- **Booking calendar** on the profile page — a static UI demo today,
  not backed by real availability or payment.

## Who can publish, today

Same as Precheks: only `ezurukam@gmail.com` and
`precheks.info@gmail.com` (see `lib/admin.ts` / `firestore.rules`).
Any signed-up reader can already comment and like — that's Precheks'
existing behavior, inherited here for free. Opening *publishing* to
any professional is the next milestone, not this session.

## Avatars

`lib/admin.ts` points at real headshots, matching Precheks' own file
exactly:

- `/images/headshots/emmanuel-adams-1.jpeg`
- `/images/headshots/chimdinma-onwuegbu-2-professional.jpeg`
- `/images/headshots/default-avatar.png` (fallback)

Drop your headshot files into `public/images/headshots/` with those
exact names (`.jpeg` on the real photos, `.png` only on the default).
`components/Avatar.tsx` falls back to `default-avatar.png` at runtime
if a file is ever missing, so a typo'd filename degrades gracefully.

## Brand stores — real catalogues, not placeholders

`lib/store.ts` holds real products, keyed by username:

- **`/u/chimdinma/store`** — her three items from
  [precheks.com.ng/shop](https://www.precheks.com.ng/shop) (MS-Excel
  course, Career Planning and Development, 20 IT Niches — all via
  Selar). Cover images expected at `public/images/shop/*.jpg`.
- **`/u/emmanuel/store`** — his LWB Magazine feature (free), and his
  two Amazon titles (Future of Digital Money, Entrepreneurship 101).
  Images at `public/images/shop/Hero-Cover-June-2026.webp`,
  `Future-Digital-Money-Cryptocurrency.jpg`,
  `Entrepreneurship-101-Release-Inner-Entrepreneur.jpg`.

"Buy" buttons deep-link out to Selar / Amazon / the magazine as they
do today — inline Paystack/Flutterwave checkout for #NotesApp's own
products is a follow-up build, not this session's scope.

## Admin dashboard — ported from Precheks' expanded version

`app/admin/page.tsx` now matches Precheks' fuller dashboard build:
stats grid, Top Journals by Views, Best Engagement
((likes+shares+comments)÷views), Most Commented, Top Categories/Tags
by views, and a 6-month Journals Published bar chart. Same `notes`
collection, same numbers as Precheks' own dashboard — only the labels
say "journal." Per-note comment counts are fetched one
`getCountFromServer` call per note (fine at today's volume); if the
note count grows into the hundreds, denormalize a `commentCount`
field on write instead of querying per-note on every dashboard load.

## Merch store — `/merchstore`

Combines two things on one page:

1. **Official #NotesApp merch** — t-shirts, caps, mugs, a Stanley-style
   cup, mouse pad, coffee cup, laptop bag. Each item has a logo picker
   (`components/MerchCard.tsx`) pulling from the same core + seasonal
   marks on `/brand` (`lib/merch.ts`). No product photography exists
   yet, so items render as an icon placeholder with the chosen logo
   badged on top — swap in real mockup photos per logo/product
   combination when they exist. "Add to Cart" is disabled and labeled
   demo — no checkout or print-on-demand fulfillment wired up.
2. **The two individual shops**, below it, **Emmanuel's first, then
   Chimdinma's** (`lib/store.ts`'s existing real catalogues,
   unchanged) — each links out to its own `/u/[username]/store` page.

The footer's "Merch Store" link (Product column) now points here
instead of straight to Chimdinma's individual store.

## What's in this MVP

- `/` — landing page (product, the core loop, features, Precheks
  framed as first reference customer/partner — never as owner)
- `/journals`, `/journals/[slug]` — Precheks' published notes, read
  and interacted with (comment/like/share, live) through this UI
- `/u/[username]`, `/u/[username]/store` — a professional's profile:
  bio, native booking calendar (demo), their public writing, and
  their brand store
- `/login`, `/signup` — reader accounts (shared with Precheks)
- `/admin/login`, `/admin` (Dashboard: stats, top journals by views),
  `/admin/journals`, `/admin/journals/new`,
  `/admin/journals/[id]/edit`, `/admin/users` (read-only, shared
  `users` collection), `/admin/settings` (shared `settings/site` doc —
  see note in that page)
- `/booking` — a short explainer of the booking product
- `/brand` — the Company → Brand page: logo system, colors, and every
  seasonal/festival mark, with usage notes
- `/merchstore` — official branded merch (demo, logo picker, no
  checkout) plus links to the two individual creator stores
- `/advertise` — the ad-share program explainer (see below) — copy
  only, not a working feature
- `/roadmap` — social publishing, AI drafting, and enhanced booking —
  decided and documented, not built yet
- `/u/notesapp` — the synthetic official platform journal, auto-
  followed by every member

## Ad-share program — documented now, not built yet

**Read this before touching anything ad-related in a future session —
the plan is already decided, only the implementation is pending.**

`/advertise` is a static explainer page for this. No ad serving, no
payout logic, no database fields exist yet. When it's time to build:

- **Free-tier journals**: ads shown, no revenue share to the author.
- **Pro tier**: 25% ad revenue share, *if the professional opts in* to
  showing ads on their pages.
- **Business tier**: 45% ad revenue share, same opt-in condition.
- Both paid tiers get their share **from day one of opting in** — no
  follower/view threshold, no approval queue, unlike platforms that
  gate ad revenue behind qualification criteria. This "no gated
  conditions" framing is a deliberate differentiator, not a detail to
  drop when building it.
- **Anyone can buy an ad** — a #NotesApp user or not, free tier or
  paid. Advertising isn't restricted to members.
- Entry point is a single footer link ("Advertise") — that's the only
  UI surface that exists today.

## Follow & Subscribe — this DOES require a rules deploy

Unlike every earlier change in this repo, follow/subscribe genuinely
needed new Firestore collections — Precheks has no concept of
following an author, so there was no existing data to reuse. Two new
top-level collections, both #NotesApp-only:

- **`follows/{followerUid}_{username}`** — following a journal means
  its public entries show up for you; nothing paywalled unlocks from
  a follow alone.
- **`subscriptions/{subscriberUid}_{username}`** — subscribing to a
  journal unlocks that journal's `premium: true` entries (a new,
  additive, optional field on `Note` — Precheks' own note pages and
  `NoteForm` ignore it and just show the entry, so this doesn't touch
  Precheks' behavior at all).

**Redeploy `firestore.rules`** — the copy in this repo now includes
`match /follows/{followId}` and `match /subscriptions/{subId}` blocks
that don't exist in Precheks' live rules yet. Everything else in the
file is untouched. This is a real, necessary change, not a false
alarm like an earlier draft of this app — deploy it before testing
follow/subscribe locally or the dashboard's "Firestore rules likely
out of date" banner will fire.

**Mandatory follows.** `lib/journals-directory.ts` defines three
journals every member auto-follows the moment they sign up:
`@notesapp` (a synthetic platform account — no real Firebase Auth
user, hardcoded, rendered at `/u/notesapp`), and both founders. Free
accounts can't unfollow them — enforced both in `lib/follows.ts` and
in `firestore.rules` (a `mandatory: true` doc can't be deleted by
anyone). Letting a future paid tier unfollow these is a documented
gap, not implemented.

**Onboarding.** `/signup` now has a second step: the 3 mandatory
follows write immediately, then the member picks 2 more from a
search/browse list of real registered users (`getAllUsers()`) to
reach 5 total, same as any other person already in the `users`
collection — including someone who hasn't published anything yet,
since following is about their journal going forward, not what
already exists. If fewer than 2 other people have signed up yet, the
requirement gracefully drops to whatever's available, with copy
explaining why, rather than blocking signup on content that doesn't
exist yet.

**Subscribing is a demo, like the booking calendar.** No
Paystack/Flutterwave wiring — `subscribeToJournal()` writes a
`status: "demo"` doc and grants access immediately, same pattern as
the booking calendar's "Confirm & pay (demo)" button. Real billing is
a follow-up build.

**If a follower count shows nothing instead of a number:**
`getFollowerCount()` uses Firestore's `getCountFromServer()`
aggregation query, which occasionally fails with a `"unavailable"`
RPC error. A browser ad-blocker or privacy extension blocking the
request (`RunAggregationQuery` reads as a tracking call to some
blocklists) is one plausible, common cause — treat it as a starting
hypothesis, not a confirmed diagnosis, especially if this starts
happening often rather than occasionally once there are real users
beyond local testing. The profile page catches this and quietly hides
the follower count rather than spinning forever — check the browser
console for the underlying error if it happens consistently, rather
than assuming it's the same cause every time.

## `/journals` redesign — People, Channels, Topics

Same "official first" pattern as `/merchstore`, applied to the
journals directory:

1. **`ChannelSpotlight`** — @notesapp's card, first on the page. Bio
   copy explaining what the channel is, follower/subscriber counts, a
   Follow button, and — since there's no calendar to book for a brand
   account — a dedicated **Subscribe card** in the same visual slot a
   "Book a session" card occupies on a person's profile.
2. **`FoundersSpotlight`** — one big card holding both founders'
   journals, each with journal/follower/subscriber counts and their
   own Follow + Subscribe buttons.
3. Below both spotlights, a **hero search bar** (`JournalsHero`) sits
   at the top of the page as its own section, with **People / Channels
   / Topics / All** as tabs built into the same hero block, per how
   this was specced — filters live in the hero, not scattered
   elsewhere on the page.
   - **People** — every individual journal (both founders, plus any
     other registered member who isn't a brand account).
   - **Channels** — brand/company journals. Just @notesapp today;
     `lib/journals-directory.ts`'s `CHANNEL_JOURNALS` is where a
     second one would be added later.
   - **Topics** — categories aggregated from published notes as
     clickable pills with counts, filtering the list below.
   - **All** — every published journal, `JournalRow`-style, same as
     the old page.
   The search box filters whichever tab's data is currently showing.

`lib/useJournalStats.ts` bundles journal count (computed client-side
from already-fetched notes, not a separate query) with follower and
subscriber counts (one aggregation query each) for any given journal —
used by both spotlight cards and the People/Channels directory.

**Rules change:** `subscriptions` read went from "owner + admin only"
to fully public (`allow read: if true`), matching `follows`. Reason:
`getSubscriberCount()` runs an aggregation query across every
subscriber of a username, not just the current user's own doc — that
can't be expressed as "read your own record only." This doesn't
weaken the paywall: `PremiumGate` still only ever calls `isSubscribed()`
for the signed-in user's own doc, and no premium content lives in the
`subscriptions` collection itself, just the subscription record.
Redeploy `firestore.rules` for subscriber counts to work.

## The real domain, and search

`lib/site.ts` holds the actual production URL
(`https://www.notesapp.name.ng`) and the live company LinkedIn
(`linkedin.com/company/na-notesapp`) — used in metadata, the footer,
`/contact`, and `/about`. Update this one file if either ever
changes.

The header now has a real search bar (`components/SearchBar.tsx`) —
client-side filter over notes and people, since the dataset is small
enough that a proper search index isn't needed yet. Matches journals
by title/category/tag and people by name/username.

## Not built in this session (by design) — historical

> Written when payments were still a demo. Payments, rescheduling/reminders, subscriptions and non-admin publishing are live now.

Payment integration (Paystack/Flutterwave), WhatsApp reminders,
non-admin publishing, the partner API for Precheks to pull this
content onto precheks.com.ng, and subscription billing. All of these
are represented in the copy/UI so the story is complete for a pitch,
but none are wired to live services yet.

`/roadmap` documents three more, same "decided, not built" treatment
as the ad-share program — read it before starting any of these in a
future session, the product decisions are already made:

- **One-click social publishing** — LinkedIn, TikTok, Instagram,
  Facebook, WhatsApp, multiple platforms from one click in the
  composer, not a bolt-on scheduler.
- **AI content drafting** — two distinct jobs: session capture via
  Firefly/Read AI, and polishing raw notes into a publishable post via
  Claude/Gemini/ChatGPT (user's choice of model).
- **Client-driven session management** — the booking calendar is
  currently a static demo; the real version needs client-initiated
  rescheduling (not just booking), reminders on both sides, and an
  actual charge behind "Confirm & pay".

## Ops checklist — uploads, indexes, profiles (manual steps)

1. **R2 CORS (required for image uploads).** Cloudflare dashboard → R2 →
   `notesapp-media` → Settings → CORS policy → paste `scripts/r2-cors.json`.
   Without it the browser's preflight to the presigned URL fails and the
   form shows "Failed to fetch". The presign code also no longer adds the
   CRC32 checksum header (`lib/r2.ts`), which R2 rejects on preflight.
2. **Firestore indexes.** `firestore.indexes.json` already defines the
   `notifications` (recipientUid + createdAt) and `comments` indexes, but
   they must be deployed to the new project:
   `firebase deploy --only firestore --project notesapp-a1402` (indexes + rules; `firebase.json` is now in the repo — run from the repo root).
3. **Founder profiles.** `/u/emmanuel` and `/u/chimdinma` now fall back to
   the static profile in `lib/admin.ts` if no `users` doc exists yet.
   Real docs are still created on the founder's first admin sign-in.
4. Inter-*.woff2 404s and "[Smart Unit Converter]" console lines come from
   a browser extension, not this app.

## Gap audit (README + /roadmap) — what's left

> **Historical (written in September 2026).** Since then: payments, rescheduling, custom-claims admin, rules tests, account
> deletion/export, consent, rate limiting, media domain, ad share, partner API (Enterprise API), video upload and error monitoring
> are all built. See "Where things stand" at the top for the current list.

Fixed in code: `.env.local.example` (referenced above but was gitignored and
missing) now exists; `/api/upload` accepts any account `firestore.rules`'
`isPublisher()` allows (was admin-only, so non-admin publishers got 401);
removed stray `lib/journals-directory_.ts` and `tsconfig.tsbuildinfo`.

Still not built (product decisions already made, see sections above):
1. Real payments (Paystack/Flutterwave) — booking "Confirm & pay (demo)",
   subscriptions, merch. Highest priority per /roadmap ("get paid").
2. Client-driven rescheduling + reminders (WhatsApp/email).
3. One-click social publishing; AI drafting via MCP + notetaker handoff.
4. Video upload + compression (image upload only today).
5. Ad-share program; subscription billing; partner API for Precheks.
6. Custom-claims migration replacing the hardcoded 2-email admin allowlist
   (duplicated in `firestore.rules`, `lib/admin.ts`, `lib/firebase-admin.ts`).
7. Leftover `NEXT_PUBLIC_CLOUDINARY_*` env references and `test-r2.mjs`
   (root-level dev script) can be cleaned up once R2 is confirmed working.

## Payments, payouts, rates, reminders (built)

**Media note:** images/avatars uploaded before the migration still serve
from Cloudinary (`next.config.js` keeps `res.cloudinary.com`); they were
never copied to R2. Everything uploaded from now on goes to R2.

### Publisher rates — `/profile/publishing`
Any publishing account (staff/volunteer/paid tier/admin) sets its own:
session price (₦5,000–₦500,000, enforced server-side), session length,
weekly availability (Lagos time), and monthly journal-subscription price
(₦1,000–₦100,000 — my chosen bounds, adjust in `LIMITS`,
`lib/booking-time.ts`). Stored in `publisherSettings/{uid}` (public
read, server-write only via `/api/publisher/settings`). Sessions and
subscriptions stay hidden on a profile until the publisher enables them
**and** has a verified payout account.

### Money flow
1. Buyer pays through Paystack (`/api/paystack/initialize` → hosted
   checkout → `/booking/confirm`; webhook is the backup). Price, slot,
   and plan come from the publisher's server-side settings.
2. **All money lands in the platform's Paystack balance — no split at
   charge time.** That's deliberate: a Paystack split settles to the
   publisher immediately, which contradicts "nobody is paid until the
   session has happened". Each payment writes a `ledger/{reference}` entry
   (gross, commission from `lib/tiers.ts` by the publisher's tier, net).
3. Sessions: releasable after the session ends. Subscriptions: releasable
   7 days after each charge (dispute window). Admin releases them in
   `/admin/payments` → Paystack Transfer to the publisher's verified bank
   account (`payoutAccounts/{uid}`, created via Paystack account
   resolution + transfer recipient). Admin can also **Dispute** (freeze:
   no-show/complaint) or **Refund**. Double-booked slots show up there
   for refund too.
4. Subscriptions use Paystack **plans** (monthly). Renewals arrive via
   webhook and extend `currentPeriodEnd`; cancellations keep access
   until that date. Legacy free "demo" subscriptions are grandfathered;
   clients can no longer create subscriptions (rules).
5. Enterprise commission is "custom" — until a per-account override
   exists it uses the 5% floor.

**Paystack setup:** `PAYSTACK_SECRET_KEY` (start with `sk_test_`);
webhook URL `https://www.notesapp.name.ng/api/paystack/webhook`
(events: charge.success, subscription.disable/not_renew,
transfer.success/failed/reversed). **Transfers must be enabled on the
Paystack account, and "Confirm transfers before sending" (OTP) turned
off** in Settings → Preferences, or releases will stall awaiting OTP.
Redeploy `firestore.rules`.

### Emails & reminders
Booking confirmation (both sides) is sent immediately via Resend
(`RESEND_API_KEY`, `EMAIL_FROM`; verify the sending domain in Resend).
24-hour and 1-hour reminders come from `GET /api/cron/reminders`, which
must be hit every ~15 min with `Authorization: Bearer $CRON_SECRET`.
Vercel Hobby only allows daily crons, so use Vercel Cron on Pro or a free
pinger such as cron-job.org. WhatsApp reminders: later (needs Meta
template approval).

### Suggested gaps — awaiting approval (historical — mostly built since; see "Where things stand")
Password reset + email verification · bookings dashboard for clients and
publishers · cancellation/refund policy + self-serve cancel · Terms &
Privacy consent before payment · account deletion + data export ·
rate-limiting on upload/payment endpoints + real image validation ·
admin allowlist → custom claims · Firestore rules tests (emulator) ·
error monitoring (Sentry) · custom media domain
`media.notesapp.name.ng`. Also: merch checkout, tier billing, ad-share,
auto-release of payouts, an in-app link to `/profile/edit` from the
header (it's only reachable from your own profile page today).

## Password reset + email verification (built)

- `/forgot-password` sends Firebase's reset email (same response whether
  or not the address has an account, to avoid leaking who's registered);
  the login page links to it and now distinguishes rate-limit and network
  errors from wrong credentials.
- Signup sends a verification email automatically. `VerifyEmailBanner`
  (site-wide) lets unverified users resend it (60 s cooldown) or refresh
  once verified.
- **Payments require a verified email** — enforced server-side in
  `/api/paystack/initialize` from the ID token's `email_verified` claim.
  Existing accounts that never verified will see the banner and must
  verify before paying.
- Firebase Console to-do: Authentication → Templates → customise the
  reset/verify emails (sender name, subject) and set the action URL/
  language; Authentication → Settings → Authorized domains must include
  `www.notesapp.name.ng`. The default `noreply@…firebaseapp.com` sender
  often lands in spam — configure a custom SMTP sender there if so.

### Build order for the remaining approved items (historical)
Each is its own session; nothing below is started except what is marked
built above: (1) bookings dashboard · (2) cancellation/refund policy +
self-serve cancel (needs your policy: e.g. full refund ≥48 h before, 50%
24–48 h, none <24 h?) · (3) terms/privacy consent · (4) rate-limiting +
image validation · (5) custom-claims admin migration · (6) rules tests ·
(7) Sentry · (8) media custom domain · (9) account deletion/export ·
(10) rich-text drafting · (11) video upload · (12) social publishing ·
(13) AI drafting/MCP · (14) ad-share · (15) Cloudinary/test-r2 cleanup
once R2 is confirmed.

## Session 5 — dashboard, cancellations, consent, hardening, admin claims, rules tests, editor

**Bookings dashboard** — `/bookings` (linked in the header): upcoming and
past sessions for both roles, with a cancel button.
**Cancellation policy (approved)** — `lib/cancellation.ts`: client cancels
≥48 h before → 100% refund, 24–48 h → 50%, <24 h → none; publisher cancels
→ always 100%. `POST /api/bookings/cancel` claims the booking, refunds via
Paystack (partial when needed), frees the slot, adjusts the ledger (a kept
portion becomes releasable to the publisher minus commission), emails both
sides. Bookings are now keyed by payment reference; `slotLocks/` holds
one doc per slot (deleting it frees the slot).
**Terms + Privacy** — `/terms`, `/privacy` (**drafts — have a Nigerian
lawyer review; NDPC registration may apply**), required checkbox at
signup, consent stored on the user doc; older accounts are asked once at
their first checkout. Bump `LEGAL_VERSION` (`lib/legal.ts`) to force
re-acceptance.
**Hardening** — `lib/rate-limit.ts` on upload, payment, verify, cancel,
payout, settings, consent, slots, banks (in-memory per server instance —
a speed bump, not a global cap; swap for Upstash if abuse appears).
Uploads: type allowlist, per-purpose size caps (avatar 5 MB, image 10 MB),
`Content-Length` signed into the presigned URL, and a magic-byte check so
a renamed non-image is rejected in the browser.
**Custom-claims admin** — admin = Firebase claim `admin: true`.
Migration (do in order, nothing breaks in between because the old email
list still works): (1) `FIREBASE_SERVICE_ACCOUNT_KEY='…' node scripts/set-admin-claims.mjs ezurukam@gmail.com precheks.info@gmail.com`;
(2) both founders sign out and in; (3) deploy rules + code; confirm
`/admin` works; (4) the legacy email fallback has been removed (done) — admin is the claim only. Add admins later with
`POST /api/admin/set-admin {email, admin}`.
**Rules tests** — `npm run test:rules` (needs Java; starts the Firestore
emulator): 11 tests covering profile-field lockdown, server-only money
collections, booking/ledger/payout read scopes, subscriptions, claims and
notes. Runs in CI (`.github/workflows/ci.yml`) with `tsc`.
**Editor** — journal composer now has a formatting toolbar (bold,
italic, headings, quote, lists, code, link, divider, inline image
upload), Ctrl+B/I/K, Write/Preview tabs, word count, and browser-local
draft autosave/restore. Content is still Markdown, so existing journals
and Precheks' shared notes render unchanged.

Still queued at the time (since done except social publishing and AI drafting/MCP): Sentry (built-in error monitoring
instead), account deletion/export, media domain verification, video, ad-share, partner API.

## Step-by-step: switch admin to custom claims

Do this from your own computer, in the repo folder, on the branch/main
that contains `scripts/set-admin-claims.mjs`. Nothing breaks midway —
the old email list keeps working until step 8.

1. **Get a service-account key.** Firebase Console → project
   `notesapp-a1402` → ⚙ Project settings → *Service accounts* → *Generate
   new private key* → download the JSON. Treat it like a password; never
   commit it.
2. **Install deps** (once): `npm install`.
3. **Run the script** (Git Bash on Windows shown; the key must be ONE line):
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_KEY="$(cat ~/Downloads/notesapp-a1402-key.json | tr -d '\n')"
   node scripts/set-admin-claims.mjs ezurukam@gmail.com precheks.info@gmail.com
   ```
   (PowerShell: `$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\key.json"` then the
   same `node …` line.) Expected output: `Granted admin: <email> (<uid>)` twice.
4. **Delete the key file** from Downloads when done.
5. **Sign out and back in** on the live site, as each founder (claims are
   read from the login token).
6. **Deploy** this branch's code + rules
   (`firebase deploy --only firestore --project notesapp-a1402`, and merge
   for Vercel).
7. **Verify:** `/admin` loads, you can open `/admin/payments` and publish a
   journal. If something is locked out, nothing is lost — the legacy email
   check is still active; re-run step 3.
8. **Legacy path removed.** The founder-email fallback is gone from
   `firestore.rules`, `lib/firebase-admin.ts` and `lib/admin-claims.ts`; admin is the
   `admin` claim only. Admins are managed with the script or `POST /api/admin/set-admin`.
   If an admin is ever locked out, re-run `scripts/set-admin-claims.mjs <email>` and have
   them sign out and in.

**Bell notifications for purchases and orders.** `sendEmail` takes an optional `bell`
(`{ uid, type, linkHref }`); the notification is written first, so it appears even when email
isn't configured. Every transactional email now carries one: merch (pre-order, printed, shipped,
delivered, hand-offs), store orders (new order, dispatched, delivered, hand-offs, dispute,
buyer-confirmed, payout), bookings (confirmed, new, reminders, cancelled), ads (in review, live,
declined, refund), plans/trials, boosts and subscriptions, gold/badge payments, and organisation
verification and team invites. New types: `order`, `merch`, `booking`, `ad`, `plan`, `org`.
Server writes bypass the client-create rules, so `firestore.rules` is unchanged.

**Booking policy: rescheduling, problem reports, automatic payouts.** One policy, one file
(`lib/cancellation.ts`, shown on the booking pages and Terms):
- *Cancel* (already existed): 48h+ → full refund, 24–48h → 50%, under 24h → none; publisher cancels → full refund.
- *Reschedule* (`POST /api/bookings/reschedule`, logic in `lib/bookings-server.ts`): the client can move
  their own session free, up to 2 times, while it is at least 24h away, to an open slot in the
  publisher's availability that is itself 24h–60 days ahead. One transaction swaps the slot lock, updates
  the booking (and resets the reminders) and moves the ledger's `releaseAfter`; price, refund rights and
  earnings are unchanged. Both sides get an email and a bell notification.
- *Report a problem* (`POST /api/bookings/report`): within 24h after the session ends the client can
  report a no-show etc. That freezes the payout (`ledger.status = "disputed"`), emails
  `SUPPORT_EMAIL` (default hello@notesapp.name.ng), the client and the publisher, and an admin decides
  on `/admin/payments` (release or refund).
- *Automatic payout* (`lib/payouts.ts`, run by `/api/cron/reminders`): booking earnings are transferred
  24h after the session ends, unless frozen. It skips publishers with no payout account (they get a
  bell notification), retries a failed transfer up to 3 times and then leaves it for a manual release
  (the reason shows on `/admin/payments`). Set `AUTO_PAYOUTS=off` in Vercel to pause it. The admin
  "Release" button uses the same code (`releaseLedgerEntry`). Gifts, subscriptions and store orders
  are not auto-released.

**Going live with Dojah.** No code change: (1) in Dojah, switch to live mode, create the personal and
corporate hosted widgets and top up the wallet; (2) Vercel: set `DOJAH_APP_ID`, both
`NEXT_PUBLIC_DOJAH_WIDGET_*` ids to the **live** widget ids, and **delete `DOJAH_API_BASE`** (that is what
selects the sandbox host and, for corporate checks, skips the registration-number match that production
enforces); (3) register the production webhook locally with the live secret key (command in the Dojah
section above, without `DOJAH_API_BASE`), copy that subscription's webhook secret into
`DOJAH_WEBHOOK_SECRET`; (4) redeploy, run one real check for a real corporate and personal account, and keep
`DOJAH_AUTO_APPROVE` off until a few real results look right.

**Digital downloads, store boosts, and the store layout.** A store item is `kind: "physical"` (default) or
`"digital"`, chosen on the add-item form and fixed afterwards (rules refuse switching).
- *Digital*: the seller uploads a file (≤ 200 MB; pdf, epub, zip, mp3/m4a/wav, mp4/mov, docx/xlsx/pptx, txt/csv, png/jpg/webp)
  straight to a **private** R2 bucket via `POST /api/store/file-upload` (signed PUT) and `POST /api/store/files` (server checks
  the object, writes `storeFiles/{itemId}` — never client-readable — and the public name/size). Buyers pay with checkout kind
  `digital` (they must tick that it is final); `digitalPurchases/{reference}` is created and the file is available at once through
  `GET /api/store/download` (one-minute signed link; the first download makes the sale final — the admin refund is then refused).
  No stock, no delivery, no tracking. The seller's money is held 7 days (`DIGITAL_HOLD_DAYS`), then released automatically by the
  cron (same retry rules as session payouts; `AUTO_PAYOUTS=off` pauses it).
  **Setup:** create a second R2 bucket that is *not* exposed on any public domain, set `R2_PRIVATE_BUCKET` in Vercel, and apply
  `scripts/r2-cors.json` to it too (the browser PUTs the file to it). Without `R2_PRIVATE_BUCKET`, digital items can't be uploaded or bought.
- *Commission* (`lib/tiers.ts`): digital 20 / 15 / 10 % (Basic / Pro / Business; Enterprise negotiated, 5% floor); physical stays 8 / 5 / 4 / 3 %.
  Both are on `/pricing` and `/store-selling`.
- *Store page*: a **Digital downloads** section first, **Physical items** below; a download without its file attached is hidden from buyers.
- *Boosting items*: `/boost/item/<itemId>` (a "Boost" link next to each item in the store manager) reuses the post-boost packages. A boost
  doc carries `itemId`; `/api/boosts/active` returns `href`/`kind` and takes `?kind=item|post` and `?owner=<uid>`; boosted items show in the
  Journals strip, the `/shop` page, and at the top of the owner's store page.
- *Where buyers/sellers look*: Orders → My purchases → **My downloads**; Orders → Sales from my store → **Download sales**.
- Terms 5g gained a digital-downloads paragraph and `LEGAL_VERSION` moved to 2026-10-03, so each member is asked to accept once at their next payment.

**Pitch-readiness: traction snapshot, Trust & security, data rights, error monitoring.**
- *Traction snapshot* — `/admin/traction` (`lib/traction.ts`, `GET /api/admin/traction`): registered users, publishers, sellers and items, organisations, gold-verified, store orders, digital sales, sessions, merch, boosts, total money processed (refunded, pending and slot-conflict payments excluded), paying customers, commission, payouts made, money held in escrow, by-type and six-month tables. "Copy summary for a deck" and CSV download. Counts only — no personal data.
- *Trust & security* — public `/security` (linked in the footer and sitemap): payments and held money, signed webhooks, private downloads, tested rules, identity checks, monitoring, data rights — and an honest "still building" box (no certifications, no independent pen test yet). Keep it true: only claim what the code does.
- *Data rights* (`lib/account-server.ts`, `/api/account/export`, `/api/account/delete`, `components/AccountData.tsx` on `/profile/account`): download a JSON copy of your data; delete your account after a fresh sign-in (≤ 10 minutes) and typing your username. Refused while money or obligations are open (unpaid earnings, open store/merch orders, upcoming sessions, active plans or subscriptions, running ads/boosts, co-authored posts, a team, or an admin account). Deletion removes the profile, posts (with their comments), your comments, store items and private files, follows, notifications, payout account and settings, frees the username and deletes the login; payments, bookings and orders are kept with email, name, address and phone replaced by `[deleted]`. Per-post likes aren't searched out.
- *Error monitoring* (`lib/monitoring.ts`, `/admin/errors`, `components/ErrorReporter.tsx`, `app/error.tsx`): unexpected server errors (caught where routes call `friendlyMessage`, filtered to real faults rather than deliberate messages) and browser errors (`/api/errors`, rate-limited, bots ignored) are grouped by fingerprint into `errorLogs` with a count, scrubbed of emails/tokens/ids, and expire after 30 days (the TTL policy is declared in `firestore.indexes.json`, so the next `firebase deploy` creates it). The first sighting of each new error emails `SUPPORT_EMAIL` (max 10 an hour). No third-party account is needed; Sentry can be added later if wanted.

**Scheduled-jobs status.** `/api/cron/reminders` writes `cronRuns/reminders`
(server-only, no client rules) after every run; `/status` shows it as
"Scheduled jobs": operational under 30 min old, slow at 30–60 min or after a
partly failed run, down beyond 60 min.

## Session 6 — ordering, trending, status (built) + boosts & gifts (proposal)

**Chronological order everywhere.** Root cause of "wrong order": `date` is
a string in mixed formats (ISO from the composer, RFC-2822 like
`Thu, 08 May 2025…` on seeded/Precheks notes), and Firestore orders strings
lexicographically — RFC dates sorted *ahead of* newer ISO ones (and notes
without a date vanished). `lib/dates.ts` now parses to timestamps and
`getAllNotes` / journals lists sort newest-first in code. Profiles, the
journals directory, search and "more notes" all derive from those, so they
follow. `@notesapp`'s 5 explainer posts are an intentional fixed series
(no dates), so they keep their reading order.

**Trending** — `/trending` (header nav): top publishers and top posts.
Visits are counted per page per day (`pageViews/`, server-only) via
`POST /api/views` (one count per visitor IP per page per 30 min, bots
ignored — a popularity signal, not audited analytics). `GET /api/trending`
ranks the last 7 days (falls back to lifetime `viewCount` until windowed
data exists) and is CDN-cached 5 min. Publisher score = profile visits +
visits to their posts. Existing lifetime `viewCount` still increments as before.

**Status page** — `/status` (footer → Company). `GET /api/status` checks
database, auth, R2 uploads, media domain, private download storage, the
Enterprise API, custom-domain connection (Vercel API — checks the token works),
Paystack, Resend (each "not enabled yet" if its key is missing), shows up/slow/down + latency,
cached 60 s, page auto-refreshes. It runs inside the app, so it can't
report the app itself being unreachable — add an external monitor
(UptimeRobot / Better Stack free tier) on `/api/status` for that, and
optionally point a `status.notesapp.name.ng` hosted page at it.

The page also shows **recent response times** (bars from your browser's last
24 checks, kept in localStorage), an **incident history** and **email
subscriptions**. An incident opens after two consecutive slow/down checks and
resolves on the first clean one (state in `settings/statusState`, incidents in
`statusIncidents`, subscribers in `statusSubscribers` — all server-only);
subscribers are emailed on open and resolve with a one-click unsubscribe link
(`GET /api/status/subscribe?id=&t=`). Checks run when someone loads /status or
an external monitor pings `/api/status`, so ping it every 5 min for reliable
incident detection.

### API, Console, Docs and custom domains (Enterprise)
**Access.** Members request it through the contact form (`/contact?topic=api` opens it on the "API access, Console & Enterprise" topic, which lands in `/admin/leads`). `users/{uid}.apiAccess` (admin-only field; users can't write it — rules-tested) is switched on per
account at `/admin/api-access`, which also lists/activates custom domains. Turning it off revokes the
account's keys and pauses its webhooks. Console (`/console`) shows keys/webhooks only with `apiAccess`; the domain
section needs a tier with `customDomain` (Enterprise).

**API (`/api/v1/*`, `lib/api-keys.ts`, `lib/api-v1.ts`).** Keys are `nak_<id>.<secret>`; only a SHA-256 of the secret is
stored (`apiKeys/{id}`, server-only), compared in constant time, shown once. Scopes: `read:posts`, `write:posts`,
`read:bookings`, `read:orders`, `read:earnings`. 120 req/min per key (in-memory limiter, like the rest of the app).
Endpoints: `GET /me`, `GET|POST /posts`, `GET|PATCH /posts/{id}`, `GET /bookings`, `GET /orders` (`?kind=digital`),
`GET /earnings`. `POST /posts` takes an `Idempotency-Key` (`apiIdempotency`, 24 h TTL). Buyer/client PII (email, phone,
street address) is never returned. The docs page renders from `lib/api-docs.ts` — edit endpoints there and in the route together.

**Webhooks (`lib/webhooks.ts`).** `webhookEndpoints` (server-only, with signing secret) and `webhookDeliveries` (30-day TTL).
Events: `booking.created`, `order.paid`, `digital.sold` (emitted from `lib/payments.ts` after settlement),
`payout.released` (from `lib/payouts.ts`), `post.published` (API). Signature header
`NotesApp-Signature: t=<unix>,v1=<HMAC-SHA256 of "t.body">`. Targets must be public HTTPS names (private/loopback/IP
literals refused, DNS-checked), 5 s timeout, no redirects. One attempt per event — failures are logged and can be resent
from the Console.

**Custom domains (`middleware.ts`, `lib/domains.ts`, `lib/host.ts`).** One domain per account (subdomain or root);
`customDomains/{host}` is server-only. With `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` (+ `VERCEL_TEAM_ID` for a team project)
the domain is added to the Vercel project and checked through the Vercel API; without them it stays *pending* until an admin adds
it in Vercel and presses Activate. Middleware does nothing on our own hosts. On a member's domain `/` → their profile (or store, their
choice), `/store`, `/journals/<slug>` and `/shop/<id>` (only if they belong to that member) are served; everything else (login,
checkout, bookings…) 307s to `www.notesapp.name.ng`, because sign-in and Paystack live there. The shop page shows
"Continue to secure checkout" on a custom domain and a "← Back to the store" link when it arrives with `?from=<verified domain>`.
Known limits: full sign-in/like/comment on the custom domain isn't supported (those hop to the main site), and webhooks
are single-attempt.

**Deploy.** `firebase deploy --only firestore` (new server-only rules + TTL on `webhookDeliveries.expireAt` and
`apiIdempotency.expireAt`; answer `N` to deleting other field overrides).

### Changelog & Enterprise extras
`/changelog` renders `lib/changelog.ts` (newest first; each release has a version,
major/minor/patch, a date and Added/Changed/Fixed lines) — add an object at the top
to ship a note. `/pricing` has two new Enterprise-only rows, **Your own domain**
(notes.yourbrand.com or the root domain; `/u/username` stays the default home) and
**API & Console** (enabled per account by an admin, no self-serve). They are driven
by `customDomain` / `apiAccess` in `lib/tiers.ts`. The domain, API and Console
themselves are planned, not built.

### Video on posts
One optional video per post, stored in the public media bucket (`videos/<uid>/<id>.mp4|webm`) and played by our own
`components/VideoPlayer.tsx` (no autoload: `preload="none"`, shows length + data size before play, speed, fullscreen,
keyboard, resume position in localStorage). There is **no transcoding** — instead the rules are: MP4 (H.264 — QuickTime/HEVC
brands are refused) or WebM, ≤ 100 MB, ≤ 3 minutes, weekly uploads by plan (`VIDEO_WEEKLY_LIMIT` in `lib/video-rules.ts`:
Basic 2 · Pro 7 · Business 14 · Enterprise 30; ISO week), not on premium posts. All limits live in `lib/video-rules.ts`.

Flow (`app/api/video`, `lib/video-server.ts`, `lib/video-upload.ts`): the composer checks the file and its length in the
browser → `start` validates again, takes a quota slot and returns a signed PUT (the exact byte length is signed in) →
the browser PUTs straight to R2 with progress → `finish` HEADs the object, compares the size and reads the first bytes
(must really be MP4/WebM) and only then marks `videoUploads/{id}` verified; a failed check deletes the file and refunds the slot.
**`firestore.rules` refuse to save a post that points at a video that isn't a verified upload by the same member**
(`videoValid`/`videoOkOnEdit`; rules-tested). `/api/upload` is images-only now. Unverified upload records expire after
2 days (TTL on `videoUploads.expireAt`); account deletion removes the member's video files.

Cover image: a poster frame is made automatically; in the composer the member can pick any frame (read from the file just
uploaded, or from the media domain for a saved video — needs its CORS headers) or upload an image. The cover is saved as
`videoPoster` and, unless a featured image is set, as the post's `featured_image` (so cards, search and share previews use it).

Housekeeping: `node scripts/clean-orphan-videos.mjs [--apply]` lists/deletes video files no post references (files younger
than 2 days are kept) — run it monthly. Terms section 2a carries the content rules (legal version bumped to 2026-10-05, so
members re-accept before their next payment). Deploy: `firebase deploy --only firestore` (rules + TTL), and make sure the
media bucket's CORS (`scripts/r2-cors.json`) allows PUT from the site, as it already does for images.

### Share previews (Open Graph)
`lib/og.ts` builds each page's card: **posts** use featured image → video cover → first image in the body → default
(`journalMetadata`, shared with the legacy `/notes/<slug>` redirect, whose redirect response would otherwise carry only the
site default to scrapers that don't follow it); **store items** (`app/shop/[itemId]/layout.tsx`, since the page is a client
component) use the item's photo, title and price — or the seller's avatar, never a private file's name; **store pages** use the
first item photo and the real item count. The Share button and Copy link now point straight at `/journals/<slug>`. Platforms
cache previews: after deploy, re-scrape a link with Facebook's Sharing Debugger (WhatsApp/Telegram refresh on their own after a while).

### Company identity
`COMPANY_INFO` in `lib/site.ts` holds the legal entity — NOTESAPP TECHNOLOGIES
LTD, RC 9825642 (registered 2 Sep 2026), TIN 2623750527563 — taken from the CAC
certified extract and the tax ID letter. It shows in the footer, on `/security`
and in the Terms/Privacy contact line. The registered address is the director's
residence, so it is intentionally not published. **SMEDAN:** not registered yet —
`smedanId` is `null`; once you have the number, set it in `lib/site.ts` and it
appears in the footer automatically.

### Boosts & gifts (built — approved 2026-09-30)
**Boost nudge** — when an author opens their own post and it has no active
boost, `components/BoostNudge.tsx` shows a bottom sheet (3.5 s after load) with
an animated preview — hearts popping, counters racing up — and "Boost now"
(→ `/boost/<noteId>`) / "Maybe later". Once per post per session, and quiet
for 3 days after "Maybe later". The preview figures are an illustration and
are labelled as such; reduced-motion users get static end values.
The same sheet appears for sellers on their own store item (`/shop/<id>`, →
`/boost/item/<id>`), with a 🛒 counter instead of comments/reposts.
**Gifts** — 🎁 button on every publisher profile and every post
(`components/GiftButton.tsx`). Presets ₦200/500/1,000/2,000/5,000 or custom
up to ₦500,000 (server-enforced, `lib/boost-config.ts`), optional message,
optional anonymous. Paystack one-time charge → `gifts/{ref}` + a ledger
entry (`kind: gift`) at the recipient's **tier commission**, held 7 days
like subscriptions, paid out from `/admin/payments`. Recipient gets an
in-app notification + email. Needs the publisher to have a verified payout
account (`publisherSettings.payoutReady`); they can switch gifts off in
`/profile/publishing`. No self-gifting; refunds are admin-only. Public
supporter counts: not built (per decision).
**Boosts** — sold by **validated impressions**, delivered over days.
`/boost/[noteId]` (linked from the composer's "Boost this post after saving"
checkbox and from Admin → Notes). Suggested packages (edit in
`lib/boost-config.ts`; also shown on `/pricing`):
Starter ₦3,000 = 1,000 impressions (≥3 days, ≤7) · Growth ₦12,500 = 5,000
(≥5 days, ≤14) · Scale ₦45,000 = 20,000 (≥10 days, ≤30) — i.e. ₦3,000 /
₦2,500 / ₦2,250 per 1,000 impressions. A daily cap
(`impressions ÷ minDays`) forces delivery to spread over days. An impression
counts only after the boosted card was ≥50% visible for 1 s
(IntersectionObserver), once per visitor (hash of IP+UA) per boost per day,
bots and the publisher's own views excluded; clicks are tracked the same
way. Served in "Boosted posts" strips on the home and Journals pages
(`GET /api/boosts/active`, fair rotation by least-delivered). When a boost
ends with impressions left, admin clicks **Refund undelivered** in
`/admin/payments → Boosts` (partial Paystack refund, pro-rata). One active
boost per post; only the post's author or an admin can boost it. Boost
revenue is 100% platform (no ledger entry). **Housekeeping:** add a
Firestore TTL policy on collection group `seen`, field `expireAt`, so
de-dup docs clean themselves up.
**Not built yet:** in-app "Sponsored" disclosure beyond the label,
per-boost analytics charts, self-serve boost refunds, public supporter counts.

### Boost as its own product page
`/boost` is now a standalone marketing + entry page (packages, how
validated impressions work, fairness/refund terms, and — when signed in —
a list of your published posts with a Boost button). Linked from the footer
(Product), the home hero, the pricing page and `/advertise`; `/boost/[noteId]`
remains the purchase step. `/pricing` now shows, for every publisher tier:
session price range, subscription price range, gifts, boost pricing and
payout timing, all read from `LIMITS` / `BOOST_PACKAGES` so one edit in
`lib/booking-time.ts` or `lib/boost-config.ts` updates the whole site.
Sitemap now includes `/pricing`, `/boost`, `/trending`, `/status`, `/terms`, `/privacy`.

### /gifts product page + Contact topics
`/gifts` is a standalone page (footer → Product, sitemap, pricing link):
presets, how it works, what a publisher keeps per tier on a ₦5,000 gift
(computed from `lib/tiers.ts`), payout timing, and how to switch gifts on.
`commissionRateFor()` now lives in `lib/tiers.ts` (pure) so client/server
pages can share it. The Contact form's "What's this about?" list is now one
source, `LEAD_CATEGORIES` in `lib/leads.ts` (support, bookings & sessions,
payments/payouts/refunds, boosts/gifts/advertising, publishing, account,
report a post or account, bug, partnership, press, investment, other) and
the admin Leads inbox reads the same list.

### Pro / Business plans — checkout built
Pricing table buttons (`components/UpgradeButton.tsx`, monthly/yearly toggle)
→ `POST /api/paystack/initialize {kind:"tier"}` → Paystack **plan** checkout
(plans are created lazily per tier+interval and cached in `platformPlans/`,
re-created if the price in `lib/tiers.ts` changes) → on payment the account's
`accountTier` is set and `tierSubscriptions/{uid}` is written (server-only;
owner can read). Renewals arrive via the webhook (`charge.success` on a
platform plan → extends `currentPeriodEnd`); `subscription.disable/not_renew`
marks it cancelled. **Cancel** = `POST /api/billing/cancel-tier` (finds the
subscription at Paystack and disables it); the plan runs to the end of the
paid period, no partial refunds. **Expiry**: the reminders cron
(`/api/cron/reminders`, every ~15 min) also runs `expireTiers()` — plans
lapsed more than 3 days become Free Basic *only if the account's tier is
still the one they paid for* (admin-set tiers are never touched). Plan
revenue is 100% platform (no ledger entry). You can't start a second plan
while one is running (cancel, wait for the end, then switch) — self-serve
upgrade/downgrade proration is not built. Prices: Pro ₦5,000/mo (₦50,000/yr),
Business ₦15,000/mo (₦150,000/yr) in `lib/tiers.ts`. The Terms gained a
"Paid plans, boosts and gifts" section and `LEGAL_VERSION` moved to
2026-09-30, so everyone re-accepts at their next checkout. The admin tier
dropdown in `/admin/users` still works for manual/Enterprise grants.
**Test it with a `sk_test_` key first**; Paystack's list-subscriptions API
is scanned (5 pages) to find the cancel token, fine at this scale.

### Navigation + legal pages
Admin pages now share a sub-header (`app/admin/layout.tsx` →
`AdminSubNav`): Back button + Dashboard / Journals / Notes / Users /
Payments / Leads / Settings, admins only, hidden on the login page.
Signed-in members get a matching "My account" sub-header on `/profile/*`
and `/bookings` (Edit profile · Rates & payouts · Bookings · Boost). The
"Draft for legal review" banners were removed from `/terms` and `/privacy`
at the owner's request — the underlying advice (have a Nigerian lawyer
review both; NDPC registration may apply) still stands.

### Verified badge (paid add-on)
Included free on **Business and Enterprise** (and for admin/staff/volunteer
roles and the official accounts); **Free Standard, Free Basic and Pro** can
add it for **₦999/month** (`BADGE_PRICE_KOBO` in `lib/tiers.ts`). Own
Paystack plan (`platformPlans/badge_monthly`), `badgeSubscriptions/{uid}`
(server-only), and the user doc's `badgeUntil` (server-written) drives the ✔:
`hasVerifiedBadge()` in `lib/users.ts` is the single check — used on
profiles, the people directory and the post byline; suspended accounts never
show it. Buy/cancel on **Edit profile** and the pricing page
(`components/BadgeCard.tsx`); renewals + cancellation flow through the same
webhook as plans; upgrading to Business best-effort cancels a running add-on
so nobody is double-billed. Terms gained §5b (a badge is *not* an identity
check or endorsement; removable without refund for impersonation/suspension).
Consider adding real identity verification later if the ✔ is to imply it.

### Paystack webhook — exact setup
URL: `https://www.notesapp.name.ng/api/paystack/webhook`. Paystack
Dashboard → Settings → API Keys & Webhooks → paste it in **Webhook URL**
(Test and Live modes each have their own URL field — set both). Paystack
sends every event type to that one URL; the route verifies the
`x-paystack-signature` header with your secret key, so it works with either
mode's key as long as `PAYSTACK_SECRET_KEY` matches the mode. Events the app
handles: `charge.success`, `subscription.disable`, `subscription.not_renew`,
`transfer.success`, `transfer.failed`, `transfer.reversed`.

### Gold badge — coming soon (groundwork built)
Two ✔ levels (`lib/badges.ts`, `badgeLevel()` in `lib/users.ts`): the
maroon **verified** badge (account in good standing — role, Business/
Enterprise, or the ₦999 add-on) and the **gold** badge (identity checked /
endorsed by #NotesApp). Built: the `goldBadge` field on `users/{uid}`
(admin-written only — clients can't set it), a gold `VerifiedBadge` variant,
gold-aware rendering on profiles, the people directory and post bylines, and
an admin "Gold" dropdown in `/admin/users`. **Hidden until launch**: nothing
gold renders while `GOLD_BADGE_LIVE = false`; the pricing page, roadmap,
about, terms (§5b), Edit-profile badge card and home all say "coming soon",
and Contact has a "Gold badge / identity verification" topic for interest.
To launch: build the application + review flow (ID / CAC / credential
upload to a private R2 prefix, admin review queue, decision emails), decide
criteria and any fee, publish them on `/pricing`, then set
`GOLD_BADGE_LIVE = true` and update the "coming soon" copy.

### #NotesApp team badge + /badges page + footer
`components/TeamBadge.tsx` (the #NotesApp icon) renders beside the ✔ for
staff, guest writers and admins (`isTeamMember()` = internal roles) and for
the official accounts/founders (`VERIFIED_USERNAMES`): profiles, the people
directory, post bylines and the channel/founder spotlights. Not purchasable.
`/badges` ("Verification badges", footer → Product, sitemap) explains the
team, verified and gold marks, tier table, FAQ, and embeds the buy card.
Footer changes: Terms of Service / Privacy Policy moved from Connect to
Company; Facebook (`SITE.facebook`) added under Connect; a blank line now
precedes the "Built in partnership with Precheks … Staff Login" line.

## Firestore quota (free tier) — what burned it and what changed
Symptom: `8 RESOURCE_EXHAUSTED: Quota exceeded` — the Spark (free) plan
allows 50,000 reads and 20,000 writes per day, then blocks everything
until the daily reset. Main cause: several public pages read WHOLE
collections on every visit (all notes on Home/Journals/Profile/"more
journals"; all users on Journals/Signup/Sitemap), so reads ≈ visitors ×
(notes + users), and crawlers multiply it. Changes: public list reads are
now cached (`lib/ttl-cache.ts`) — in the browser they call
`/api/public/notes` and `/api/public/users` (CDN-cached 5 min, no note
bodies, no emails), on the server they share a 5-minute in-process cache;
drafts are no longer read for public lists; trending reuses those caches
(CDN 15 min); active boosts cached 1 min; `/api/views` no longer reads
Firestore; the admin screens still read directly. Payment/booking routes now
answer quota errors with a friendly "at capacity, you haven't been
charged" message. **Real fix: upgrade the Firebase project to the Blaze
(pay-as-you-go) plan** — the same free allowance applies but there's no
hard daily stop; set a budget alert (Google Cloud Console → Billing →
Budgets). Watch Firebase Console → Firestore → Usage to see reads vs
writes. **Privacy note (not yet fixed):** `users/{uid}` documents include
`email` and are publicly readable by the rules, so anyone using the client
SDK could list emails — the public API strips them, but the rules and data
model should move email into a private doc (next task).

## Emails moved out of public user documents (privacy fix)
`users/{uid}` is publicly readable (profiles, directory), and it used to
contain each member's `email`. Emails now live **only in Firebase
Authentication**: nothing writes `email` to `users` any more, the rules
reject any create that includes one, server code that needs to email
someone (booking/gift notifications, reminders, cancellations) looks it up
with the Admin SDK (`getUserEmail`, Auth — no Firestore reads), and the admin
Users screen fetches emails through the admin-only `/api/admin/user-emails`.
**Migration steps (in this order):**
1. Merge + deploy this code and `firestore.rules`.
2. Dry run: `FIREBASE_SERVICE_ACCOUNT_KEY='<json one line>' node scripts/strip-user-emails.mjs`
   — prints how many user docs still carry an email; writes nothing.
3. Apply: same command with `--apply` (writes one small update per affected
   doc — **run it after the Firestore quota resets or once on Blaze**, since it
   needs writes).
4. Check a user doc in Firebase Console → Firestore → `users`: no `email` field.
`scripts/migrate-to-own-infra.mjs` copies the old shape and would re-add emails
if re-run (don't). `consent` on user docs is still public (version + timestamp only).

## Privacy round 2: drafts, suspensions, account changes, stores
- **Drafts are private.** `notes` reads are allowed only for `status ==
  'published'`, the author, or admins. Queries must therefore filter on
  `status == 'published'` (or the author's uid) — `getNoteBySlug` and
  `slugTaken` already do. An author can no longer open their own draft by URL on
  `/journals/<slug>` (server-rendered, unauthenticated); edit it from `/write`.
  **Redeploy `firestore.rules`.**
- **Suspension details are private.** Reason/appeal now live in
  `suspensions/{uid}` (member + admins only). `users/{uid}` keeps just the
  public `suspended` flag. **After deploying code + rules run** (dry run first):
  `FIREBASE_SERVICE_ACCOUNT_KEY='<json>' node scripts/move-suspensions.mjs [--apply]`
- **Account settings** (`/profile/account`, menu → "Account (email, username)"):
  change username (server route `/api/account/username`: once per 30 days, old
  name stays reserved and still resolves; notes/follows/subscriptions are
  updated; founders and `notesapp` names blocked), change email (re-enter
  password, confirmation link goes to the *new* address — enable the
  "email address change" template in Firebase Auth), change password.
- **Stores.** `/u/<username>/store` now has an owner-only "Manage your store"
  panel (add/edit/remove items, image upload) backed by `storeItems`
  (rules validate fields, https links only). Open to anyone who can publish —
  the `externalStoreAllowed` tier flag in `lib/tiers.ts` no longer gates listings
  (items are outbound links; NotesApp takes no payment). Founder catalogues in
  `lib/store.ts` still show first.
- **Gold badge — paid (same price on every plan tier).** `lib/gold.ts`:
  Personal ₦1,999/mo, Corporate ₦2,999/mo; identity check adds a
  **non-refundable** deposit (₦999 personal / ₦1,999 corporate) to cover the
  third-party check (Dojah: NIN + liveness / CAC lookup, roughly ₦550–₦900 /
  ₦550–₦700 per check). Flow (`badgeRequests/{uid}` status):
  endorsement `pending → approved → active`; identity `awaiting_deposit →
  pending → approved → active`. Members apply on `/badges` (text + links, **no ID
  documents**), admins Approve/Decline in `/admin/users`, approved members pay
  via Paystack (`gold` kind, monthly plan per track, renewals through the
  existing webhook, `goldUntil` lapses the badge, `goldSubscriptions/{uid}`).
  **Identity (Dojah hosted widgets):** turns on automatically when
  `NEXT_PUBLIC_DOJAH_WIDGET_PERSONAL` and `NEXT_PUBLIC_DOJAH_WIDGET_CORPORATE`
  are set (widget ids from the Dojah dashboard; set both in Vercel). Flow:
  apply → pay deposit → "Start identity check" opens
  `https://identity.dojah.io?widget_id=…&reference_id=na_<uid>` → an admin reads
  the result and Approves in `/admin/users`. **Results now arrive by webhook** (below);
  we store only a pass/fail summary, never ID data. Check Dojah's per-check price for
  the steps you enabled — the deposit must cover it (more steps ⇒ higher cost).
  Dojah's docs/sandbox keys are available. Admin dropdown grants still work as
  free comps. Redeploy `firestore.rules`.
- **Official merch (pre-order batches).** `/merchstore` items show a product
  mockup with the chosen logo superimposed (`components/MerchMockup.tsx`; drawn
  placeholder shapes until real photos exist — drop a plain photo at
  `public/images/merch/<id>.webp`, set `photo` on the item in `lib/merch.ts`, and
  tune its `print` box). Checkout is `kind: "merch"` (Paystack; price, flat
  delivery, quantity, batch and Nigerian address all validated server-side) →
  `merchOrders/{reference}` (owner/admin read, server write). Admin → **Merch**
  (`/admin/merch`) shows a "to print" tally and moves orders
  preordered → printed → shipped → delivered; the buyer is emailed at printed, shipped
  and delivered, and "Mark shipped" asks for an optional courier and tracking number
  that go into the email and onto the order. Every merch order also gets a **parcel ID** (NA-XXXXXXXX, created at
  checkout; older orders get one on their first status change) and so a public
  `/track/<id>` page with the same four stages — the pre-order, printed, shipped and
  delivered emails carry a "Track your order" button to it. On `/admin/merch`, "Mark
  shipped" takes an optional courier, tracking number and tracking link (shown on the
  tracking page), and "Record who holds it" logs a rider / bus / motor-park hand-off
  (optional phone, only with the holder's agreement) into the same custody log store
  parcels use. Buyers also see the status line under **Orders → My purchases**
  Each hand-off has a **"Get their update link"**: a private no-login `/p/<token>` page (same one store sellers
  use) where the rider/driver/agent updates the location, hands the parcel on, or marks it delivered —
  for merch that records the delivery on the order and emails the buyer (no escrow to release). Links
  expire when the next holder is recorded or after 14 days. (`components/MerchPreorders.tsx`, read straight from `merchOrders` via the owner rule). Refunds go
  through Payments and are blocked once an order is printed. **Edit in
  `lib/merch.ts` before launch:** `MERCH_BATCH.closesOn` (placeholder
  2026-11-15), `MERCH_DELIVERY_KOBO` (placeholder ₦3,000) and the item prices.
  Redeploy `firestore.rules`.
- **Co-authoring.** Lead authors invite members to a *draft* from the Co-authors
  panel in the composer (`components/CoAuthorsPanel.tsx`), proposing each person's
  % of the post's earnings (co-author ≥5%, lead keeps ≥10%, max 4). Invitees
  accept/decline on `/invites` (also a bell notification). All state changes go
  through `POST /api/coauthors` (`invite` / `respond` / `revoke`); clients can't
  write `coAuthors` / `coAuthorUids` (rules) or `coAuthorInvites` (server-only,
  lead + invitee + admin read). Accepting syncs `coAuthors` / `coAuthorUids` onto
  the note (byline "with …", profile listing via `isNoteBy`). The split is locked
  at publish: invites/accepts work only on drafts; pending invites then expire.
  **The agreed % live in `coAuthorInvites` (accepted ones) and are NOT used for
  money yet** — ad-share isn't built, and gifts on a post still go to the lead
  author. When building ad-share / per-post gift splits, read the accepted invites
  (lead = 100 − sum). Co-authors can't edit the post (lead only). Redeploy
  `firestore.rules`.
- **Ads scaffold (house banners only).** `lib/ads.ts` (providers, footer notes,
  placements, `publisherShowsAds`), `GET /api/ads?placement=` (active creatives,
  cached 5 min), `components/AdSlot.tsx` (weighted rotation every 15 s, renders
  nothing when there's no active ad), admin CRUD at `/admin/ads` (`adCreatives`,
  admin-only rules). Placements: home, journals, trending (site) and profile, post
  (publisher-scoped: free tiers always show; Pro/Business only if they ticked "Show
  ads on my journal" on `/profile/publishing` → `users.adsOptIn`, server-written).
  Every house ad shows "Sponsored: NotesApp Ads". **Not built:** impression/click
  tracking, ad-share accounting/payouts, and the Google/Meta/AdMob slots — those
  footers exist in `AD_FOOTER` but nothing third-party loads. Notes before adding
  them: AdMob is a mobile-app SDK (web would be AdSense / Ad Manager); each network
  needs its own approval; Google needs `ads.txt`; personalised ads need a consent
  banner first (our privacy page currently says we use only essential storage);
  update the Privacy Policy when a network goes live. Redeploy `firestore.rules`.
- **Revenue analytics (admin).** `/admin/revenue` (Revenue in the admin nav) ←
  `GET /api/admin/revenue?days=7|30|90|365|0`, built on `lib/revenue.ts`, which
  defines what counts as platform revenue: commission only for sessions,
  subscriptions and gifts (ledger `commissionKobo`); 100% for boosts (minus
  undelivered-impression refunds), Pro/Business plans, verified badges, gold
  (deposits + monthly), merch; refunded payments excluded; Paystack fees (customer-
  borne) and merch cost of goods NOT deducted. Plan/badge/gold **renewals** come
  from `tierCharges` (now stamped with `kind`; older records without it count as
  plans). Raw data is cached 2 min server-side. **Ads** has a row marked "not live
  yet" — there's no ad accounting until ad-share/tracking is built.
- **Boost performance (publishers).** `/profile/boosts` (menu: "Boost performance"):
  totals, active vs ended, delivered/purchased progress, clicks, click rate, 14-day
  impressions chart, days left, refunds. `/profile/publishing` shows a compact
  summary of the same.
- **Roadmap:** iOS and Android apps added (push notifications, in-app Paystack,
  offline drafts, AdMob and other app ad networks, PWA after the phone apps).
- **Co-authoring rules (updated).** Lead must be Pro/Business/Enterprise (or admin)
  — `canLeadCoAuthors` in `lib/coauthors.ts`, enforced in `/api/coauthors`; anyone
  can be invited but *accepting* needs `canAcceptCoAuthor` (publishing account).
  The composer shows a "Write this with co-authors" option on new posts (saves a
  draft, then opens the panel) and the panel on drafts; non-Pro leads see an
  upsell. **Gifts on a co-authored post are now split** in `lib/payments.ts`
  (`giftShares`): one ledger entry per author (`ledger/<ref>` for the lead,
  `ledger/<ref>_<uid>` for co-authors, with `paymentReference` + `sharePercent`),
  each at that author's own plan commission, lead keeps the rounding remainder,
  co-authors get a notification; admin refund returns the whole payment and needs
  every entry unpaid. Sessions are NOT split (personal; each author keeps their
  own calendar). Co-author gift splits go through the existing 7-day hold and
  payout flow, so co-authors need a payout account.
- **Ad tracking.** `POST /api/ads/track` (impression once per ad per tab-session
  when ≥50% visible; click on tap) → daily aggregates `adStats/{ad}_{YYYYMMDD}` and,
  on publisher-scoped slots, `adPublisherStats/{publisherUid}_{day}` (the base for
  ad-share; opted-in publishers see their last-30-day totals on
  `/profile/publishing`; admin sees per-ad views/clicks/CTR on `/admin/ads`).
  Bots are skipped by user-agent and the endpoint is rate-limited, but counts are
  NOT fraud-proof — add filtering before paying anyone from them. Ad-share
  payouts and the revenue ledger for ads are still to build.
- **Ad fraud controls (built) and what's still needed before paying ad-share.**
  Built: unique-per-visitor counting (`adSeen/{hash}`, salted hash of IP+UA — set
  `AD_HASH_SALT` in Vercel and a **Firestore TTL policy on `adSeen.expireAt`**), a
  click only counts after that visitor's view, bot user-agents skipped, rate limit,
  and an admin "Ad-share review" table on `/admin/ads` flagging more-clicks-than-
  views, >15% click rate, and one-day spikes. NOT built (do before any payout):
  hold ad-share ~30 days with manual approval, minimum payout, exclude the
  publisher's own traffic (needs verified viewer ids), Cloudflare Turnstile on
  suspicious traffic, and clawback terms in the Terms. Ad-share payouts and the ad
  revenue ledger are the remaining build.
- **Setup: `AD_HASH_SALT` and the `adSeen` TTL (step by step).**
  1. *Salt:* in Git Bash run `openssl rand -hex 32` and copy the output (or use a
     password manager's generator). Keep it secret; never `NEXT_PUBLIC_`.
  2. Vercel → project → Settings → Environment Variables → Add: Key `AD_HASH_SALT`,
     Value = the string, Environments = Production (and Preview if you like),
     tick **Sensitive** → Save.
  3. Vercel → Deployments → latest → ⋯ → **Redeploy** (new env vars only apply to
     new deployments). Changing the salt later just resets today's de-dup memory.
  4. *TTL:* Google Cloud Console (same account) → project `notesapp-a1402` →
     Firestore → **Time-to-live (TTL)** → Create policy → Collection group ID
     `adSeen`, Timestamp field `expireAt` → Create. Repeat for boosts with
     collection group `seen`, field `expireAt`. Or CLI: `gcloud firestore fields
     ttls update expireAt --collection-group=adSeen --enable-ttl
     --database='(default)' --project=notesapp-a1402`. Documents are removed
     within about a day of expiring; without a policy they just pile up (small).
- **Ad-share payouts + ad revenue accounting (built).** `lib/ad-share.ts`,
  `/api/admin/ad-share`, admin page **`/admin/ad-share`** (nav "Ad share").
  Monthly flow: (1) admin records ad revenue actually *received* (`adRevenue`:
  source, label, ₦, month); (2) **Compute statements**: RPM = revenue ÷ ALL valid
  impressions that month (`adStats`); each opted-in paid publisher (Pro 25% /
  Business 45% / Enterprise 75%, `users.adsOptIn`, not suspended) earns
  impressions-on-their-pages × RPM × share → `adShareStatements/{month}_{uid}`
  (`pending_review`, fraud flags attached; free journals earn nothing);
  (3) admin **Approves / Withholds** (or "Approve all unflagged"); approval adds a
  `ledger/adshare_<id>` entry (`kind: "adshare"`, no commission, held
  `AD_SHARE_HOLD_DAYS`=30) released via Payments → Paystack transfer (webhook marks
  the statement `paid`); (4) under `AD_SHARE_MIN_KOBO`=₦1,000 the statement
  `rolled_over` and is added to the next approval (older one → `rolled_forward`).
  Decided statements are locked and the month's revenue can't be removed.
  Publishers see their statements on `/profile/publishing`. **Revenue report:** the
  Ads row = revenue received − shares owed (pending/approved/rolled/paid), dated the
  28th of the month. Redeploy `firestore.rules` (`adRevenue`, `adShareStatements`).
  **Still manual / not built:** advertisers paying through the site (self-serve ad
  checkout) — revenue is recorded by an admin when money arrives; third-party ad
  networks; verified-viewer exclusion of a publisher's own traffic.
- **Admin Payments** now lists **all payments** (every product, latest 300,
  filterable; `pending` = started but never confirmed) above the payout ledger.
- Header now shows the member's avatar (links to their profile) after the bell.

## Member journey — what people see and where they change things
- **Header (signed in):** bell + an **@username ▾ account menu** — My profile,
  Edit profile, Rates & payouts (or "Start publishing" for non-publishers),
  Bookings, Boost a post, Verification badges, Sign out. Pages under
  `/profile/*` and `/bookings` also show a "My account" sub-header.
- **Edit profile** (`/profile/edit`): display name, bio, avatar upload (R2),
  social links, and the verified-badge card. Username can't be changed and
  email/password changes aren't self-serve yet (password reset is on the
  login page).
- **Rates & payouts** (`/profile/publishing`): for publishing accounts —
  verified bank account, session price/length/weekly availability,
  subscription price, gifts on/off, plan (cancel), boost results, earnings.
  Nothing (booking, subscribe, gift) shows on a profile until a payout account
  is verified. **Free Standard members** instead see "Start publishing":
  apply for **Free Basic** (a short note; an admin approves/rejects it in
  `/admin/users`, and the member is notified) or pick **Pro/Business** on
  `/pricing` (publishing starts on payment). The application goes through
  `POST /api/tier-request` (clients can't write `tierRequest` directly).
- **Admin dashboard errors** now say what Firestore actually reported
  (quota exhausted / permission denied / missing index) instead of always
  blaming the rules.

## Session — footer settings, profile visibility, publisher composer
- **#NotesApp footer is now editable.** `/admin/settings` writes
  `settings/notesapp-site` (email, WhatsApp, LinkedIn, Facebook, Instagram, X,
  website); the footer's Connect column, the Contact page and About read it
  (`getSiteSettingsCached`, 1-minute server cache, falls back to defaults so
  the footer never breaks). The old `settings/site` doc (Precheks' footer
  config) is no longer read. Blank fields are simply hidden.
- **Profile edits are visible to others.** Social links are now shown on the
  public profile (`SocialLinksRow`, http(s) only); note bylines use the
  author's *current* profile (name/avatar) via `authorUid`; a member's posts
  are matched by `authorUid`/`authorUsername` before display name, so
  renaming yourself no longer orphans your entries. The profile page itself
  reads Firestore directly (instant); directory/search lists update within a
  few minutes (cache).
- **Publishing for members (`/write`).** Approved/paid publishers get *My
  journal*: list (drafts + published), New entry, Edit, Boost, Delete, all via
  the rich-text composer with the byline taken from their own profile
  (`NoteForm self`). Slugs must be unique (`slugTaken`). Menu, account
  sub-header and the profile page link to it.
- **Known gap:** `notes` documents (drafts included) are publicly readable by
  the rules — a draft's text is visible to anyone using the client SDK. Fix by
  serving drafts only through an owner-only path (next task).

## Advertiser campaigns (self-serve banners)

Anyone with a verified account buys a banner campaign at `/advertise/new` (packages in `lib/ad-packages.ts` — **placeholder prices, edit there**). Flow:

1. Checkout (`kind: "ad"`) writes `adCampaigns/{reference}` (awaiting_payment) + `payments/{reference}`; the image must be uploaded via the `"ad"` upload purpose.
2. Paystack confirmation (webhook or verify) moves it to `in_review`.
3. `/admin/ads` → **Paid campaigns**: Approve (creates `adCreatives/{id}` with an impression budget + end date, and records `adRevenue/campaign_{id}`) or Reject (full Paystack refund + reason emailed).
4. Delivery stops automatically when the budget of validated impressions is reached or the window closes (`lib/ads-server.ts`). Admin then runs **Settle & refund undelivered** for a pro-rata refund (negative `adRevenue` entry keeps revenue accurate).
5. Advertisers track delivery at `/advertise/campaigns`. Terms 5e covers the rules.

Deploy `firestore.rules` (new `adCampaigns` rule). Not covered: Google/Meta/AdMob slots.

## Organisation accounts (phase 1)

Sign up as **Organisation** at `/signup` (name + CAC number), onboarding checklist at `/organisation`, public explainer at `/organisations`.

- Data (all server-written; `firestore.rules` lets an owner edit only name/bio/logo/links): `users/{uid}.accountKind = "organisation"`, `org { rcNumber, rcStatus: unverified|verified|rejected }`, `trialUntil/trialTier/trialUsedAt`. `orgRc/{number}` = one organisation per registration number; `orgTrials/{number}` = one free trial per number; `orgRequests/{uid}` = admin-approved conversion of an older personal account.
- `POST /api/org`: `register`, `resubmit`, `start_trial` (30-day Business, needs a verified email). The cron (`expireTiers`) emails 5 days before the end and drops to Free Basic unless a paid plan started (payment fulfilment clears the trial fields).
- `/admin/organisations`: check each number on search.cac.gov.ng, then verify/reject (`/api/admin/organisations`).
- Maroon ✔ for an organisation needs `rcStatus === "verified"` **and** a plan that includes the badge; until then the channel and each post show the "unverified organisation" notice (`components/OrgNotice.tsx`).
- Also fixed: the `users` create rule used to accept any fields (a client could self-assign a tier). It now allows only the ordinary starting fields as a Free Standard reader.
- Maroon ✔ confirmation is manual (`/admin/organisations`), or automatic when the organisation's **corporate identity-check** gold badge activates (`lib/payments.ts`).

## Organisation teams (phase 2)

- `orgMembers/{orgUid}_{uid}` (active members only; the owner is the org account itself) and `orgInvites/{orgUid}_{uid}` — server-written via `/api/org/team` (`invite` by @username or email, `revoke`, `remove`, `set_role`, `accept`, `decline`, `leave`). Owner can add admins; admins manage writers. Seats: Business 4 (owner + members + pending invites), Enterprise unlimited, others 1.
- Org posts: `authorUid` = the organisation, `writerUid/writerUsername` = the person. Money (gifts, subscriptions, ad share, sessions) therefore lands in the organisation's own payout account with no change to the money code; the owner sets it at Rates & payouts.
- `firestore.rules`: `orgRole()` / `orgCanPublish()` let writers create/edit/delete their own org posts and admins any, only while the org is on Business/Enterprise; `authorUid`/`writerUid` can't be changed. `verifyPublisherRequest` lets members upload for an org on a team plan.
- UI: `/organisation/team` (manage), "Post as" selector in `/write/new`, team invitations at `/invites`, byline "Written by @person for #Org".
- Limits: co-authoring isn't offered on org posts; Boost is owner-only.

Redeploy `firestore.rules`.

## Seller checkout and parcel tracking

- **Listing:** a publisher marks a store item "sell through #NotesApp checkout" (`storeItems` gets `sellable`, `priceKobo`, `deliveryKobo`, optional `stock`; validated in `firestore.rules`). `/shop/[itemId]` is the buy page → `POST /api/paystack/initialize` `kind: "store"` (seller must have a payout account; amount comes from the item doc, never the client).
- **Commission** (`lib/tiers.ts` `physicalCommission`): Free Basic 8%, Pro 5%, Business 4%, Enterprise 3%+ — on the item price only; the delivery fee is the seller's. Shown on `/pricing` and `/store-selling`. Revenue stream "Store sales" (commission) on `/admin/revenue`.
- **Escrow:** `lib/payments.ts` creates `storeOrders/{ref}`, `parcels/{NA-XXXXXXXX}` and a `ledger` entry (kind `order`) held with a far-future `releaseAfter`. It becomes payable when the buyer confirms, when the cron auto-confirms 7 days after "delivered" (`releaseDueOrders`, in `/api/cron/reminders`), or when an admin clicks **Confirm delivery** on `/admin/payments`. A buyer dispute freezes the entry; an admin can refund or confirm.
- **Tracking:** seller records either courier details (name, number, https link → "Open tracking" opens in a new tab; no iframe because most couriers forbid embedding) or hand-off entries (bike/bus/park, name, location, phone with the holder's consent). Holders use no-login links (`/p/[token]`, stored hashed in `parcelLinks`) that die when the next holder confirms or after 14 days. `/track/[id]` shows status and the current holder; phone numbers only for buyer/seller/admin or with the receiver's last 4 digits (lockout after 8 wrong guesses/hour).
- **Pages/APIs:** `/orders` (buying + selling), `/track`, `/track/[id]`, `/p/[token]`, `/store-selling`; `/api/store/orders`, `/api/track`, `/api/track/holder`. Terms 5g.
- **Managed stock:** every listing needs a stock count. Starting a checkout reserves the quantity in a transaction (`reserveStock`); an unpaid reservation (30 min) is returned by `releaseExpiredReservations` (run before each checkout for that item and by the cron). A very late payment re-takes stock or, if it's gone, becomes `paid_slot_conflict` for an admin refund. At 0 nobody can order; "Notify me when it's back" (`stockWatches`, `/api/store/watch`) sends a bell notification (type `stock`) when the seller restocks (`/api/store/restock`) or an unshipped order is refunded.
- **No link-outs:** stores sell through #NotesApp checkout only. The form no longer offers link-out items, rules require `sellable` + stock, legacy link-outs are hidden and can only be removed, and the pricing row/`externalStoreAllowed` were removed. The founders' hard-coded catalogues in `lib/store.ts` and the old `/shop` page deliberately stay as link-outs (decision: they stay).
- **Organisation stores:** the org's own store page works as before; the owner can tick "runs the store" per team member (`orgMembers.store`, `set_store_access`). Those members can add/edit/remove the org's items (rules: `orgStoreFlag`) and run its orders/parcels (`canActForSeller`) while the org is on a team plan. Items, orders and payouts stay on the organisation's account, so funds and liability do too.
- **Not built:** partial refunds, courier-API auto tracking, iframe tracking (scrapped on purpose).
- Redeploy `firestore.rules` (new `storeOrders`/`parcels`/`parcelLinks` rules, `storeItems` sale fields).

## Moving founders' journals into organisations (admin tooling)

`/admin/organisations` → **Move posts into an organisation**: choose the organisation and the person (`@chimdinma`, `@emmanuel`), load their posts, tick the ones to move. Each post keeps its slug/URL; `authorUid/authorUsername/author/author_role/author_avatar` become the organisation's, `writerUid/writerUsername` become the person (byline "Written by @person for #Org"), and the original byline is saved in `movedFrom` so **Undo** restores it (load the org's own @username to find them). Gifts and ad share from moved posts go to the organisation.
Each organisation row also has **Give gold ✔ (endorsed)** and **Verify** (CAC). Setting up a founder org: sign up as Organisation with its own email → verify the email → Verify the CAC number here → set the plan in `/admin/users` (Business/Enterprise, or start the free trial) → invite the founder under `/organisation/team` → give gold → move the posts.

## Dojah webhook (identity-check results)

`POST /api/dojah/webhook` receives Dojah's `kyc_widget` events. It verifies `x-dojah-signature` (HMAC-SHA256 of the **raw body** with `DOJAH_WEBHOOK_SECRET`, compared in constant time; 401 otherwise), maps `reference_id` (`na_<uid>`) to `badgeRequests/{uid}`, and writes `dojah: { verificationStatus, overall, steps{name: bool}, passed, terminal }` there — no ID numbers, images or PDFs. `passed` means status `Completed` **and** top-level `status` true **and** every step true (a "Completed" session can still have failed steps). `/admin/users` shows the result next to Approve; the member sees a plain-language status on `/badges`. Nothing is approved automatically unless **`DOJAH_AUTO_APPROVE=true`** (then only a fully-passed application that is waiting for review).

Setup, per environment (sandbox first, then production):
1. Vercel env: `DOJAH_APP_ID` (your app ID, not secret), `DOJAH_SECRET_KEY` (only needed by the subscribe script, so run that locally rather than storing it), `DOJAH_WEBHOOK_SECRET` (below), optional `DOJAH_AUTO_APPROVE`, and for sandbox keys `DOJAH_API_BASE` (Dojah's sandbox host).
2. Register the URL: `DOJAH_SECRET_KEY=… DOJAH_APP_ID=… node scripts/dojah-subscribe.mjs https://www.notesapp.name.ng/api/dojah/webhook` (POSTs `{webhook, service: "kyc_widget"}` to `/api/v1/webhook/subscribe`).
3. Dojah dashboard → Developers → Webhooks → reveal the subscription's **Secret** (not your API secret) → set it as `DOJAH_WEBHOOK_SECRET` in Vercel → redeploy. Until it is set the endpoint rejects every event.
4. Sandbox and production use different keys, app IDs, widget IDs and secrets; switch them together.
Dojah's file links expire after about an hour and we ignore them. Duplicate or out-of-order events are safe (a late "Ongoing" never overwrites a finished result).

Gold-badge decisions: `POST /api/admin/badge-request` (used by Approve/Decline in `/admin/users`) records the decision, sends the applicant a bell notification (type `badge`) and an email, and stores an optional decline reason.

Testing the webhook without a real check: `DOJAH_WEBHOOK_SECRET=… node scripts/dojah-test-event.mjs <uid> [pass|fail|abandoned]` sends a correctly signed fake event for a member who has a paid identity application, so you can confirm the signature check and the `/admin/users` display independently of Dojah's sandbox. Dojah sandbox values (only against `https://sandbox.dojah.io`): NIN 70123456789, BVN 22222222222, phone 09011111111, RC/CAC 1261103 or 14320749, TIN 18609323-0001.

## Planned: meetings, calls and direct messages (decisions so far — not built)

Internal planning notes; the public `/roadmap` only says these are under team discussion.

- **Provider:** Daily (daily.co) for audio and video rooms, screen sharing, in-call chat and optional transcription. Confirm each capability on the plan we buy before building.
- **Who pays for calls:**
  - A plain audio call (a one-to-one call in a direct message) is free; #NotesApp absorbs the cost because it is cheap.
  - Everything else is charged at the video rate, **₦15 per minute**, whatever the call type or how many people join: video calls, booked-session meetings (even if audio only), group calls, and any call where screen sharing or a presentation is available.
  - The person who starts or schedules the meeting pays, in advance.
  - Billing rounds up to whole minutes: every started minute counts (61 seconds is billed as 2 minutes).
  - Unused call credit stays on the account and can be used for later calls.
  - In-built wallet: the minimum top-up is ₦1,000. The caller must hold credit with us before a paid call, or the video-call button, goes live.
- **Who gets which button:**
  - The direct-message button is live on every registered account.
  - The audio-call button goes live from Pro; the video-call button from Business.
  - Anyone, including Free Standard, can *receive* audio calls. Receiving video calls needs Free Basic or above, so a Free Standard member is asked to move up first.
- **Blocking, reporting and moderation:** the same tools other social apps give — block, mute, report a message or account, admin review and suspension — with rate limits on new conversations.
- **Recording and transcription (Nigeria Data Protection Act):**
  - The meeting owner chooses where a recording or transcript is kept (their own device, or cloud storage) and has to give permission for it before it starts.
  - Every participant sees an on-screen flash notice and hears an audio announcement, before they join, that the meeting is recorded or transcribed.
  - How long files are kept depends on the storage and transcript options we offer; the owner can delete a recording or transcript at any time.
- **AI note-taker:** to explore next — Daily's own transcription service and its rates (what it costs per minute, which languages and accents it handles well, such as Nigerian English and Pidgin, where the transcript is stored, and whether it can be deleted on request). What we can and can't guarantee about accuracy, who sees a transcript and deletion follows from that.
- **Still to decide:** how recordings and shared files are stored and retained in practice (follows the options above), the wallet's refund and expiry rules, and the exact build order.

### Wallet (planned): rules and how to make it safe

**Product rules so far** (draft copy; rates and percentages are settings, not code):
- Premium video calls are billed from the member's #NotesApp wallet; audio calls stay free. The rate is **₦15 per minute** (decided; every started minute counts) and is shown live before a call starts. It is a setting and can change.
- Top-up bonus, web only, for a top-up of ₦10,000 or more: Tuesday–Friday +5%, Saturday and Sunday +7.5%, Monday +10% (all in WAT). The top-up button is turned off inside the mobile apps.
- **Bonus credit** is spent first, and only on calls, boosts and badges. It can't be combined with other offers, sent to another member, or cashed out.
- **Topped-up (real) funds** can pay for anything on the platform: calls, boosts, badges, plans, and items and sessions in other members' shops (see below). They can't be sent to another member, and the wallet can't be cashed out. **There are no member-to-member transfers** (decided).

**Before building: licensing.** Holding member balances is regulated activity in Nigeria (central-bank rules on payment service providers and wallets). Member-to-member transfers are the part that most needs a licence, so they are left out. Get legal advice before enabling balances at all, and consider holding the money with a licensed partner (for example Paylony virtual accounts) rather than in our own books. Spending only on our own services (calls, boosts, badges) is the lighter case; a lawyer should also confirm that paying other members' shops from the wallet stays within the same closed-loop position.

**Paying other members' shops and sessions from the wallet (no transfers).**
- The wallet is just another way to fund checkout, like a card. The buyer's wallet is debited into the platform's escrow (the same held-until-delivery or after-the-session flow used today), and the seller or publisher is later paid by **bank payout** from the platform, minus our commission. The seller never receives wallet money, so no balance moves from one member to another.
- Seller earnings stay a payout ledger paid to a bank account; they are not credited to the seller's wallet. (If we later let people spend earnings on calls, boosts or badges, that is a conversion on our own services, not a transfer.)
- At checkout: "Pay with wallet" shows only when the balance covers the price (cash balance only: bonus credit never pays for shop items or sessions). If it falls short, show "Top up ₦X more" and then pay. Refunds on wallet-paid orders go back to the buyer's wallet as cash balance.
- Build: a wallet option in the existing checkout (`/api/paystack/initialize` and its siblings) that debits the wallet in one transaction, writes the payment as paid and runs the same confirmation, ledger and payout steps as a card payment. The idempotency key is the payment reference.

**Never spend twice (ten devices, one balance).**
1. The wallet only changes on the server. Browsers and apps can ask for a spend; they can never write a balance (Firestore rules: no client writes to wallet data).
2. Every spend, transfer and top-up is one Firestore *transaction*: read the wallet, check `balance >= amount`, subtract, and append a ledger entry, all together. Firestore makes concurrent transactions on the same wallet take turns, each re-reading the latest balance. With ₦2.5m and ten devices each spending ₦1m at once, two succeed and the other eight fail with "insufficient funds".
3. Money is whole kobo integers, the ledger is append-only, and the balance is derived from it. Refunds are new reversing entries, never edits. A nightly job re-adds the ledger and flags any wallet whose balance doesn't match.
4. Bonus and real funds are separate buckets; the server decides which to spend from and enforces what each can pay for.

**Never charge twice (the connection drops after paying).**
1. Every spend carries an idempotency key made when the member taps Pay and saved on the device before the request is sent. The server stores the key with the result inside the same transaction as the debit. A retry with the same key gets the original result back and is never charged again; the same key with a different amount or target is rejected.
2. When the app reopens or the network returns, it first asks "what happened to key X?" and shows "checking your payment…", never an enabled Pay button that would make a new key.
3. The strongest guard is on the business action itself: a unique reference per thing being bought (the call id and minute number, the boost id, the order reference). The server refuses a second charge for the same reference even if a client invents a new key.
4. Calls reserve a small block of credit up front (a hold), bill each minute once (call id + minute number), and release what is unused. Holds expire on their own if the app crashes.
5. Top-ups only credit the wallet from the payment provider's verified confirmation, keyed by the payment reference, using the same "pending to paid exactly once" step the payments code already uses for orders and plans.
6. There are no transfers between members. Every debit sends a notification, so an unexpected one is noticed quickly, and larger wallet payments can ask for a PIN or code.
