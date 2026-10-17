# #NotesApp hand-over note

**Date:** 17 October 2026 · **Latest version:** v0.40.0 · **Repository:** `AceBoss1/notesapp`
**Owner:** the founder and CEO of NotesApp Technologies Ltd (product decisions, approvals, deploys that need console access).

Start with `README.md` (what is live, the docs index, the checks); settings are in `docs/ENVIRONMENT.md`, deploying in
`docs/DEPLOY.md`, how the newer pieces work in `docs/ARCHITECTURE.md`, the full history in `docs/BUILD_LOG.md`.
This note covers how the work is done, what's in flight, and what to watch.

---

## 1. Where the code is right now

| | State |
|---|---|
| `main` | **v0.36.0** (merged 16 Oct 2026, with this note and the updated README): Notes Life hotel stays (11 AM checkout, room service, 100% needs in the suite), the calm sound in the suite / VIP bar / classes, site-wide links, chat link previews and the @mention picker; before it, #145 and #146 (Digital Witch landing cards, the partner card, the VIP bar 360° view, the pool shape, the street billboard). Vercel deploys `main` on merge. |
| `claude/pensive-allen-5tvypx` | The previous session's working branch, reset to `main` after each merge. |
| `push/discovery` | **v0.40.0:** the new look from the owner's Moda designs (the phone header and tab bar, the app frame on computers, the journal feed, Explore, saved journals, Messages, calls, the profile header, Trending), Journals, Notes Market (`/shop`) and Notes Academy (`/academy`) in one order (For you, Most viewed this week, Recent), profile tabs and buttons, Trending tabs, badges after every name, the ℹ️ on Gift me, and demo data for the emulators (`scripts/seed-demo.ts`). |
| `claude/interests-and-courses` | v0.39.0, merged: hashtag interests and one topic list (`lib/topics.ts`, `/interests`, the journal form, For you in the feed, the Topics tab, the digest), and the course platform plan (`docs/COURSES.md`). |
| `claude/server-writes-and-docs` | v0.38.0, merged: server-owned comments and notifications, shared rate limits (Upstash), one place for settings (`lib/config.ts`), journals by account id, the staging plan and CI, the digest admin page, the short README and `docs/`, and the fund and launch tasks on the team hub. |
| `claude/notesapp-tech-and-digest` | v0.37.0, merged: the primary address setting, link-preview fix, @mention bells, the weekly digest. |

