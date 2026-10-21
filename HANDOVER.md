# #NotesApp hand-over note

**Date:** 17 October 2026 · **Latest version:** v0.43.0 · **Repository:** `AceBoss1/notesapp`
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

Ship-docs rule (owner's instruction, 19 Oct 2026): everything that ships updates the main front pages and docs in the same release:
Home (`app/(main)/page.tsx`), About, the desktop footer (`app/(main)/layout.tsx`), the changelog (`lib/changelog.ts`), Status (`lib/status.ts`), the Roadmap (live and not-live lists),
the help articles (`lib/kb-articles.ts`), `README.md` and these handover notes. Push list rule (19 Oct 2026): every finished item gets its own
`push/<topic>` branch and a row in `docs/PUSH_LIST2.md` (kept on the working branch); a pull request carries only the items the owner names.
Before opening any pull request, fetch `main` and make sure the branch is on the current `main` (merge or rebase it, re-run the checks); anything new
on `main` that isn't understood is raised with the owner first.

## 2. Waiting on the owner

1. **`firebase deploy --only firestore`**: done by the owner on 17 Oct 2026 (through v0.45.0: saved journals, courses, profile pictures, kept messages). Run it again after any release that changes `firestore.rules`.
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
   `UPSTASH_REDIS_REST_TOKEN`), and run the journal author backfill (Admin → Maintenance: Dry run, then Apply; or `npx -y tsx scripts/backfill-author-uids.ts` then `--apply`).
