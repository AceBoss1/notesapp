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
