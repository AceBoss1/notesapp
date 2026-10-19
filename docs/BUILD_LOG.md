# Build log (history)

How #NotesApp was built, in the order it happened, moved here from the README in v0.38.0 so the README can stay short. It
explains *why* things are the way they are. Where an older passage says something is "not built", "demo" or "shared with
Precheks", the current truth is in the README ("Where things stand") and `HANDOVER.md`.

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
   Every site address must be in the list: `app.notesapp.name.ng`, `notesapp.ng` and `www.notesapp.ng` were added for the app address, so re-paste it into **both** buckets after any change.
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
`/admin` works; (4) the legacy email fallback has been removed (done) — admin is the claim only. Add and remove staff later from
**Admin → Team access** (see *Staff roles* below).
**Staff roles** — `lib/admin-access.ts` (pure, shared by the browser, the API routes and the tests).
Claims: `admin: true` plus `adminRole: "super" | "admin"` and, for admins, `depts: [...]`.
A bare `admin: true` (accounts set up before roles existed) is a super admin. Departments:
`support` (Customer care), `moderation` (Trust & safety), `finance`, `growth` (Growth & partnerships),
`content` (Editorial), `product` (Product & tech). A super admin sees everything; an admin sees only the
pages and data of their departments (`ADMIN_SECTIONS` lists who can open what). The owner is whoever
`OWNER_EMAIL` names (defaults to the first founder in `lib/admin.ts`): only the owner appoints or removes
super admins; other super admins appoint and remove admins and choose departments; nobody changes the
owner or themselves. Manage it all at **Admin → Team access** (`/api/admin/access`; changes are logged in
`adminAccessLog`, the person gets a bell, and narrowing or removing access signs them out of old sessions).
The person must already have an account. Enforcement is in three places: `verifyAdminRequest(token, need)`
on every admin API route, `isSuper()/adminHas()/adminHasAny()` in `firestore.rules`, and the nav/page gate
in the browser. Note: a token already issued keeps its claims until it refreshes (up to an hour) for direct
database reads; API routes check revocation on every call. Deploy with `firebase deploy --only firestore`.
`POST /api/admin/set-admin` was removed.
**Store reviews and recommendations** — `lib/reviews.ts` (rules), `lib/reviews-server.ts`, `/api/store/reviews`, `/api/recommendations`, `components/ReviewsPanel.tsx` (item page and store page) and `components/RecommendationsPanel.tsx` (profile, people and organisations). Reviews: only a buyer with a delivered or confirmed physical order, or a digital purchase, can review; one per item (editable); the seller replies once; running totals live on `storeStats` (`ratingSum`, `ratingCount`). Recommendations: any signed-in member writes one per person; it is public only after the person approves it (`pending`, `approved`, `hidden`); max 10 waiting per author. Both collections (`storeReviews`, `recommendations`) are server-only in the rules, and included in account export and deletion. `/trending` has a third tab, Top store items (score = views + 5 × saves, from `storeStats`; padded to ten with the newest unviewed items, marked New).

**Granola in the team hub** — `lib/granola.ts`, `/api/admin/granola` (+ `/callback`), `components/GranolaPanel.tsx` on `/admin/team`. #NotesApp is an MCP client of Granola's hosted server (`GRANOLA_MCP_URL`, default `https://mcp.granola.ai/mcp`): discovery (protected-resource + authorization-server metadata), dynamic client registration (client id kept in `integrationClients/granola`), OAuth with PKCE, refresh, then streamable-HTTP JSON-RPC (`initialize`, `notifications/initialized`, `tools/call`). Per staff member; tokens encrypted with `ACCOUNT_DATA_KEY` in server-only `granolaConnections` (deleted with the account; one-time sign-in states in `granolaStates`, 10 min). Tools used: `list_meetings`, `query_granola_meetings` (and `get_account_info`); the transcript tool is not on our plan. Notes are never stored; ticked bullet lines of an answer become work items (this week, owner = the person). Needs `NEXT_PUBLIC_SITE_URL` right (the redirect is `<site>/api/admin/granola/callback`). Tested against a local mock server (OAuth, SSE and JSON replies, refresh, revoke); not yet against the live Granola server.

**Pricing & revenue rates** — Admin → Pricing (`/admin/pricing`, owner and super admins; `/api/admin/pricing`, `lib/pricing.ts` for the shape, checks and `applyPricing`, `lib/pricing-server.ts` for storage). One saved object in `platformSettings/pricing` (server-only; change log in `pricingLog`) covers Pro and Business monthly/yearly prices, Enterprise "from" prices and floor rates, session/subscription/gift, physical and digital commission per plan, publisher ad share, the verified-badge and gold prices, and the boost and ad packages. The code still reads `TIERS`, `GOLD_PRICING`, `BOOST_PACKAGES`, `AD_PACKAGES` and `BADGE_PRICE_KOBO`; `applyPricing` writes the saved values into them in place. Pages: the root layout reads the saved config (cached 60 s, `revalidatePath` on save) and `PricingHydrator` applies it in the browser before anything renders. Server money paths (checkout initialize, fulfilment, renewals, loadPublisher, plan codes, ad share) call `ensurePricing()` first (20 s cache per instance). Paystack plans are re-created when a price changes, so existing subscribers stay on the plan they bought. Not editable here: per-account Enterprise rates (those are on the Enterprise admin page), gift amounts, and the limits per plan.

**Expenses due** — shown on the team hub and the money ledger (`components/DuesPanel.tsx`, `/api/admin/dues`, `lib/dues.ts`, `lib/dues-server.ts`, server-only `financeDues`). Manual items (bill, renewal, date, optional amount) plus free plans that turn paid (derived from Grants & subscriptions, day after the free period ends). The `dueReminders` cron job messages owner, super admins and finance at 14, 7, 3, 1 and 0 days and once when overdue. "Mark paid" writes an expense entry into the ledger (normal ledger rules) and closes the item. Not on Traction on purpose: that page is for growth numbers. Grants can also be `pending` (applied for, not counted or reminded) until approved.

**Grants & subscriptions** — Admin → Team hub → Grants & subscriptions (`/admin/team/grants`, `/api/admin/grants`, rules in `lib/grants.ts`, server in `lib/grants-server.ts`, server-only `grants` collection). Tracks credits (usage is deducted) and free-period plans (seats, list rate, months, what they cost after), with templates for the Claude Startups credit, Claude Team, Moda Pro and Granola Business. Values are USD cents; the person enters the naira-per-dollar rate, and "Add to ledger" writes an in-kind `grant` income entry (counted separately from cash). The `grantReminders` cron job (in `/api/cron/reminders`) messages the owner, super admins and finance at 30, 14, 7, 3, 1 and 0 days, once per threshold, and closes grants past their end date. Finance edits, product reads. List prices in templates are prefilled from public pricing pages and must be checked against invoices.