10. **Staging:** `docs/STAGING.md` (a second Firebase project and the `staging` branch on Vercel Preview).
11. **After merging v0.39.0:** file older journals under topics (Admin → Maintenance: Dry run, then Apply; or `npx -y tsx scripts/backfill-topics.ts` then `--apply`).
12. **Courses:** the owner's decisions are in `docs/COURSES.md` ("Decisions", 17 Oct 2026). Step 1, free courses with the publisher's YouTube, goes live as Notes Academy in this release; certificates, paid courses and the Enterprise packages follow. The package prices are in Admin → Pricing.
13. **MCP server (v0.46.0):** point `mcp.notesapp.name.ng` (and later `mcp.notesapp.tech`) at Vercel (Vercel → Domains, then the CNAME it shows); the Firestore **TTL policy** on `agentActions.expireAt` (the log keeps 12 months) is set (owner, 19 Oct 2026) and now also declared in `firestore.indexes.json`; decide the phase 2 questions on the team hub (which plans, AI budget, referral fee) before OAuth and write tools.
14. **Discord changelog:** `DISCORD_CHANGELOG_WEBHOOK_URL` in Vercel (Production), from a new webhook (the first one was shared in chat), then redeploy.
15. **Nana gems (v0.47.0):** in Admin → Pricing → Nana AI check the model prices (US dollars per million tokens, for Pearl, Emerald and Ruby) and the naira to the dollar, and the allowances. Optional in Vercel: `NANA_MODEL_EMERALD`, `NANA_MODEL_RUBY` (defaults claude-sonnet-5-5, claude-opus-5-5), `NANA_BANK_DAYS` (7). The **TTL policy** on `nanaBank.expireAt` is declared in `firestore.indexes.json` (v0.54.0), so the next `firebase deploy --only firestore` creates it. Then `firebase deploy --only firestore` (rules for `nanaAccounts`, `nanaSpend`, `nanaBank`).
16. **Nana costs (v0.47.1):** the default model prices are now the real ones (Pearl $0.10/$0.50, Emerald $2/$10, Ruby $4/$20 per million tokens). If Admin → Pricing → Nana AI was saved with the old $1/$5, $3/$15, $5/$25, change them there: a saved config keeps its own values.
17. **Certificates (v0.48.0):** `firebase deploy --only firestore` (rules for `academies`, `certificates`, `creditTopups`). Check Admin → Pricing → certificate minimum and late claim fee. Admin → Academy (content and moderation staff) has the accreditation queue, the Certified seal per course, and find / revoke. Certificate refunds go through `refundPayment`, which revokes the certificate. Course FAQ text: `lib/academy-faq.ts` (also the help article `notes-academy-faq`).
18. **Chat reactions and Delete for me (v0.49.0):** `firebase deploy --only firestore` (read rule for `chatHidden/{uid}/chats/{cid}`); until then a member's "Delete for me" is saved but the messages stay on their screen.
19. **Course likes, saves and reviews (v0.52.0):** `firebase deploy --only firestore` (rules for `courseReviews`, `courseLikes`, `savedCourses`). Until then the Saved page and course cards can't show your saved courses. Reporting a review isn't built yet: remove abusive ones in the Firestore console for now.
20. **Nana's suggestions, subtopics and subcategories (v0.53.0):** `firebase deploy --only firestore` (read rules for `subtopics` and `storeSubcategories`, and `subcategory` on store items). Until then saving a Market item with a subcategory is refused by the rules; journals and courses work. Suggestions use the platform AI key (`ANTHROPIC_API_KEY`) on Pearl; without it they fall back to matching words in the title. New subtopics go live without review: check Admin → Topics now and then.
21. **Paid courses, co-tutors and course details (v0.55.0):** `firebase deploy --only firestore` (a paid course's lessons stop being public; rules for `courseLinks`, `courseTutorInvites`, `coursePurchases`). Uploaded video needs `CLOUDFLARE_STREAM_TOKEN` (already used by view-only items) and PDFs `R2_PRIVATE_BUCKET`. Course sales go through the usual ledger as kind `course` (paid out automatically after 7 days, like downloads); Admin → Payments refunds a course only within 7 days and before the learner started, which is also what the learner's own Refund button does. The live-class and group links are private (`courseLinks/{id}`).
22. **Shipments (v0.56.0):** `firebase deploy --only firestore:indexes` (the new `parcels` index on sellerUid, kind, createdAt; until it's built the Shipments list errors). Logistics businesses switch Track on in Your site. Shipments come with Business and Enterprise; deliveries are paid by the customer (`/logistics`, `/pricing`). Next: API and webhooks on Enterprise (to be agreed with the owner).
23. **Logistics network (v0.57.0):** `firebase deploy --only firestore` (rules: `weightKg` on store items, `logisticsProviders` server-only). Until then saving a store item with a weight is refused. Check Admin → Pricing → Logistics network (add-on ₦4,500/month, 30-day trial, our commission 10% of providers' delivery earnings, at least ₦100). Delivery partners' earnings are `shipping` ledger entries (`<ref>_ship`), held with the store order and released with it on confirm; release them in Admin → Payments like store orders. Add-on providers' tracking links go to /track (their own Track page needs Business). Later: Nana rate suggestions, provider API and webhooks on Enterprise.
24. **Community and Events (coming soon, v0.57.1):** pages only (`/community`, `/events`). The owner's decisions (19 Oct 2026) and the phases are in `docs/COMMUNITY.md`. The giving charges there (wallet bands like bank transfers, card at Paystack's cost plus the band) were approved on 19 Oct 2026; giving itself is phase 2.
25. **Call safety code and screen sharing (v0.60.0):** nothing to deploy. The code is made in the browser from both devices' per-call certificates (`lib/calls.ts`), so it proves no one sat in the middle of the handshake that passes through `calls/{id}`. Screen sharing shows only on computers (`getDisplayMedia` and a fine pointer); phone browsers and installed web apps can't capture the screen.
26. **Group calls (v0.61.0):** `firebase deploy --only firestore` (rules for `groupCalls` and their `links`, and the index on `groupCalls` memberUids + status; until the index is built, nobody is rung and Join call doesn't show). Calls stay phone to phone (a mesh), so they cost nothing to run; the TURN relay is used as for 1:1 calls. A call everyone left without saying so is closed when someone next starts one in that group. Bigger meetings need a paid video service (Community phase 3).
27. **Analytics (v0.64.0):** `firebase deploy --only firestore` (the `ownerViews` rule and four indexes: ledger and payments by publisherUid + createdAt, bookings by publisherUid + createdAt, storeOrders by sellerUid + paidAt). Until the indexes are built the page still works, reading each member's documents and filtering them (slower for big sellers). Visits by page and source count only from deploy day. The sites plan (looks, kits, the Community theme) is `docs/SITES.md`.
28. **Sites for every plan (v0.65.0):** `firebase deploy --only firestore` (the `sites/{uid}` rule: anyone reads, only the server writes). From this release Free Basic and Pro members have a site at `/s/<username>` (readers still don't); a Free Basic site doesn't show Track (Business and above); Shop stays, at the plan's store commission, and Aurora and Maroon fall back to Legacy below Pro; nothing stored is deleted. Site reminders (About and Contact) still show only on Business and Enterprise. After a downgrade from Business a member's own domain keeps working on purpose (owner, 21 Oct 2026); everything else follows the new plan, commissions included (they are read from the current tier).
29. **Scholar and the academic sections (v0.66.0):** nothing to deploy beyond item 28. Dark mode turns the site's ink, paper, card, slate and rule colours round through CSS variables (`app/globals.css`, `[data-site-dark]`); the colours are variables everywhere now, with the old values as the fallback, so the main site is unchanged. The globe's land is a 2° mask made once from Natural Earth (public domain) in `lib/globe-land.ts`; places are `lib/places.ts`.
30. **Free trials (v0.67.0):** nothing to deploy. Every trial is 15 days (`lib/trials.ts`): Pro and Business each once per account (`users.trials`), Business once per registration number for organisations (`orgTrials`), and a paid plan between two trials (`users.lastPaidAt`, set by payments and renewals). The old organisation trial (`trialUsedAt`) counts as a Business trial. The logistics add-on's trial is capped at 15 days even if Admin → Pricing still says 30. The daily expiry (`expireOrgTrials`) returns an account to the plan it pays for, or Free Basic. Terms updated without a new legal version (no re-acceptance asked).
31. **Inventory (v0.68.0):** `firebase deploy --only firestore` (rules for `inventory` and `inventoryMoves`, server-only, and two indexes on `inventoryMoves`: ownerUid + at, ownerUid + itemId + at; the history works without them, more slowly). Sales are recorded from the deploy on; stock changed in the item editor isn't in the history (only Inventory's own changes, orders and refunds are). The add-on's price and trial are in Admin → Pricing.
32. **Publications import (v0.69.0):** nothing to deploy. Crossref and ORCID are public APIs with no key (Crossref is sent our contact address, as it asks). The ORCID sync runs in the reminders cron (`syncOrcidSites`, 25 sites a run, each at most every 20 hours). Google Scholar can't be read by other sites, so Scholar lists come in through its BibTeX export.
33. **More kits and the cover photo (v0.70.0):** nothing to deploy. 16 kits (`lib/site-kits.ts` KITS); the cover is `sites/{uid}.cover` (https pictures only).
34. **Courses on sites, the storefront and basket, WebP (v0.72.0):** nothing to deploy. A member's course opens inside their site (`app/(site)/s/[username]/courses/[slug]`, with `MemberProvider`; middleware rewrites `/courses/<slug>` on their domain and lets `/api/academy/…` through); only a course they teach shows. The site shop is `components/site/Storefront.tsx` with `shopStyleOf`/`sortItems` in `lib/site-kits.ts` (state in the address: `?cat=&sort=&q=`); the announcement bar is `sites/{uid}.announce` (`cleanAnnounce`, 90 characters); "Order on WhatsApp" buttons are gone (owner: orders stay on #NotesApp; `cleanButton` turns a saved one into Contact us; the strip still lists WhatsApp as a contact). **The basket:** `payments/{ref}` kind `store_cart` lists its orders `{ref}_1…n`, each an ordinary `store` payment with `cartRef`; `fulfillPayment` settles them (`paidWith`), then the basket; delivery once on the first order (`lib/cart-server.ts basketDelivery`, also `/api/logistics?view=basket`); `refundPayment` refunds an order's share of the basket's Paystack transaction and refuses the basket itself; reports skip `store_cart`; card only (not the wallet); tests `test:cart`, `test:cart-server`; a shop-first home with a cover opens with `StoreBanner` in `SiteHome.tsx`. Pictures go up as WebP: `asWebp` in `lib/upload.ts` (rules in `lib/upload-rules.ts`, test `npm run test:uploads`); academy logos and signatures stay PNG for the certificate renderer.
35. **Beauty and wellness kit (v0.73.0):** nothing to deploy. Four kits `beauty-spa|massage|hair|nails` (`beautyKits()` in `lib/site-kits.ts`, `family` groups them into one card in `KitPicker`); the old `spa`/`salon` ids resolve through `kitOf` and `isBeautyKit`. Hero `style: "photo"` + `eyebrow` (`SitePhotoHero`, Clean look only); services take `minutes`, `group`, `image` (menu cards in `Services`); the side/bottom Book your appointment tab is in the site layout when `isBeautyKit(kit)` and sessions are on; background `night` sets `data-site-dark` (the Scholar dark colours). Per-service booking (own price and length) is not built: the owner said not yet. Since then (same item): the **Luxe** look (`lib/site-themes.ts`; `isCleanLike` covers Clean and Luxe; Luxe always uses the photo hero, falling back to the cover); `sites/{uid}.focus` (`SITE_FOCUS`: mix, shop, services, courses, notes) orders Home in `SiteHome.tsx`; button kind `services` → `/#services`; `info.email` shown in the strip instead of the phone; `SocialLinksRow light` over the photo and in the footer; Fashion uses Luxe with `ShopByCategory`.
36. **Community and Events (v0.74.0):** `firebase deploy --only firestore` (server-only rules for `communities`, `communityMembers`, `communityPosts`, `communityComments`, `communityLikes`, `events`, `eventRsvps`, `eventReminders`; indexes: communityPosts by cid + channel + createdAt, events by hostUid + nextStartAt; posts load without the index, more slowly). Event reminders run in the reminders cron (`eventReminders`). Circles are group chats with a `communityId` (up to 50 people, the group-chat limit; bigger rooms are phase 2). Not yet: giving, paid tickets, our own live streaming, reports to #NotesApp from inside a community (community moderators remove posts today), an Events tab on profiles and in Explore.
37. **Audio rooms and the group-style feed (v0.75.0):** `firebase deploy --only firestore` (rules for `communityRooms`, its links and chat, 2 indexes: cid+status, hostUid+status). `lib/rooms.ts` (who is on stage, `linksFor`: stage mesh, host→listener links with the host's Web Audio mix), `lib/rooms-server.ts`, `/api/community/rooms`, `components/community/AudioRoom.tsx`. Phone to phone, 20 listeners; the Team hub shows a reminder until `CLOUDFLARE_REALTIME_APP_ID`/`_TOKEN` are set (the relay is not built yet; owner: start small, upgrade later). Room chat: `communityRooms/{id}/chat` (rules: people in a live room write as themselves, 500 characters, no edits; `removeChat` for the host or a moderator via `{action:"unchat"}`; `endRoom` deletes it). Feed redesign in `components/community/Feed.tsx`; comments now keep `authorAvatar`.

All of these are on the team hub board with departments and dates (`lib/team-seed.ts`: `FUND_BACKLOG`, `LAUNCH_BACKLOG`, `COURSES_BACKLOG`, `TOPICS_BACKLOG`, `BIMI_BACKLOG`). Items can have several people (`ownerUids`; `ownerUid` stays as the first of them for older readers) and can repeat monthly (`repeat: "monthly"`: done moves the due date on a month).

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
| Member sites | `/profile/site` (Your site), `lib/site-settings.ts` (sections, About/Contact), `lib/site-themes.ts` (Legacy, Aurora, Maroon), `app/api/site/{theme,sections,pages}`, `app/(site)/s/[username]/*`, `components/site/*` (SiteFeed for Maroon), `components/SiteReminder.tsx` |
| Profile pictures and links | past pictures: `lib/profile-pictures.ts` (server, `profilePictures`), `lib/profile-pictures-client.ts`, `app/api/account/pictures`, `components/PictureViewer.tsx` (opened from `MomentRing` and `OwnPictureMenu`); social links: `lib/social-links.ts` (`socialHref`, `cleanSocial`; `npm run test:social`) |
| Journal feed | `lib/feed-author.ts` (who wrote it, even for journals saved with only a name), `components/JournalsPageClient.tsx`, `components/feed/FeedPost.tsx`, `FeedModules.tsx`; Explore `components/ExplorePageClient.tsx`; saved journals `lib/saved-journals-*.ts`, `app/api/journals/save`; badge suggestion `BadgePitchCard` in `components/BadgeToast.tsx` |
| Calls (look) | `components/calls/CallViews.tsx` (`CallStage`, `IncomingCall`: plain props, handy for screenshots); the logic stays in `CallManager.tsx` |
| Discovery | `lib/discovery.ts` (the shelves: For you, Most viewed, Recent), `lib/discovery-server.ts` + `app/api/public/weekly-views` (this week's visits from `pageViews`), `components/DiscoveryHero.tsx`, `Shelf.tsx`, `RankedList.tsx`, `FollowCards.tsx`, `JournalsPageClient.tsx`, `app/(main)/trending` |
| Notes Market and Academy | `/shop`: `components/MarketPageClient.tsx`, `MarketCard.tsx`, `lib/shop-directory.ts` (`getMarket`), `app/api/public/market`; `/academy`: `app/(main)/academy`; profile tabs `components/ProfileTabs.tsx`, `BookSessionButton.tsx` |
| Badges by names | `lib/name-badges.ts`, `lib/badges-client.ts`, `app/api/public/badges`, `components/PersonName.tsx` (`NameBadgeIcons`) |
| Demo data | `scripts/seed-demo.ts` (emulators only; `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST`, `NEXT_PUBLIC_AUTH_EMULATOR_HOST`), see `docs/STAGING.md` |
| Courses | `docs/COURSES.md`; free courses (v0.42.0): `lib/courses.ts` (shapes, limits, YouTube ids, `ACADEMY_LIVE`), `lib/courses-server.ts` (every write), `lib/courses-client.ts`, `app/api/academy/*`, `app/api/public/academy`, `components/academy/*`, pages `/academy`, `/academy/teach`, `/academy/[slug]`, `/academy/[slug]/[lessonId]`; tests `npm run test:courses`, `test:courses-server`; paid courses build on view-only lessons (`components/LessonsEditor.tsx`, `lib/stream.ts`, `lib/private-files.ts`); the Enterprise Courses and Academy API prices are `coursePackages` in `lib/pricing.ts` (Admin → Pricing) |
| Paid add-ons | The team hub, company finance tools, the investor data room and LinkedIn advertising: in internal testing, then paid add-ons for Business and Enterprise. Said the same way on `/pricing`, `/roadmap`, `/teams`, `/advertise`, `/organisations` and the help article `paid-add-ons` (`lib/kb-articles.ts`) |
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
