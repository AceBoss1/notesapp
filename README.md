# #NotesApp

Where African creators, professionals and businesses publish, take bookings, sell and get paid in Naira. Next.js 14 (App
Router) on Vercel, Firebase (Auth, Firestore), Cloudflare R2 and Stream, Paystack, Resend, Anthropic (Nana).

**New here? Read `HANDOVER.md` first** (how the work is done, what's waiting, the map of the code), then this page.

| Doc | What's in it |
|---|---|
| `HANDOVER.md` | The state of the code, what's waiting on the owner, how the work is done, map of the code, tests, known gaps |
| `docs/ENVIRONMENT.md` | Every setting (environment variable), made from `lib/config.ts` |
| `docs/DEPLOY.md` | Deploy checklist, where to look when something's wrong, scripts |
| `docs/ARCHITECTURE.md` | How the newer pieces work: addresses, bells, digest, server-owned writes, shared limits, settings |
| `docs/DOMAIN_SWITCH.md` | Moving the primary address to notesapp.tech |
| `docs/STAGING.md` | The staging copy and how a release goes |
| `docs/COURSES.md` | The course platform plan (free YouTube courses, paid courses, certificates) |
| `docs/BUILD_LOG.md` | The full history, in order (what used to be this README) |
| `lib/changelog.ts` | Release notes, shown at `/changelog` |

## Where things stand (updated 17 Oct 2026, v0.40.0)

### Live today
| Area | What exists | Where to read more |
|---|---|---|
| Publishing | Journals (Markdown composer with toolbar and preview, drafts, premium posts), follow, likes, comments and replies, shares, co-authoring, organisation channels and teams, drag-and-drop or pasted pictures | "Who can publish", "Organisation accounts", co-authoring in "Boosts & gifts" |
| **Links and @mentions** | Web addresses become links wherever members write (`lib/linkify.ts`, `components/LinkedText.tsx`, `remarkLinkify` for journals); link preview cards in Messages and Notes Life chat (`/api/link-preview`: signed in, public addresses only, every redirect re-checked, 512 KB / 5 s, cached 6 h); the @mention picker (`components/MentionPicker.tsx`, users by username prefix) in journals, comments, replies, messages, moment captions and Notes Life chat; @username links to `/u/username` | `/help` → "Links and @mentions" |
| **Video on posts** | One MP4/WebM per post (≤ 100 MB, ≤ 3 min, weekly allowance by plan), our own player, cover-image picker, server-verified uploads | "Video on posts" |
| **Share previews** | Per-post, per-store-item and per-store Open Graph cards | "Share previews (Open Graph)" |
| Booking & money | Native calendar, Paystack checkout, escrow-style holds, automatic payouts, client rescheduling/cancellation + problem reports | "Payments, payouts, rates, reminders", "Money flow" |
| **NotesApp Credit wallet** | Top up ₦1,000 to ₦500,000 through Paystack (bonus credits on larger top-ups), pay with wallet or card or both, statement with filters, refunds to the wallet; switch: `NEXT_PUBLIC_WALLET_LIVE` | `lib/wallet.ts`, `lib/wallet-server.ts`, `/help` |
| Stores | Physical goods (managed stock, categories, "ships from", parcel IDs, rider links, tracking), digital downloads (private bucket, short-lived links), saved items ♡, featured item, store boosts, reviews from buyers who received the item (with seller replies), official merch pre-orders; organisation admins can add and edit items | "Seller checkout and parcel tracking", "Boosts & gifts", `/store-selling` |
| Promotion & discovery | **Journals, Notes Market (`/shop`) and Notes Academy (`/academy`) in one order: For you, Most viewed this week, Recent** (`lib/discovery.ts`); profile tabs Notes, Store, Courses; Trending tabs Notes, Store, Courses, Publishers; post/item boosts (cancel any time, half of what's left refunded), gifts, self-serve banner ads and ad share, recommendations on profiles and organisations | "Boosts & gifts", "Advertiser campaigns" |
| Plans & badges | Free Standard/Basic, Pro, Business (Paystack plans), Enterprise (custom); prices set by the owner in Admin → Pricing; maroon ✔, gold ✔ (endorsed; identity-checked is built but **Dojah is still on the sandbox**) | "Pro / Business plans", "Verified badge", "Dojah webhook" |
| **Enterprise** | Server-to-server API (`/api/v1`), Console, signed webhooks, `/docs`, own domain (subdomain or root), site themes (Legacy or Modern) for Business and Enterprise | "API, Console, Docs and custom domains" |
| **App address** | `app.notesapp.name.ng`: welcome screen with sign-up and sign-in, a Download button that knows the device, then the journal feed | `middleware.ts` |
| Trust & ops | `/security`, `/status` (+ incidents, response times, email subscribers, calls and their relay, Claude), `/changelog`, account export/deletion, error monitoring, traction snapshot (stored hourly), admin by custom claims and departments | "Where to look when something's wrong" below |
| **Messaging** | Direct messages and group chats (up to 50, admin moderation), voice notes, stickers, emoji, bold/italic/underline, replies, pin 3 messages and 3 chats, typing indicator, edit/delete with reader consent once read, link previews, moments, block/report, device and email notifications | Flags `NEXT_PUBLIC_MESSAGES_LIVE`, `NEXT_PUBLIC_MOMENTS_LIVE` |
| **Calls** | Free 1:1 voice and video calls between people who follow each other (WebRTC), call back from the call line, drag/swap self view, front/back camera, ringing on the installed app even when closed; relay through Cloudflare TURN or our own TURN | `lib/calls-server.ts`, flag `NEXT_PUBLIC_CALLS_LIVE` |
| **Followers and presence** | Followers and Following lists on every profile, online now and last seen (only for people who follow you), two privacy switches | `/help` → "Followers, following and online status" |
| **Nana AI and help centre** | Chat on every page, pinned in `/messages`, `/nana`, `/help` articles (built-in + staff, Admin → Help & Nana), writing help in drafts, sharing and messages, member-connected Anthropic key, Ask Nana in the team hub, help-centre-only answers when the AI is off | "Nana AI and the help centre" |
| **Notes Life** | A free life game at `life.notesapp.name.ng` (and `/life`) played with the NotesApp account: needs, jobs and shifts, food (Chef Adams delivery, takeaway, dine-in, cooking), a fridge and microwave, NEPA blackouts with Power GO / generators / solar, Abuja (Lagos coming), partners Chef Adams, itel Energy, Candellux Imperial (suites with an 11 AM checkout, room service, the pool, swimming lessons, the VIP bar with a 360° view, gym) and Digital Witch (courses, certificates for tech jobs, Cynthia Okeh as #1 and her Saturday giveaway), partner outlets players can own, residents 🤖 and real players at the same place, chat with friends, invites (₦250 each), Billionaires List, sound. Game money (Notesville Naira) bought with the wallet or a card, never cashed out | README "Notes Life" section, `/help` → "How Notes Life works", `/life/partners`, flag `NEXT_PUBLIC_LIFE_LIVE` |
| **Social publishing** | Publish a post to a connected LinkedIn or X account (`LINKEDIN_*`, `X_*` variables) | "Publish to LinkedIn and X" in `/changelog` |
| **Team hub (internal)** | Work board (views by person, departments, due dates), milestones, daily/weekly summaries, meetings with Granola (each member connects their own account), money ledger, Grants & subscriptions, Expenses due, payment assignee and deadlines, payroll, staff library with "I have read this" and who has read it, team message hub, legal team access, Admin → Pricing, the AI agent-layer backlog (15 items with owners and due dates). Opens to Business and Enterprise after internal testing (`/teams`) | "Money ledger", `lib/admin-access.ts` |
| **Public site** | Home and About with the owner's description, Trusted by and Partners marquees (`lib/partners.ts`), With thanks (programmes that back us), `/pricing`, `/teams`, `/roadmap`, `/domains`, the #1MillionNairaNotesAppChallenge; the standard description lives in `lib/site.ts` | `lib/partners.ts`, `lib/site.ts` |
| Company | NOTESAPP TECHNOLOGIES LTD (RC and TIN in `lib/site.ts`; SMEDAN number pending) | "Company identity" |

### Not built yet
**#NotesApp Courses** (`docs/COURSES.md`: free courses with the publisher's YouTube, paid courses on Pro and Business, Enterprise from ₦100,000 a month, certificates with verification and sharing) · WhatsApp reminders (plan: Meta WhatsApp Cloud API directly; booking reminders + delivery updates; needs Meta Business
verification and approved templates) · publishing to Facebook, Instagram and TikTok (LinkedIn and X are built) · the NotesApp MCP server and the Nana operator
(scoped; the work is on the team hub as the agent-layer backlog) · AI notetaker · team hub and team messaging for Business and Enterprise (internal only for now) ·
LinkedIn advertising (Advertising API development tier approved; advertisers boost a post on LinkedIn from their own ad account, plus our own campaign stats on Traction) ·
Paylony virtual accounts and bank payouts (client in `lib/paylony.ts`; the payout and reserved-account endpoints are not in yet) · domain sales and DNS management (Whogohost / go54) ·
Notes Life: Lagos, the conference hall, real players in the VIP bar · iOS/Android apps · video transcoding/streaming (we cap size and length instead) · Dojah **live** mode (README "Going live with Dojah") ·
webhook retries (one attempt, manual resend) · OAuth for third-party API apps · checkout and bookings in a popup on custom domains, and a sending address on the member's own domain (sign-in and sign-up in the member's name are live) ·
investor data room, runway calculator, CAC and MRR calculator, burn and revenue analytics, vesting and cap table (planned) · voice (Listen on journals, Nana reading aloud) · Sentry (we have built-in error monitoring instead).

## Run it locally

```bash
npm ci
cp .env.local.example .env.local   # Firebase web config and a service account at least (docs/ENVIRONMENT.md)
npm run dev                        # http://localhost:3000
```

## Checks

```bash
npx tsc --noEmit                   # types (there is no ESLint config)
npm run test:rules                 # Firestore rules (needs Java; starts the emulator)
npm run test:life                  # Notes Life economy
npm run test:messages              # message edits
npm run test:mentions              # @mention bells
npm run test:digest                # weekly digest
npm run test:authors               # journal author backfill
npm run test:shared                # shared rate limits and cache
npm run test:topics                # topics, hashtags and the topic backfill
npm run test:discovery             # For you, Most viewed and Recent shelves
npm run test:preview               # link-preview safety (listens on port 80)
npm run test:smoke                 # Playwright smoke test against a running site (SMOKE_BASE_URL)
npx -y tsx scripts/settings-doc.ts --check   # settings read only through lib/config.ts; docs/ENVIRONMENT.md current
```
CI runs all of them on every pull request (`.github/workflows/ci.yml`).