**Money ledger** — Admin → Team hub → Money ledger (`/admin/team/finance`, `/api/admin/finance`, `lib/finance.ts` for the rules,
`lib/finance-server.ts` for the logic). Expenses, payroll and money in that isn't platform revenue (grants, sponsorships, direct
transfers), with receipts and invoices (private R2 bucket, short-lived links, same bucket and CORS as message files), next to
the platform's own revenue (shared with /admin/revenue through `lib/revenue-server.ts`). Month-by-month and by-category totals, CSV
export. Who: **finance** (and super admins) record entries dated today or up to 3 days back (`BACKDATE_DAYS`), add receipts to any
entry and void recent ones with a reason; **product** reads everything except payroll lines (payroll shows as a total); only the
**owner** (`OWNER_EMAIL`) enters older dates, edits, voids history and bulk-imports a CSV (up to 500 rows, checked first,
duplicates skipped). Nothing is deleted. Collections `financeEntries` and `financeLog` are server-only in `firestore.rules`.
**Profile work lines** — optional `industry` ("What do you do?", a fixed list in `lib/profile-work.ts`), `jobTitle` and `workplace` on the
public `users` document: asked at sign-up (organisations only get the industry), editable in Edit profile, shown as "CEO at Acme" under the
name (`headline()`), listed in `/api/public/users`, and counted on Admin → Users ("What our members do"). `firestore.rules` allows only
those keys with length limits (`workOk`). Privacy Policy mentions them; `LEGAL_VERSION` was not bumped (voluntary public profile info,
so no forced re-acceptance), bump it if you change that.
**Nana AI and the help centre** — one chat (`components/NanaPanel.tsx`) shown as the corner button (`NanaChat`), the conversation pinned at the top
of Messages (`/messages/nana`), her own page (`/nana`) and an Ask Nana panel in the team hub. `POST /api/nana` → `lib/nana-server.ts`:
the official `@anthropic-ai/sdk`, `claude-opus-5-5` by default at low effort, the knowledge base in a cached system block, server-side
fallbacks on. **Who pays, in order:** the member's own connected AI account (`lib/ai-connect.ts`, an Anthropic key checked at connect time and kept
AES-GCM encrypted in `aiConnections` with `ACCOUNT_DATA_KEY`), then #NotesApp's `ANTHROPIC_API_KEY` (limited by rate limits, `NANA_DAILY_LIMIT` for
the day and a per-person allowance), and with neither, or if the AI is out of credit, rejects the key or is down, **Nana answers from the knowledge
base alone** (`lib/nana-kb.ts`: searches the articles and replies in a friendly template with links, detects requests for a person), so the chat
never stops. The knowledge base is `lib/kb-articles.ts` (built-in articles that read the real prices and limits from code) plus articles staff write at
**Admin → Help & Nana** (`kbArticles`; a staff article with a built-in slug replaces it); readers see the same articles at `/help`. In the team
hub, `context: "hub"` (admin sign-in required) adds team-only articles (`internalArticles()`) and the person's open items (`lib/nana-hub.ts`).
Replies are checked before showing: links survive only if they point at a page of ours that exists (`sanitizeLinks`), and the `[[HANDOFF]]` /
`[[GAP]]` tags the model adds are removed. Visitors must give a name and email (members are recognised from their sign-in). Chats are saved in
`nanaChats` (server-only); a request for a person creates a lead in the Leads inbox; the Chats tab shows what Nana couldn't answer.
**Writing help** (`POST /api/nana/assist`, `lib/nana-assist.ts`, button `components/NanaAssist.tsx`): improve / shorten / expand / friendlier /
more professional / notes-to-draft in the journal composer, a post for LinkedIn or X in the share panel (limits enforced on the result), and
reply suggestions and polish in a conversation. Text is not stored. It needs an AI account (own key, or ours within `NANA_ASSIST_DAILY` per person
per day, default 20); the knowledge base cannot write. Variables: `ANTHROPIC_API_KEY` (optional, Sensitive: without it Nana still works from the
help centre and members can connect their own), `NANA_MODEL` (for example `claude-haiku-5-5` to spend less), `NANA_DAILY_LIMIT` (replies a day, default
1500), `NANA_CHAT_PER_USER_DAILY` (default 100), `NANA_ASSIST_DAILY` (default 20). No voice: Nana is text only.
**Site themes (v0.17):** Business and Enterprise members choose `legacy` or `aurora` (`lib/site-themes.ts`) under Edit profile (`components/SiteThemePicker.tsx` → `POST /api/site/theme`, plan checked on the server, stored as `siteTheme` on `users/{uid}`; client rules only restrict the keys a member *changes*, so the server-written field does not break profile edits). `data-site-theme` on the member-site layout carries it; Aurora styles `SiteHome`, `SiteShop` (category chips, featured item), `SiteNotes`, the header and the journal rail (`JournalDetail` `site.theme`). Default is legacy. **Moments viewer (v0.16):** one overlay player for phone and desktop (`components/moments/MomentViewer.tsx`): tap the left 30% to go back, elsewhere to go on; owners see stats, an auto-loaded Who-watched list and their other moments on `lg`+, and a 👁 pill sheet on phones. **Journal page (v0.16):** `components/JournalDetail.tsx` is a two-column grid on `lg`+ with an author rail (the Book/Gift cards stay inline under the article below `lg`; custom-domain note pages keep the single column). **Look and feel (v0.15):** `components/PageHero.tsx` (crimson hero band for About, Pricing, Help, Track), `components/FooterCta.tsx` (call to action opening the footer), crimson masthead in `app/(main)/layout.tsx` (`AuthNav onDark`), profile header card, two-pane Messages (`app/(main)/messages/layout.tsx`, the list shows left from `lg`), and a three-column Moments viewer (`components/moments/MomentViewer.tsx`, rail and side panels from `lg`/`xl`; quick reactions like the moment and reply with the emoji). Avatar rule: people are circles, organisations rounded squares (`accountKind === "organisation"`). **Store categories, saves, views, ships-from:** `lib/store-meta.ts` (categories, `shipsFrom`), `category`/`shipsFrom` on `storeItems` (rules validate both), saves in server-only-written `storeFavorites/{uid}_{itemId}` (a member reads only their own), public counters in `storeStats/{itemId}` = `{ownerUid, views, favs}` written only by `lib/store-stats-server.ts` via `POST /api/store/favorite` and `/api/store/look` (browser sends at most one view a day per item; the seller's own views are ignored). `StorePageClient` and `ShopItemView` are the redesigned storefront and item page; `/saved` lists a member's saves. **Store sizes:** sellers add sizes (and an optional second option such as Colour) one entry at a time with a ✔ in `components/StoreManager.tsx`; `variantStock` is sparse (only saved entries, at most 60) and each option has up to 20 choices (`MAX_CHOICES`, `MAX_VARIANTS` in `lib/store.ts`, mirrored in `firestore.rules`, which needs `firebase deploy --only firestore`). A combination that was never saved is simply not offered. **Limits only when we pay:** the per-person/per-day allowances and the hourly request limits (`/api/nana`, `/api/nana/assist`) apply only to #NotesApp's AI;
a member with their own key connected is never limited by us. **Booking in replies:** for a suggested reply in a conversation, `lib/nana-booking.ts` adds the
member's booking link and next open times (availability minus `slotLocks`) when they take paid sessions and have a payout account; otherwise Nana is told
not to mention booking. **Status and partners:** `/status` has a "Claude AI (Anthropic)" line (lists models with our key; "Not enabled yet" without one) and
`lib/partners.ts` has the Anthropic card (`public/images/partners/anthropic.png`). **Help article format:** `Markdownish` supports `## headings`; an
article page passes `external` so a Sources list can link to https sites (Nana's own replies never can). Example: the built-in "Who is Emmanuel Adams?"
(`who-is-emmanuel-adams`); a staff article with that slug replaces it.
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
   `admin` claim only. Staff are managed from Admin → Team access (the script only bootstraps the first super admin).
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
- *Traction snapshot* — `/admin/traction` (`lib/traction.ts`, `GET /api/admin/traction`): registered users, publishers, sellers and items, organisations, gold-verified, store orders, digital sales, sessions, merch, boosts, total money processed (refunded, pending and slot-conflict payments excluded), paying customers, commission, payouts made, money held in escrow, by-type and six-month tables. "Copy summary for a deck" and CSV download. Counts only — no personal data. **Stored snapshots (`lib/stat-cache.ts`):** the traction numbers and the revenue report (`/admin/revenue`, every date range at once) read whole collections, so they are kept in `statCache/{traction|revenue}` and rebuilt at most once an hour (traction) or every 15 minutes (revenue) across all server instances; opening the page costs one read, and **Refresh now** (`?fresh=1`) rebuilds straight away. The team hub reads the same traction snapshot. Reads ask only for the fields used (`select()`). `statCache` has no client rule, so only the server reads it. The admin payments page loads every open ledger entry (held, disputed, transferring) plus the newest 300 others and the newest 300 boosts, not the whole collections.
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
boost per post; only the post's author or an admin can boost it. **Cancelling a running boost** (`lib/boost-cancel.ts`): the member does it from `/profile/boosts` (`POST /api/boosts/cancel`) and gets **half of the undelivered share** back, the other half is forfeited (`MEMBER_FORFEIT`); an admin does it from `/admin/payments → Boosts` (**Cancel and refund**, a reason is required and shown to the member) and the **whole** undelivered share is refunded. Delivered impressions are never refunded. The boost is claimed first (status `cancelling`, so impressions stop and a double click can't refund twice); if the Paystack refund fails it goes back to `active`; on success it is `closed` with `cancelledBy`, `refundedKobo` and, for members, `forfeitedKobo` (or the admin's `cancelReason`). The member gets a bell notice. The Terms, `/boost` page and the help article describe the 50% forfeit. Boost
revenue is 100% platform (no ledger entry). **Housekeeping:** add a
Firestore TTL policy on collection group `seen`, field `expireAt`, so
de-dup docs clean themselves up.
**Not built yet:** in-app "Sponsored" disclosure beyond the label,
per-boost analytics charts, public supporter counts.

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

## Planned: team operations and data room (scaffold — online status and follow lists are built, see section 4)

Internal planning notes (12 October 2026). Section 1 and 3 are not built, section 2 is built apart from the items listed at its end, and section 4 is built; the public `/roadmap` lists the member-facing parts in plain words. Open questions are marked **(ask)**.

### 1. Nana: suggested replies to posts
- Extend the writing help (drafts, sharing, messages are live) to **suggest replies**: to comments on your own posts, and a response to a post you are reading, in your voice (from your past notes). Always a suggestion you edit and send yourself; nothing posts on its own.
- Same rules as today: knowledge base first, your own connected AI account or the platform key with the daily limit, and the person's text sent to the AI only when they press the button.

### 2. Team hub: work, payments, payroll, library, messages
- **Work still to do, who has it, by when:** the work board already has owner and due date, morning summary and overdue handling. Gaps: a per-person view ("assigned to me / to Chimdinma"), a deadline reminder to the assignee (bell and email) before and on the date, and a company-wide "overdue" strip. **No new data model needed.**
- **Payments to be made, assigned, with a deadline — BUILT (13 October 2026):** **Expenses due** (`lib/dues.ts`, `lib/dues-server.ts`, `components/DuesPanel.tsx`) now has an **assignee** (`assigneeUid/Name/Email`, chosen from the team) and a **pay-by date** (`payBy`, on or before the due date, not in the past). Finance sets or changes them (**Assign** on each item; `assign` action on `/api/admin/dues`); the assignee gets a bell when assigned, and reminders (14, 7, 3, 1, 0 days, then overdue) count down to the pay-by date when there is one and go to finance **and** the assignee. Any staff member can open the panel on the team hub: finance and product see everything, anyone else sees only what is assigned to them, and an **Assigned to me** filter is there for the rest. "Mark paid" is still finance's (it writes the ledger expense). Optional approver for large amounts: still **(ask)**, not built.
- **Payroll under Accounts — BUILT:** `/admin/team/payroll` (menu: Money; finance and super admins only; `lib/payroll.ts`, `lib/payroll-server.ts`, `/api/admin/payroll`). **Staff** (name, role, monthly pay, pay day 1–28, start date, bank, account name, account number), a **monthly run** (`payrollRuns/{YYYY-MM}`, one per month, built from active staff who started on or before that month; a month that hasn't begun is refused), a per-line **Adjust** (a deduction or extra, never more than the monthly pay, with a reason) and **Remove**, and **Mark paid** one person at a time, which writes a **Payroll / Salary entry into the money ledger** (dated today, `period` = the month) — the line is claimed in a transaction first so a double click can't record it twice, and un-claimed if the ledger write fails. Full account numbers are encrypted with `ACCOUNT_DATA_KEY` (same key as publisher payouts) into `payrollSecrets/{staffId}`, the page only gets the last four digits, **Show account** decrypts on request and is logged in `financeLog`. Without `ACCOUNT_DATA_KEY` everything works except saving account numbers (the page says so). Transfers are still made by hand; Paylony payouts later **(ask)**. Collections `payrollStaff`, `payrollRuns`, `payrollSecrets` are server-only in `firestore.rules`.
- **Staff library — BUILT:** `/admin/team/library` (`lib/staff-ops.ts`, `lib/staff-ops-server.ts`, `/api/admin/staff-library`, collection `staffDocs`). Documents of kind **SOP, handbook, policy, template, other**, each with a version, up to 10 files (private bucket, `staff/<doc id>/…`, 25 MB each, pdf/docx/xlsx/pptx/png/jpg/txt/csv/md, opened through 1-minute links) and an optional **"I have read this"** confirmation. Visible to **everyone on staff**, **one department** (super admins always), or **named people (personal)**, where only the receivers and whoever added it can open it (not even a super admin). **New version** bumps the number, clears the confirmations and tells the audience; maintainers see **who has read it and who hasn't**. Super admins, customer care (support) and product maintain the library; everyone on staff reads. Archive instead of delete.
- **Message hub — BUILT:** `/admin/team/messages` (`/api/admin/hub`, collection `hubMessages`). **To**, optional **Cc**, subject, message, up to 10 files, and **Also send by email** (everyone gets a bell either way; the hub copy always stays; emails say the files are in the hub). **Personal material = To, not Cc:** files open only for the sender and the people in To; people in Cc get the message and are told the files went to To. Inbox / Copied to me / Sent, unread dots, per-person read state, Reply. Sending is two steps (`prepare` gives an id and upload addresses, `send` checks each file arrived under `hub/<id>/`). Group conversations stay in the Team room.
- **Work board — BUILT:** a **Show** filter (everyone, assigned to me, a named person, not assigned) replaces "Only mine", and a strip counts overdue items across the team per person (tap to filter). Assigning an item (create or change of owner) sends the new owner a bell (not when you assign yourself). `sendWorkReminders` (cron `workReminders`, `lib/team-server.ts`; thresholds in `lib/team.ts` `workReminders`) reminds each owner 3 days and 1 day before the due date, on the day, and once when overdue: one bell per person per run listing their items, plus an email when anything is due tomorrow, today or overdue. Sent thresholds are kept in `remindedDays` on the item and cleared when the date or owner changes. Unassigned items are left to the morning summary. Reads items with a due date from 60 days ago on.
- **Not built from this list:** an approver on payments, and bank transfers from the app. Files need the private bucket (`R2_PRIVATE_BUCKET` etc.); without it the library and hub work as text and the pages say so.
- Storage: private bucket with short-lived links (as for receipts and message files), collections server-only, access by role and department.

### 3. Investor and partner data room
- **Separate logins by category** (for example Investors, Partners, Advisers, Legal); each category has its own set of folders and files. Own sign-in (email code), not a #NotesApp member account.
- **View only, never download:** files open in a viewer that draws pages in the browser (no file download link, print and save disabled, short-lived tokens, device limit like our view-only courses in `lib/view-access.ts`). Every page carries a **watermark with the viewer's name and email**. Honest limit: nothing stops a photo of the screen, so the watermark, the access log and a click-through NDA are the real deterrents.
- **Access page in admin** (owner and super admins): **add** a person directly, or **approve / decline applications** from a public "Request access" form (name, email, organisation, category wanted, reason); set category, expiry, revoke; see who opened what and when (audit log).
- **Live numbers:** traction, revenue and other key figures flow from the team hub and the admin pages into the data room as live pages, with a "figures as of" stamp (no copying by hand). Choose per figure whether it appears and for which category **(ask)**.
- Needs counsel's wording for the NDA and data-protection notice; first build on the stack we already have (Firestore server-only collections, private bucket, email sender).

### 4. Online status, last seen and follow lists — BUILT (13 October 2026)
What shipped, and how it works:
- **Followers and Following** under the follower count on every profile (`components/FollowLists.tsx`), a dialog with two tabs, 30 per page by document id (`GET /api/follows?username=&list=followers|following&after=`, `lib/follows-server.ts`). Signed-in members only. Rules in `lib/social-graph.ts`: you see someone's lists only if they have lists public **and** you do (your own lists always). The official channels (@notesapp, @na-notesapp) have no switch and are public. The reason is returned (`viewer-off` / `target-off`) so the dialog can say what to change.
- **Online now / last seen** on the profile header, the conversation header and the inbox rows (`components/PresenceText.tsx`, `lib/presence-client.ts`, `POST /api/presence`). Shown only when you and they **follow each other** and both have **online visibility on**; otherwise the person is simply left out of the answer, so "hidden" and "doesn't follow back" look the same. Groups, @notesapp and @na-notesapp never show a status.
- **Heartbeat:** `components/PresenceBeat.tsx` (mounted in the main layout) writes `presence/{uid}` = `{ lastSeen: serverTimestamp }` about every **3 minutes** while a tab is visible; online = a beat in the last **7 minutes**. This follows the cost note above (writes at most every few minutes, on Firestore, no realtime service). Switching online visibility off stops the beat and deletes the record. Rules: `presence/{uid}` is write-your-own, never readable from the client; `/api/presence` reads it, applies the rules and caches each viewer/person pair for 60 seconds, so a new follow or a switch can take up to a minute to show. At most 25 people per request. Reads per lookup: user + two follow docs + presence per person.
- **Switches:** `users/{uid}.showOnline` and `.showLists` (booleans, absent = on), editable only by the member (`firestore.rules`), in `components/VisibilitySettings.tsx` on **Profile, Account** and under the message settings on `/messages`.
- **@na-notesapp follows (owner only):** follows made in its name are stored as `follows/na-notesapp_{username}` (`followerUid: "na-notesapp"`, `official: true`), written only by the server (`POST /api/follows/official` `{ username, follow }`, owner = `OWNER_EMAIL` with a verified email). Every profile shows **Follow as @na-notesapp / Unfollow as @na-notesapp** to the owner only (`components/OfficialFollowControl.tsx`, it asks the server before showing anything), and the owner can also remove accounts from the Following tab on `/u/na-notesapp`. Works for members, organisations and the founders' channels; not for @notesapp or @na-notesapp itself. Clients cannot create or delete these (rules test).
- Account deletion also removes the `presence` record.
- **Follow records are private to the database rules:** a browser may read only its own follows (`get` on its own id, `list` where `followerUid` is itself). Counts come from `/api/public/journal-stats` and the lists from `/api/follows`, which apply the privacy switches. The new-post notification fan-out moved to the server (`lib/new-post-notify.ts`, `POST /api/notify/new-post`, admins only, sends once per post via `newPostNotifiedAt`, batches of 400). `subscriptions` is still publicly readable.
- Tests: `npm run test:rules` (49, includes the new switches, presence and @na-notesapp cases). The list, @na-notesapp and presence logic was also run against the emulator (mutual follow, either side's switch off, stale heartbeat, one-way follow, own list, owner follow and unfollow).

### Suggested order
1. ~~Follow lists, the @na-notesapp control and online status~~ (built). 2. Staff library and message hub, assignee and deadline on payments, Payroll page. 3. Data room (access page first, then viewer and watermark, then live figures). 4. Nana suggested replies. Also next week: trim the whole-collection Firestore reads.

## Planned: runway calculator, burn and revenue analytics, vesting and cap table (scaffold — not built)

Internal planning notes (12 October 2026). Nothing here is built. Only the owner and super admins (and finance for the runway and analytics) would see these pages; the cap table is owner and super admins only. Open questions are marked **(ask)**.

### 1. Burn and revenue analytics (build first: it uses data we already have)
- One admin page under Money, built from the **money ledger** (expenses, payroll, in-kind grants kept apart from cash), **Revenue** (what the platform really earns: commissions, plans, ad revenue, **not** the gross amount processed) and **Expenses due**.
- Shows, by month: revenue by source, **gross burn** (all spending), **net burn** (spending minus cash revenue and other cash income), payroll share, cost by category, month-on-month growth, **burn multiple** once there is enough revenue, and a trend of runway. Export as CSV. Every figure carries an "as of" time.
- Needs an **opening cash balance** (amount and date, set once by the owner, changed only with a logged reason) because the ledger starts late. **(ask: the balance and its date)**.

### 2. Dynamic runway calculator
- **Question it answers:** with the C-suite expansion, on what date does cash run out, and what changes it?
- **Cash today** = opening balance + cash income − expenses − payroll (from the ledger), in naira.
- **Monthly burn** = the trailing average of real spending, **plus the headcount plan**, **plus known payments coming up** (Expenses due), **plus planned items** such as the Live (Daily) bill.
- **Software grants:** read straight from Grants & subscriptions. While a grant is running its software cost is **not** in the burn; on its end date a plan that becomes paid adds its monthly cost (so the chart shows a **step up on 12 January** for Moda, and so on). In-kind credits and USD values use the naira rate entered on each grant. API credits (Claude) are used up by usage, so they are modelled as a pool that runs out at the current spend rate or on the expiry date, whichever is first.
- **Headcount plan:** a list of planned hires (role, start month, monthly cost, employer overhead % for pension and tax), with the C-suite roles; each can be switched on or off to see its effect. Founders' and executives' current pay comes from the Payroll page once that exists.
- **Revenue assumption:** pick one: flat at the trailing average, a monthly growth rate, or a hand-entered line. Show **three scenarios** (cautious, base, ambitious) side by side.
- **Outputs:** runway in months, **zero-cash date**, a chart of cash by month with markers for each hire and each grant cliff, gross and net burn, and the largest levers ("cutting X adds N months"). Sliders change everything live; **named scenarios can be saved and compared**, and "as of" and who saved them are recorded.
- Vesting is **not cash**, so it does not change runway; it matters for the cap table.
- Needs a **People plan** record and a saved-scenario record, both server-only; no change to the ledger.

### 3. Vesting schedule (to be uploaded later)
- A **3-year structure** (as stated). Import from CSV or Excel: holder, role, grant date, shares or percent, cliff, vesting period (36 months), frequency, and any acceleration terms. **(ask: cliff length, monthly or quarterly vesting after the cliff, acceleration on exit)**.
- Computes per holder: vested to date, unvested, next vest dates and the fully-vested date, and a company timeline; feeds the cap table's fully-diluted view. Imports are checked row by row and nothing is saved if a row is wrong.

### 4. Cap table
- **Holders** (founders, option pool, investors, advisers) and **instruments** (common shares, options, preferred shares, SAFEs, convertible notes) as an **append-only list of events** (issue, transfer, cancel, exercise, convert); the table is always computed from the events, so history and a change log come free and past states can be shown "as of" a date.
- Shows ownership %, **fully diluted** (including the option pool and unvested grants), and holdings by holder and class.
- **Round modelling:** pre- and post-money, new money, price per share, option-pool top-up and SAFE or note conversion, with dilution per holder, before anything is agreed.
- A **working record, not the legal register**: the company's register of members (and CAC filings) stays with the company secretary or counsel; this should be reconciled with it. **(ask: current share count, classes, any SAFEs or notes, the option pool size)**.
- Access owner and super admins only; the data room can show an investor a **read-only view as of a date** with their name and email watermarked (see the data room plan above).

### Suggested order
1. Opening balance and the burn and revenue page. 2. People plan and the runway calculator with grant cliffs and saved scenarios. 3. Cap table (events and fully-diluted view). 4. Vesting import and its timeline. 5. Feeding these into the data room. Also next week: trim the whole-collection Firestore reads.

## Planned: CAC and MRR calculator (scaffold — not built; sits beside the runway calculator)

Internal planning notes (12 October 2026). The inputs become sliders; the defaults below are the **planning case with the least downside** (cautious on everything except cost per signup, which we keep at ₦100 because acquisition is by a gamified concept). Prices are read from the admin Pricing page, not typed in.

### Inputs (sliders, saved as named scenarios shared with the runway calculator)
Acquisition spend (₦10,000,000) · target registered users (100,000) · **badge incentive cost** (badges given × ₦999 × months; planning case 2,000 × 1 month = ₦1,998,000) · naira per dollar (₦1,333) · **conversion to premium tiers** (planning 1%) · Pro to Business mix (4 : 1) · badge payers per premium user (0.4) · share on yearly plans and the yearly discount · **monthly churn** (planning 8%) · **average monthly earnings through the platform per paid member** (planning ₦10,000, used for commission given up) · payment fees (Paystack, about 1.5% plus ₦100 on charges of ₦2,500 and over; check the real rate) · horizon (12 months).

### Outputs
- **Blended CAC** = (spend + badge cost) ÷ users: ₦119.98 ($0.09). **Cost per paying user** at the chosen conversion.
- **MRR bridge:** gross subscription MRR → minus payment fees → minus **commission given up** (a member who moves up a tier pays us a lower cut on what they earn: Free Basic 35% to Pro 25% to Business 15% on sessions, subscriptions and gifts) → **net MRR**. Pro pays for itself for the member above about ₦50,000 a month earned (Business ₦75,000), so for the heaviest earners a Pro upgrade *loses* us money; the calculator shows it.
- **Cohort revenue** month by month with churn, **12-month cumulative revenue against spend**, **payback month**, **break-even conversion**, LTV (net per payer ÷ churn) and LTV:CAC. **ARR is shown only as "if nobody leaves"**, never as a headline.
- **Floor / planning / upside** side by side, and a one-line "what would have to be true" (break-even conversion, break-even CAC).

### Planning case worked out (the calculator's starting defaults; a shareable copy with the logo is the Google-style doc "CAC Efficiency Analysis")
Prices as set on the admin Pricing page on 12 October 2026: Pro ₦5,000, Business ₦25,000, badge ₦999 a month; commission Free Basic 35%, Pro 25%, Business 15%. Premium conversion **1%** = 1,000 users (800 Pro, 200 Business) plus 400 badge payers; the challenge badge is free for **1 month only** (2,000 × ₦999 = ₦1,998,000); a **₦2,000,000 marketing execution fund**; members earn **₦10,000 a month** through the platform on average; monthly churn 8%; payment fees about 1.5% plus ₦100 on charges of ₦2,500 and over.
- **CAC** ₦119.98 per registered user before the execution fund, **₦139.98 ($0.105) all-in** (total outlay ₦13,998,000); about ₦9,999 per paying user.
- Gross MRR ₦9,399,600 (Pro ₦4,000,000, Business ₦5,000,000, badges ₦399,600) → payment fees about ₦241,000 → commission given up about ₦1,200,000 → **net ₦7,958,600 a month** (about $5,970).
- With churn the cohort earns about **₦62.9 million over 12 months** against ₦13,998,000 spent (+₦48.9M, 4.5×); **payback in month 2**.
- **Break-even is about 0.22% conversion** over 12 months (about 0.38% if the real cost per signup were double). At 0.5% the cohort returns about ₦31.5 million; at 3% about ₦188.7 million; at 5% about ₦314.5 million.
- Pro costs us money only for a member earning over about ₦50,000 a month through us; Business over about ₦125,000 at the ₦25,000 price.
- The 5% case is the upside, not the plan: free-to-paid is usually a few percent at best, and sign-ups won through a game may convert and stay less well, which is why we measure by cohort.

### Cash survival (re-budgeted; also the runway calculator's starting defaults)
- **Cash bridge** ₦14,663,000 ($11,000 at ₦1,333) − campaign outlay ₦13,998,000 (acquisition ₦10,000,000 + badge incentive ₦1,998,000 + execution fund ₦2,000,000) = **₦665,000 reserve**.
- **Post-launch monthly cash burn ₦1,142,600** = 30% of infrastructure after software grants (₦342,600) + local team admin ₦800,000. **Standalone runway 0.58 months** (about 18 days) with no revenue.
- Software grants ($9,820 = ₦13,090,060 at ₦1,333, "70% cover") are **non-cash**: they lower the infrastructure bill, they are not part of the cash above. They are the **ceiling** of the stated offers, not invoiced savings, and they lapse from January 2027 (Granola 9 Jan, Moda 12 Jan; Claude Team and credits later), when burn would rise to about ₦1,942,000 a month (₦342,600 is 30% of about ₦1,142,000).
- Net MRR in the planning case is about seven times the monthly burn, so the thin reserve matters mainly for the weeks before the first members pay.

### Wiring
- **Actual vs projected:** real registered users, paid plans and badges from the traction snapshot, and acquisition spend from the ledger's *marketing* category, shown next to the projection so the sliders are calibrated by real data as it arrives.
- **Into the runway calculator:** planned acquisition spend as burn and net MRR (not gross) as the revenue line.
- Access: finance and super admins; CSV export; "as of" stamps. Data room feed later.

## Planned: public Live and private group sessions (decisions so far — not built)

Internal planning notes (October 2026). Nothing here is built. The public `/roadmap` and `/challenge` pages only say live video is coming.

**Product split**
- **Public Live** (one to many): professional and educational, not entertainment. **Private group sessions** (booked, paid): Zoom-like, no public audience.
- Provider: Daily (see the calls section below); price LiveKit as the fallback if the cost of many on stage worries us. Confirm Daily's stage and audience limits before promising numbers.

**Public Live: decided**
- Stage: the host plus up to **10 co-hosts**. The screen shows **4 live video tiles**; everyone else on stage is an avatar with audio. Viewers press **Request**, host or a moderator approves; the host can also invite; mute, remove and "back to audience" are one tap.
- The host **appoints moderators** (remove comments, mute or remove people, approve requests, pin, slow mode; a moderator log).
- The host's **last-used setup carries over** to the next Live (title, topic, chat rules, who may request, moderators, stage seats, recording consent), and named presets can be saved.
- A **Book a session** button for the host's private sessions is visible **from the first second to the last**, not only at the end. Other tools: audience-upvoted Q&A, polls, pinned links (journal, store item), Nana notes, replay turned into a journal post with transcript and summary, audio-only low-data mode.
- **Who may host:** verified publishers (confirmed). The challenge's 100k views and 10k new followers stay the condition for the ₦1,000,000 giveaway only. For now we don't want Live used heavily except as a user-acquisition tool, so allowances stay small.
- **Who pays:** #NotesApp pays for Live at the start (confirmed): gamified Live and leaderboards are the cheapest user acquisition. A host who wins the challenge may get a different allowance (wording to confirm: higher, or the caps lifted). Needs guard rails: a free minutes allowance per host per month, a stage-seat limit, an audience cap and a global monthly cap, set on the admin Pricing page, and each month's Daily bill entered as an expense in the money ledger.
- **Audience is always free. No tickets.** Hosts use Live to promote their private sessions.
- **Gifts exist** in Live (confirmed). Gifts, subscriptions, engagement, purchases and reviews all count towards fan and follower ranking site-wide, **with no cap on gifts** (confirmed).
- **Leaderboards:** collect the real data from day one (attendance, watch time, questions, ratings, gifts, subscriptions, purchases, reviews as server-written stats, like `storeStats`); decide what to show once there is data.
- **Participants** (not "learners"): an optional "top participants" board from attendance streaks and good questions.
- **Recording** for safety review, with the host's consent (accepted when the host enables Live); everyone is told. Kept **30 days**, then deleted unless the host publishes the replay (confirmed). Check wording with counsel (NDPA).
- **Platforms:** web and mobile together. Web is built mobile-first now; the native apps (on the roadmap) reuse the same backend. Digital gifts inside the iOS and Android apps probably need the stores' in-app purchase, so gifts there would be bought with credit topped up on the web (as the top-up button already is).

**Ranking (decided)**
- Two boards: **Hosts** (quality: unique viewers who stay, watch time, ratings, return rate, questions answered, reviews, subscriber growth) and **Fans and participants** (attendance, questions, reviews, plus support: gifts, subscriptions, purchases).
- Money counts and **gifts are not capped** (decided). Because uncapped money can let a big spender outrank an active participant, keep self-gifting and linked-account checks so rank cannot be faked with extra accounts, and look at the real numbers before the boards go public.
- Showing on a public board is **opt-in** or anonymous (confirmed), for NDPA reasons and to avoid pressure to spend.

**Private group sessions: decided**
- **No guests:** everyone has an account, so account setup gets easier with **passwordless sign-in**: an **email code first** (confirmed); a phone code later, since SMS in Nigeria costs money and can be unreliable. Join link opens a short "enter your email, type the code" step, creates the account if new, and lands in the waiting room.
- Zoom-like: gallery and speaker views, waiting room, mute all, screen share, chat, hand raise, breakout rooms later, recording only with consent, transcript with Nana's summary.
- Room is made when the booking is made; the host pays the per-minute call rate from NotesApp Credit (see below), to revisit for groups of ten or more.

**Suggested order:** (1) passwordless sign-in, (2) private group sessions, (3) public Live with presets and moderators, (4) stats collection running from the first Live, (5) leaderboards when there is data, (6) replay to journal, (7) ten co-hosts and low-data mode. Also next week: trim the whole-collection Firestore reads.

## Planned: meetings, calls and direct messages (decisions so far — not built)

Internal planning notes; the public `/roadmap` only says these are under team discussion.

- **Provider:** Daily (daily.co) for audio and video rooms, screen sharing, in-call chat and optional transcription. Confirm each capability on the plan we buy before building.
- **Who pays for calls:**
  - A plain audio call (a one-to-one call in a direct message) is free; #NotesApp absorbs the cost because it is cheap.
  - Everything else is charged at the video rate, **₦15 per minute**, whatever the call type or how many people join: video calls, booked-session meetings (even if audio only), group calls, and any call where screen sharing or a presentation is available.
  - The person who starts or schedules the meeting pays, in advance.
  - Billing rounds up to whole minutes: every started minute counts (61 seconds is billed as 2 minutes).
  - Unused call credit stays on the account and can be used for later calls.
  - NotesApp Credit: the minimum top-up is ₦1,000. The caller must hold credit with us before a paid call, or the video-call button, goes live.
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
- **Still to decide:** how recordings and shared files are stored and retained in practice (follows the options above), the refund and expiry rules for NotesApp Credit, and the exact build order.

### NotesApp Credit and Bonus Credits (planned): rules and how to make them safe

Names: the prepaid balance is **NotesApp Credit**; promotional extras are **Bonus Credits**. ("Wallet" is only a technical word in the notes below.)

**Product rules so far** (draft copy; rates and percentages are settings, not code):
- Premium video calls are billed from the member's NotesApp Credit; audio calls stay free. The rate is **₦15 per minute** (decided; every started minute counts) and is shown live before a call starts. It is a setting and can change.
- Top-up bonus, web only, for a top-up of ₦10,000 or more: Tuesday–Friday +5%, Saturday and Sunday +7.5%, Monday +10% (all in WAT). The top-up button is turned off inside the mobile apps.
- **Bonus Credits** are spent first, and only on calls, advert banner payments, boosts and badges. It can't be combined with other offers, sent to another member, or cashed out.
- **NotesApp Credit (topped-up funds)** can pay for anything on the platform: calls, boosts, badges, plans, and items and sessions in other members' shops (see below). They can't be sent to another member, and NotesApp Credit can't be cashed out. **There are no member-to-member transfers** (decided).

**Licensing: counsel's view (October 2026).** Nigerian legal counsel advised that (1) a prepaid balance usable only on our platform, including paying other members' shops and sessions, needs no licence; (2) the existing "held until delivery, then paid to the seller" flow needs nothing beyond what the payment provider holds; (3) holding the money with a licensed partner means the platform needs no approval of its own; and (4) we should **prepare for data-protection registration** (NDPC). This holds only while the controls stay true: no member-to-member transfers, no cash-out, seller earnings paid to bank accounts only, and bonus credit that can't be moved or cashed. The register is shown on `/admin/traction` (source: `lib/compliance.ts`) so investors can see it in the deck summary; update it whenever counsel's advice changes.

**Paying other members' shops and sessions with NotesApp Credit (no transfers).**
- NotesApp Credit is just another way to fund checkout, like a card. The buyer's balance is debited into the platform's escrow (the same held-until-delivery or after-the-session flow used today), and the seller or publisher is later paid by **bank payout** from the platform, minus our commission. The seller never receives wallet money, so no balance moves from one member to another.
- Seller earnings stay a payout ledger paid to a bank account; they are not credited to the seller's NotesApp Credit. (If we later let people spend earnings on calls, boosts or badges, that is a conversion on our own services, not a transfer.)
- At checkout: "Pay with NotesApp Credit" shows only when the balance covers the price (cash balance only: Bonus Credits never pay for shop items or sessions). If it falls short, show "Top up ₦X more" and then pay. Refunds on wallet-paid orders go back to the buyer's wallet as cash balance.
- Build: a NotesApp Credit option in the existing checkout (`/api/paystack/initialize` and its siblings) that debits the balance in one transaction, writes the payment as paid and runs the same confirmation, ledger and payout steps as a card payment. The idempotency key is the payment reference.

**Never spend twice (ten devices, one balance).**
1. A balance only changes on the server. Browsers and apps can ask for a spend; they can never write a balance (Firestore rules: no client writes to wallet data).
2. Every spend, transfer and top-up is one Firestore *transaction*: read the balance record, check `balance >= amount`, subtract, and append a ledger entry, all together. Firestore makes concurrent transactions on the same wallet take turns, each re-reading the latest balance. With ₦2.5m and ten devices each spending ₦1m at once, two succeed and the other eight fail with "insufficient funds".
3. Money is whole kobo integers, the ledger is append-only, and the balance is derived from it. Refunds are new reversing entries, never edits. A nightly job re-adds the ledger and flags any wallet whose balance doesn't match.
4. Bonus Credits and NotesApp Credit are separate buckets; the server decides which to spend from and enforces what each can pay for.

**Never charge twice (the connection drops after paying).**
1. Every spend carries an idempotency key made when the member taps Pay and saved on the device before the request is sent. The server stores the key with the result inside the same transaction as the debit. A retry with the same key gets the original result back and is never charged again; the same key with a different amount or target is rejected.
2. When the app reopens or the network returns, it first asks "what happened to key X?" and shows "checking your payment…", never an enabled Pay button that would make a new key.
3. The strongest guard is on the business action itself: a unique reference per thing being bought (the call id and minute number, the boost id, the order reference). The server refuses a second charge for the same reference even if a client invents a new key.
4. Calls reserve a small block of credit up front (a hold), bill each minute once (call id + minute number), and release what is unused. Holds expire on their own if the app crashes.
5. Top-ups only credit NotesApp Credit from the payment provider's verified confirmation, keyed by the payment reference, using the same "pending to paid exactly once" step the payments code already uses for orders and plans.
6. There are no transfers between members. Every debit sends a notification, so an unexpected one is noticed quickly, and larger payments from NotesApp Credit can ask for a PIN or code.

## Paylony integration (in progress)

Paylony is being added for **bank payouts** and **virtual accounts** first; Paystack stays the main provider for card checkout, refunds, plans and subscriptions until Paylony offers them. Code: `lib/paylony.ts` (client), `/api/paylony/webhook`, `/admin/paylony` (connection test and the events received).

**Environment variables** (Vercel; never commit or paste them): `PAYLONY_SECRET_KEY` (`sk_test_…` or `sk_live_…`), `PAYLONY_WEBHOOK_KEY` (the Bearer token Paylony sends us on webhooks), `PAYLONY_ENCRYPTION_KEY` (signs payouts).

**From Paylony's public API pages:** base URL `https://api.paylony.com/api/v1`; every request carries `Authorization: Bearer <secret key>`. Collections, BVN checks and queries are on by default; bank transfer (payout) access is enabled by Paylony support per business. Payouts must be signed: arrange the payload parameters alphabetically, compute an HMAC-512 with the encryption key, and send the result in a `Signature` header. Endpoints we have documentation for: `GET /wallet_balance`, `GET /fetch_transfer_details/{reference}`, `POST /account_bvn_match`, `POST /bvn_verification`, `GET /bvn_history`. Webhooks (up to 10 retries): `collection` (money paid into a reserved account: `receiving_account`, `amount`, `fee`, `sender_*`, `trx`, `reference`, `customer_reference`) and `payout` (a transfer we sent changed state: `account_number`, `bank_code`, `trx`, `reference`, `statusMessage`). We must answer the plain text `success`; for instant settlement Paylony settles only after that answer, so we answer it only after the event is stored. Status codes are in `PAYLONY_CODES` (`00` success, `10` insufficient wallet balance, `13` bank transfer access denied, `22` invalid signature, `96` refunded, `99` possible duplicate).

**Endpoints now known (from Paylony's exported collection):** `POST /bank_transfer` (`account_number`, `amount`, `bank_code`, `narration`, `reference`, `sender_name`; `Signature` header; `reference` is chosen by us and unique per transaction, so it is our idempotency key), `GET /fetch_transfer_details/{reference}`, `GET /fetch_all_transfers`, `GET /bank_list`, `POST /account_name` (`bank_code`, `account_number`), `POST /create_checkout_account` (a one-time virtual account for one payment: `name`, `email`, `amount`, `currency`, `reference`, `phone`, optional `title`, `description`), `POST /create_account` (a permanent dedicated virtual account for a customer, with a provider choice and BVN/NIN limits), `GET /fetch_account_details/{id}` and `/reference/{reference}`, `GET /transaction_verify/{trx}`, `POST /refund` (`trx`, `note`; sends the money back to the account that paid), `GET /refund_status/{reference}`, `GET /check_fees`, `GET /resend_hook/{reference}`.

**Built so far:** the client for all of the above except the permanent-account and refund calls, the webhook, and an admin page (`/admin/paylony`) with a connection test and test-key-only tools: bank list, account-name check, a *signature test* (sends ₦100 test transfers using each candidate signing format until Paylony stops answering "22 invalid signature", then saves that format in `paylonyConfig/main`), and a test virtual account to show Paylony's reply.

**Decisions made, and how each is built:**
1. **Full account numbers are stored, encrypted** (decided). AES-256-GCM with `ACCOUNT_DATA_KEY` (base64 of 32 random bytes: `openssl rand -base64 32`; only in Vercel's environment; losing it means publishers re-enter their numbers). The ciphertext is in `payoutSecrets/{uid}`, which no client can read. Saved when a publisher adds or changes a payout account; accounts added before this have no stored number until the publisher saves the account again. The Privacy Policy and the compliance register (`lib/compliance.ts`) say so.
2. **Two bank codes per account** (decided). `bankCode` is Paystack's; `paylonyBankCode` is found by matching the bank's name against Paylony's `/bank_list` when the account is saved (`lib/paylony-banks.ts`). No clear match means no Paylony code, and that account is paid through Paystack.
3. **A switch chooses the provider** (decided): admin → Paylony → "Pay publishers through" (default Paystack, kept in `paylonyConfig/main`). Switching to Paylony is refused until the signing format has been verified and `PAYLONY_ENCRYPTION_KEY`, `ACCOUNT_DATA_KEY` and the secret key are set. Paylony is used only for an account that has the encrypted number and a Paylony code.
4. **Failure handling** (built and tested). Our payout reference (`payout_<ledger id>`, then `_r1`, `_r2` after a failed attempt, since Paylony won't reuse a failed reference) is Paylony's idempotency key. A definite refusal (codes 07, 10, 11, 13, 15–25 except as noted) falls back to Paystack. An accepted answer, an "09 already exists", or any unclear answer or network failure is never retried elsewhere: the payout stays "transferring" and is settled by asking Paylony about that reference (`reconcilePaylonyPayouts`: on every payout webhook, every scheduled run, and the admin's "Check waiting payouts now").
5. **Still to verify with real Paylony replies:** the shape of `fetch_transfer_details` (the code looks for `statusMessage`, as in the payout webhook, and leaves anything it can't read untouched), the shape of `/bank_list`, and the signing format (admin Signature test). Run the test tools with the test key before switching.

**Build order from here:** (1) run the bank list, name check and signature test with the test key and confirm the reply shapes; (2) a test payout end to end with the test key; (3) switch real payouts to Paylony in the admin; (4) bank-transfer checkout and NotesApp Credit top-ups with checkout virtual accounts, matched by `receiving_account` and confirmed with `transaction_verify`.

## Planned: #1MillionNairaNotesAppChallenge (influencers) — not built

Public page: `/challenge`. Rules as decided so far:
- Unlock: 100k views and 10k followers turns on the LIVE video button (live video itself is not built; it depends on the Daily work above).
- Trigger: 2,000 *registered member* viewers in one live (not cumulative across lives).
- Giveaway of ₦1,000,000: ₦250,000 Bonus Credits shared among followers watching live, chosen by the influencer; ₦250,000 NotesApp Credit to the influencer; ₦500,000 withdrawable cash to the influencer's bank.

Decided: all views, followers and live audiences are counted and checked for fake accounts, bots and self-viewing; each influencer can win once; the founder funds it from personal funds (not stated publicly); identity and tax checks are required before the ₦500,000 payout; Bonus Credits for followers are ₦5,000 minimum and ₦25,000 maximum each (so the ₦250,000 reaches 10 to 50 followers) and carry the usual Bonus Credits limits (calls, advert banner payments, boosts and badges only).

Opening is automatic: when a live started by an unlocked influencer reaches 2,000 counted viewers (rules below), the giveaway for that live opens by itself, with no admin step. "First 10 to qualify each month" is decided by the time the live reached 2,000 counted viewers. Also decided: first 10 influencers to qualify each month are paid (cap of 10 per month, one win per influencer ever); a viewer counts after 5 minutes of watching; identity check through Dojah (NIN plus face match, the same check as the gold identity badge, `lib/dojah.ts` and the personal widget) before the ₦500,000 payout. Every winner also gets 1 month of the identity-checked gold ✔ badge free (gold is ₦1,999/month, and its identity check is the same Dojah NIN and face match, so the payout check also satisfies the badge). The one-off identity deposit is waived for the influencer. Followers get the maroon ✔ instead (below).

Follower picks: the influencer chooses from a ranked list of followers who watched at least 5 minutes, ordered by their activity in the last 5 minutes of the live: most shares first, then most likes, then most comments. The influencer cannot pick their own accounts or accounts linked to them (see below).

Counting and fraud checks (recommended method; confirm before building):
- A counted viewer is a signed-in member with a verified email, an account at least 7 days old when the live starts, and a followed or unfollowed state recorded before the live (no follow-then-vanish). New accounts that appear right before a live do not count.
- Watch time comes from the server, not the app: the player sends a heartbeat every 15 seconds, and 5 minutes means 5 minutes of heartbeats, with the tab or app in the foreground and the video playing. One active session per account; a second session pauses the first.
- One counted viewer per device and per household network: a device fingerprint (the same one used for view-only items) and an IP range may count for at most 3 accounts, and the rest are not counted.
- Self-viewing and linked accounts: excluded if the account shares a device, payout bank account, phone number, recovery email or card with the influencer, or was created through the influencer's own invite link within 24 hours of the live (invite signups count, but are flagged for review rather than excluded).
- Bot signals: each account gets a score from the points below. 0 to 2 counts. 3 to 4 counts but is flagged in the admin queue. 5 or more is held out (not counted, listed in the queue). Points: disposable or temporary email domain 5; unverified email 5; same device as more than 3 accounts 3 (the fourth and later are held out); more than 5 accounts from one network range (/24) signed up within 24 hours 2; part of a burst of 20 or more signups from the influencer's link within 10 minutes 3; no name or photo and no activity other than following and watching 2; watch times identical to within a second across 50 or more accounts 3; more than 5 likes, shares or comments within 10 seconds 2; the same comment text posted 3 or more times in one live 2. Only accounts scoring 0 to 2 can appear in the influencer's follower pick list. Live-level safeguard: if more than 25% of an influencer's counted viewers or new followers are flagged or held out, the live goes to manual review and every payout waits; if more than 50% are held out, the influencer is paused pending review and may be disqualified. All of these numbers are config values (one file), not code, so they can be tuned from real data without a release.
- New followers only (decided): the 10,000 followers must be new registrations to #NotesApp, not existing members. How: the influencer enrols and gets a personal sign-up link (the existing invite mechanism); a follower counts only if their account was created after the enrolment date, through that link or by following the influencer within 24 hours of signing up, and it still passes the viewer test (verified email, at least 7 days old when counted, not a bot or duplicate). Existing members who follow later are not counted towards the 10,000, though they can still watch lives and be picked for the giveaway. Decided: the 100,000 views count all-time, including views from before enrolment (there is no after-enrolment rule for views), and there is no deadline: it is first come, first served, with the first 10 influencers to qualify each month paid.
- Followers: counted only when the account passes the viewer test above; the 10,000 follower and 100,000 view bars use the same rules, counted once per account.
- Review after the fact (decided): the giveaway opens automatically, and every winning live is also written to an admin review queue with the counts, flags and removed accounts. Payout timing: each chosen follower's Bonus Credits share (₦5,000 to ₦25,000) and a free 1-month personal maroon ✔ are granted automatically once that follower is Dojah NIN and face match verified: at once if they already are, otherwise as soon as they pass it. They can later upgrade to gold with their Bonus Credits (badges are an allowed spend). Eligibility does not require being Dojah verified beforehand: every follower who watched 5 minutes and passes the bot and fraud checks can be picked; verification only gates the grant, within the 30-day window. Only the influencer gets the free gold ✔ month. Every prize has a 30-day claim window from the day it is awarded; an unclaimed prize expires and the amount returns to us; the influencer's ₦250,000 NotesApp Credit and free identity-checked gold ✔ month are granted automatically once the influencer passes the Dojah check, within the same 30-day window; the ₦500,000 cash waits for the Dojah check and a 7-day hold so late fraud flags can still stop it. An admin can cancel any unpaid prize.
- Disqualification: attempts at fake accounts, bots or self-viewing disqualify the influencer, with the reason recorded.

Challenge dashboard (decided): an influencer's public followers list stays exactly as it is for everyone. Separately, each enrolled influencer gets a private challenge dashboard (their eyes only) showing: qualified new followers against the 10,000 bar; all-time views against the 100,000 bar; whether LIVE video is unlocked; for each live, counted viewers (5 minutes or more) against the 2,000 bar and the best single live so far; this month's slots ("3 of 10 taken") and their position in the queue; prizes with status and the days left in each 30-day claim window; the Dojah check status; and a count of accounts "not counted" (a number only). The dashboard never shows individual fraud scores, signals or the reason an account was not counted, so it can't be used to learn how to get around the checks. Admins see everything in the review queue.

Still open: VAT and tax treatment of the prizes (see the VAT and tax entry in the compliance register; waiting for the accountant). Nothing in the challenge is built yet; it all depends on live video.

## Scaffold: Moments and direct messages (built, switched off)

Moments are short-lived pictures, videos or text that sit on top of a member's profile picture (like WhatsApp Status). Replies go to a direct-message inbox, so both were built together. Nothing shows until you switch them on.

**Switches (Vercel env vars, then redeploy):** `NEXT_PUBLIC_MOMENTS_LIVE=true` turns on Moments and messaging; `NEXT_PUBLIC_MESSAGES_LIVE=true` turns on messaging alone. Also run `firebase deploy --only firestore` once (new rules).

**Decided (from the founder):**
- Name: **Moments**. Hint text in the box: "Share your moment with your followers".
- Duration: 24 hours by default; the member can choose 48 or 72 hours.
- Content: a picture, a video up to 90 seconds, or text only. Voice-over on top is wanted (see "not built yet").
- Viewers can like, reply or reshare. Everything disappears when the time is up.
- A reply goes to the owner's inbox as a direct message and stays there, with a note ("Replied to a moment that has expired") once the moment is gone. The moment itself can no longer be opened. The message keeps only the moment's id and expiry, never its content.
- A reshare lands on the resharer's own ring for the rest of the original's time, never longer.

**What was built:**
- `lib/moments-rules.ts` (constants, flags), `lib/moments-server.ts` (create, feed, ring, like, view, reshare, reply, delete, expiry sweep), `lib/messages-server.ts` (send, inbox, thread), API routes under `app/api/moments` and `app/api/messages`, picture upload through `/api/upload` (purpose `moment`), video through `/api/video` (purpose `moment`).
- Audience: the owner and members who follow the owner's journal. Expired, missing and not-allowed all answer "not available". Moments, likes, views, usage and blocks are server-only in `firestore.rules`; conversations and their messages can be read by the two members only and are never written from a browser.
- Limits: 10 new moments per member a day (Lagos time), email verified to post or send, suspended accounts can't post or send, 2,000 characters a message, 20 messages a minute, a block (`dmBlocks/{recipient}_{sender}`) looks like "member not found".
- Clean-up: the scheduler (`/api/cron/reminders`) deletes expired moments, their likes and views, and their files. Reads already refuse expired ones, so a late run only costs storage. Optional belt and braces: turn on Firestore TTL for the `expireAt` field on `moments` and its `likes` and `views`.
- UI, only when switched on: a ring and an add button on profile pictures, a viewer (like, reshare, reply, delete), a composer (text, picture, video, 24/48/72 hours), a Message button on profiles, `/messages`, `/messages/[id]` and `/messages/new?to=username`, and a Messages link in the account menu.
- Tests: rules tests (41 pass) and a server test against the Firestore emulator that covered create, limits, audience, expiry, likes, views, reshare, replies and expired references, blocks, suspension, deletion and the sweep.

**Built since (founder, 8 October):**
- Voice-over: record in the browser (up to 90 seconds, WebM or MP4 audio), uploaded through `/api/moments/audio` (type, size, length checked, first bytes verified), played over the picture, video or text. Unused recordings are removed after two days.
- Reply and message notifications: a bell for a new message or a reply to a moment, one per burst (nothing new while the last is still unread), and an unread count beside "Messages" in the menu.
- Block: from a conversation. A block works both ways: neither of you sees the other's moments or can message the other; the person blocked sees "member not found", and a blocker must unblock before messaging.
- Report: on a moment (in the viewer) and on a conversation. A report keeps a copy of what was reported (a moment's details and files, or the last 20 messages) until someone looks at it; `/admin/reports` lists open reports with that copy. Dismiss clears it; Actioned also removes a live reported moment. Resolving deletes the copy and the kept files (unless another open report still needs them). Reported moments are not deleted at expiry until their report is resolved.
- A reshare of a reshare is allowed. It points at the original, ends when the original ends, and deleting the original removes the whole chain. You can't reshare something that began as your own moment.
- A moment is visible to followers and the owner only (no public option).

**Not built yet (next steps):**
- Live updates (the inbox polls every 10 seconds today), typing and read receipts, deleting a single message.
- Who has seen a moment (viewers list for the owner; view counts are stored).
- Email for messages (bell only for now), push notifications on mobile.
- Audio and video calls inside conversations (separate decisions in the calls section above).

**Decided (founder, 7 October):**
- Video moments are limited by plan, like post video, but counted separately: Free Standard 0, Basic 2, Pro 7, Business 14, Enterprise 30 a week (pictures and text are free for every verified member). A rejected upload gives its slot back to the moment counter, never the post-video one.
- Moment files stay in the public media bucket under a hard-to-guess path until they are deleted. Accepted for 24 to 72 hours.
- Privacy text drafted: the Privacy Policy has a "Moments and direct messages" section, the "What we collect" paragraph mentions them, and the data-protection register entry lists the controls and the to-do (add them to the record of processing before launch). Account deletion now removes a member's moments and files and the messages they wrote (a thread nobody else wrote in goes entirely); the data download includes live moments and sent messages. LEGAL_VERSION was not bumped because the features are off: bump it on the day Moments or messages go live so everyone re-accepts.

**Still open:**
1. Counsel reading the new Privacy Policy section before launch (founder: OK).
2. Who handles `/admin/reports` day to day, and how fast we promise to look (suggest: within 24 hours for anything flagged nudity or violence).
3. Each open report has a length picker and a "Suspend @user" button: after a confirm it suspends the reported member (your note, or the report reason, is what they are told), notifies them, and marks the report actioned (removing a live moment and the kept copy). Admins can't be suspended this way. To warn or to unsuspend, use the Users page.

## Messaging, notifications and review: how they run (founder decisions, 7 October)

- **Live inbox:** the inbox, the conversation and the unread count beside "Messages" now update live (they listen to the member's own conversations, which `firestore.rules` let only the two people in each one read). No more polling.
- **Notifications for a new message or a reply to a moment:** a bell, an email (**off by default; Business and Enterprise only** (`messageEmails` in `lib/tiers.ts`); a member must switch it on under Messages; at most one an hour per member across all conversations, so it can't eat the email quota) and a device notification (web push, opt-in per device). None carries what was written, only who it's from. One of each per burst (nothing new while the last message is unread).
- **Switch on device notifications:** run `npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:` address) in Vercel and redeploy. Without them the button doesn't appear and /status shows "Device notifications" as not enabled. Works on Android Chrome and desktop browsers; on iPhone the site has to be added to the home screen first.
- **Moment viewers:** the owner can see who viewed a moment (each person once, newest first) by tapping the view count.
- **Reports are reviewed by the founder's team.** Promise: anything marked nudity or violence within 24 hours. `/admin/reports` shows those first, with an "URGENT / OVERDUE" badge, and one digest email a day (about 8am Lagos, sent by the reminders cron, only when reports are open; subject starts URGENT when nudity/violence is waiting) goes to `REPORTS_EMAIL` instead of one email per report, to save the free email quota. Nudity and violence reports are the exception: those email `REPORTS_EMAIL` straight away (subject `URGENT: ...`), because of the 24-hour promise. The admin dashboard has an "Open reports" card (open count, urgent, overdue; amber when something is urgent, red when something is past 24 hours). The Terms (2b) say we aim to review those within 24 hours.
- **Suspension length.** Admins pick 1 day, 3 days, 1 week, 2 weeks, 1 month, 3 months, 6 months, 1 year, or until they lift it (Users page and the report button). The end is stored as `suspensions/{uid}.until`; the reminders cron job `liftExpiredSuspensions` reactivates the account and notifies the member (so it can lag by up to one cron interval). The member's profile and notification say when it ends. Appeals work as before.
- **Suspend from this report: done.** See point 3 above. The audit trail is `suspensions/{uid}.suspendedByUid` plus the report's `resolvedBy` and `resolutionNote`.

## Enterprise full white label: sign-in and sign-up (built)

On an Enterprise member's own domain, `/login`, `/signup` and `/forgot-password` no longer go to the #NotesApp page. Middleware rewrites them to the member's home page with a branded window (`components/site/SiteAuth.tsx`): their logo and name, headed "Sign in with a NotesApp account" or "Sign up with a NotesApp account". Business domains keep the main-site page and hand-off.
- Sign-up creates the NotesApp account on the domain itself (same profile, consent version and starting follows as the main page, plus a follow of the site's owner); no five-journals step.
- Password reset and email confirmation go out through `/api/auth/branded` in the member's name and logo (the sender name is theirs; the address is still ours), and their links open `/auth/action` on the member's domain, so nobody lands on a #NotesApp or Firebase page.
- Not done yet (listed on the roadmap): Google sign-in in the window (needs each domain added to Firebase's authorised domains; a Google-only member sets a password with "Forgot your password"), checkout and bookings still open on #NotesApp (the visitor has to sign in there once more; the fix is the Paystack popup plus a session hand-off the other way), a sending address on the member's own domain (SPF and DKIM through Resend), and a sweep of error pages. Do these as one piece of work before promising "nothing says #NotesApp".
- Env: none new. Firebase's web API key must allow the member domains (the existing hand-off already depends on this).

## Longer videos in Moments (built, 7 October)

A moment's video is up to 90 seconds. A longer video (up to 10 minutes and 100 MB) is no longer refused: the composer reads its length, asks how many video moments the plan has left this week (`POST /api/video {action:"quota", purpose:"moment"}`) and tells the member what will happen before they press Share.
- Room for every part: the video is cut into equal parts (none over 90 seconds), shared as separate moments in order ("Part 1 of 3" or the caption with "(1/3)"), each using one of the weekly video moments. A voice-over goes on the first part.
- Room for fewer parts: only the first 90 seconds of each part there is room for is used; the rest is left out, and the member is told. No room at all: nothing is shared (as before).
- No trimming or re-encoding happens: the file is uploaded once and each moment plays its own stretch (`clipStart` to `clipEnd`); the viewer seeks to the start and moves on at the end. So there is no load on the phone and no server video processing. The cost is that the whole file is stored (up to 100 MB) until the last part expires.
- The parts share one file: the first owns it; deleting or expiring a part passes ownership on, and the file goes with the last part. A rejected upload gives back every part it was granted.
- Weekly allowance by plan stays 0 / 2 / 7 / 14 / 30 (Free Standard / Basic / Pro / Business / Enterprise). Open: should the allowance count parts or uploads? (Today: parts, one per moment, so a 3-part video uses 3.)



## Messages: formatting, read receipts, files (v0.8.0) and plan limits

- **Formatting.** Typed as plain text so it can't carry HTML: `**bold**`, `_italic_`, `__underline__` (they combine). The B / I / U buttons and Ctrl/Cmd+B/I/U add the marks around the selection; Enter sends, Shift+Enter is a new line. Parsed in `lib/message-format.ts`, rendered as React text by `components/messages/FormattedText.tsx`; the inbox preview strips the marks.
- **Sent and read times.** Every message shows its sent time with a single tick; the sender also sees a double tick and the time the other person opened it (`readAt`, stamped by `stampRead` in `lib/messages-server.ts` when the recipient opens the conversation; `conversations.readMarker.<uid>` makes each message get its time once). Live, because the thread listens to the messages.
- **Files.** Pictures, videos, PDFs, Word/Excel/PowerPoint, text, CSV and zip (`ATTACHMENT_EXTENSIONS` in `lib/messages-rules.ts`; nothing that can run). Flow: `POST /api/messages/attachments` checks the type and the plan's limits and returns a presigned PUT to the **private** bucket (`R2_PRIVATE_BUCKET`, the same one the digital store uses; needs its CORS to allow PUT from the site); the message is then sent with `attachmentIds`, and the server HEADs each file to confirm it arrived and matches. Files are shown through `GET /api/messages/file`, which only hands a short-lived signed link to the two people in the conversation. Uploads never sent are removed after a day (`sweepMessageUploads`, in the reminders cron); an account deletion removes the files that member sent.
- **Limits by plan, set by admins.** `/admin/limits` (a button on the admin dashboard) edits the numbers for each plan: largest file in a message, files per message, video moments a week and new moments a day. They are stored in `serverConfig/limits` (server-only) and read through a 30-second cache, so a change is live sitewide within about half a minute. The defaults and ranges are the `LIMITS` list in `lib/limits.ts`; to put another number under admin control, add a row there and read it with `limit(db, key, tier)` where it is enforced. `GET /api/limits` returns the current table for showing limits in the app.
- **Moments viewer.** One bar per moment; the maroon part is what has played (video: its playback position within its clip; pictures and text: time on screen). Fixed along the way: the bars' timer no longer carries one moment's progress into the next.

- **Device notification keys are checked (v0.8.4).** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be the 87-character **Public Key** that `npx web-push generate-vapid-keys` prints (not the Private Key, no quotes, spaces or line breaks), `VAPID_PRIVATE_KEY` the 43-character Private Key, and `VAPID_SUBJECT` a `mailto:` address. A wrong public key makes the browser fail with "The provided applicationServerKey is not valid". The server now trims stray quotes and whitespace and checks the shapes (`vapidPublicKey`, `vapidPrivateKey`, `pushProblem` in `lib/push-server.ts`); if they are set but wrong, `/status` shows Device notifications as down and says which setting to fix, and the button stays hidden.

## Voice notes, stickers and the challenge graphic (v0.9.0)

- **Voice notes.** A microphone (dictate) button sits just before Send in a conversation. Tap to record, ■ Stop to attach (or × to cancel); it stops by itself at the limit, **5 minutes** by default, and is attached like any file (so it counts toward "files in one message" and the plan's file size). Recorded in the browser (WebM in Chrome/Firefox, MP4 in Safari, `.weba` / `.m4a`), uploaded to the private bucket through the same flow as other files, and played with an audio player in the thread. The longest voice note is a row in `/admin/limits` ("Longest voice note", 10 to 900 seconds, per plan). Known limit: a WebM voice note may not play in an older Safari/iPhone; MP4 notes recorded by Safari play everywhere.
- **Stickers.** A Stickers button opens the #NotesApp icon marks from `/brand` (`lib/brand-marks.ts`: the two icon versions the eight seasonal marks and the #1MillionNairaNotesAppChallenge artwork, so a new mark added there is a sticker too). Tapping one sends it as a message of its own: only its id is stored (`sticker`), the server refuses any id not in `lib/stickers.ts`, and nothing is uploaded.
- **Brand page.** The #1MillionNairaNotesAppChallenge artwork is shown (and downloadable) on `/brand` under "Campaign graphic": `public/images/brand/challenge-graphic.webp`.

## Notifications on by default, public pages brought up to date (v0.9.2)

- **Device notifications default to on.** A browser lets a site turn notifications on only with the person's permission, so "on by default" works like this (`components/messages/PushPrompt.tsx`, mounted in the main layout): a device that has already allowed notifications is subscribed automatically; one that hasn't been asked sees a one-line offer (Turn on / Not now; "Not now" asks again after a week). A person who turns them off in Messages is never re-subscribed on that device (the choice is kept in that browser: `lib/push-client.ts`). Needs the three VAPID settings; without them nothing is offered.
- **Rates & payouts page:** Earnings now sits directly under "Your plan".
- **Stickers:** the #1MillionNairaNotesAppChallenge artwork is in the pack (shown larger in the thread).
- **Public pages updated:** Privacy (who can see moments and how to change it, voice notes and files, stickers, read times, device notifications), Terms 2b (visibility choice, files, voice notes, stickers, limits as shown on Pricing), Trust & security (private message files, moments audience, timed suspensions and the 24-hour report promise), Pricing (live per-plan rows: files in messages, voice notes, moments; read from the admin-set limits every minute), home page and roadmap. LEGAL_VERSION was **not** bumped; bump it if you want everyone to re-accept the updated Privacy Policy and Terms.
## Moments card on /journals and Moments privacy (v0.9.1)

- **The card.** `components/moments/MomentsStrip.tsx` sits on `/journals` between the boosted posts and the sponsored ad card, laid out like WhatsApp's Status row: your own tile first (your rounded-square picture with a + to add a moment; tapping it plays your moments), then a tile for each member you follow who has a moment up (gradient ring, name, and a preview of their newest picture or text). Data comes from `GET /api/moments`, which now also returns `me` and each group's `displayName` and `avatar`. Signed-out visitors and sites with Moments switched off see nothing. **Live video:** when live video is built, live streams should be added to this row (a tile with a LIVE mark) and to the profile ring; nothing for it exists yet.
- **Who can see moments.** Followers only by default. Each member can choose **Everyone** in `/profile/edit` ("Moments privacy", `userPrefs/{uid}.momentsPublic`, `GET/POST /api/moments/prefs`): any signed-in member who isn't blocked can then open their profile ring, like, reply and re-share. The strip itself still lists only people you follow. A block always wins.
- **Channels on /journals.** The first channel card is labelled "NotesApp Premium channel" and the second "Public Channels"; the organisation channels (as on the Channels tab) are listed directly under the second card (the two official channels are the cards above, so they aren't repeated).

## Hero artwork, wordmark sticker, legal version (v0.9.3)

- The challenge artwork sits on the right of the home-page challenge banner (`components/ChallengeHero.tsx`) and links to `/challenge`; the full wordmark (`notesapp-logo-full.webp`) is a sticker (`WORDMARK_MARKS` in `lib/brand-marks.ts`); the roadmap's challenge item links to `/challenge`.
- **LEGAL_VERSION is now `2026-10-08.2`** (it is compared as a plain string): everyone has to accept the updated Privacy Policy and Terms before their next payment.

## Conversation look: avatars, badges, day dividers, replies, avatar menu (v0.9.5)

- **Thread layout** (`components/messages/Thread.tsx`): the other person's messages on the left, yours on the right, as before, now with a rounded-square picture beside every bubble, the name and badge (maroon or gold ✔, via `getUserByUid`, `badgeLevel`, `goldKindOf`) above the first message of each run (same person within five minutes), and a TODAY / YESTERDAY / date divider whenever the day changes. Received bubbles are white cards with a hairline (they used to vanish into the page colour).
- **Reply to a message:** "↩ Reply" in each bubble's footer puts a quote bar above the box; the reply shows "Name: the start of the message" with a bar, and tapping it scrolls to the original. Stored as `replyTo: { id, from, text }` (a 140-character copy, formatting stripped; attachments and stickers are named, e.g. "🎙 Voice note"); the server checks the quoted message exists in that conversation (`replyToId` in `POST /api/messages`).
- **Badges in the inbox** now show beside names too.
- **Picture menu** (`components/ProfileAvatar.tsx`): tapping someone's picture in a chat, a journal (author, directory cards) or a comment asks what to do: View profile; View moments (only when they have one up that you may see); and, away from a chat, Send a message. Signed out, it goes to the profile.
- Also fixed: `Avatar` kept the "failed" fallback after an empty first `src`; it now retries when `src` changes.

- **Emoji button (v0.9.8):** a 😊 button before B / I / U in the message toolbar (`components/messages/EmojiPicker.tsx`, 64 everyday emojis, no flags or skin tones because those draw badly on some devices). Picking one inserts it at the cursor.

## Vercel deployment storage

Every deployment (a production build for each merge to `main`, and a preview for each push to a branch) keeps its own copy of the build in Vercel until deleted, and the Hobby plan caps Functions Storage at 10 GB. `vercel.json` therefore turns off automatic deployments for branches named `claude/*` (the working branch used for pull requests), so pushes there no longer build a preview; merging to `main` still deploys to production as before. Consequences: pull requests from those branches have no Vercel preview link (CI, the `checks` job, still runs on every push), and fewer, bigger pull requests mean fewer production deployments too. Also set **Deployment Retention** (project Settings, Security) and delete old preview deployments from the Deployments page.

## Planned: domain sales and DNS management via Whogohost (go54) — not built

Decisions (founder, 8 October): the member is the registrant and owns the domain; no extra `.ng` or `.com.ng` documents beyond the four standard contact blocks; Business and Enterprise only. The registration flow suggests profile data for each of the four blocks (registrant, admin, technical, billing), asks before using it, requests missing fields, and offers to copy a finished block into the next. `/domains` is the public page (with the Whogohost gold partner badge in `public/images/partners/`), and the roadmap lists it.

Built so far: `lib/whogohost.ts`, a server-only client for the reseller API (signing, form encoding, typed calls for pricing, TLD list, DNS, nameservers, contact, lock, EPP code, register, renew), and `GET /api/admin/domains`, an admin check that returns the service version, the reseller credit balance and the TLD list. The token is `base64(hex(HMAC-SHA256(data = api key, key = "<email>:<UTC yy-mm-dd HH>")))`, as their sample shows; it changes every UTC hour and a failed call is retried once. Whogohost confirmed (9 October) that they have **no domain-lookup API**: availability has to come from a third-party source (`lib/domain-lookup.ts`: RDAP, which answers 200 for a registered name and 404 for none; `.ng` names go to `https://rdap.nic.net.ng`, other extensions through the IANA RDAP bootstrap; "unknown" when the registry can't be reached; the registration call is the final word, with an automatic refund if it refuses). The admin page has a "Check a name" box to compare its answers with names you know. Still to confirm with Whogohost: whether a test mode exists. Known now: a DNS record is `{ hostname, type, address, priority, recid }`; a contact block uses `postcode` (we also send `zipcode`) and every field but `address2`, including `companyname`, is required; the Whogohost API settings page has an **IP restrictions** list (single IPs only, no ranges) — leave it empty unless calls come from a fixed IP. Not built yet: the forms, payment, the DNS editor and the page for members.

Decisions (9 October): members pay us in Naira through Paystack, then we register from our Whogohost credit; our price is Whogohost's price plus **20%**; no IP restriction is set on the Whogohost side (Vercel Hobby has no fixed outgoing address; the hourly token and the key protect the calls). **Fixed address (9 October):** Whogohost limits some actions to listed IPs (single addresses, no ranges), and Vercel's outgoing address changes. Set `WHOGOHOST_PROXY_URL` (`http://user:pass@host:port`, Sensitive, Production) to send every Whogohost call, and only those, through an HTTP proxy with a fixed address (a static-IP proxy service such as QuotaGuard Static or Fixie, or your own small server running a proxy); `lib/whogohost.ts` uses `undici`'s `ProxyAgent`. `/admin/domains` shows the address the calls leave from — give exactly that to Whogohost under IP restrictions. Providers that give two addresses need both listed. The key and the hourly token still never leave Vercel.

The connection is scanned at `/admin/domains` (admin: connected or not, which settings exist, version, credit, extensions, with a Scan now button), and shows on `/status` as "Domain registration" once both settings exist (it reads our credit, which costs nothing; `/version` was refused with "Action is not allowed … Your IP is …" while credit and the TLD list worked, so some actions seem to be limited by IP — ask Whogohost which, before building register, renew and DNS).

Originally waiting on: the availability and price call, the DNS record read and save calls, and the HMAC `token` order. The reseller email and API key will go in new Vercel environment variables; never paste them into chat or commit them. The client will attach to `lib/domains.ts`.

## Team hub (`/admin/team`, admin only)

Where the team sees what is moving, what is stuck and what needs a decision, plans the day and the week, and tracks milestones against the real platform numbers. Built 9 October as version one.

- **Work items** (`teamItems`): title, details, owner, status (To do, Doing, Blocked, Needs a decision, Done), when (Today, This week, Later) and an optional due date (Lagos date). Blocking needs "what is it blocked on"; asking for a decision needs "what has to be decided", and "Decided" records the answer. Today shows what is set for today, due today or overdue; This week the rest of the week and anything due in seven days; Done keeps seven days of history (items done more than 30 days ago stop loading). Rules in `lib/team.ts` (pure, tested), storage in `lib/team-server.ts`.
- **Needs you:** open decisions, blocked work, overdue work, plus the queues that already exist, read live: reports (with urgent and overdue), gold badge applications, organisations to verify, new contact messages and leads, disputed payouts and errors in the last 24 hours. Each links to its own page.
- **Milestones** (`teamMilestones`): a target on one traction number (members, paid plans, gold badges, publishers, sellers, organisations, sessions booked, store orders, paying customers, money processed) as growth since the start date or the running total, over any dates. Progress comes from the same figures as `/admin/traction` (`lib/traction-server.ts`, cached 60 s); the state is Hit, On track, Behind (never in the first fifth of the period), Missed or Starts soon.
- Everyone with the `admin` claim is "the team" (names come from their profile). Both collections are server-only in `firestore.rules` (covered by the rules tests); everything goes through `/api/admin/team`.
- **Meetings and the Team room (built):** `/admin/team` has a Meetings section. Scheduling a meeting (title, date and time in Lagos, agenda) creates the meeting's own room in the group chat with the whole team in it (the agenda is the first message, which rings everyone's bell). `/admin/team/meetings/<id>` shows the room beside the agenda, **decisions** (recorded, removable), **actions** (each becomes a work item on the board with the meeting's id), notes, Start/End and "Copy the summary" (plain text). The standing **Team room** (`conversations/team_room`) and every upcoming meeting room are kept in step with whoever has the admin claim, each time the hub loads. Collection: `teamMeetings`; code in `lib/team.ts` (`cleanMeeting`, `meetingSummary`) and `lib/team-server.ts`.
- **Comments (built):** every item has a Comments button (`teamItems/<id>/discussion`, a count on the item; not called `comments` because a subcollection with that name is world-readable through the collection-group rule for journal comments). The owner and the person who created the item get a bell (type `team`) unless they wrote the comment; you can delete only your own.
- **Morning summary (built):** the reminders cron (`/api/cron/reminders`, job `teamMorningSummary`) sends, from 07:00 Lagos time and once a day (`teamDigests/<date>` makes it safe to run every 15 minutes), each team member their day (their own items, overdue first), today's meetings, decisions and blockers waiting on the team, the review queues, running milestones and what the team finished yesterday. By email and/or the bell; each person chooses on the hub (both on by default, `userPrefs.teamMorningEmail` / `teamMorningBell`). Nothing is sent to someone with nothing to read. Built by `buildMorningSummary` in `lib/team.ts`.
- **Weekly review (built):** `/admin/team/review` (weeks run Monday to Sunday, Lagos dates; earlier and later weeks). It shows new members, payments and money processed against last week with six-week bars (counted from `users.createdAt` and `payments.paidAt`), the week's work (done, added, carried over, overdue, still blocked or waiting for a decision), the milestones that ran and the meetings held, and a form for what went well, what was learnt and next week's focus (`teamReviews/<Monday>`). "Add the focus lines to the board" turns each line into a work item for the week; "Copy the review" gives plain text; "Hold the review as a meeting" creates a meeting with the review as its agenda. Rules in `lib/team.ts`, storage in `lib/team-server.ts`.
- **Vision model (built):** `/admin/team/vision` (`lib/vision.ts` for the maths, `lib/vision-server.ts`, `/api/admin/vision`). A slider model of rounds, the staff pool, an optional dual-class vote, paper value and runway, with Worst case, Baseline and Vision presets. It opens **focused on whoever is signed in**: Emmanuel (the owner) sees his stake, vote and the founders' control; Chimdinma and Ifeyinwa (@ify; shown as Ifeyinwa Maureen on this page) see their own stake, value, vote and cash multiple with their row highlighted; Nora Bawa sees only her own option (1.50%, 150,000 of 10,000,000 shares) and the company's rounds, never the founders' split. Nobody else gets it (403). The starting split is served by the API to the people it concerns, not shipped in the page's code. The owner has a "View as" switch to check each person's view. Who is who: the owner is Emmanuel, others are recognised by username (@ify is Ifeyinwa Akujuobi), then the name on their account, or set `VISION_PEOPLE="chimdinma=a@x.com,akujuobi=b@y.com,nora=c@z.com"`. **New users arriving:** a slider adds a share of today's users each month as new payers (at the paying conversion) who churn like everyone else; growth equal to churn holds net revenue steady, and burn follows the growing user count. **User gates:** a round opens only when the users slider reaches its gate: Seed 1,000,000, Series A 10,000,000, Series B 50,000,000 (cross-country), Series C 200,000,000 (cross-continent: Africa, South America and Asia); locked rounds drop out of the cap table until then (a checkbox turns this off). The users slider is logarithmic (1,000 to 250 million) with one-click gate buttons, and each round shows value per user and its multiple of the net revenue those users bring. Monthly burn grows with users, but slower than users: ₦1,142,600 at 100,000 users, of which 70% (the team and operations part) grows as users^0.75 above that, never below it (about ₦4.8M at 1M users, ₦85M at 50M, ₦240M, about US$180,000, at 200M); the share and the exponent are sliders, and one-time expansion spend is a separate field taken once from the 12-month cash. Rounds link raise, share sold and post-money; a pool target after each round replaces a manual top-up. Nothing is saved; it is a planning tool, not a forecast. Paper value = stake × last post-money, with no liquidation preferences or tax.
- **Meetings for a team (built):** scheduling a meeting asks for a team (Everyone, a department such as Growth & partnerships or Finance, or Choose people) and ticks that team's people; the person scheduling then ticks or unticks anyone. Only the people invited are in the meeting's chat room, and only they (and the owner) see the meeting on the hub, in the weekly review and in the morning summary; older meetings with no list stay open to the whole team. The standing Team room is still everyone.
- **Decisions and actions picked out for you (built):** on a meeting page, "Nana: from the chat" reads the meeting room's recent messages and suggests decisions and actions (owners matched to team members, due dates only if stated), and "From my Granola notes" asks the person's own Granola account for that meeting's decisions and actions after it ends. Nothing is saved until the person ticks what is right. "Keep looking while the meeting is live" re-reads the chat every four minutes. Nana uses the person's own AI account, else #NotesApp's with its daily allowance. Code: `lib/meeting-extract.ts`, actions `suggestFromChat` and `suggestFromGranola` in `/api/admin/team`.
- **Drag and drop and paste (built):** `lib/useFileDrop.ts` lets a part of a page take files by drag and drop and by paste (a screenshot or files copied from the desktop). It is on the message composer (so DMs, groups, the Team room and every meeting chat), the money ledger's receipts, the store item photos and file, the journal and note editors (images dropped or pasted go in at the cursor; the featured image takes a dropped picture), the profile picture (drop or paste on the edit page) and both ad forms (the admin ad and an advertiser's new ad). Not on moments (kept off for now). **Passwords:** every password field (sign up, log in, admin log in, changing a password, member-site sign in, deleting an account, and the Nana API key) has an eye button to show or hide what was typed (`components/PasswordInput.tsx`).
- **Not built yet:** per-person views of work items, @mentions in comments, a Monday-morning weekly digest by email.

## Group chats (built 9 October; the team room first)

Groups are `conversations` documents with `kind: "group"`: `title`, `participants` (the members, so the same live listeners and security rules as direct messages apply), `adminUids`, `createdBy`, `scope` and, for a meeting, `meetingId`. Ids are `g_<hex>`, `team_room` or `meeting_<id>` (`isGroupId` in `lib/messages-rules.ts`), never the two-uids id of a direct conversation. Everything goes through `lib/groups-server.ts`; the browser never writes.

- **Messages** use the same composer as direct messages (bold, italic, underline, emoji, stickers, files, voice notes, replies) and the same plan limits. Each sender shows with their picture, name and badges. There are no read ticks in a group (it only clears your own unread count). A bell and a push (never carrying the text: "Name in Group title") go to each member who had nothing unread; no emails.
- **Scopes:** `team` (rooms and meetings: only people with the admin claim, created from the team hub, kept in step automatically; members can't be added or removed by hand) and `public` (any member's group, below).
- **Public groups (built):** any signed-in member with a verified email starts one from **+ New group** in the inbox (`/messages/new-group`: a name and usernames; `POST /api/messages/groups`, 5 an hour). In a group, the members panel (the "N members" link) lets an admin rename it, add people by username, remove people and make others admin; anyone can leave (`POST /api/messages/groups/<id>`). You can add only people you follow or who follow you, who haven't blocked you and aren't suspended; up to 50 members (`GROUP_MEMBERS_MAX`). A group always keeps an admin (the next member takes over), and the last person leaving deletes it. **Reporting:** each message from someone else has a Report link; the report names that message's author, keeps the last 20 messages as evidence (`reportedMessageId`, `group`) and goes to `/admin/reports` like any other. (A direct conversation is still reported as a whole.)
- **Inbox:** groups show with their initials, a TEAM tag for team rooms, the member count and "Name: last message". The Messages menu count already includes them.
- **Rules:** members read the group and its messages; strangers, signed-out visitors and even group admins can't write from the browser (rules tests cover it).

## Publishing a post to LinkedIn and X (built 9 October, off until the apps are set up)

On their own post (`/journals/<slug>`, only for the author), "Share this post to your networks" posts an **excerpt with a link back to the full journal** to the member's own LinkedIn and/or X. They connect once, press **Write the post**, read and edit the words (counters show the limits: X 280 with a link counted as 23, LinkedIn 3,000) and press **Post**. Nothing goes out without that last press. It is hidden while no network is configured.

- **Words** (`lib/social-text.ts`, no AI): title, then the opening of the post as plain words (Markdown marks, images and HTML removed), cut at a word to fit; X always ends with the link, LinkedIn ends "Read the full journal on #NotesApp:" and the post carries a link card.
- **Connecting** (`lib/social-server.ts`): OAuth 2.0 with a one-use `state` kept for 10 minutes (`socialStates`), PKCE for X, and a return to the page the member started from (our own hosts only). Tokens are stored AES-GCM encrypted (`ACCOUNT_DATA_KEY`) in `socialConnections/<uid>_<provider>`, server-only, and never sent to the browser. LinkedIn tokens last about 60 days and can't be renewed, so the member is asked to reconnect; X tokens renew themselves with the refresh token (which X rotates).
- **LinkedIn:** scopes `openid profile w_member_social` (products "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn"). Posts through the Posts API (`/rest/posts`, header `LinkedIn-Version`, default `202606`, override with `LINKEDIN_API_VERSION` if LinkedIn retires it) as `urn:li:person:<sub>`, an article card (source, title, description) with the post's picture uploaded through the Images API when it can be fetched (without it the post still goes). The text is escaped for LinkedIn's markup characters.
- **X:** scopes `tweet.read tweet.write users.read offline.access` through OAuth 2.0 with PKCE; posts `POST /2/tweets` with the text and link (X builds the card from the post's share image). Check X's current API access and limits before relying on it: posting from a free developer app is capped across *all* members, not per member.
- **Safety:** only the author (or a co-author) of a published post can share it; each network answers separately; a post already shared to a network is refused unless the member confirms "Post it again" (`socialPosts`); refusals come back in plain words (expired, not allowed, rate limit, duplicate).
- **Set up (once):** create a LinkedIn app (add the two products) and an X app (OAuth 2.0, read and write), register the redirect URIs `https://www.notesapp.name.ng/api/social/callback/linkedin` and `.../x`, and set the four variables. Tested here against a stand-in for the networks (request shapes, OAuth state and PKCE, refresh, refusals, duplicates), not against LinkedIn or X themselves: the first real post is the real test.
- **Share window (no connection needed):** the share menu on every post (WhatsApp, X, Facebook, LinkedIn, copy link) is unchanged except that X now carries the title *and* an excerpt. LinkedIn and Facebook build their cards from the page's share tags, whose description is the excerpt.
- **Excerpts** everywhere (cards, search, share previews) are now plain words rather than the raw first 180 characters of Markdown.
- **Not built:** Facebook (only Pages can be posted to by an app, and it needs a review), Instagram (professional accounts with a linked Page), TikTok (video, and posts stay private until TikTok audits the app), WhatsApp (no posting API).

## App address (app.notesapp.name.ng, notesapp.ng)

- **Welcome screen** (`components/Splash.tsx`, middleware rewrites `/` to `/welcome`): challenge panel on the left, and on the right the **sign-in and sign-up forms themselves** (`components/LoginForm.tsx`, `components/SignupFlow.tsx`, the same forms the `/login` and `/signup` pages use, with an `embedded` mode). No pop-up and no trip to the main site: signing in goes to the journal (or the page in `?next=`), and the sign-up's follow-5-journals step runs in the card. `/login`, `/signup` and `/forgot-password` on this address land on the welcome screen (`?auth=signin|signup|forgot`); a visitor being handed over from a member's own domain (`?from=`) still uses the main login page.
- **Download button that knows the device** (`lib/visitor-device.ts`, `lib/use-device.ts`): on the left of the welcome screen it says *Download on mobile* on a phone or tablet, *Download on PC* on Windows, *Download on Mac* on a Mac and *Download on desktop* otherwise (a link on the card on phones). It opens `/install` (`components/InstallGuide.tsx`), which opens on the visitor's own device and browser: iPhone and iPad (Safari: Share, Add to Home Screen), Android (Chrome, Samsung Internet, Firefox), and Windows, Mac and Linux (Chrome and Edge install icon, Safari Add to Dock; Firefox on a computer can't install), a warning when inside another app's browser, what to do after installing, and a one-click Install button when the browser offers it.
- **Stays on the app address:** Explore, Help, Terms and Privacy open on the app address (only the marketing pages still go to the main site), and the bottom left carries © and the company registration line. `app/manifest.ts` and the icons in `public/images/brand` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) make the site installable; `app/layout.tsx` adds the Apple home-screen tags and the theme colour.
- **Team badge:** adding someone at Team access gives them the staff role at once (so the ✔ and #NotesApp team mark show), flagged `roleFromAccess`; removing their access takes it back; people already on the team are fixed the next time the staff list loads. **Organisation admins and the store:** a team member the owner makes **admin** can add and edit the organisation's store items (and attach files, lessons and restock) without the separate "runs orders & money too" switch (`orgItemsRole` in `firestore.rules`, `canManageItems` in `lib/orders-server.ts`). Deleting items, orders, boosts and money still need the owner or a member given store access. The organisation must be on a team plan (Business or Enterprise).

## Messages: conversation header, mute, and group admin controls (built 13 October 2026)
- **Header** (`components/messages/ThreadHeader.tsx`, used by `Thread.tsx`): the picture, the name with the verified/gold/team badge beside it, the online status (or `@username`) below, and a chevron that opens a menu. **Direct:** View profile, **View moments** (opens the moments viewer; hidden when Moments is off; says so when there is nothing you may see), Create group, Mute/Unmute, Block/Unblock, Report. No theme, nicknames or emoji items. **Group:** Members, Group settings (public-group admins), Create group, Mute/Unmute, Leave group. Under a group's name: "Group · 12 members" (team rooms: "Team room"), plus "only admins can send" when locked.
- **Mute** (`POST /api/messages/{id} {action:"mute", muted}`, `convMutes/{uid}_{cid}`, server-only): no bell, push or email for new messages in that conversation, for that person. Checked in `sendMessage` and `sendGroupMessage`.
- **Group picture:** an admin uploads an image with the usual avatar upload (`uploadToR2(file, "avatar")`) and `POST /api/messages/groups/{id} {action:"avatar", url}` saves it; the server only accepts an address inside that admin's own `avatars/<uid>/` folder (empty clears it). Shown in the inbox and header; team rooms keep the #NotesApp look.
- **Only admins can send** (`{action:"lock", locked}`, `conversations/{id}.sendLocked`): enforced in `sendGroupMessage` (before and inside the transaction). Members see "Only group admins can send messages in this group" instead of the composer and can still read; admins see a note that the lock is on.
- **Ban** (`{action:"ban", uid, ban}`, `bannedUids`): removes the member, stops them being added back (`addGroupMembers` refuses) until an admin unbans them (unban lifts the ban only; they have to be added again). Admins can't be banned (remove the admin role first) and nobody can ban themselves. The Members panel lists banned people (admins only get that list from the API).
- Team rooms and meeting rooms are excluded from picture, lock and ban (they follow the team automatically).
- Tested against the Firestore emulator: lock allowed/blocked, admin writes while locked, picture address checks, ban/unban and re-add, mute.

## Messages: free one-to-one voice and video calls (built 13 October 2026)
- **Who:** two people who **follow each other** and haven't blocked each other (`startCall`, `lib/calls-server.ts`; a block reads as "member not found", like Messages). Free. Groups, sessions and meetings are not affected (sessions keep the existing calls provider).
- **How:** phone to phone with **WebRTC**. The server creates `calls/{id}` (ringing), pushes "Incoming call" to the other person, and records the end. The browsers exchange the offer/answer on the call document and connection candidates in `callerCandidates` / `calleeCandidates` (rules: only the two people read; the caller writes only the offer while it rings; the person called writes only the answer, `status: accepted` and `acceptedAt`; candidates only while live; starting and ending only through the server). No audio or video passes through or is stored by us.
- **Screens:** phone and camera buttons in the conversation header (`ThreadHeader` actions); `components/calls/CallManager.tsx` is mounted in the main layout, rings anywhere on the site (soft ringtone, Answer/Decline card), and runs the call screen (mute, camera on/off, end, timer). Unanswered after 45 s → missed; a ringing call older than 60 s is ignored (caller closed the app); a connection lost for 10 s ends the call.
- **Call log:** every call leaves a line in the conversation ("📞 Voice call · 3:12", "Missed video call", "Declined voice call") and updates the inbox preview; a missed call also gives the other person a bell and a push. **Call back:** in a one-to-one chat each call line is a button that starts the same kind of call again (`Thread.tsx`; not in groups or when you've blocked them).
- **Clean-up:** when a call ends, `endCall` deletes the `offer`/`answer` (they hold network addresses) and both candidate sub-collections (`clearCandidates`); the call record (who, kind, times, seconds, outcome) stays until either person deletes their account (`eraseAccount` removes `calls` where they are caller or callee).
- **Status:** `/status` has a "Calls (voice and video)" row (`lib/status.ts`): it asks Cloudflare for TURN credentials (`cloudflareTurn`) and names the problem (wrong key ID, refused token, unreachable, not set up); relay problems show as slow, not down. Call screen: a `permission-denied` from Firestore says the call rules aren't deployed.
- **Group moderation (14 October 2026):** admins get a visible ⚙️ Manage button (members, admins, ban/unban, send lock, picture) and **Remove** under any message → `POST /api/messages/groups/[id] {action:"remove_message", messageId}` → `removeGroupMessage` → `wipeMessage` (`lib/groups-server.ts`): text, files (private bucket), sticker, moment ref and quote go, `removed: {by: "admin"|"notesapp", at}` stays; replies quoting it and the inbox preview are rewritten. Staff "Actioned" on a group-message report calls `wipeMessage(..., "notesapp")` (`resolveReport`). Non-admins see who the admins are. **Duplicate groups:** `createGroup` keeps `groupCreates/{uid}` (last title+members key, id, time) and returns the same group for a repeat within 2 minutes (transaction, so parallel taps also dedupe); `NewGroup` also guards with a ref. Tested on the emulator.
- **Where calls are described:** home and About (Messages card), Pricing ("Voice and video calls" row), Roadmap (live list), Privacy ("Voice and video calls"), Terms (2b-i), Security, help article `voice-and-video-calls` (Nana reads it).
- **Relay (TURN) — set this up for reliability:** without it, calls connect on most networks but fail on strict ones (some offices and mobile carriers). Set either `TURN_URLS` (comma-separated), `TURN_USERNAME`, `TURN_CREDENTIAL` for any TURN service, or `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN` for short-lived Cloudflare relay credentials (endpoint `rtc.live.cloudflare.com/v1/turn/keys/<id>/credentials/generate`; confirm against Cloudflare's current docs). Public STUN (Cloudflare, Google) is always included.
- **Switch:** `CALLS_LIVE` in `lib/moments-rules.ts` = on wherever Messages is, unless `NEXT_PUBLIC_CALLS_LIVE=false`.
- **Tested:** `npm run test:rules` (50, incl. the call rules) and the start/end logic against the emulator (follow-each-other check, blocks, missed/declined/ended, duration, the conversation line, bells). **Tested between two real phones on 13 October 2026 (voice and video, after the rules were deployed).** Still to do: one call between mobile data and Wi-Fi to prove the relay.
- **Later (decided, not built):** the NotesApp Credit wallet, then paid calls in Notes Life at ₦5/min voice and ₦10/min video over this same direct-call route (paid calls would go through the relay so the minutes can be metered and stopped when credit runs out).

## NotesApp Credit wallet (built 14 October 2026)
- **Rules** (`lib/wallet.ts`): top-up ₦1,000–₦500,000 (`TOPUP_MIN_KOBO`/`TOPUP_MAX_KOBO`), Bonus Credits by step (`BONUS_STEPS`: ₦5k→₦250, ₦10k→₦700, ₦20k→₦2,000, ₦50k+→₦6,000), bonus lasts `BONUS_DAYS` = 90, spent first (soonest-ending lot first) and only on `BONUS_KINDS` (boost, ad, badge; calls later). Payable from the wallet: `WALLET_KINDS` = boost, ad, badge, gift, store, digital, booking (gifts/shop/sessions use credit only). Not yet: tier plans, journal subscriptions, gold, merch (Paystack plans or platform goods). Switch: `NEXT_PUBLIC_WALLET_LIVE=false` hides it.
- **Data** (server-only writes; `firestore.rules`: a member may `get` their own `wallets/{uid}` and read their own `walletTx`): `wallets/{uid}` = `{creditKobo, bonusLots[{id, kobo, expiresAt, source}]}`; `walletTx/{id}` = statement lines `{uid, type: topup|spend|refund|bonus_expired|topup_refund, creditKobo, bonusKobo (signed), label, reference, kind, held, at}` (index `uid` + `at desc` in `firestore.indexes.json`, **deploy indexes**). Expired lots are dropped (with a `bonus_expired` line) whenever the wallet is next written.
- **Top-up:** `POST /api/paystack/initialize {kind:"wallet_topup", amountNaira}` → Paystack → `fulfillPayment` branch `wallet_topup` → `creditTopup` (credit + a bonus lot with id = reference). Bell + `/booking/confirm` "Added to your wallet".
- **Pay from the wallet:** `startCheckout(user, body, {amountKobo})` (`lib/checkout.ts`) asks **Wallet or Card** (`components/PayChooser.tsx`, mounted in the main layout) when the member has a balance and the kind is payable; it then sends `payWith:"wallet"`. In `/api/paystack/initialize` every check runs unchanged; `initTx` skips Paystack and `savePayment` calls `payFromWallet` (takes the money and writes the payment record with `payWith`/`walletDebit` in one transaction; refuses with 402 if it doesn't cover it) and then `fulfillPayment`, which skips `verifyTransaction` for wallet payments. So bookings, orders (held until delivery), downloads, gifts (co-author shares), boosts, ads and badges are fulfilled by the same code as card payments. A wallet badge is one month, stored as `status: "cancelled"` (no renewal, no Paystack cancel).
- **Refunds:** every refund goes through `refundPayment` (`lib/refunds.ts`; used by boost cancel, admin payments, ad campaigns, booking cancel): wallet payment → `refundToWallet` (proportional; the bonus share returns as a new 90-day lot); a top-up refunded to the card → `reverseTopup` (only unspent credit, plus its bonus from what is left) then Paystack, with `restoreTopup` if Paystack refuses; otherwise Paystack as before.
- **Screens:** `/profile/wallet` (balance card, top-up with presets and bonus preview, where to use it, activity with filters, bonus lots with end dates); "💳 Wallet" in the account menu and sub-nav; cards on home and About; Pricing note; Roadmap live; help article `notesapp-credit-wallet`; Terms 5a-i; Privacy "Your wallet". Account deletion is blocked while credit is left; erase removes the wallet and statement; the data download includes them.
- **Tested:** pure rules (bonus steps, split order, expiry, proportional refunds) and, on the emulator, top-up → pay a boost (bonus first) → fulfil without Paystack → duplicate refused → not-enough refused → partial and full refunds → top-up reversal leaving 0; rules tests (51). **Not yet tested with real Paystack money**: do one ₦1,000 top-up and one wallet payment on production before announcing.

## Notes Life (first playable built 14 October 2026; plan decided 13 October 2026)
A browser life game at **life.notesapp.name.ng**, its own look, **NotesApp sign-in**. **The landing page is live** at `/life` (`app/life/page.tsx`, real game screenshots in `public/images/life/shots/`; the partner page is `app/life/partners/page.tsx`, at life.notesapp.name.ng/partners), served at the root of `life.notesapp.name.ng` by `middleware.ts` once that domain is added in Vercel (add `life.notesapp.name.ng` to the project's domains and a CNAME `life` → `cname.vercel-dns.com`). The same card (`components/NotesLifeCard.tsx`) is on the home, About and Roadmap pages. The top-left slot of the game bar shows the **difficulty level**. Every screen is shown to the founder as phone and desktop **mockup screenshots before it is built**.
- **Start:** a face-me-I-face-you room in your own city; your NotesApp profile picture is your portrait (corner badge and name tag), with a customisable low-poly character. Needs bars (food, energy, fun, social, hygiene), jobs, a phone, a map.
- **Look and tech:** low-poly **3D** in plain three.js (built: `components/life/world.ts`, pinned three 0.160), camera that rotates. Game state on the phone with compact saves to Firestore (built; see below); credits, rewards and purchases server-side only (Firestore).
- **Two currencies, no cash-out:** **NotesApp Credit** (real money, topped up, spent across NotesApp and Notes Life, never withdrawn) and **Notesville Naira** (game money from jobs, quests and events; can be bought with NotesApp Credit; never converts back). Players can buy cars, skyscrapers, private jets and yachts, host events and charge other players entry in Notesville Naira. **Hosts never cash out** real money.
- **Bonus Credits:** quests can award the same Bonus Credits used on app.notesapp.name.ng, with a **monthly cap** on the total the game may hand out. No cash prizes and no prize budget: **shareable result cards** and **leaderboards** (by city and week).
- **Rich list:** named **"Billionaires List"**, sub-title **"NotesVille Fat Wallet Index"**; the first time a player opens it a tutorial pop-up says: *"Welcome to the official [REDACTED BY LAWYERS] Rich List!"* A **brag button** makes a share card (asset bought, rank) with the player's referral link.
- **Calls in the game:** to friends (people who follow each other), ₦5/min voice and ₦10/min video, paid from NotesApp Credit, over our own direct calls (above).
- **Real NotesApp inside:** daily quests that are real actions (follow, read, complete profile, invite a friend who verifies); a **market street** where stalls are real NotesApp stores and items (Buy on NotesApp opens the real checkout; boosted items get the best stalls); **billboards** running our real ad campaigns with **Visit** and **Ask about this promotion** (a message or enquiry to the advertiser), counted like site impressions; a newsstand (trending journals), an office (bookings), a stage (live video and the #1MillionNaira challenge, when live).
- **Cities (decided 13 October 2026):** the player chooses a city at the start. **Launch with three: Abuja (first, NotesApp's home), Lagos and Port Harcourt.** Later: Kano, Ibadan, Enugu, Benin City, Kaduna, Jos, Calabar, then Accra and Nairobi. Each city has its own neighbourhoods (inspired by real ones, e.g. Wuse, Garki, Maitama), rents, prices, market and city leaderboard; travel by bus, train or flight in Notesville Naira; property in several cities. The top-left slot of the game bar is the **difficulty level**. (Times in code are "Lagos time" = Africa/Lagos, WAT, which is the whole country's time zone, not the city.)
- **Work mirrors NotesApp:** choose any profession (writer/creator, coach, consultant, therapist, fashion or food seller, tech freelancer, business owner) and do what members do on NotesApp: publish posts for readers and followers, take bookings, run a storefront, start a company and hire players, get paid at the Central Bank of Notesville. Quests point to real NotesApp actions.
- **NEPA power cuts (Notesville Electric Power Authority):** server-wide, the same second for every player in every city, a few times a day at unpredictable times. Ordinary houses go dark; estates with dedicated power, 24/7 high-rises and homes with solar are never affected. Neighbourhood murmur ("NEPA don take light again o!"), then a prompt: **"I Better Pass My Neighbour" 950W** (bulb, fan, charging; loud; petrol), a bigger generator (TV and fridge too), **solar + inverter** (silent, never affected again), or **stay in darkness till light returns**. Generators start one by one with different sounds by size and distance; only powered windows light up. Without power: energy drops faster, fridge food spoils, the in-game phone battery runs down, unpowered shops lose customers; generators need fuel (filling-station queue) and lower neighbours' mood. When light returns: the "nwiiiiiii" appliance chorus, children shouting "UP NEPA!", an adult "Shhhh! Before dem hear and take am again!", generators going off one by one, quiet. Spatial sound with its own volume, mute and captions.
- **Crime and the police (founder's decisions; content needs counsel and founder sign-off before build):** players can rob others, but the chance of being caught is high (about 85–90%), then court, prison time (real-time hours; no work or trade; prison chores, call a lawyer, pay bail), a fine and a criminal record. The police unit is **NARS** (a fictional squad). Satire scenes asked for: roadside officers demanding receipts for phones, cameras and laptops; young men in flashy cars labelled "yahoo boys" and taken in; the station banner "BAIL IS FREE" with small print "never pay for bail bond", while officers charge for "photocopying" the bail bond or send people back to detention "till HQ sends the next batch"; a few good police. In prison a player can also **negotiate with a bigger syndicate** to secure bail in exchange for **underground jobs for an agreed period**. **Assets bought with NotesApp Credit can be stolen but the thief is always caught on, before or immediately after the act** and the item goes back. Banked money, new players (first 7 days) and offline players are protected. **Also decided (founder, repeated three times):** under interrogation NARS officers always tell suspects they are "licensed to shoot anyone in custody"; if a suspect dies in custody, officers place a gun in the dead person's hand and take a picture, claiming the person tried to escape or shot at an officer. Some players in prison negotiate with a bigger syndicate to secure bail and then work for it for an agreed period. Build notes: it is satire of real abuses, so it stays clearly fictional (fictional force, no real officers, places or cases); the game is 18+; the scene is shown once with a content note and can be skipped; a player's character can lose progress or "restart from the village", but nothing real is taken. Counsel to look over NARS (close to SARS), the police satire and the syndicate mechanic before launch.
- **Money lessons built in:** insurance (home, shop, car, health) with premiums in Notesville Naira and payouts after robbery, fire or flood, so players learn what insurance is worth; savings at the Central Bank with interest; ajo/esusu savings circles with friends; loans and their cost; starting and growing a business. **Hospitality trap events:** helping a stranger who claims to be family, lending to "my brother", housing a friend who brings trouble; good choices and bad ones both have consequences, so players learn when kindness needs care.
- **Decided 14 October 2026 (first playable):**
  - **Start:** day 1 with **N$ 100,000**, a room in Wuse, Abuja, a bicycle and public transport (bus N$ 200, keke N$ 400, taxi N$ 1,500). Suggestions to buy an e-bike (N$ 450,000) or an EV appear along the way; the player can save up, top up NotesApp Credit, or keep cycling. Most things sold in the game are eco-friendly (🌿 tags: recycled, refurbished, low power, inverter, induction).
  - **Exchange rate:** ₦1 of NotesApp Credit buys **N$ 100** (Notesville Naira never converts back).
  - **Time:** 24 game hours = **48 real minutes**, so 30 game days (a game month, when rent is due) = 24 real hours, and a game year = 12 days 4 hours real.
  - **Room:** sage walls, a window above the reading desk, the **maroon NotesApp rug with the na icon** in the middle (better rugs to buy, including unbranded ones), bed with a lamp on one bedside table and the **deal phone** on the other (deal calls ring there), wardrobe (change outfit), WC and bath, the old big desktop (upgrade to a refurbished laptop and an all-in-one display PC: faster work), a standing fan (upgrade to an inverter AC: deeper sleep), and a **small cooker** as an upgrade (cook at home: cheaper, takes time, builds a cooking skill).
  - **Needs:** hunger, energy, fun, social, hygiene, bladder; low needs cut work pay.
  - **Food:** **@chef_adams** is the food brand in the game: **takeaway** from the Chef Adams kiosk, **delivery** to your room (e-bike riders with the red bag), and **dine-in** at the Mini Dine-In Shop (more fun and social, invite a friend). Menu from the brand sheet (jollof, fried, native rice, noodles; chicken, beef, turkey, fish; plantain, coleslaw, salad, moi moi); in-game prices in N$ to confirm with @chef_adams, with a link to the real @chef_adams store on NotesApp. Brand: coral #FF8F83, tomato red #E53935, charcoal #292929, cream #FFF9F0, warm gold #F2B544; Montserrat ExtraBold and Poppins; the chef emblem and the lockup.
  - **Jobs:** writer, delivery rider, tutor, fashion seller, tech freelancer (needs a laptop), and **Chef Adams jobs** (kiosk attendant, line cook, delivery rider, outlet supervisor), plus **Become a Partner**: own a Chef Adams Takeaway Kiosk or Mini Dine-In Shop in the game ("One brand. Standardised recipes, training and quality control in every outlet").
  - **Saving:** on the device every 5 s (localStorage, works offline) and in the player's NotesApp account every 30 s and when the tab closes (Firestore `lifeSaves`); **restore points** (hourly for a day, daily for a week) in Settings. **Server-side only, never in the save:** Notesville Naira, NotesApp Credit, anything bought with real money, rank (a save on the device can be edited, so anything of value is checked by the server; a restore never removes or doubles it).
  - **Partner brands (paid placements, labelled "Partner" in the game):** **Candellux Imperial Hotel & Suites**, Garki, Abuja ("…We Strive for the Best"; Area 1, No. 5 Sir Anebo Okekenta Street; WhatsApp +234 916 004 9435) is the luxury tier for rich players: luxury suites (energy to 100%), 24-hour restaurant, swimming pool, VIP bar (meet top players), gym, barbing saloon (deal bonus), laundry, conference hall (host events and sell tickets) and business centre (faster work), with an **Imperial Club** membership for Billionaires List players, and a "Stay at the real Candellux" link to book for real. In-game prices are placeholders (suite N$ 180,000 a night, day pass N$ 25,000, club N$ 2m a game month). The game shows the hotel from the founder's photos: dark stone-grey storeys, stone perimeter wall with lamp pillars, the lit pylon sign and the rooftop sign, and the blue mosaic pool on green turf. **@chef_adams** is the everyday food brand (above). A **Lagos partner brand** will be supplied when Lagos is built.
  - **Mockups shown for approval** (phone and desktop, 20 screens, including 4 for Candellux): room, upgraded room, shop, needs, deal call, phone, jobs, friends, getting around, e-bike suggestion, saves and restore, Chef Adams street, delivery, dine-in, cook at home, Chef Adams jobs and partner.
- **Built (first playable, 14 October 2026):**
  - **Play:** `/life/play` on www (`app/life/play/page.tsx` → `components/life/LifeGame.tsx`, client only). On the life host, `/` shows the landing page (keeping `?ref=`) and `/play` redirects to `https://www.notesapp.name.ng/life/play`, so the NotesApp sign-in is the usual one. The landing page's **Play now** button passes an invite's `ref` on.
  - **Rules and catalogue:** `lib/life/catalog.ts` (prices, jobs, food, hotel, deals, transport, time, rent, invite bonus). Client-side needs, activities and saves: `lib/life/play.ts`, `components/life/save.ts`. 3D scenes (room built from what you own, street, Chef Adams, Candellux, pool): `components/life/world.ts`; scene tags are HTML buttons projected each frame.
  - **Server (never trusted from the device):** `lib/life/server.ts` keeps `lifePlayers/{uid}` (N$, owned items, job, shift, deal, rent, reputation, invites) and the statement `lifeTx`, all in transactions; shifts are timed on the server (8 real minutes), deal calls are generated there, rent is taken when due (or recorded as owed). API: `app/api/life/route.ts` (GET me / `?view=rich|friends|tx`, POST `{action}`).
  - **Buying N$:** payment kind `life_naira` (₦100–₦100,000, wallet or card through the usual checkout); fulfilment adds `amountKobo` N$ (1 kobo = N$ 1) and is never refundable to cash.
  - **Invites:** a new player who opens the game with `?ref=username` gets `referredBy`. Their first finished shift calls `lib/life/referral.ts`, which (if their email is verified, they were not paid before, the inviter is under 20 this month and the game's monthly cap `lifeBonus/{YYYY-MM}` allows) gives each of them ₦250 Bonus Credit (`grantBonus` in `lib/wallet-server.ts`, a 90-day lot) and a bell. Monthly cap: env `LIFE_BONUS_MONTHLY_CAP_NAIRA` (default ₦500,000). Invite panel: Contact Picker (Chrome on Android), WhatsApp and SMS per contact, share, copy. Achievements offer a WhatsApp share.
  - **Sound:** `components/life/sound.ts`, all Web Audio synthesis (no files): effects bus (tap, coin/pay on N$ changes, ring loop while a deal waits at home, water, eat, sizzle, travel bell/horn/whoosh, done, success, bonus, warn) and surroundings bus (room birds or crickets, street traffic and horns, Candellux lounge chords, pool water). Mute in the HUD, master/effects/surroundings sliders in Settings, kept in localStorage `notesLife:sound`; unlocked on the first tap, paused when the tab is hidden.
  - **Invites list:** GET `/api/life?view=invites` (lifePlayers where `referredBy` = you): paid, needs a first shift, needs a verified email, over the monthly limit. The bonus is retried on every finished shift until paid.
  - **Card payments in the game** pass `payWith: "card"` to `startCheckout`, because the Wallet-or-card chooser (`components/PayChooser.tsx`) isn't mounted on `/life/play`. **Back to NotesApp** goes to `https://app.notesapp.name.ng/journals` after saving.
  - **Partners:** Chef Adams (food, jobs, partner card) and Candellux Imperial (hotel services, real booking on WhatsApp); logos in `public/images/life/partners/`.
  - **Tests:** `npm run test:life` (economy, rent, deals, hotel, buying N$, rich list, friends, invites) and the Notes Life rules in `npm run test:rules`. Deploy the rules and indexes (`firebase deploy --only firestore:rules,firestore:indexes`) before opening it. Switch the game off with `NEXT_PUBLIC_LIFE_LIVE=false`.
  - **Partner outlets, jobs, kitchen and billboards (built 14 October 2026, v0.32.0):** `OUTLETS` in the catalogue (Chef Adams Takeaway Kiosk N$ 2.5m / Mini Dine-In N$ 8.0m, itel Home Store N$ 1.5m / Mall Store N$ 7.0m; Wuse or Garki ×1.12). `lifePlayers.outlets[]` holds kind, area, openedAt, lastCollectAt, earned, backup. `outletTakings()` (shared by server and screen) counts day by day since the last collection, capped at 30 game days: sales × quality (88%, 96% with backup, −2 a day after 3 uncollected), half in blackout hours without backup, less the 8% Chef Adams fee or the itel stock rate, less resident wages. Actions `outlet_open`, `outlet_collect`, `outlet_backup` (N$ 620k, collects first). Staff are residents only; real players work at the brands' own outlets. New itel and Candellux jobs with `extra` (bonus/tips), `meal`, `needFitness`, `needBrandShifts` (`chefShifts`, `itelShifts`, `hotelShifts`); `STAFF_PERKS` (20% off itel, half price pool/gym/VIP bar). Fridge, microwave, Power Tank 1000 (1000 Wh, fridge 200 W, 650W panels ~300 W each by day) and spoilage after `FOOD_SPOIL_HOURS` = 8 without a cold fridge live in `lib/life/play.ts` (`tank`, `plateWarm`, `spoiledAt` in the save). Billboards (`public/images/life/billboards/`) on the street, Chef Adams and itel scenes; owned outlets drawn with the owner's name. Real partner links: `REAL_PARTNER`.
  - **Cities, the new Candellux, swimming and VIPs (built 15 October 2026, v0.33.0):** new players pick a city from `CITY_CARDS` (our own landmark drawings in `public/images/life/cities/`: Abuja City Gate, the National Theatre for Lagos, Isaac Boro Park for Port Harcourt). Only Abuja is open; action `city_notify` stores `lifePlayers.cityNotify[]` for cities in `COMING_CITY_IDS`. The `hotel` scene in `components/life/world.ts` has `night` and `view` (`front`, `pool`, `aerial`), `swim` and `vips`; the old `pool` scene is gone. `solar()` puts panels on the Candellux, gym, itel and Chef Adams roofs. `HOTEL` services carry `tab: "pool"` for the Pool tab: day pass, `lesson` (N$ 15,000), gym, `poolbar` (N$ 10,000), `vipbar` (N$ 11,500). The server counts `swimLessons`, `swims` and `gymSessions`; `swimSkill()` = lessons × 2 + swims ÷ 2, max 10; the deep end opens after `SWIM_DEEP_LESSONS` = 3. Jobs `hotel_swim` (`needSwim` 5) and `hotel_gym` (`needGymSessions` 10); the lifeguard gets a rescue bonus. `vipsAt()` rotates the four richest residents through the VIP bar, two at a time, every `VIP_EVERY_HOURS` = 4 game hours. Chef Adams food groups `fast` (shawarma, pizza) and `fresh` (Sum Ting Fresh), with billboards `bb:chef2`–`bb:chef4`.
  - **Friend chat in the game (built 15 October 2026, v0.34.0):** `components/life/FriendChat.tsx` is a chat sheet (phone) or right-hand dock (desktop) over the game for players who follow each other (the `friends` view). It reads `conversations/{conversationId(a,b)}/messages` live (firestore.rules: only the two participants) and sends through `POST /api/messages`, so it is the same conversation as Messages; new messages from the friend mark it read like the Messages thread does. `LifeGame` listens to the player's conversations (`participants array-contains`) for unread counts per friend (badges on the Phone button and the Friends tile); a friend's unread going up adds the reply Social. Social comes from `chatSocial()` in `lib/life/play.ts` (`CHAT_SOCIAL`: send +8, same place +12, reply +4, at most 40 per real hour, tracked in the save as `chatHour`/`chatGained`). A real player at the same place who is a friend gets "Chat here"; others still open NotesApp Messages.
  - **Digital Witch partner (built 16 October 2026, v0.35.0):** place `dw` (Digital Witch hub, CBD) with the `dw` scene in `components/life/world.ts` (glass Skyscraper Plaza towers with solar roofs, the hub's open glass front and classrooms, a fountain plaza, the billboard `billboards/digitalwitch.webp`; the same advert is a lightbox at the Wuse bus stand in the street scene). Resident `cynthia` (Ekwutosi Cynthia Okeh, `photo` and `partner` fields; N$ 7.5bn, #1) is at the hub 9 AM to 5 PM and the VIP bar 7 PM to 11 PM (`cynthiaAt`; `vipsAt` puts her first in the evening and leaves her out of the rotation). `DW_COURSES` (price, classes, the job each opens); server actions `dw_enroll`, `dw_class` (opening hours `dwOpen`, one class per `DW_CLASS_MS` = 2 game hours, certificate on the last class), `dw_giveaway` (Saturday 7 PM to 11 PM, `giveawayEligible` = a certificate and 10 `techShifts`, once per `giveawayWeek`, `giveawayPrize`: 5% N$ 1m, 10% N$ 500k). `lifePlayers` gains `certs`, `dwCourses`, `dwClassAt`, `techShifts`, `giveawayWeek`. Jobs carry `needCert` (a course id or `"any"`) and `tech`; `jobBlocker` checks certificates at apply time only, so existing tech workers keep their jobs. Presence allows `dw` (firestore.rules: run `firebase deploy --only firestore`). Partner card on `/life/partners`.
  - **Hotel stays and calm sound (built 16 October 2026, v0.36.0):** the suite is a stay: `hotel` action `suite` sets `lifePlayers.hotelUntil = hotelCheckout(now)` (`lib/life/catalog.ts`: the next 11 AM game time, or tomorrow's from 6 AM; one stay at a time). While `lodged(hotelUntil)`, the hotel panel shows *Your Imperial Suite* (rest an hour, sleep up to 8 hours, capped at checkout), each setting `SUITE_SET` (energy, hygiene, bladder, fun 100) when it ends, and the `restaurant` returns `set: { hunger: 100 }` as room service. The game says when you've checked out. `components/life/sound.ts` has a `calm` surroundings (a soft music-box tune) used in the suite, at the VIP bar (panel or drink) and in class; generators and the NEPA off/on sounds are skipped there. The VIP bar panel opens with a 360° view (`components/life/VipPano.tsx`, `partners/candellux-vip-360.webp`).
  - **NEPA, power and itel Energy (built 14 October 2026):** `nepaAt()`/`outagesOfDay()` in `lib/life/catalog.ts` give the same blackouts to everyone from the world clock (seeded per game day: 2 or 3 outages, 2 to 6 game hours). Items in the `power` category: `power_go` (N$ 150k, itel), `solar_panel` (N$ 55k, needs the Power GO), `home_kit` (N$ 2.4m, soon), `gen_small` "I Better Pass My Neighbour" (N$ 65k, 0.4 L/h, 5 L tank), `gen_big` 3.5kVA (N$ 420k, 1.1 L/h, 12 L). Server: action `fuel` (N$ 1,100/L), `buy` checks `needs` and `soon`, and `shift_start` refuses desk work on the old desktop during a blackout without a Power GO or generator. Client (`powerStep` in `lib/life/play.ts`): battery Wh and petrol in the save; the prompt "NEPA has taken light" once per outage; generator hum and neighbours' generators in `sound.ts`; UP NEPA when light returns. itel Energy scene in `world.ts` (place `itel`, Wuse); partner via @clickam (`ITEL.sellerUrl`). Logo and product images in `public/images/life/partners/itel-*`.
  - **Residents (computer players, always 🤖):** `RESIDENTS` and `RESIDENTS_AT` in the catalogue (look, role, lines on greet/food/work/NEPA/money, some with a net worth). They stand in each scene; chats are scripted and kept in localStorage only (`components/life/chats.ts`). `richList` merges the rich ones in (`npc` rows), with `?real=1` for real players only and `realRank`.
  - **Players at the same place:** `lifePresence/{uid}` holds only `place`, `outfit`, `at` (rules: own doc, those keys); names and pictures come from the public `users` doc so nobody can pose as someone else (`components/life/presence.ts`). Refreshed every 45 s; others shown if seen in the last 10 minutes; tap → real NotesApp message. Settings: "Show me to other players" (deletes the doc). Index: lifePresence (place, at desc). Erased with the account.
  - **Not yet:** Lagos and Port Harcourt, market street and billboards, calls from the game phone, fashion stall, Chef Adams outlets, Candellux conference hall, Imperial Club, crime and money lessons.
- **Calls and the regulators (founder, 14 October 2026):** calls in Messages and in Notes Life are pure VoIP over the player's own data, so no NCC telecom licence or tariff approval is needed; the obligation is data privacy under the NDPC (Nigeria Data Protection Act). The Terms (2b-i), the calls help article and the Privacy Policy say calls use the member's data and their network charges its usual data rates.
- **Open (ask counsel):** consumer-protection wording for NotesApp Credit, the Billionaires List naming. **Order:** free calls in Messages (done) → NotesApp Credit wallet → Notes Life mockups → Notes Life first playable (room, needs, jobs, phone, friends) → market and billboards → economy, assets, events, Billionaires List → paid calls.

**Team hub: several people per item, monthly items, BIMI reminders (v0.43.0)** — `teamItems` gain `ownerUids` (everyone on it; `ownerUid` is kept as the first, so older readers and items work) and `repeat` (`""` or `"monthly"`, with `lastDoneAt`). `lib/team.ts`: `ownersOf`, `isOwner`, `ownerNames`, `addMonths`, `nextMonthly`; `cleanItem` takes `ownerUids` (deduplicated, at most 50) or a single `ownerUid`. `lib/team-server.ts`: new people get a bell ("with 2 others"), only the ones just added; comments and deadline reminders go to everyone on the item; a monthly item marked done goes back to To do with the due date a month on (never today or earlier) and fresh reminders. The hub page has a people picker with Select all (edit form, the add form as a menu, meeting invites); cards show each person and "↻ every month". `BIMI_BACKLOG` (`lib/team-seed.ts`): the monthly check that the logo's public record is kept (archive snapshots) while we wait for a Common Mark Certificate (logo public since August 2026, so from late August 2027), DMARC to quarantine, the SVG Tiny P/S logo, and the CMC application with the `default._bimi` record. Tests: `npm run test:team`, `npm run test:team-server`.

**Chat essentials (v0.44.0)** — Reactions: `reactions.<uid>` on the message doc, written only by the server (`reactToMessage` in `lib/message-edits.ts`, POST `/api/messages/[id]` `{ action: "react", messageId, emoji }`, `""` to remove). The list is `REACTIONS` in `lib/messages-rules.ts`; refused on deleted, removed and call lines and in blocked one-to-one chats; the sender gets a bell unless they muted the chat; deleting a message removes its reactions. One message menu (`components/messages/MessageMenu.tsx`): right-click, long press (450 ms) or ⋯; a bottom sheet on phones. Message info: direct chats show the read time; groups show who has read it from each member's `readMarker` (no per-person time is kept). Select mode: Copy (with names and times) and Delete for your own. Search: `lib/chat-tools.ts` (`filterInbox`, `tabCounts`, `searchThread`, accent-insensitive); in-chat search covers the loaded messages (the newest 100). Bookings and Orders filters: GET `/api/messages/contexts` (`chatContexts`: four single-field queries on `bookings` and `storeOrders`, either side, 500 each). File cards in `MessageAttachments.tsx`; PDFs now open in the browser (`/api/messages/file` serves them inline), other documents download. Swipe right on a phone (over 60 px) to reply. Tests: `npm run test:chat`, reactions in `npm run test:messages`.

**Chat superpowers (v0.45.0)** — Forward: `lib/message-forward.ts` `forwardMessage` (POST `/api/messages/[id]` `{ action: "forward", messageId, to }`, up to `FORWARD_MAX` = 5 chats, rate-limited with sending). Each target goes through the normal `sendMessage` / `sendGroupMessage` (blocks, locked groups, plan file limits, bells), with `forwarded: true` on the new message; files are copied in the private bucket (`copyObject`) and registered as the forwarder's `messageUploads`, so each message owns its files. Journal draft: your own message is handed to `/write/new?from=chat` through `sessionStorage` (`notesapp:chatDraft`) and prefills `NoteForm`; someone else's words can't start a draft. Keep: `keptMessages/{uid}_{messageId}` (owner reads, server writes; `firestore.rules`), shown in `components/messages/KeptMessages.tsx` on /saved; `dropKept` (`lib/message-kept.ts`) runs when a message is deleted (`lib/message-edits.ts`) or removed (`wipeMessage`). Cards: `lib/chat-cards.ts` `parseCardLink` (our domains only: journals, shop items, courses, profiles), `lib/chat-cards-server.ts` `cardFor` (public things only), GET `/api/messages/card` (cached 10 min), `components/messages/NotesAppCard.tsx` in place of the web preview. Nana: tasks `summarise` (up to 8,000 characters of chat) and `translate` (`LANGUAGES`: English, Nigerian Pidgin, Yorùbá, Igbo, Hausa) in `lib/nana-assist.ts`; `components/messages/ChatNana.tsx`; the "N new messages · Summarise" bar counts messages from others that arrived before you opened the chat. Tests: `forward.emulator.ts` in `npm run test:messages`, card links in `npm run test:chat`, the keptMessages rule in `npm run test:rules`.

**Changelog to Discord** — `lib/discord.ts` `announceReleases`, run by the cron job (`/api/cron/reminders`, job `discordChangelog`): each new `CHANGELOG` release is posted once to the Discord #announcements channel through `DISCORD_CHANGELOG_WEBHOOK_URL` (secret; only Discord webhook addresses are accepted). `announcements/discord` holds the last version posted; `announcements/discord_<version>` is created before posting so two runs can't both post, and removed if Discord fails so the next run retries. The first run posts only the newest release; after that, up to three a run, oldest first. Messages never ping anyone. Test: `tests/digest/discord.emulator.ts` (in `npm run test:digest`).

**MCP server, phase 1 (v0.46.0)** — `POST /api/mcp` (`app/api/mcp/route.ts`), also `https://mcp.<domain>/` through `middleware.ts` (other paths there go to `/docs#mcp`). Streamable HTTP, stateless, plain JSON answers (no SSE: GET is 405), protocol versions 2025-06-18 / 2025-03-26 / 2024-11-05 (`lib/mcp/protocol.ts`, pure). CORS is open because no cookies are used. Tools (`lib/mcp/catalog.ts`, all read-only): `search_creators`, `get_creator`, `get_open_slots`, `get_booking_link`, `search_store`, `search_journals`, `search_courses`, and with the member's own API key `my_profile`, `my_posts`, `my_bookings`, `my_orders`, `my_earnings`, which call the `/api/v1` handlers in-process (same auth, scopes, rate limits and answer shapes). Public data is cached 10 minutes per server (`lib/mcp/tools.ts`: users, who takes paid sessions = session on + payout account, published journals; the store and academy listings reuse `getMarket` / `getAcademy`). Members' text is labelled as data in every answer and in the server instructions. Every tool call goes to `agentActions` (`lib/mcp/log.ts`: tool, ok, shortened args, API key id, client name, `expireAt` + 365 days; set a Firestore TTL policy on `expireAt`). 120 calls a minute per IP. Booking links carry `?date=&time=` and `BookingCard` opens on that slot. Tests: `npm run test:mcp`, `npm run test:mcp-server`. Phase 2 (not built): OAuth 2.1 sign-in with consent, write tools with approval, the agent scopes.

**Admin → Maintenance** — `/admin/maintenance` (owner and super admins; `lib/admin-access.ts`) runs the journal backfills from the browser: "Journal authors by account" and "File journals under topics". The plans moved from the scripts into `lib/backfills.ts` (`planBackfill`, `planTopics`, `firestoreLookups`, `runBackfill`), so the page and `scripts/backfill-*.ts` share one implementation. POST `/api/admin/maintenance` `{ job, apply }`: a dry run lists every change and the journals to check by hand and writes nothing; Apply (enabled only after a dry run that found something) writes the same list in batches of 400 with merge. `maintenance/<job>` keeps when it was last checked and applied, how many, and by whom. Both jobs only fill what's missing, so running them again is harmless. Test: `npm run test:maintenance`.

**Pricing: certificate late claim fee and Nana allowances** — `lib/pricing.ts` gains `certificateLate` (grace 7 days, +1% of the starting price per full week, not compounding, capped at +50%; `certificatePrice()` works it out) and `nana` (monthly AI allowance per plan in kobo of AI cost: Basic ₦50, Pro ₦750, Business ₦3,000, Enterprise ₦10,000; top-up packs Starter ₦1,000→₦800, Plus ₦2,500→₦2,100, Max ₦5,000→₦4,400 of credit; a ₦500,000 site-wide monthly ceiling). Editable in Admin → Pricing; older saved configs keep the defaults. Not yet enforced: certificates (step 2) and the Nana allowance metering come with their builds. Test: `npm run test:pricing`.

**Nana's gems, allowances, credit and answer bank (v0.47.0)** — `lib/nana-gems.ts` (pure, shared with the page): the gems Pearl → `NANA_MODEL` (default claude-haiku-5-5), Emerald → `NANA_MODEL_EMERALD` (claude-sonnet-5-5), Ruby → `NANA_MODEL_RUBY` (claude-opus-5-5), named so the dearest gem is the dearest model; efforts Quick/Balanced/Thorough (`output_config.effort` low/medium/high; chat max tokens 2,000/4,000/8,000). `gemsFor`/`effortsFor`: Pearl and Quick for every plan, Emerald and Balanced from Business, Ruby and Thorough on Enterprise; `pickGem`/`pickEffort` bring a request down to the plan rather than refuse. Metering (`lib/nana-meter.ts`): after every call on our key, `res.usage` (input, output, cache reads at 0.1×, cache writes at 1.25×) × the gem's dollar prices × the naira rate (Admin → Pricing → Nana AI) is taken from the member's allowance for the period, then their Nana credit (`nanaAccounts/{uid}`: `period`, `usedKobo`, `creditKobo`); a call that runs over is still answered and credit never goes negative. The monthly budget per plan (`nana.budgets`, now with Free/Standard) is shared out over the reset period (`nana.resetEvery`: day, week from Monday 00:00 Lagos, or month); `nana.allowanceGems` "pearl" makes Emerald and Ruby credit-only. `nanaSpend/{YYYY-MM}` adds up what allowances cost; over `siteCeilingKobo` allowances pause for the month and credit still works. Visitors use Pearl, count toward the month, and keep the daily caps; the team hub isn't metered; members with their own key are never metered. Writing help (`lib/nana-assist.ts`) is metered on Pearl. Credit packs: payment kind `nana_credit` (`nanaPack`), card or wallet, `addNanaCredit` in `fulfillPayment`. GET `/api/nana/account` for the page; `components/NanaGems.tsx` (header picker in `NanaPanel`, allowance card on /nana#credit). Answer bank (`lib/nana-bank.ts`, `nanaBank/{key}`): a first, short, non-personal question outside the hub is answered without the person's name or page and stored for `NANA_BANK_DAYS` (default 7; 0 = off), keyed by the normalised question, member or visitor, and a hash of the help centre's text (an edited article retires old answers). A hit costs nothing and works even when the allowance is gone. A dearer gem's answer is never replaced by a cheaper one, and a cheaper one is never served to someone who chose a dearer gem. Rules: `nanaAccounts`, `nanaSpend`, `nanaBank` server-only. Tests: `npm run test:nana`, `npm run test:nana-server`, `npm run test:pricing`.

**Nana's costs (v0.47.1)** — Each answer used to send the whole help centre (49 articles, about 19,000 tokens) as a cached system block with the 5-minute cache, so on a quiet site almost every question paid a cache write. Now `buildSystem` holds only the instructions, the pages Nana may link to and every article's title (about 2,300 tokens), cached for an hour (`ttl: "1h"`; the caching minimum on these models is 512 tokens); `pickArticles` (lib/nana-prompt.ts) adds the articles that match the conversation in full after it, uncached: up to 4 for the latest question (a short follow-up leans on the one before), up to 2 for each of the three before, at most 6 and 24,000 characters. The answer bank's fingerprint is now every article's text. Metering: 1-hour cache writes at 2× (`usage.cache_creation.ephemeral_1h_input_tokens`), cache reads at 0.1× (0.05× on Ruby, `CACHE_READ`). The default model prices were wrong (Pearl was ten times too high): now Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20 per million tokens. A Pearl answer went from about ₦42 to ₦0.66 (₦1.37 the first in an hour). Help article `mcp-ai-assistants`. Tests: `tests/nana/prompt.test.ts` (in `npm run test:nana`).

**Admin → Credits** — `/admin/credits` (super admins; `lib/admin-credits.ts`, `/api/admin/credits`): add Nana credit (`nanaAccounts/{uid}.creditKobo`) or NotesApp Credit (`wallets/{uid}.creditKobo`, with a `walletTx` line of kind `admin_credit`) to a member by hand. Only the owner (`OWNER_EMAIL`) can add, plus the super admins the owner switches on there for emergencies (`platformSettings/creditTopups.uids`, owner-only to change, super admins only). Members are found by email (exact), username (exact) or the start of their display name, with their Nana and wallet balances. Each top-up needs a reason (5+ characters; the member doesn't see it), is at most ₦500,000, rings the member's bell and is logged for good in `creditTopups` (server-only rules), shown on the page. Test: `npm run test:credits`.

**Notes Academy certificates (v0.48.0)** — Pure rules in `lib/certificates.ts` (IDs `NA-C-` + 8 Crockford characters, `normaliseCertificateId`, `cleanSetup`, `faceFor`, `teacherGross`, `linkedInAddUrl`, `faceOnly`); server in `lib/certificates-server.ts`. `academies/{ownerUid}`: the teacher's one-time setup (`/academy/teach/setup`, `components/academy/AcademySetup.tsx`; images through `/api/upload` purpose `academy` → `academy/<uid>/…`; signatures are whitened in the browser; without one the signer's name is set in Mrs Saint Delafield). An accrediting institution starts `pending` and only prints once approved in Admin → Academy; changing it sends it back. `certificates/{id}`: a snapshot of everything printed, so later edits never change an issued certificate; `enrolments/{courseId}_{uid}.certificateId` links it. Price (`quote`): the certificate minimum (Admin → Pricing) + the teacher's margin, plus `certificatePrice`'s late claim fee after the grace days; teachers can't claim their own course. Payment kind `certificate` (card or wallet): `checkoutFor` fixes the price and name at checkout; `fulfillPayment` calls `issueInTransaction` (one per enrolment) and holds the teacher's share (`teacherGross`: margin + the same share of any late fee) in the ledger for `DIGITAL_HOLD_DAYS` at their digital commission rate; bells to learner and teacher; `refundPayment` revokes it. Pages: `/academy/<slug>/certificate` (claim), `/certificates` (lookup), `/certificates/<id>` (public, only printed fields reach the browser; LinkedIn "Add to profile", X, WhatsApp, copy; Download PDF for the owner), `/certificate-print/<id>` (landscape A4, opens the print dialog: "Save as PDF"). `components/academy/Certificate.tsx` draws it everywhere with container-query units; QR via `qrcode` (`lib/certificate-qr.ts`, error correction H, the "na" mark in the middle). Admin → Academy (`/api/admin/academy`): accreditations, the Certified seal per course (`courses.certified = {at, by}`), find and revoke. Course FAQ: `lib/academy-faq.ts` on every course page and as help article `notes-academy-faq`. Tests: `npm run test:certificates`, `npm run test:certificates-server`.

**Certificate layout (v0.48.1)** — `components/academy/Certificate.tsx`: the academy name and subtext stay fixed under the logo; "Certificate of completion" (extra bold, larger) through the "offered by … completed" line is one flex column centred on the certificate (`top: 50%` + `-translate-y-1/2`), keeping the faded gold line under the name; the logo watermark is centred too. `public/demo-cert/` (the screenshot set-up's demo logo) is gitignored.

**Chat reactions, Forward and Delete for me (v0.49.0)** — Our own emojis: `NOTESAPP_EMOJI` in `lib/messages-rules.ts` (`:na:` → `/images/emoji/na.png`, `:academy:` → `/images/emoji/academy.svg`, the Academy line icon in crimson), drawn by `components/NotesAppEmoji.tsx` (`Emoji`, `EmojiText`: used by `LinkedText` with `format`, the reaction chips and the inbox preview); `emojiAsText` for text-only places (the reaction bell). Reactions: `isReaction` now takes any single emoji (one grapheme starting with a pictograph, flag or keycap) or one of ours; `reactionSummary` sorts by count, then the default order. Quick reactions: `REACTIONS` (7, ending with `:na:`) is the default; a member's own set is `userPrefs/{uid}.quickReactions` (`cleanQuickReactions`, `getPrefs`/`setPrefs`, POST `/api/messages/prefs { quickReactions }`, `null` resets), read in the browser by `lib/quick-reactions-client.ts` (one copy per page, cached in localStorage). `MessageMenu` adds ⇄ at the end of the row, which opens `SwapReactions` (pick a place, then an emoji from ours, the grid or typed; one already in the row swaps places). Delete for me: `hideMessages` (`lib/message-edits.ts`, action `hide` on `/api/messages/[id]`, up to 100 ids) adds to `chatHidden/{uid}/chats/{cid}.ids` (owner read only); `Thread` filters them out. `DeleteChoice` (for everyone only when all are yours, otherwise for me) serves both the menu's Delete and the selection bar. The selection bar adds Forward (`ForwardDialog` takes `messageIds`, sent oldest first, up to `FORWARD_MANY` = 10). Tests: `tests/messages/chat-tools.test.ts`, `tests/messages/reactions.emulator.ts`.

**Academy in the navigation; Market and Academy on Explore (v0.50.0)** — `BottomTabs` adds Academy (`AcademyIcon` in `components/shell/icons.tsx`, a mortarboard with a hanging tassel like 🎓; the same drawing, in crimson, is the `:academy:` emoji) between Market and Messages; the header (`NAV`, `APP_NAV` in `app/(main)/layout.tsx`), sidebar and footer say plain "Academy". `NavLinks` and `AuthNav` don't wrap. `ExplorePageClient` adds tabs Market (fetches `/api/public/market` when first opened) and Academy (`useAcademy(undefined, tab === "academy")`), each searchable with its own placeholder, in `xl:grid-cols-4` / `xl:grid-cols-3` grids.

**The certificate as a picture (v0.51.0)** — `lib/certificate-image.tsx` draws a certificate with `next/og` (`ImageResponse`, Node runtime) in the same layout as `components/academy/Certificate.tsx`, in pixels (every size a share of the width): 2000 × 1414, or `og` 1200 × 630 with the certificate on our crimson for link previews. Served at `/certificates/<id>/image.png` (`app/(main)/certificates/[id]/image.png/route.ts`; `?size=og`, `?download=1`; cached an hour; "REVOKED" across a revoked one). Fonts are bundled TTFs in `assets/fonts` (Inter, Newsreader, Mrs Saint Delafield, JetBrains Mono; OFL), included in the function by `experimental.outputFileTracingIncludes` in `next.config.js`, with `assets/certificate-logo.png` (the Notes Academy logo, 640 px) and PNG copies of the two WebP badges. The renderer reads PNG, JPEG and SVG only: academy logos are now converted to PNG on upload (`asPng` in `AcademySetup`), and a picture it can't read is left out. `certificateMetadata` (`lib/og.ts`) uses the `og` picture, so pasting the link anywhere shows the certificate. The certificate page (`CertificateActions`) adds Download image and Copy image link for its owner, with the LinkedIn steps. The 🎓 on the certificate links (course page, lesson player, Teach) is now `AcademyIcon`.

**Course likes, saves and reviews; recommendation stars (v0.52.0)** — `lib/course-social-server.ts`: `courseLikes/{uid}_{courseId}` (`courses/{id}.likeCount`), `savedCourses/{uid}_{courseId}` (owner-read; `useSavedCourses` in `lib/course-social-client.ts`, one shared listener) and `courseReviews/{uid}_{courseId}` (one each, editable; `ratingSum`/`ratingCount` on the course, kept in the same transaction; `finished` marks reviewers who completed it). Reviewing needs half the lessons (`reviewProgress` in `lib/courses.ts`); the teacher replies once. APIs: `/api/academy/social` (GET state, POST like/save) and `/api/academy/reviews` (GET list with `breakdown` and the viewer's `progress`; POST review/delete/reply). Stars show from `RATING_SHOWN_FROM` = 2 (`showsRating`): the course header, cards (`CourseCard`, with a save bookmark on the cover) and the review panel's average. `components/ReviewsPanel.tsx` is now one panel for store items (`itemId`, `ownerUid`) and courses (`courseId`): `RatingBreakdown` (average and the 5→1 split), a "Your review" card, a badge per review ("Bought it" / "Finished the course") and the seller's or teacher's reply. Store `listReviews` returns `breakdown` too. Recommendations: `rating` (1–5, required for new and edited ones; `recommendationSummary` averages those that have one) in `lib/reviews.ts`; `RecommendationsPanel` takes and shows stars; `components/RecommendationsCard.tsx` (stars, count, latest two) sits in the journal sidebar (and in the article on phones) and on the site About page (`SitePageView`); `/api/recommendations` is allowed on members' own domains (middleware `PASS`). Tests: `tests/courses/courses.test.ts`, `tests/courses/social.emulator.ts` (in `test:courses-server`).

**Nana's suggestions; subtopics and subcategories (v0.53.0)** — `lib/subtopics.ts` (pure): a subtopic sits under one of our topics, a subcategory under a Market category; labels 2–30 characters, up to four words (`cleanSubtopicLabel`), slug `normaliseTag`, hashtag `subtopicHashtag` ("IT Support" → #ITSupport); `parseTopicSuggestion` / `parseCategorySuggestion` check a model's JSON against our lists, `fallbackTopicSuggestion` / `fallbackCategorySuggestion` match words. `lib/subtopics-server.ts`: public-read, server-written `subtopics/{parent}__{slug}` and `storeSubcategories/{categoryKey}__{slug}` (`uses`, `createdByUid`); `ensureSubtopic` creates or counts one in a transaction (new ones go live straight away, the owner's decision); `suggestFor` asks Pearl (`gemModel("pearl")`, the platform key only, never charged to the writer, cached an hour per title) with the topic or category list and the existing subtopics, falling back to words. APIs: `POST /api/nana/suggest` (signed in, 60 an hour), `POST /api/topics/subtopics` (ensure, 60 an hour), `/api/admin/topics` (list, rename, remove; content and moderation staff) for **Admin → Topics**. `components/NanaSuggest.tsx`: `TopicSuggestions` (1.2 s after typing stops, title of 6+ characters; chips, NEW badge, Add all, Not now, Refresh), `SubtopicChips`, `CategorySuggestions`. Journals keep subtopics as hashtags in `tags` (`NoteForm` ensures them on save); courses keep `subtopics` (`updateCourse` ensures them and drops those whose topic was removed; shown on `CourseView`); store items keep `subcategory` (`StoreManager`, rules `validStoreItem`; shown as Category › Subcategory on `ShopItemView`). Tests: `tests/topics/subtopics.test.ts` (in `test:topics`), `tests/topics/subtopics.emulator.ts` (in `test:nana-server`, with a fake model).

**Paid courses; co-tutors and organisations; course details (v0.55.0)** — `lib/courses.ts`: `Course` gains `priceKobo`/`free`, `certificateIncluded`, `level`, `language`, `format` (self or live), `outcomes`, `requirements`, `runsFor`, `schedule`, `modules`, `outline` (the public list of lessons: title, kind, minutes, preview, module), `hasClassLink`/`hasCommunityLink`/`communityKind`, `tutors`/`tutorUids`, `isOrg`/`createdByUid`; lessons gain kinds `video` (Cloudflare Stream `streamUid`) and `pdf` (`fileKey` in the private bucket), `preview` and `moduleId`; `orderedLessons`/`groupByModule` (by module, then order), `includesOf` (This course includes), `cleanPrice`, `cleanLink`, `canSellCourses` (Pro and up) and `canUploadVideo` (Business, Enterprise). `lib/courses-server.ts`: `accessTo` (lead: the owner, an organisation's admins and the writer who made it; tutor: an accepted co-tutor), `createCourse` with `orgUid`, `myCourses` (own, made for an organisation, the organisation's as admin, co-taught), `courseForOwner` (with the private links, invitations and the owner's plan), `updateCourse` (price and certificate: the lead, within the plan; links to `courseLinks/{id}`; modules reorder the lessons in a transaction), uploads checked by `checkUpload` (paid courses only, the plan, and that the Stream video or PDF really is the course's), co-tutors (`inviteTutor`, `respondTutor`, `removeTutor`, `courseTutorInvites/{courseId}_{uid}`, the lead keeps at least 10%), `linksFor`, and paid courses can't be enrolled in for free or deleted once bought. `lib/course-sales-server.ts`: `courseCheckout` (kind `course` in `app/api/paystack/initialize`, card or wallet), `courseShares` + `fulfilCourseInTransaction` (in `fulfillPayment`: `coursePurchases/{ref}`, the enrolment with `purchaseRef`, one more learner, ledger entries split like a co-authored gift, each share at its own plan's digital rate, held 7 days and paid out automatically), `openLesson` (free courses and previews for anyone; otherwise tutors, or a buyer on at most two devices through `viewAccess/{ref}`; the first paid lesson opened sets `startedAt`), `claimIncludedCertificate`, `refundable` (7 days, not started) and `undoCoursePurchase`. `lib/course-uploads-server.ts` wires Stream and the bucket. APIs: `/api/academy/courses/[id]/upload`, `/api/academy/courses/[id]/tutors`, `/api/academy/lesson` (content, PDF bytes, removeDevice), `/api/academy/links`, `/api/academy/purchase` (the learner's refund), POST `/api/academy/certificate` (included). Rules: a paid course's lessons are never readable from browsers. UI: `CourseView` (tabs Overview, Curriculum, Tutors, Reviews; price card, This course includes, `ShareRow`, Course details; a price bar on phones; Review opens the Reviews tab and scrolls to it), `LessonPlayer` (`RemoteLesson`, `StreamLesson` with the drifting watermark and our own full-screen button, `PdfViewer`), `CourseEditor` (About the course, Price, Tutors, Modules, uploads with progress, Free preview), `TeachDashboard` (Teach as, invitations), `AcademyPageClient` (Topics list with counts, Level and Price filters), `CourseCard` (level, filed under, price). Webhook `course.sold`. Tests: `tests/courses/paid.emulator.ts` (in `test:courses-server`), a rules test.

**Sitewide update (v0.57.3)** — Every page, help article and Nana's knowledge brought up to v0.55.0: `lib/site.ts` (`WHAT_YOU_CAN_DO`: free and paid courses, co-tutors, organisations, certificates; a Nana line), the home page (Explore's tabs, the Academy tab, Notes Academy, Nana, a new MCP card), About (Notes Academy, a Certificates card, Nana, an MCP card, what's still to come, the paid-course fee), the roadmap (metadata, Courses, Notes Life with CardTap, Paylony, the live and not-live lists, last updated), Pricing (buying paid courses, Nana's allowance, gems and credit), Academy and Explore metadata, Trending, profile and site course empty states, Store selling, Organisations (Teach as your organisation), the Nana page (Summarise and Translate, suggestions, gems), Notes Life (the CardTap billboard), `NotesLifeCard`, `lib/kb-articles.ts` (the tab bar, Explore, Saved, organisations, digital courses, the roadmap article), `NANA_PAGES` in `lib/nana-prompt.ts` (adds `/certificates`, `/academy/teach`, `/academy/teach/setup`, `/nana`, `/life`, `/life/play`, `/life/partners`, `/install`, which `sanitizeLinks` would otherwise strip), the MCP instructions and `search_courses` description, the sitemap (`/certificates`), the footer (Check a certificate, Notes Life), the README and `docs/ARCHITECTURE.md` (a paid courses, co-tutors and certificates section). Fix: `weekCourses` in `lib/digest-server.ts` labelled every course Free; it now uses `priceLabel`. Logistics is left out: it brings its own pages and help.
**Adverts and boosts; the digest's new layout (v0.58.0)** — `lib/ad-config.ts` (pure): `AdConfig` (boostsWide 3, boostsPhone 1, boostRotateSec 45, adRotateSec 30, feedPromoted 2, digestSlots 3, spotsOff) with `cleanAdConfig` limits, and the creative spec (`AD_IMAGE` 1200 × 628, sharp 2400 × 1256, min 600 × 314, 500 KB best, 1 MB max, safe 960 × 502; `BILLBOARD_IMAGE` 1600 × 900; `AD_TITLE_MAX` 60, `AD_TEXT_MAX` 120; `cropFor`, `imageProblem`). `lib/ad-config-server.ts`: `adConfig/main` (server-only rule), cached a minute; `/api/admin/ad-config` (growth) and `components/admin/AdSettings.tsx` on Admin → Ads. `AD_PLACEMENTS` gains market, academy, explore, search, course, digest and life, each with a `where` for the spec page. `/api/ads` drops spots switched off and returns `rotateSec`; `AdSlot` is a fixed 1.91:1 frame, rotates only while half on screen, `offset` and `stacked` props. `/api/boosts/active` returns `show` and takes `limit=feed`; `BoostedStrip` shows `wide`/`phone` per set, rotates every `rotateSec` (paused on hover and off screen), with dots; the journal feed places promoted posts after posts 3, 8, 13 and 18. New spots in `MarketPageClient`, `AcademyPageClient`, `ExplorePageClient`, the journal feed when searching, and `CourseView` (free courses only). The campaign form and the admin form crop with `components/advertise/ImageCrop.tsx` (JPEG under 500 KB where possible); checkout enforces the limits and a billboard picture for life; approval copies `billboard` into `adCreatives`. `/advertise/specifications` reads the live numbers; `/api/ads/template` draws the PNG templates. Notes Life: the street has an advertisers' billboard (`bb:ad`, a house "Your advert here" board when none), loaded through `/_next/image` so WebGL can draw it, with an impression per visit and a click to the advertiser. Digest (`lib/digest.ts`, `lib/digest-server.ts`): `pickStories` 10, interests first; `weekMarket`/`weekCourses` return pools of 40 with tags and `pickItems` chooses 4 per reader; `weekSponsors` + `fillSlots` fill 3 slots (boosted journal, advert, boosted item, each falling back), never past a boost's daily cap or what was bought; `countSends` adds each email sent to the boost's impressions and the advert's `adStats` (digest spot); clicks go through `/api/digest/go` (destination looked up server-side). Tests: `npm run test:ads` (pure), `test:digest` (sponsors and counting on the emulator).
**The football emoji (v0.58.1)** — `public/images/emoji/football.png` (128 × 128, the ball cut out of the owner's badge with the outer blue ring removed, transparent around it) and `:football:` in `NOTESAPP_EMOJI` / `NOTESAPP_EMOJI_RE` (`lib/messages-rules.ts`); the picker, reactions, `LinkedText` and `emojiAsText` pick it up from the list. Test in `tests/messages/chat-tools.test.ts`.
**CardTap wallet top-ups (v0.59.0)** — `lib/cardtap-topup.ts` (pure): Paylony's fee at cost (`cardtapFeeKobo`: 1%, capped at ₦1,000; `cardtapQuote` with the launch offer), and strict readers of Paylony's replies (`readStart` for the app code; `readVerify` credits only on a payment-level status of paid for at least the amount asked, never on the reply's own "00"). `lib/paylony.ts`: `payWithCardtap` (POST /pay_with_cardtap with `PAYLONY_CARDTAP_TERMINAL_ID`) and `verifyCheckoutPayment`. `lib/cardtap-topup-server.ts`: `startCardtap` writes a pending `payments/{reference}` (kind `wallet_topup`, `payWith: "cardtap"`, `cardtap: { feeKobo, waived, payKobo, initiationRef }`; the wallet gets the top-up, not the fee); `checkCardtap` runs `fulfillPayment`, which for CardTap calls `confirmCardtap` (Paylony instead of Paystack; keeps the last reply on the payment; `CardtapNotPaid` while waiting or refused, `cardtapFailed` when refused) and then the usual `creditTopup` ("Top-up via CardTap"), once. Asked by `/api/wallet/cardtap` (GET ?ref=, every 4 s from `components/wallet/CardtapTopUp.tsx` for up to 15 minutes, and on Paylony's redirect back) and by the Paylony webhook, which now stores any event and checks a CardTap top-up by its reference (it credits nothing on its own word). The launch offer: `walletConfig/main.cardtapFeeWaived`, switched in Admin → Credits (`action: "cardtap_fee"`). Refunds: `refundPayment` takes the credit back and marks `cardtapRefund.status = "ask_paylony"`; Paylony returns the money. Tests: `test:cardtap` (pure) and `test:cardtap-server` (emulator, Paylony stubbed).

**Footer arrangement and the calls page (v0.61.1)** — `app/(main)/layout.tsx`: the owner's order. Column one: the logo, the line, the reference customers and Staff Login, then the email, LinkedIn, Facebook and the #NotesApp channel (and any other social links set in Admin → Settings), then Terms | Privacy. Then `PRODUCT`, `COMPANY` and `CONNECT` arrays, one map for the three columns. Spaces and Circles link to their anchors on `/community`;  "Encrypted group calls" to the two sections of the new `/calls` page (`app/(main)/calls/page.tsx`: 1-on-1, group calls with `GROUP_CALL_MAX`, the safety code, privacy; linked from the sitemap and Nana's pages).