Working branch convention (owner's instruction, 17 Oct 2026): branches are named `push/<what it is>`, for example
`push/interests-and-courses`. Vercel doesn't deploy `push/*` or the older `claude/*` branches (`vercel.json`); only `main` goes live. After each squash merge the branch is reset to `main`
(`git fetch origin main && git checkout -B <branch> origin/main && git push -f -u origin <branch>`).

## 2. Waiting on the owner

1. **`firebase deploy --only firestore`** (also needed for v0.40.0's saved journals, `savedJournals`; until then the bookmark can't list what you saved). The rules that let Notes Life presence use the Digital Witch hub (`dw`) are merged
   but not deployed. Until they are, players at the hub don't appear to each other.
2. **Firestore index suggestions** (Query insights, e.g. `ledger WHERE status = ? COUNT`): create them with the console's one-click
   "Create index" when they appear.
3. **The agent-layer scope PDF**: attach it to the staff library entry "Where AI agents meet #NotesApp".
4. **Legal draft set** (counsel pack, fixed documents 1.2–3.2, equity plan, five-director consent): drafts are **kept out of the
   repository on purpose** and are still open.
5. **Dojah live mode** and **Paylony live keys**: both are still on test/sandbox (`docs/BUILD_LOG.md` "Going live with Dojah"; `lib/paylony.ts`).
6. **notesapp.tech (the .tech No Excuses Fund, applications close 15 Dec 2026):** register it in the company's name, then
   follow `docs/DOMAIN_SWITCH.md` (Vercel domains, Firebase authorised domains, Resend, webhooks, LinkedIn/X callbacks,
   then `NEXT_PUBLIC_ROOT_DOMAIN=notesapp.tech`). The fund wants the **primary** site on .tech: every link we publish should use it.
7. **Before the fund's code review** (terms 4.5: read-only repository access may be asked for): decide what reviewers should
   not see (company numbers, counsel's advice, partner details in `docs/BUILD_LOG.md` and this note) and move it out. Removing it
   from the files is not enough: git history keeps it, so share a clean copy of the repository (a fresh repo from the current
   files) rather than this one.
8. **Weekly digest:** Admin → Weekly digest: Preview, Send me a test, then Turn on. Check the Resend plan first (free = 100
   emails a day for everything). Links are signed with `CRON_SECRET` unless `EMAIL_LINK_SECRET` is set.
9. **After merging v0.38.0:** `firebase deploy --only firestore` (browsers can no longer create notifications or comments;
   until it's deployed the old rules still allow it), create the Upstash database (`UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`), and run `npx -y tsx scripts/backfill-author-uids.ts` then `--apply`.
10. **Staging:** `docs/STAGING.md` (a second Firebase project and the `staging` branch on Vercel Preview).
11. **After merging v0.39.0:** `npx -y tsx scripts/backfill-topics.ts` then `--apply` (files older journals under topics).
12. **Courses:** the four decisions in `docs/COURSES.md` ("Open questions") before step 1 starts.
All of these are on the team hub board with departments and dates (`lib/team-seed.ts`: `FUND_BACKLOG`, `LAUNCH_BACKLOG`, `COURSES_BACKLOG`, `TOPICS_BACKLOG`).

## 3. How the work is done (please keep these)

- **Never open a PR unless asked.** "Open the PR and merge" means: stop any running build → start the Firestore emulator
  (`npx firebase-tools@13 emulators:start --only firestore --project demo-notesapp`) → `rm -rf .next` → `next build` with the
  emulator env (Firebase demo project, a dummy service-account JSON, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`) → confirm
  **"Compiled successfully"** and **`ƒ Middleware`** in the output → create the PR (no PR template in the repo) → **squash-merge** →
  reset the branch to main.
- **Settings only through `lib/config.ts`** (`setting("NAME")`), never `process.env`; CI checks it.
- **Comments and notifications are written by the server**, never by browsers (`lib/comments-server.ts`, `notifyBell`).
- **Journals are matched by account id or username** (`isNoteBy`), never by display name.
- **One build at a time.** Two `next build`s in parallel exhaust the container.
- **Commits and pull requests are the owner's** (his instruction, 17 Oct 2026): author `Emmanuel Adams <emmanuel@adams.com.ng>`
  (`git config user.name "Emmanuel Adams"`, `git config user.email emmanuel@adams.com.ng`), and every commit message and PR
  description ends with
  `Authored-By: Emmanuel Adams of Adams Consults (https://www.adams.com.ng) <emmanuel@adams.com.ng>.`
  No Claude or AI naming anywhere: no co-author line, no session link, no "generated with" footer, no model names or IDs in
  commits, PRs, code or docs.
- **Legal drafts are never committed.** The **Vision** page stays out of the changelog, the roadmap and public docs; it is served only to the
  people it concerns (`lib/vision-server.ts`, `VISION_PEOPLE`).
- **Screenshots before shipping:** every major UI build (a new page, a new email, a redesigned panel) is shown as phone and
  desktop screenshots for approval before it ships, rendered from the real code (Chromium is in the container:
  `/opt/pw-browsers/chromium`).
- **Game features: mockups first.** Show phone and desktop mockups of important Notes Life features for approval before building
  (they are rendered from the real `components/life/world.ts` scenes).
- **Every feature ships with its docs:** a `lib/changelog.ts` entry (Added / Changed / Fixed, version bump), the help article in
  `lib/kb-articles.ts` (Nana answers from these), the docs (`README.md` "Where things stand", `docs/ARCHITECTURE.md`; settings in
  `lib/config.ts` then `npm run docs:settings`), and tests where there is server logic.
- Writing style for anything people read: short, plain sentences; British spelling; prices in N$ (game) or ₦ (real money).

## 4. Map of the code

| Area | Where |
|---|---|
| Pages | `app/(main)` (the site and app), `app/(site)`, `app/life` (Notes Life landing and partners), `app/api` (all server routes) |
| Hosts | `middleware.ts`: `app.notesapp.name.ng` (welcome screen, then the feed), `life.notesapp.name.ng` (the game), members' own domains |
| Firebase | client `lib/firebase.ts`; admin `lib/firebase-admin.ts` (`verifySignedInRequest`, `verifyAdminRequest`, departments) ; rules `firestore.rules`; TTLs `firestore.indexes.json` |
| Messaging | `components/messages/*`, `lib/messages-server.ts`, `lib/groups-server.ts`, calls `lib/calls-server.ts` + `components/calls/*` |
| Links and @mentions | `lib/linkify.ts` (tokenizer + `remarkLinkify`), `components/LinkedText.tsx`, `components/MentionPicker.tsx`, `components/LinkPreview.tsx`, `app/api/link-preview/route.ts` |
| Addresses | `lib/host.ts` (the primary address and every domain's family), `middleware.ts`, `lib/use-family-url.ts` + `components/FamilyLink.tsx`, `docs/DOMAIN_SWITCH.md` |
| Mention bells | `lib/mentions-server.ts`, `app/api/notify/mentions/route.ts` (comments, journals); reviews, recommendations and moments call it on the server |
| Settings | `lib/config.ts` (every setting), `docs/ENVIRONMENT.md` (made from it: `npm run docs:settings`) |
| Comments and bells | `lib/comments-server.ts`, `app/api/comments`, `app/api/notify/like`, `app/api/admin/notify`, `lib/moderation-messages.ts` |
| Shared store | `lib/shared-store.ts` (Upstash REST, memory fallback), `lib/rate-limit.ts` |
| Topics and interests | `lib/topics.ts` (the one list), `components/TopicPicker.tsx`, `app/(main)/interests`, `app/api/account/interests`, `lib/interests-client.ts`, `scripts/backfill-topics.ts` |
| Frame | `lib/chrome.ts` (which page gets which frame), `lib/member-client.tsx` (the signed-in member, once), `components/shell/` (Masthead, BottomTabs, AppSidebar, AccountSheet, Frame: AppFrame, ChromeGate, FooterGate) |
| Journal feed | `components/JournalsPageClient.tsx`, `components/feed/FeedPost.tsx`, `FeedModules.tsx`; Explore `components/ExplorePageClient.tsx`; saved journals `lib/saved-journals-*.ts`, `app/api/journals/save`; badge suggestion `BadgePitchCard` in `components/BadgeToast.tsx` |
| Calls (look) | `components/calls/CallViews.tsx` (`CallStage`, `IncomingCall`: plain props, handy for screenshots); the logic stays in `CallManager.tsx` |
| Discovery | `lib/discovery.ts` (the shelves: For you, Most viewed, Recent), `lib/discovery-server.ts` + `app/api/public/weekly-views` (this week's visits from `pageViews`), `components/DiscoveryHero.tsx`, `Shelf.tsx`, `RankedList.tsx`, `FollowCards.tsx`, `JournalsPageClient.tsx`, `app/(main)/trending` |
| Notes Market and Academy | `/shop`: `components/MarketPageClient.tsx`, `MarketCard.tsx`, `lib/shop-directory.ts` (`getMarket`), `app/api/public/market`; `/academy`: `app/(main)/academy`; profile tabs `components/ProfileTabs.tsx`, `BookSessionButton.tsx` |
| Badges by names | `lib/name-badges.ts`, `lib/badges-client.ts`, `app/api/public/badges`, `components/PersonName.tsx` (`NameBadgeIcons`) |
| Demo data | `scripts/seed-demo.ts` (emulators only; `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST`, `NEXT_PUBLIC_AUTH_EMULATOR_HOST`), see `docs/STAGING.md` |
| Courses (planned) | `docs/COURSES.md`; builds on view-only lessons (`components/LessonsEditor.tsx`, `lib/stream.ts`, `lib/private-files.ts`) |
| Weekly digest | template `lib/digest.ts`, sending `lib/digest-server.ts`, cron job `weeklyDigest`, `app/api/digest/unsubscribe`, `app/api/account/email-prefs`, `app/api/admin/digest`, `app/(main)/admin/digest`, `components/EmailSettings.tsx` |
| Money | Paystack `app/api/paystack/*`, `lib/payments.ts`; wallet `lib/wallet*.ts`; Paylony (in progress) `lib/paylony.ts`; team ledger in the admin area |
| Nana AI | `lib/nana-*.ts`, `components/Nana*.tsx`, help articles `lib/kb-articles.ts` |
| Platform numbers | `lib/stat-cache.ts` (snapshots in `statCache/{key}`: traction hourly, revenue every 15 minutes), `lib/traction-server.ts` |
| Notes Life | rules and catalogue `lib/life/catalog.ts` · server economy `lib/life/server.ts` (`act`, `mutate`, `LifeError`) · needs, activities, saves `lib/life/play.ts`, `components/life/save.ts` · 3D scenes `components/life/world.ts` (three.js) · UI `components/life/LifeGame.tsx` · sound `components/life/sound.ts` (Web Audio, no files) · friend chat `components/life/FriendChat.tsx` · presence `components/life/presence.ts` · VIP bar view `components/life/VipPano.tsx` |
| Game time | a game day is 48 real minutes, a game hour 2 real minutes (`worldTime`, `WORLD_EPOCH`, `GAME_HOUR_MS`) |

## 5. Tests and checks

```
npx tsc --noEmit -p .          # types (there is no ESLint config in this repo)
npm run test:rules             # Firestore rules, 54 tests (needs Java)
npm run test:life              # Notes Life economy; prints "ALL OK"
npm run test:messages          # message edit/delete rules
npm run test:mentions          # @mention bells; prints "ALL OK"
npm run test:digest            # weekly digest; prints "ALL OK"
npm run test:preview           # link-preview safety (no emulator; listens on port 80)
npm run test:authors           # journal author backfill
npm run test:shared            # shared rate limits and cache (a stand-in Upstash)
npm run test:topics            # topics, hashtags and the topic backfill
npm run test:discovery         # For you, Most viewed and Recent shelves
npm run test:smoke             # Playwright, against a running site (SMOKE_BASE_URL)
```
The emulator-based tests start their own emulator on port 8080, so stop any emulator you started yourself first.

## 6. Known gaps and things to check

- **v0.36.0 was not tried in the live game.** Check once deployed: check in to the suite, leave and come back before 11 AM,
  room service, the checkout message, the calm tune.
- **Link previews were tested on a local page only** (the build container has no direct internet). Check a few real addresses
  in Messages after deploy.
- The **VIP bar 360° view** was tested on its own in a browser, not inside the running game.
- Rate limits (`lib/rate-limit.ts`) and the link-preview cache are **in memory per server instance**, not global.
- **Mention bells** are built (v0.37.0) but only tested against the emulator; check a real comment with an @mention after deploy.
- **The weekly digest** was tested against the emulator and with sample stories in a browser, not yet sent through Resend.
  `getUsers` (emails) needs the real Auth, so the batch send itself is untested until the first `send_test`.
- **Interests:** the digest ranks by `users/{uid}.interests`, but nothing fills it yet: the hashtag picker is next.
- The `/life` landing screenshots still show the old rectangular pool and the old Chef Adams street board; re-capture them.
- The hotel suite has no interior 3D scene; time in the room plays at the hotel front.
- Vercel cost: keep public pages on ISR (`revalidate` + `generateStaticParams`), keep admin auto-refresh slow and only while
  the tab is visible, and keep whole-collection reads behind `lib/stat-cache.ts`.

## 7. Partners in Notes Life (real businesses)

Chef Adams (food, @chef_adams), itel Energy (through @clickam), Candellux Imperial Hotel & Suites (Garki; WhatsApp and
website in `CANDELLUX`), Digital Witch (Ekwutosi Cynthia Okeh; `DIGITAL_WITCH`). Their details live in `lib/life/catalog.ts`;
their pictures in `public/images/life/partners/` and `public/images/life/billboards/`. In-game prices are game prices;
Notesville Naira is never cashed out.
