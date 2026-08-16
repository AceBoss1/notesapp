# #NotesApp — landing page + MVP

A deployable Next.js app: the public marketing site plus a working
demo of the core loop — a native booking calendar, a per-professional
brand store, and full engagement (comments, likes, shares). It reads
and writes **the exact same Firestore data Precheks already has** —
same `notes`, `users`, `usernames`, and `settings` collections, same
Firebase Auth project, same security rules. Nothing about Firestore
changes for this demo. #NotesApp is a second, differently-branded UI
over data Precheks already owns; "journal" is what this UI calls a
note, nothing more.

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
writers. **Important scope boundary:** neither role currently grants
publish permission. `firestore.rules`' `notes/{noteId}` create rule
still only checks `isAdmin()` — the 2 hardcoded founder emails — not
this field. A client-writable Firestore field was never going to be
the right place to grant that (a malicious actor reasoning about it
client-side is exactly the risk the third-party review's point #2
flagged); wiring real publish permission for staff/volunteer needs the
same Firebase custom-claims (Admin SDK) migration already documented
there. Today, `role` is a label and a moderation marker, not an
authorization grant. Admins assign it from `/admin/users`.

**Suspension.** `lib/moderation.ts`: `suspendUser()`,
`unsuspendUser()`, `rejectAppeal()`, `updateUserRole()`,
`getSuspendedUids()`. A suspended account:
- Shows the locked-profile avatar (`public/images/brand/suspended-avatar.png`)
  and a "⚠ Temporarily Suspended" badge in place of the normal role
  label, on their own profile page.
- Has its published notes hidden behind a "temporarily hidden" banner
  on the journal detail page (`authorProfile?.status === "suspended"`
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
   directly on the homepage (`app/page.tsx`), right below the hero,
   explicitly separating what's live from what's roadmap. Extends the
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

## Not built in this session (by design)

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
