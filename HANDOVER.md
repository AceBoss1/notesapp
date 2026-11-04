# #NotesApp hand-over note

**Date:** 17 October 2026 · **Latest version:** v0.43.0 · **Repository:** `AceBoss1/notesapp`
**Owner:** the founder and CEO of NotesApp Technologies Ltd (product decisions, approvals, deploys that need console access).

Read `docs/ENGINEERING_GUIDE.md` first for where the platform is going and why. Start with `README.md` (what is live, the docs index, the checks); settings are in `docs/ENVIRONMENT.md`, deploying in
`docs/DEPLOY.md`, how the newer pieces work in `docs/ARCHITECTURE.md`, the full history in `docs/BUILD_LOG.md`.
This note covers how the work is done, what's in flight, and what to watch.

**Owner set-up steps** (Firebase deploy and TTL policies, Cloudflare Realtime, the live rooms worker, the Cloud Run recorder, Stream,
cron-job.org, authorised domains, counsel review and the testing checklist) are gathered, click by click, in `docs/OWNER_SETUP.md`.

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
6. **naapp.tech (the .tech No Excuses Fund, applications close 15 Dec 2026; the owner chose naapp.tech over notesapp.tech on 30 Oct 2026 and is applying for it through the .tech startup programme, `docs/FUNDING.md`):** register it in the company's name, then
   follow `docs/DOMAIN_SWITCH.md` (Vercel domains, Firebase authorised domains, Resend, webhooks, LinkedIn/X callbacks,
   then `NEXT_PUBLIC_ROOT_DOMAIN=naapp.tech`). The fund wants the **primary** site on .tech: every link we publish should use it.
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

13. **MCP server (v0.46.0):** point `mcp.notesapp.name.ng` (and later `mcp.naapp.tech`) at Vercel (Vercel → Domains, then the CNAME it shows); the Firestore **TTL policy** on `agentActions.expireAt` (the log keeps 12 months) is set (owner, 19 Oct 2026) and now also declared in `firestore.indexes.json`; decide the phase 2 questions on the team hub (which plans, AI budget, referral fee) before OAuth and write tools.

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

37. **Audio rooms and the group-style feed (v0.75.0):** `firebase deploy --only firestore` (rules for `communityRooms`, its links and chat, 2 indexes: cid+status, hostUid+status). `lib/rooms.ts` (who is on stage, `linksFor`: stage mesh, host→listener links with the host's Web Audio mix), `lib/rooms-server.ts`, `/api/community/rooms`, `components/community/AudioRoom.tsx`. Phone to phone, 20 listeners; the Team hub shows a reminder until `CLOUDFLARE_REALTIME_APP_ID`/`_TOKEN` are set (the relay is not built yet; owner: start small, upgrade later). Room chat: `communityRooms/{id}/chat` (rules: people in a live room write as themselves, 500 characters, no edits; `removeChat` for the host or a moderator via `{action:"unchat"}`; `endRoom` deletes it). Churches and NGOs kit: `COMMUNITY_KITS` in `lib/site-kits.ts`; `components/site-settings/CommunityPanel.tsx` on Your site (start a community prefilled, or link one the member owns/admins via `/api/community?run=1` + `POST /api/site/community`, `linkCommunity` in `lib/site-server.ts`); `sites/{uid}.community` puts a Community link in `SiteNav`. Own pages: `/community/[feature]` from `lib/community-features.ts` (general, spaces, circles, audio-rooms; screenshots in `public/images/community/`), linked from the footer and `/community`. `leave`/`removeMember` also take the person out of the community's Circles. Help articles added for every feature since v0.60 that had none (see the changelog). Feed redesign in `components/community/Feed.tsx`; comments now keep `authorAvatar`.

38. **Shop collections, Notes topics, Community Events page (v0.76.0):** nothing to deploy. `shopCollections`/`collectionKey` in `lib/site-kits.ts` (labels = the publisher's subcategories when any item has one, otherwise each item's badge; spellings grouped) drive `SiteShop` links (top 5, rest as chips, `?c=` in the address); `SiteNotes` links by `topicsOf`; `/community/events` from `lib/community-features.ts`.

39. **Kits refreshed (v0.77.0):** nothing to deploy. The 11 business kits in `lib/site-kits.ts` now carry grouped starter menus, industry FAQs, hours, two buttons and `bestFor` (shown on `KitPicker`); food, fitness, events and real estate are Luxe, school and church use the photo hero on Clean. `menuActionOf(kit)` sets the menu card button (Order/Apply/none/Book now). `SiteHome` shows the store banner only when the shop leads Home or a shop without journals has no hero. Below-fold site images are lazy with `decoding="async"`.

40. **Community on the member's site (v0.78.0):** nothing to deploy. `app/(site)/s/[username]/community` renders `CommunityView` inside the site when `sites/{uid}.community` is set and `communityPage !== false`; `middleware.ts` rewrites `/community` on member domains and lets `api/community`, `api/events` and `api/upload` through. `components/community/place.tsx`: `CommunityPlaceProvider` (tabs stay on `<site>/community`), `mainHref` (profiles and Messages go to www on a member domain), `communityUrl` (invite/share links). Step 3 has `CommunityPageCard` (link or switch the page; `/api/site/community { cid, page }`).

41. **Naija Exam Prep (v0.79.0):** three steps before it's live. (1) Vercel → Domains: add `prep.notesapp.name.ng` (CNAME to Vercel). Until it's added, leave this release unmerged: the main site sends `/exam-prep` to that address. (2) Firebase → Authentication → Settings → Authorised domains: add `prep.notesapp.name.ng` (students sign in on that address). (3) Vercel → Environment Variables: `EXAM_PREP_PASS_KEY`, a P-256 private key (the one-liner is in docs/ENVIRONMENT.md); without it, free questions still save offline but pack questions don't. No rules or indexes to deploy (the `prep*` collections are server-only, closed by default). Then Admin → Naija Exam Prep → Import → Import the starter set (120 original questions, labelled Nana AI-assisted draft), have reviewers approve them, and publish: nothing shows to students before that. `lib/exam-prep.ts` (pure rules), `lib/exam-prep-server.ts`, `/api/exam-prep/*`, `/api/admin/exam-prep`, `app/exam-prep/*`, `public/sw.js` (offline, prep pages only). Packs are platform revenue: `fulfillPayment` grants the months (kind `exam_pack`) and writes no publisher ledger entry.

42. **Note wording, brand guidelines, young members (v0.80.0):** nothing to deploy. The guidelines are `lib/brand-guidelines.ts` (the page and the zip share them); after changing a logo file, rebuild the zip with `npx -y tsx scripts/brand-pack.mjs` (needs `zip`). The young-members plan is `docs/YOUNG_MEMBERS.md`; its team hub items, Legal included, are `PREP_YOUNG_BACKLOG` in `lib/team-seed.ts`, added once when a super admin opens the hub. Exam Prep invites now carry subjects (`prepInvites.subjects`, `kind` single|open, `maxUses`, `acceptedBy`, `active`); a reviewer's `prepReviewers.subjects` limits their queue and reviews, and `reviews`/`reviewsByMonth` count their work (for wallet pay later). Any reviewer added before this has no subjects and sees nothing until Admin gives them a subject link.

43. **Communities in Explore and Trending; Notes Life across NotesApp (v0.81.0):** nothing to deploy (single-field queries only). `isDiscoverable` (not invite-only) and `trendScore` in `lib/community.ts`; `directory` hides invite-only communities from non-members, `trendingCommunities` (`/api/community?trending=1|7|30`, CDN-cached 5 min). Notes Life: `lib/life/social.ts` (pure: twice-a-day card, privacy, who may be shown), `lib/life/social-server.ts`, `/api/life/social` (`?feed=1`, `?uid=`, `?privacy=1`, POST the switches `users.lifeShow`/`users.lifeCard`, written by the server so no rules change), `components/life/LifeFeedCard.tsx` (feed), `components/life/PlaysLife.tsx` (profile, store, course). Tests: `test:life-social`, `test:life-social-server`, both in CI.

44. **Team hub → Time (v0.82.0):** nothing to deploy beyond `firebase deploy --only firestore:rules` (seven new server-only collections, closed by default anyway: `timeTimers`, `timeEntries`, `timeSheets`, `timeLeave`, `timeProjects`, `timeLeads`, `timeNudges`; single-field queries only, so no indexes). The rules the owner set are at the top of `lib/time.ts` (pure): a 20-hour week, check-ins every 30 minutes with 10 minutes to answer (unanswered stops at the last answer), meetings wait for their planned length, midnight stop, Friday 4 pm reminder, approval by team leads of the person's departments or super admins and never your own. `lib/time-server.ts` (timer, entries with `uidWeek`/`week` keys, timesheets, leave, projects with running minute totals, leads, `approvedMinutesByUid` for payroll, `sweepTimers` and `fridayNudges` in the 15-minute cron), `/api/admin/time`, `app/(main)/admin/team/time/page.tsx`, `components/TimeCheck.tsx` (the check on every page, staff only). Payroll: `PayStaff.basis` (hourly is the default for new people; existing records stay monthly until finance edits them) and `hourlyKobo`; a run pays hourly staff their approved minutes in the month × rate and needs their staff login linked. The setup steps are on the team hub (`TIME_BACKLOG`). Tests: `test:time`, `test:time-server` (Firestore + Auth emulators), both in CI.

45. **Teen protections (v0.83.0):** nothing to deploy. `lib/young.ts` (pure age rules, birth month and year only), `prepTeens.birth` (asked when teen mode is turned on, 13 to 17; teens from before are asked once on the Exam Prep card), `teenGate` in `lib/comments-server.ts` (replies to a teen's journal or comment only from people they follow, moderators aside), and teens' moments for mutual follows only (`canSee`/`listFeed` in `lib/moments-server.ts`; `setMomentPrefs` refuses public). Tests: `test:young`, `test:young-server`, in CI.

47. **Kids mode (v0.85.0):** `firebase deploy --only firestore:rules` (`isKid()`: a child profile can't edit `users`, claim a `usernames` entry or create `follows`; `kidProfiles`, `kidPlay`, `kidReports` are server-only). It needs the service-account key (already set) to mint custom tokens. `lib/kids.ts` (pure), `lib/kids-server.ts` (add/update/remove, `enterKid` and `exitKid` mint the sign-ins, PIN by scrypt with 5 tries then 15 minutes, `lifeGate`, `sendKidReports` on Sundays from 5 pm in the cron), `/api/kids`, `/profile/family`, `/kids`, `components/KidGuard.tsx`. Kids' Notesville: `richList(…, kidView)`, no friends, invites, referral or VIP bar in `/api/life`. Child profiles can't buy (`/api/exam-prep/checkout`, `/api/paystack/initialize`; no email elsewhere). Tests: `test:kids`, `test:kids-server`, in CI.

48. **Turning 18 (v0.86.0):** nothing to deploy. `lib/young.ts` (`graduationDue`, `cleanChoice`, `keepFlags`), `lib/young-server.ts` (`graduationStatus`, `exportMine`, `graduate`, `birthdayBells` in the cron), `/api/young`, `/eighteen`, `components/EighteenBanner.tsx`. The keep flags are read in `serverPublicUsers` (lib/users.ts), `sendMessage`, `checkAddable`, `teenGate` and the moments rules. The digest skips teen accounts; the Exam Prep board shows the real name only with `prepBoard.realName`. Tests: in `test:young`, `test:young-server`.

49. **Schools on Naija Exam Prep (v0.87.0):** nothing to deploy (the `prep*` collections are closed by default; single-field and array-contains queries). `lib/prep-schools.ts` (pure), `lib/prep-schools-server.ts` (`applySchool`, `decideSchool`, `setAgreement`/`signAgreement`, `addTeacher`, `createClass` with a unique code in `prepClassCodes`, `joinClass`, `classView`), `/api/exam-prep/schools`, Admin → Naija Exam Prep → Schools, `app/exam-prep/schools`, `app/exam-prep/class/[id]`, `components/exam-prep/ClassCode.tsx` (on Progress), `/schools` and `/class` in the prep routing (`middleware.ts`). **The agreement text is Legal's and lives only in `prepConfig/schoolAgreement`** (the owner's rule: no legal drafts in the code); until it's set, approved schools can't sign. Tests: `test:prep-schools`, `test:prep-schools-server`, in CI.

50. **Client invoices (v0.88.0):** `firebase deploy --only firestore:rules` (four server-only collections: `invoices`, `invoiceCounters`, `invoicePays`, `invoiceSettings`; single-field and array-contains queries only). `lib/invoices.ts` (pure), `lib/invoices-server.ts` (drafts from approved billable entries, send with number and the client's link token, Paylony transfer account / CardTap / Paystack, `checkPay` on a clear yes only, `settlePaid` → ledger `income/client_invoice` as the system, `weekInvoiced` blocks returning a billed week, `sendInvoiceReminders` in the 15-minute cron), `/api/admin/invoices` (finance), `/api/invoices` (the client's link), `/invoice/[id]`, `components/time/InvoicesTab.tsx`. The Paylony webhook also calls `checkPay`. The Paylony transfer account's reply fields are read loosely (`account_number`/`accountNumber`…): check the first real one in Admin → Paylony and adjust `startPay` if it differs. Tests: `test:invoices`, `test:invoices-server`, in CI.

51. **More Exam Prep subjects (v0.89.0):** nothing to deploy. Admin → Naija Exam Prep → Import → Import the starter set again: `addMissingSubjects` (lib/exam-prep-server.ts) first writes the default subjects the site doesn't have yet (Physics, Chemistry, Biology, Economics and Government for each exam; subjects already there are left as edited), then the 300 new questions go in as in review; the English and Maths ones already imported are skipped by id. Each subject is one file in `scripts/exam-prep-questions/` (`node scripts/exam-prep-questions/check.mjs <subject>` checks it); `scripts/exam-prep-starter.mjs` builds them in with every answer letter used 5 times in 20. Invite a reviewer per new subject, approve, publish.

52. **The school pack (v0.90.0):** nothing to deploy. A class now has a size (`seats`, 1 to 300, required when it's made; the teacher or lead can change it, never below who has joined). Joining with the class code gives a place and the class's exam pack for 12 months, free during the pilot: an access source of kind `school` (`ref` `school:<classId>`) in `prepAccess`, added on top of anything the student paid for. A full class refuses new students. Leaving, or the teacher's Remove, frees the place and sets `endedAt` on that source, and `recomputeExpiry` drops it, so a pack the student paid for is kept. `lib/prep-schools.ts` (`cleanSeats`, `seatsLeft`, `SCHOOL_PACK_MONTHS`), `lib/prep-schools-server.ts` (`joinClass`, `endPlace`, `removeStudent`, `setSeats`), `/api/exam-prep/schools` actions `seats` and `remove`. Classes made before this have no size: their students are asked to wait until the teacher sets one. Billing per student after the pilot is still to build.

53. **Backfill safety and admin masking (v0.91.0):** `firebase deploy --only firestore` (rules and the two `adminViewLog` indexes). The rules now keep `payments`, `merchOrders` and `leads` from every staff browser, so Payments, Merch and Leads load through `/api/admin/payments`, `/api/admin/merch` and `/api/admin/leads` (GET), which mask emails and phones (`maskContacts`, `lib/pii.ts`); `/api/admin/user-emails` and the Credits search mask too. `<Masked>` (`components/admin/Masked.tsx`) has Show: a reason, then `/api/admin/reveal` returns the real value for the departments in `REVEALS` and writes `adminViewLog` (Admin → View log, super admins and Legal). Merch keeps the delivery address readable. Backfills (`lib/backfills.ts`): the dry run returns a `planHash`; Apply needs it and `backupConfirmed` (the command-line scripts need `--apply --backup-taken`); every apply is a `maintenanceRuns/{runId}` with `changes/{noteId}` before-images, and `undoRun` restores those not edited since. Deploy the rules after the code, or the old pages' direct reads fail in between.

54. **Stage-trigger numbers (v0.92.0):** `firebase deploy --only firestore:rules` (`opsDaily` server-only). The dashboard card (`components/admin/StageTriggers.tsx`, `/api/admin/triggers`, `lib/ops-metrics.ts` lines, `lib/ops-metrics-server.ts`) gathers the five numbers at most every 30 minutes. Timings (page LCP, feed, search from a quarter of visits through `/api/perf`; the revenue report's build time) are samples in Upstash Redis, `perf:<metric>:<day>`. `opsDaily/<day>` counts scheduled-job starts and finishes (`trackJob` around `/api/cron/reminders`; a start with no finish is a run the time limit cut off), NKENNEAi firewall blocks, and the day's active members (presence in the last 24 hours). **Owner, for reads per member:** give the server's service account the **Monitoring Viewer** role in Google Cloud (IAM); until then the card says "not connected". Video stored reads Cloudflare Stream's storage usage against the plan.

55. **Backups and restoring (v0.93.0):** `firebase deploy --only firestore:rules` (`backupLog` server-only). Admin → Backups (`app/(main)/admin/backups`, the owner only) works in the browser with the owner's own Google sign-in (`lib/backups-client.ts`, Google Identity Services, scope `datastore`) against Google's Firestore Admin API; the site's server key gets no backup or restore rights, and `/api/admin/backups` only gates the page and keeps `backupLog`. **Owner, once:** in Google Cloud → APIs & Services → Credentials, create an OAuth client ID (Web application) with authorised JavaScript origins `https://www.notesapp.name.ng` and `https://notesapp.name.ng` (and the new domain later); put its id in Vercel as `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`; redeploy. The Google account you sign in with needs Owner or Cloud Datastore Owner on the project. Then on the page: switch on point-in-time recovery and delete protection, add daily (kept 14 days) and weekly (kept 14 weeks) backups. Switching either protection off is left to the Google Cloud console on purpose. **Restoring:** a restore or point-in-time copy always makes a new database (`restore-YYYYMMDD-HHMM`, `clone-…`). To switch the site to it: deploy the rules and indexes to it (a `"database"` entry in firebase.json, then `firebase deploy --only firestore`), set `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` to its name in Vercel and redeploy; `lib/firebase.ts` and `getAdminDb()` both read it. The off-project vault and change log in the plan doc are separate work.

56. **WAEC and NECO question bank (v0.94.0):** nothing to deploy. Admin → Naija Exam Prep → Import → **Import the starter set** once more: `addMissingSubjects` adds the 11 new WAEC/NECO subjects (`SSCE_EXTRA` in `lib/exam-prep-catalog.ts`), then 1,520 new questions arrive **in review** (provenance AI draft), 50 per exam per subject, 20 free; the 420 already there are skipped. `importQuestions` now reads and writes in batches of 400 so the whole set fits the 60-second route limit (1,940 in under a second on the emulator). `reviewQueue` now filters exam and subject in the query (one query per subject for a reviewer) instead of after its 500 limit, which had hidden whole exams; the Questions tab has a subject filter. Source: `scripts/exam-prep-questions/ssce/<subject>.mjs` (one file per subject, WAEC and NECO lists), checked by `node scripts/exam-prep-questions/ssce/check.mjs`; rebuild with `node scripts/exam-prep-starter.mjs`. **Reviewers, look twice at:** Government (why Nigeria nationalised BP in 1979), Civic Education (the 2024 anthem "Nigeria, We Hail Thee"), Financial Accounting (Consolidated Revenue Fund), Commerce (stale cheque after six months), Islamic Studies (kaffarah wording) and CRS (Bible translation wording). Invite a teacher per new subject (Reviewers → Make a link).

57. **The Wuse streets, errands and Emerald (v0.95.0):** **Done:** the owner deployed `firebase deploy --only firestore:rules` (confirmed 29 October 2026). Still waiting: Emerald's and Chinasa's photos. (lifePresence accepts `market` and `wuse2`). Two new places beside the first street (`lib/life/catalog.ts` `MARKET_SHOPS`, `STREET`, `ERRANDS`; the 3D strip is `strip()` in `components/life/world.ts`, one builder for both, with walking, a following camera, traffic, hawkers and night lights). Errands are server-paid (`errand_start`/`errand_finish`/`errand_cancel` in `lib/life/server.ts`), each once a game day (`errandDay`, `errandsDone`); street food and the barber go through `street` (and CardTap). Emerald Ezurukam is a resident at N$ 12bn (#1); his real photo goes in `photo` on his `RESIDENTS` entry when the owner sends it (`public/images/life/partners/`). His convoy (`CONVOY`, `convoyAt`) is at the Wuse bus stand at 8 AM, 1 PM and 6 PM game time for 30 game minutes; `convoy_gift` pays N$ 100,000 once per 30 game days per player (`convoyAt` on the player, a `gift` line in lifeTx). Tests: `npm run test:life` ("wuse streets ok").

58. **Restrooms away from home (v0.96.0):** nothing to deploy. `RESTROOMS` and `restroomBoost` in `lib/life/catalog.ts`; the `restroom` action in `lib/life/server.ts` works out the boost (100 fills the need, 50 adds 50) and charges the Wuse Market units (WC N$ 500, shower N$ 800, through CardTap). The player now keeps `lastSwimAt` (pool day pass or lesson) and `lastVipAt` (VIP bar), set by the `hotel` action: the pool shower and VIP restroom fill the need only within 24 game hours of those. 3D: an outdoor shower stand on the pool lawn and the mobile WC/shower cabins at the west end of Wuse Market (`world.ts`). Tests: `npm run test:life` ("restrooms ok").

59. **LUXNAS, billboards and walking people (v0.97.0):** nothing to deploy. LUXNAS (partner, CEO Chinasa Odina, @luxnas / @chinasa, `LUXNAS` in `lib/life/catalog.ts`) replaces the tailor shop on Wuse Market: brand `luxnas` with jobs (`lux_*`, place `market`, `needLuxCert`), LUXNAS Academy (`LUX_COURSES`; `lux_enroll` / `lux_class`; certificates in `luxCerts`, kept apart from Digital Witch `certs` so they don't open tech jobs or the giveaway), shifts counted in `luxShifts`, and the `luxnas_studio` outlet (partner panels now take `chef_adams`, `itel` or `luxnas`, styled by `PS` in `LifeGame.tsx`). Chinasa is a resident (her photo goes in `photo` when sent). 3D: rooftop and roadside billboards on both Wuse streets, a LUXNAS board drawn in code, scrolling red LED street signs (`ledSign`), and `person()` limbs that swing from hip and shoulder (`walkCycle`) with dress styles `gown`, `skirt` and `bikini`. Tests: `npm run test:life` ("luxnas ok").

60. **Motion in the older scenes (v0.98.0):** nothing to deploy. `walkers()` and `traffic()` in `components/life/world.ts` are shared by every outdoor scene (the first street, Chef Adams, itel Energy, Digital Witch, the Candellux front, and the Wuse streets); the Candellux pool has ladies in bikinis swimming, on loungers and walking the poolside. Animations run from `anims` each frame and are cleared with the scene.

61. **Exam Prep second batch (v0.99.0):** **Imported on production** (the owner confirmed it on 29 October 2026); the 2,150 are in review. Nothing to deploy. Admin → Naija Exam Prep → Import → **Import the starter set** once more: the 1,940 already there are skipped and 2,150 new questions arrive **in review** (50 more in every subject of every exam: JAMB to 70 a subject, WAEC and NECO to 100; 20 free in each new set). Source: `scripts/exam-prep-questions/batch2/<subject>.mjs` (one file a subject, keyed by exam; `batch2/topics.mjs`), checked by `node scripts/exam-prep-questions/batch2/check.mjs <subject>`, which also rejects any repeat of a question already in the set; rebuild with `node scripts/exam-prep-starter.mjs` (ids carry on: `jamb-phy-21`…`70`, `waec-hist-51`…`100`). **Reviewers, look twice at:** Islamic Studies (Jama'atu Nasril Islam founded 1962), Civic Education (loss of citizenship for a naturalised citizen jailed 3+ years within 7 years, section 30), Geography (774 = 768 LGAs + 6 FCT area councils; heaviest rainfall around Bonny and Calabar; bitumen in Ondo State), Financial Accounting (5% interest on partners' loans under the Partnership Act 1890 when there is no agreement), Computer Studies (magnetic core memory as second-generation).

62. **Send-Na (plan only, v0.99.1):** nothing built, nothing to deploy. The owner decided on 29 October 2026: NotesApp verifies WhatsApp; the NotesApp team owns deliverability and the compliance department reviews abuse; WhatsApp booking reminders are a paid add-on. Suggested and awaiting a yes: Termii with Africa's Talking for SMS, Pearl at 4,000 emails (§9). `docs/SEND-NA.md` is the plan: an email platform priced in Naira on Na-Emperor (SES first, Resend kept as the fallback for our own mail), with a WhatsApp and SMS channel that also delivers the booking reminders still open on the roadmap, sign-in codes now and wallet codes later. Prices set by the owner: Free 3,000 a month (used first on every plan), Pearl ₦1,500, Emerald ₦12,500, Ruby ₦40,000, also a NotesApp add-on; the email counts and Pearl's thin margin are in §6. The owner's decisions are listed in its §9 (name and address, prices, SMS gateway, WhatsApp Business verification, who owns deliverability and abuse). Shown on `/roadmap` (an item and the "not live" list) and on About.

63. **Day, Night, the African pattern and emoji packs (v0.100.0):** nothing to deploy. Day is the default; to make Auto the default for new devices, change `DEFAULT_THEME_CHOICE` in `lib/theme.ts`. Night flips the colour variables on `<html>` and pins ivory words on crimson, rose crimson words and dark overlays back (`app/globals.css`), so pages using the usual colour names follow on their own; a few hard-coded light boxes (some Moments dialogs, the pricing table) may still need a look in Night. The pattern's drawings are in `lib/africa-drawings.ts` (add one there and rerun `npx -y tsx scripts/african-pattern.ts`); the Afro culture emoji pack reuses them. Paid packs (Summer, Spooky, Celebrate) are refused on send for Free Basic and Standard; an edited message isn't checked yet. Flags use Google's Noto Color Emoji font so they show on Windows too. The header's round ☀/☽/◐ button taps through the three. Pro, Business and Enterprise choose their own chat background (pattern, plain, six colours or their own picture, `userPrefs.chatBackground`); a lapsed plan shows the pattern again and keeps the choice for when the plan comes back.

64. **Payments and the mobile apps (plans, v0.100.2):** nothing to deploy. The owner decided on 29 October 2026: Paystack keeps cards and subscriptions and is the payout backup; Paylony takes bank transfers and Tap2Pay; Flutterwave comes with Kenya, then Ghana (`docs/PAYMENTS.md`). NotesApp Inc (Delaware) is due to be incorporated in about two weeks: then get its D-U-N-S number, and open the Apple and Google developer accounts in its name. The apps are scaffolded in `mobile/` (Capacitor around the app address, its own packages, outside the web build; `docs/MOBILE-APPS.md`). Decided later the same day: app ID `tech.naapp.app` (applied for through the .tech startup programme), store name "NotesApp" with the line "Publish. Book. Sell. Connect. Get paid.", plans sold only on the web, Flutterwave in Kenya first (Kenyan members are already here: account checks now, payment layer in November, pilot in early December, open in January 2027), Ghana four to six weeks later; Termii for Send-Na SMS; Send-Na Pearl at 4,000 emails a month on top of the free 3,000.

65. **Vision and mission (v0.100.3):** nothing to deploy. The owner chose the vision "Africa's knowledge, shared, valued and rewarded." on 29 October 2026. The words live in `lib/site.ts` (`VISION`, `MISSION`, `MISSION_PILLARS`, `VALUES`), shown on About (`#vision`) and copied into `docs/ENGINEERING_GUIDE.md` and the investor deck's opening slide; change them in all three together.

66. **Discount codes, referrals and affiliates (plan, v0.100.5):** nothing built, nothing to deploy. `docs/REFERRALS.md`. The owner decided on 30 October 2026: a referred friend's first month free with a card billed from month two (annual: one month's value off, billed up front); referrer paid in cash or NotesApp Credit with a bonus; affiliates 20% of plan payments for 12 months; commission on the discounted price; publisher codes on every plan; any verified member can be an affiliate. Also decided: +10% when taken as NotesApp Credit, a ₦2,000 minimum cash payout, no monthly cap (admin is alerted to sudden jumps instead).

67. **Discount codes, step 1 of docs/REFERRALS.md (v0.101.0):** `firebase deploy --only firestore` (rules for `discountCodes` and `discountRedemptions`, and four indexes). Publishers make codes at `/profile/discounts` on every plan; Growth and Finance make #NotesApp's at `/admin/discounts`. Codes work on shop items and baskets, downloads, courses, booked sessions, boosts, Nana credit, merch and the two add-ons; not yet on plans (step 2, with referrals) or certificates. A code's limits are checked when the checkout starts; if two buyers take the last use at once, both keep the price they paid and the use is marked. On packs (Nana credit, boosts) the field's preview uses the cheapest pack, so a percentage shows a smaller saving there; the server always charges the right price.

68. **Referrals and affiliates, steps 2 and 3 of docs/REFERRALS.md (v0.102.0):** `firebase deploy --only firestore` (rules for `referrals`, `referralEarnings`, `referralWithdrawals`, `affiliateOffers`, `referralAlerts`, and the new indexes). Members: `/profile/referrals` (link, earnings, cash or Credit, a bank account for members who don't sell, and the affiliate share on their own products); everyone: `/affiliates`; Finance and Growth: `/admin/referrals` (weekly leaders, jump alerts, hold). The friend's free month relies on Paystack's create-subscription with a start date and on refunding the ₦100 card check: test both on Paystack test mode before announcing. Credit withdrawals wait for `WALLET_LIVE`. The same day the owner chose **naapp.tech as the primary domain**, to be applied for through the .tech startup programme (startup.tech: sponsored for 10 years if it's the primary domain, in use within 4 months, never redirected) rather than buying n-app.tech; whether the app ID stays `tech.notesapp.app` is still to be confirmed before the first store upload.

69. **Funding applications (drafts, 30 October 2026):** nothing to deploy. `docs/FUNDING.md` has the owner's drafts for the .tech startup programme (naapp.tech as the primary domain, sponsored for 10 years: in use within 4 months, never redirected), the pitch.tech form (deadline 20 November 2026), Emergent Ventures (free exam prep, written by paid teachers), and a company summary to reuse. Fill the `[brackets]` with real numbers before sending. Peachscore was declined unless it costs nothing. The applications are on the team hub board (`lib/team-seed.ts` `FUNDING_APPS_BACKLOG`, seeded once as "funding-apps-2026-10" when a super admin opens the hub): fill the numbers by 2 Nov, startup.tech by 6 Nov, pitch.tech by 18 Nov (closes 20 Nov), Emergent Ventures by 27 Nov; the No Excuses Fund stays `fund-submit` (due 8 Dec, closes 15 Dec). NotesApp also received a Special Recognition at the Build With NKENNEAi Hackathon (October 2026) for its Swahili work.

70. **NKENNEAi recognition (v0.102.1):** nothing to deploy. #NotesApp won Special Recognition at the Build With NKENNEAi Hackathon (announced on their Discord, October 2026); it is shown on About (`#recognition-h`). The prize payment is handled by email between the owner and NKENNEAi; no bank details belong in the repository.

71. **Codes on plans and referral codes, step 3 (v0.103.0):** nothing new to deploy (the Firestore deploy from items 67 and 68 covers it). Growth and Finance make plan codes at `/admin/discounts` with the target "Plans (first payment)": the first month or year is charged at the code's price without a Paystack plan, then `startReferralSubscription` starts the plan on that card at the period's end (it refunds only a referred friend's ₦100 card check, never a real payment). A member's referral code is their username, typed under "Have a discount code?" on the pricing page. Same Paystack test before announcing: a subscription created with a start date.

72. **Coupons and Nana's pick (v0.104.0):** `firebase deploy --only firestore` again (the `savedCoupons` rule). Publishers tick **Show it as a coupon in my shop** and **Affiliates can share it** on a code (`/profile/discounts`) and **Share** it as a card; Growth's codes with **Offer it at checkout** are applied at #NotesApp's checkouts. At every checkout the field asks `/api/coupons/best` and applies the best coupon it can (marked "Nana's pick": a calculation, the largest saving after every limit, not a model call); removing it keeps it off. A code from another store is refused with "Input a coupon from this store." Saved coupons ending within 3 days: the cron's `couponReminders` job rings the bell once a day per coupon (`couponReminders/{saved id}_{day}`), and `components/CouponReminder.tsx` shows a bar on the first visit of the day (per device) and after each sign-in.

73. **Quizzes on courses (v0.105.0):** tutors add a **Quiz** lesson (CourseEditor's question builder: 1 to 50 questions, 2 to 6 answers each, the right one ticked, an optional explanation, a pass mark, 70% by default) on free and paid courses, on every plan that can teach. The lesson document holds the questions only; the answers and explanations live in `quizKeys/{courseId}_{lessonId}`, written in the same transaction as the lesson and deleted with it (or when it becomes another kind). Learners submit to `POST /api/academy/quiz` (`submitQuiz` in `lib/courses-server.ts`, enrolled learners only): it is marked on the server (`gradeQuiz` in `lib/courses.ts`), recorded in `quizAttempts/{courseId}_{lessonId}_{uid}` (attempts, best, lastPercent, passedAt) and, on a pass, the lesson is ticked off, so completion and the certificate follow. `markLesson` refuses to tick off a quiz that hasn't been passed. The editor gets the answers through the tutors' own course read (`courseForOwner`). Both collections are server-only in `firestore.rules`. Tests: `npm run test:courses` (pure) and `npm run test:quizzes-server` (emulator). Deploy: `firebase deploy --only firestore`.

74. **Community giving and paid event tickets (v0.106.0):** Deploy: `firebase deploy --only firestore` (server-only rules for `communityGifts`, `eventTickets` and `tickets`; no new indexes). Giving: a community's admins switch it on under Admin → Giving and name funds; gifts are payment kind `giving` (card, bank or the wallet), with the owner-approved charges in `lib/giving.ts` (bands ₦10/₦25/₦50; by card, Paystack's charge at cost as "card charge", in `PAYSTACK_LOCAL`: **check Paystack's current rates before launch**); the giver can cover them; no commission. Each gift is a receipt in `communityGifts` (email + `/giving`) and a `giving` ledger entry to the community owner's account (gross after the card charge, commission = the band), held 24 hours and released at the next 10:00 Lagos by the usual auto-payout run, only to the owner's payout account. Until a community is verified (`communities/{id}.verified`, or the owner's `org.rcStatus` "verified", `verified` or gold badge: `communityVerified` in `lib/community-server.ts`) each gift is capped at ₦20,000: set `verified: true` on a community from the console to lift it for an organisation checked another way. Tickets: whoever can edit an event adds ticket types on the event page (`eventTickets/{eventId}`); payment kind `ticket` (card only), sold counts move in the fulfil transaction (a payment that lands after the last ticket is `paid_slot_conflict`, to refund), one `tickets/{code}` per admission with a QR of `/events/<id>/checkin?code=…`; the host's `ticket` ledger entry has their usual commission and is released after the event ends plus the usual hold. Check-in at `/events/<id>/checkin` (typed code, or in-page scanning where the browser has BarcodeDetector). A whole refund through Admin → Payments voids the tickets (back on sale) or marks the gift refunded. Not done: one bank transfer for many gifts (each gift is its own transfer, all on the same run), Admin → Pricing for the bands, discount codes on tickets, tickets paid from the wallet, campaigns with a goal.

75. **Notes Life Low res (v0.106.1):** nothing to deploy. The owner reported the game freezing on computers (phones were fine): the full look draws soft shadows for about 100 objects at up to twice the screen resolution with edge smoothing. `components/life/world.ts` `createWorld(canvas, { low })`: Low res = pixel ratio 0.6, no shadows, no antialiasing, at most 30 frames a second; any mode skips drawing while the tab is hidden. The HD / LOW RES button in the game's top bar and Settings → Low res switch it (`notesLife:lowRes` on the device); the world is rebuilt and the current place shown again. On 1 November 2026 the owner set the next step: Low res becomes a pixel-art look, and HD a richer look with your own avatar and a city map (`docs/NOTES-LIFE-LOOKS.md`: plan and build steps, mockups first). On the roadmap as coming soon.

76. **The Notes Academy home page (v0.107.0):** `/academy` is now a product page around the catalogue. `components/academy/AcademyLanding.tsx` holds the sections (hero with the most-enrolled real course card, or a sample one when none is published, plus a quiz chip and a certificate chip; "Courses from" with the real teachers and organisations; three problem-then-answer feature blocks for building, quizzes and certificates, drawn from our own UI and the seals in `public/images/academy/`; the Teach/Sell/Grow/Learn tabs; a six-card "why" grid; live numbers; "Notes Academy for…" six audiences; help-article cards; the closing call to teach). `components/academy/AcademyPageClient.tsx` puts the catalogue (search, topics, filters, Naija Exam Prep, the shelves) in the middle at `#courses`; a `?tab=` or `?topic=` link scrolls straight to it. The numbers are counted from the same `/api/public/academy` list (courses published, the sum of `enrolCount`, distinct teachers, lessons), and any that is 0 is hidden; certificates issued are not shown because there is no public count (add one to the API, as a Firestore `count()` on `certificates` that aren't revoked, if the owner wants it). FAQ: `AcademyFaq` now takes `items`/`title`; `lib/academy-faq.ts` has a quiz question (so the course pages and `/help/notes-academy-faq` have it too) and `academyTeachFaq()` for the teachers' questions; "Visit the help centre" goes to `/help/academy`. The old "What's coming" box (which still listed quizzes) is gone. No new dependencies, no deploy steps.

77. **Public pages caught up (v0.107.1):** nothing to deploy. Every public page now describes what shipped in v0.101 to v0.106:
    `/pricing` (rows for discount codes and coupons, referrals, the affiliate marketplace, quizzes, paid event tickets and giving; a
    line on codes under Pro and Business; four more "Learn more" links), `/store-selling` (new **Discount codes and coupons** and
    **Affiliates** sections, `#discount-codes`, `#affiliates`), `/community` (a Paid tickets card, giving and ticket charges under
    What it costs), `/community/events` (`lib/community-features.ts`: a Tickets fact, Paid tickets and Giving sections), `/events`
    (links to My tickets, the tickets help article and Giving), `/organisations`, `/boost` (codes at checkout), home and About (the
    discount codes card), `/roadmap` (intro and description, last updated 1 Nov), `/status` (`lib/status.ts`: database, payments,
    email and scheduled-jobs descriptions), the footer (Affiliates, Discount codes & coupons, Community giving, My tickets, My
    giving, My coupons), `lib/site.ts` `WHAT_YOU_CAN_DO` (About, the help centre, Nana and the meta description), `lib/site-kits.ts`
    (Churches/NGOs kit), `lib/academy-faq.ts` (quizzes and discount codes) and the help articles (`plans-and-prices`,
    `commission-rates`, `payouts`, `referrals`, `discount-codes`, `selling-physical-goods`, `digital-downloads-and-courses`,
    `discovery`, `academy`, `event-tickets`, `giving`, now linked to each other). The owner's rule is in §3 and in
    `docs/ENGINEERING_GUIDE.md` (How we work). The /academy landing page was left to its own redesign branch.

78. **Our own tools first: course groups, and swiping Nana's suggestions (v0.108.0):** nothing to deploy (no rules or indexes: the course group lives in the server-only `courseLinks/{id}` as `communityId` and `spaceId`, with a public `hasGroup` flag on the course). The owner, 1 Nov 2026: "we should never suggest users to setup or add what we have to external platforms … we have community, spaces and circles … smart suggestions should be easy to adopt by swiping". The course editor's WhatsApp/Telegram field is gone: **Course group on #NotesApp** links a community the editor runs (owner or admin) and a Space in it, adds a members-only Space named after the course in one tap, or starts an invite-only community for the course (`createCourseGroup` in `lib/courses-server.ts`, `POST /api/academy/courses/<id>` `{ action: "group" }`). Enrolled learners (and buyers) get the invite with the links (`/api/academy/links`) and **Join the course group** joins them and opens the Space (`/c/<id>?invite=…&tab=spaces&space=…`). Circles weren't used for this: they're Business-only, up to 50, and admins add each person by hand. Old outside links stay and still show to learners ("Join the WhatsApp group") until a course group replaces them or the teacher removes them; `updateCourse` refuses any new or changed `communityUrl`. Live classes: audio rooms (host + 4 speakers + 20 listeners) or a meeting link for video and bigger classes. Swipe: `components/SwipeChip.tsx` (pointer events, Undo, a first-time hint and removed suggestions kept per title in localStorage, `prefers-reduced-motion`), used by `components/NanaSuggest.tsx` for topics, subtopics, Market categories and the new course lines (`kind: "course-lines"` on `/api/nana/suggest`, one Pearl call on a tap, cached an hour). Nana's prompt has the rule too (`lib/nana-prompt.ts`). Kept on purpose: share buttons, social profile links, contact WhatsApp numbers, payment providers, Join live links for streamed or video events, the comparisons with Calendly on Home and About, and the founders' Selar catalogue on `/merchstore` (`lib/store.ts` STORE_ITEMS, real products sold there; moving them onto the #NotesApp store is the owner's call).

79. **Co-author and co-tutor access and agreements (v0.109.0):** `firebase deploy --only firestore` (rules: server-only `inviteAgreements` and `coAuthorEditPings`; a note's `coEditedAt`/`coEditedBy`/`coEditedByName` can't be written from a browser; no new indexes). The lead picks the access when inviting (`lib/invite-terms.ts`): **Can view** (journals: read the draft; courses: see the course and every lesson, read-only) or **Can view and edit** (journals: the draft's title and text through `GET/POST /api/coauthors/draft`; courses: details, About, modules and lessons). Publishing, the price, the split, invitations and deleting stay with the lead. A view-only journal co-author may have 0%; one who edits keeps the 5% minimum (courses keep 0% allowed for both). The invitee answers on **`/invites/<journal|course>/<id>`** (the bell and email link there): **Accept and agree** needs `agree`, the current `INVITE_TERMS_VERSION` and the access and share they saw, and stores `agreedAt` + `agreedTerms` on the invite (the lead's panel shows "Accepted on …") plus the full wording and user agent in `inviteAgreements`. The lead changes terms with `action: "change"` (`/api/coauthors`, `/api/academy/courses/<id>/tutors`): less access applies at once; more access or any share change is stored as `change` and waits for the member to agree, the agreed terms staying in force (and counting the larger share against the lead's minimum). Old invites: a journal invite with no `access` reads as credit only (no draft, as before), a co-tutor with none as edit (as before). Journal co-authors can now **leave** before publishing; nothing changes once a post is published (a pending change lapses), while courses keep allowing changes after publishing, as before. Tests: `npm run test:coauthors-server`, `test:courses-server` (viewer and contributor co-tutors), `test:rules`.

80. **Course seeds and credited YouTube lessons (v0.110.0):** nothing to deploy (no new rules or indexes; lessons and courses gain fields only). **YouTube lessons** can carry `body` (Markdown notes, shown under the video as "Lesson notes") and `videoCredit: { title, name, url }`, which the lesson routes fill from YouTube's oEmbed on every save (`lib/youtube-oembed.ts`; a credit sent by the editor is ignored; if YouTube doesn't answer, the lesson keeps its credit for the same video). The player shows "Video: <title> by <creator>, on YouTube. Shared here with credit to the original creator." **Seeds:** Admin → Academy → **Seed courses** (super admins and the owner; `POST /api/admin/course-seeds`) writes the two courses in `lib/course-seeds.ts` as **@emmanuel**'s, after a dry run that shows what changes. *How to Restart Your Life After a Breakdown* is created as a **draft** for him to preview and publish. *IT Support Training* (`wLQCJdqolPh6A3WbvEZL`) is rewritten **in place**: details, cover and lessons replaced; id, address, published status, enrolments, reviews, likes, views and certificates kept. Seeded lessons have fixed ids, so seeding again rewrites the same lessons (no copies) and learners keep ticks on them. **Existing learners:** nothing is revoked; their old ticks no longer count (the lessons are new), so progress shows the new lessons; a learner who finished but hadn't claimed a certificate can claim until they tick a new lesson (ticking recomputes completion). Covers are original art in `public/images/academy/covers/` (1600×900 WebP). Videos were verified with oEmbed on 1 Nov 2026; the helpline numbers (112; SURPIN's toll-free 0800 078 7746 and hotlines) were checked on ncc.gov.ng and surpinng.com that day, so recheck them before re-seeding much later. Tests: `npm run test:courses`, `npm run test:courses-server`, `npm run test:course-seeds-server`.

81. **Course covers by Nana (v0.111.0):** `firebase deploy --only firestore` (server-only rules for `courseCovers`, `coverCounts` and `coverImages`; no new indexes). In the course editor's cover area, **✨ Make a cover with Nana** (`components/academy/CoverMaker.tsx`) calls `POST /api/academy/covers` `{ courseId, prompt?, baseId? }` (`lib/covers-server.ts`). There is no picture model: Pearl answers with a small JSON design (template, palette, pattern, icon, headline, subline, tag, layout; checked by `lib/covers.ts` `cleanSpec`, with our own design from the course when the answer can't be read), and `lib/cover-render.tsx` draws it at 1600 × 900 with next/og and makes WebP with the encoder Next.js ships (`next/dist/server/lib/squoosh`), stored in the media bucket under `academy/covers/<courseId>/` (Firestore `coverImages` only where the bucket isn't set up, served by `/api/academy/covers/image/<id>`). Eight templates, eight palettes, six patterns and 31 icons, all drawn in `lib/cover-art.ts`; titles are measured from the font files (`lib/font-metrics.ts`) so they never overflow. Who: the course's lead, accepted co-tutors and admins. How many: Admin → Pricing → Course covers by Nana (`academyCovers`, defaults Free 0, Free Basic 3, Pro 10, Business 25, Enterprise 50; admins at least Enterprise's), one per new cover or edit, counted per Lagos day in `coverCounts/{uid}_{day}`. Pearl is metered like writing help (`meterCheck`/`meterCharge`): allowance, then credit; when both are used up the editor says when the allowance refreshes. A member's own AI key is used first and not metered, but the daily number still applies. The last 8 per course are in `courseCovers/{courseId}`. Admins and scripts: `adminCover()` and `npx -y tsx scripts/course-covers.ts --course <id> [--spec '{…}']` (no count, no charge). Nine sample covers for our own AI courses are in `public/images/academy/covers/<slug>.webp` (`--samples` redraws them from `lib/cover-samples.ts`). In development with no AI key, a design made without the AI stands in for Pearl (only when `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST` is set). Tests: `npm run test:covers`, `npm run test:covers-server`.

82. **Monthly referrals and affiliate report (v0.112.0):** Deploy: `firebase deploy --only firestore:rules` (server-only rules for `referralReports` and `referralReportRuns`; no new indexes: every query is a range on one field). The owner asked for a monthly report "only if user has activity so mails won't be wasted". `monthlyReferralReports` (`lib/referral-report-server.ts`) runs in the reminders cron as `referralReports`: from 08:00 Lagos on the 1st, for three days, about the month before (Lagos calendar month). It finds who had activity from the month's own records, not by reading every member: `referrals` by `referredAt` (sign-ups) and `paidSince` (paid conversions), `referralEarnings` by `createdAt` (plan payments and affiliate sales) and `releaseAfter` (earnings that cleared their hold), `referralWithdrawals` by `at`. Link visits are not recorded (`/r/<username>` only sets the cookie), so the report has no visitor count; recording them would need a write on every link click. Each run sends to the next 40 members due; `referralReports/{uid}_{YYYY-MM}` is created before the email (so a re-run or an overlapping run never sends twice) and `referralReportRuns/{YYYY-MM}.done` stops the month. No activity: no email, no marker. Skipped: `emailPrefs/{uid}.referralReport === false` (Account settings → Email, on by default, and the signed link `/api/referrals/report/unsubscribe`, with List-Unsubscribe headers), suspended, teen or kid accounts, no email. The email (`lib/referral-report.ts`, its own layout in our crimson and ivory): the month's totals, all-time available, pending and withdrawn (the same `summary` as the Referrals page), a table of the month's sign-ups and sales (date, what, amount paid, commission, status), the link and code, "See your referrals", a tip, and a plain-text part. Buyers and friends are never named, as on the Referrals page (it shows earnings without buyers). A bell (`referral` type, 📈) carries the month in one line. Admin → Referrals: "Send me a preview" (any member and month, to your own email; Finance and Growth) and "Send due reports now" (super admins, if the cron missed the window). Resend's quota: count last month's active referrers before the first run. Test: `npm run test:referral-report-server`.

83. **The one-month anniversary: announcement, feedback and Exam Prep reviewers (v0.113.0):** **Deploy:** `firebase deploy --only firestore:rules` (new server-only `announcements` and `announcementSends`; `leads` now refuses browser-created `feedback` and `volunteer` leads, which come only through their rate-limited routes). No new indexes (the volunteer look-up is two equality filters). Set `EMAIL_LINK_SECRET` (or `CRON_SECRET`) in Vercel if it isn't already: the announcements' unsubscribe links are signed with it, and Send to everyone refuses without it. **Announcements** (`lib/announcements.ts` pure, `lib/announcements-server.ts`, `/api/admin/announcements`, `app/(main)/admin/announcements`, owner and super admins): the first time the page opens it writes the one-month draft (`ANNIVERSARY_DRAFT`, seed key `anniversary-2026-11` in `teamSeeds`, never written again). Write → Preview (the branded email with a hidden preheader, `renderEmailHtml`'s new `extra`) → **Send me a test** (needed after the last change) → **Send to everyone** (confirm). Sending is batches of 50 members by id, each member claimed with `announcementSends/{id}_{uid}` (`create()`), so a repeat or overlapping run never reaches anyone twice; the page loops the batches and the reminders cron (`continueAnnouncements`) finishes one left half-sent. Bell (`type: "announcement"`, linking to `/announcements/{id}`) to every member except suspended accounts and child profiles; email to members with a confirmed email, not in teen mode, whose `emailPrefs/{uid}.announcements` isn't false (unset counts as false only if they switched the weekly digest off). Unsubscribe: `/api/announcements/unsubscribe` (signed, one-click, List-Unsubscribe) and a second switch in Account settings → Email (`/api/account/email-prefs` takes `announcements`). Nothing was sent: the owner presses Send. Resend's free plan is 100 emails a day for everything, so raise it before sending to more members than that. **Feedback** (`lib/feedback.ts`, `components/FeedbackForm.tsx`, `/api/feedback`, 5 an hour per address and per member): Contact → Feedback in the topic list, `/contact?topic=feedback` and the banner on `/contact`; saved as `leads` with `category: "feedback"`, `feedback: { mood 1-5, love, missing, recommend 0-10, contactOk }` and `uid` when signed in. Admin → Leads → **Feedback** shows each reply's scores and the averages and NPS. **Reviewer sign-up** (`lib/prep-reviewers.ts`, `/exam-prep/reviewers` = `prep.<domain>/reviewers` (middleware), `/api/exam-prep/reviewers`, 5 an hour): the 18 subjects (English counts once for Use of English and English Language), JAMB/WAEC/NECO, background, years, optional phone (masked on Leads), "Join the reviewers' community (optional)" unticked. A lead with `category: "volunteer"`; a second sign-up from the same email while the first waits updates it. Admin → Leads → **Exam Prep reviewers**: **Approve** (Editorial or super admin; `approveVolunteer` in `lib/leads-server.ts`) writes `prepReviewers/{uid}` with their subject keys when the sign-up was signed in or an account has that email (the same record an invite link writes, so they appear under Admin → Naija Exam Prep → Reviewers), otherwise makes a one-person invite (`createInvite`, 14 days) and emails the link; either way an email and, for accounts, a bell. **The reviewers' community** (`seedReviewersCommunity`): one tap on that tab (super admins) makes `/c/naija-exam-prep-reviewers`, private (invite link only, not in the directory, non-members see only the name and about), verified, with Spaces Start here (admins post, a pinned welcome), Sciences, Arts and humanities, Commercial and Questions to discuss, members-only. The person who taps it owns it (`@na-notesapp` is a channel with no account, so it can't run a community); give other staff admin there. Volunteers who asked to join get the invite link with their approval (email and bell), not at sign-up, so it stays reviewers only. Tests: `npm run test:anniversary-server` (feedback to Leads, sign-up and approval both ways, the community seed run twice, the announcement: test-before-send, batches rewound and repeated, bell to all, email only where allowed) and `npm run test:rules`. The final announcement text is in Admin → Announcements; facts come from `lib/changelog.ts` (October 2026 and 1 November), the rewards from `lib/referrals.ts`, "coming soon" from the roadmap's not-live list, and "50 members with no ads" is the owner's own figure.

84. **Share to Moments, Share to Journals, and Paystack transfer OTPs on Payments & payouts (v0.114.0):** deploy `firebase deploy --only firestore` (one explicit server-only rule, `payoutOtpLog`; no new indexes). **Sharing:** `lib/share-targets.ts` (pure: the kinds `journal | course | certificate | coupon | post | item | service | event`, the card builders that return null for anything not public, `journalDraftFromCard`, `/share` links) and `lib/share-targets-server.ts` `resolveShareCard` (reads the item as it is now: published journals and courses, valid certificates, open coupons via `couponCard`, community posts only in a public channel of a findable, non-invite-only community). `components/share/ShareToNotesApp.tsx` holds the two buttons (`look` menu, pill or link), the sign-in prompt for visitors, the Moment compose sheet and `ShareMenu` (Moments, Journals, another app, Copy link). Items: `storeItems` with `sellable: true`, in stock or not, refused when the seller is suspended or `shopHidden`; the card carries `price` in naira. Services: id `<username>` = their 1:1 sessions (`publisherSettings.session.enabled`, price and minutes) or `<username>~<n>` = line n of `sites/{uid}.blocks.services` while it is on. Events: `visibility: "public"` and not cancelled. A `ShareButton` (opens `ShareMenu`) was added where there was no share at all: `ShopItemView` (main site and member sites), `MarketCard` (Notes Market and Explore), `BookingCard` (profile and site home), each service in `SiteBlocks` Services, and `EventDetail`. The others are on `SocialBar` (journal page), `FeedPost` (feed cards), community `Feed` posts (`shareable` from `CommunityView`), `CourseView` (top Share and `ShareRow`), `CertificateActions` and `CouponView`. Not added: the Exam Prep pay link (a private payment link), chat media and Notes Life; profiles have no share menu yet (a member's own domain sends both buttons to `/share` on #NotesApp). Moments: `kind: "link"` with `link` (the card) in `lib/moments-server.ts` `shareToMoment` (POST `/api/moments { share: { kind, id }, text?, hours? }`): normal hours, audience, teen mode, the daily limit and mentions, child profiles refused, `ownsMedia: false` so the item's cover is never deleted with the moment. Journals: the draft goes through `sessionStorage["notesapp:chatDraft"]` with `from: "share"` to `/write/new` (a quoted Markdown block: title link, cover, "Shared from @creator"; never auto-published). Card API: GET `/api/share?kind=&id=`. Tests: `npm run test:share`, `npm run test:share-server`. **Transfer OTP:** with Transfers OTP on in Paystack, `POST /transfer` answers `status: "otp"`; `releaseLedgerEntry` now stores `transferCode`, `awaitingOtp: true`, `otpSentAt` (status stays `transferring`) and the auto-release run skips the publisher's "on its way" email. `/admin/payments` shows **Awaiting OTP** cards (`components/admin/PayoutOtpPanel.tsx`: 6-digit field, Confirm, Resend OTP, 30-minute countdown from `otpSentAt`), each payout with its own field. POST `/api/admin/payouts/otp` (Finance; 10 a staff member per 10 minutes) → `lib/payout-otp-server.ts`: `finalize` calls `POST /transfer/finalize_transfer { transfer_code, otp }`, `resend` calls `POST /transfer/resend_otp { transfer_code, reason: "transfer" }` (checked against Paystack's API reference, 1 Nov 2026). 5 tries per code (counted before Paystack is asked), 5 resends per payout; every try is in `payoutOtpLog` with the staff member and the result, never the code. A finalize answering `success` marks it paid out; the `transfer.success / failed / reversed` webhook still settles it as before (it now also clears `awaitingOtp`). Test: `npm run test:payout-otp`. **Bulk transfers:** we don't use them (each payout is its own `POST /transfer`), so OTP works per payout. Paystack's `POST /transfer/bulk` can't be used with OTP on. For fully automatic payouts (or bulk later), the owner switches OTP off in the Paystack dashboard, Settings → Preferences → "Confirm transfers before sending" (or `POST /transfer/disable_otp` then `/transfer/disable_otp_finalize { otp }`). The trade-off: with OTP on, a leaked secret key alone can't move money; with it off, anyone holding `PAYSTACK_SECRET_KEY` can, so keep the key in Vercel only and IP-whitelist it in Paystack if switching off.

85. **Seven AI courses from LWB Academy (v0.116.0):** nothing to deploy (no rules or indexes); nothing is seeded until someone taps it. **Seed them:** Admin → Academy → Seed courses → **LWB Academy (@lwb)**: a dry run per course, a confirm per course, or **Seed all seven**. Before that, @lwb must be an organisation account (`accountKind: "organisation"`) with @emmanuel on its team as an **admin or writer** (`orgMembers/{lwbUid}_{emmanuelUid}`); if either is missing the card says so and the seed is refused (all seven are checked before anything is written). Each course is created as a **draft** owned by the organisation (`ownerUid` = @lwb, `isOrg: true`), made by Emmanuel (`createdByUid` = his uid, `madeByName`/`madeByUsername`), so the course page shows **Taught by Emmanuel Adams** under LWB Academy and he edits them from Teach; the organisation (or Emmanuel) previews and publishes them. Seeding again updates the same courses and lessons (found by `seedKey`), never copies them, and keeps their status. Courses: AI for Everyday Africans, AI for Small Businesses and Traders, AI for Farmers and Agribusiness, AI for Teachers, Schools and Students, AI for NGOs, Churches and Public Organisations, AI Careers and Freelancing in Africa, and AI for Professionals (`lib/course-seeds-ai.ts`, one file each in `lib/course-seeds-ai/`): 70 Markdown lessons, fixed lesson ids, a "Try this today" exercise and a privacy check in every lesson, a closing quiz with explanations, and 19 YouTube lessons whose `videoCredit` is YouTube's oEmbed answer word for word (checked 1 November 2026). One type for every seed: `SeedCourse` in `lib/course-seeds.ts` (`ownerUsername`, `byline`, and for an organisation's course `teacherUsername` and `group`); `ALL_COURSE_SEEDS` is Emmanuel's two plus these seven. Covers: `public/images/academy/covers/<slug>.webp`, the cover-art set (nine in all, Emmanuel's two refreshed to the same style). Organisation courses made from Teach now also record `madeByName`, so they credit their maker the same way. Platform facts in the careers course (Remotasks, Outlier, Mindrift, CrowdGen, Sama) change often: re-check them before seeding. Tests: `npm run test:ai-seeds`, `npm run test:courses`, `npm run test:course-seeds-server` (an organisation owner, the membership check, drafts, `createdByUid`, and re-seeding without copies).

86. **Business books (plan, v0.115.0):** nothing to deploy. `docs/BUSINESS-BOOKS.md` plans books for sellers. It covers walk-in sales with receipt links and PDFs, expenses with photos, stock linked to inventory, money owed to you (email and bell reminders, SMS with Send-Na) and money you owe, profit and loss by day, week and month with cash in hand, offline entry (PWA outbox), cashier and manager roles, Nana entries from a sentence (Pearl, from the allowance), a monthly email only with activity, and honest numbers (stock value never added to activity). It also lists exactly what can be imported today: inventory CSV updates only, publications (BibTeX, ORCID, DOI), plus staff-only Exam Prep and finance CSVs. It plans imports from Excel/CSV, Google Sheets, Tralo's CSV exports, Shopify, WooCommerce, Selar, Paystack, bank CSV and paper-ledger photos, with column matching, a dry-run preview, dedupe, undo for 24 hours and limits. Pricing options A/B/C (recommended: A, free with 150 entries a month on Free Basic, Inventory unchanged), a data model and ten open questions are in the doc. Owner decision (1 Nov): non-members get receipts and debt reminders by WhatsApp (click-to-send through `wa.me` from the seller's phone first, the Business API later) and by SMS once the seller opts in to Send-Na, each with a short #NotesApp line, an approved exception to "our own tools first". **Waitlist, not "coming soon" (owner, 2 Nov):** the public page `/books` (`app/(main)/books/page.tsx`, three mockups in `public/images/books/`) has the form `components/BooksWaitlistForm.tsx`. It posts to `/api/books/waitlist` (rate limited 5 an hour per address and per member; `lib/books-waitlist.ts` checks the answers). `submitBooksWaitlist` in `lib/leads-server.ts` saves one lead per email, category `books-waitlist`, sends a thank-you email and, for members, a bell (type `books`). Admin → Leads has a **Business books waitlist** tab with counts. `/store-selling#business-books`, the home features, the roadmap and the two help articles link to `/books`. **Deploy:** `firebase deploy --only firestore:rules` (browsers may not create `books-waitlist` leads). Tests: `npm run test:books-server`, `npm run test:rules`. **Waiting on the owner:** approve the plan and the mockups (phone and desktop, Day and Night, shared separately) before step 3. On the roadmap's not-live list.

87. **No written-in domains; tickets like gifts; events on Explore and Trending (v0.117.0):** nothing to deploy (no rules; no new
    indexes: the new queries are on one field each: `events.nextStartAt`, `eventRsvps.at`, `tickets.createdAt`). **Domains** (owner,
    2 Nov 2026: "by notesapp was hard coded on prep.naapp.tech … powered by #NotesApp on publisher's site are also hard coded"):
    `mainSiteUrl(host, path)` in `lib/host.ts` is the main site of the family being viewed (prep.naapp.tech → www.naapp.tech), or the
    primary address (`MAIN_HOST`) on localhost, previews, members' own domains and unknown domains. Exam Prep's header and footer
    (`app/exam-prep/layout.tsx` → `PrepChrome mainUrl`), the member-site footer mark and "Go to #NotesApp"
    (`app/(site)/s/[username]/layout.tsx`), `components/site/PoweredBy.tsx` and team tags (`useMainSiteUrl` in
    `lib/use-family-url.ts`) use it. Other written-in domains now come from `lib/host.ts`: the Exam Prep admin (reviewer invite links
    were `https://prep.notesapp.name.ng/...`: now `PREP_URL`), certificate addresses on home, About, `/certificates/<id>`, the Academy
    page and FAQ (`ROOT_DOMAIN`), sample certificates' QR (`SITE_URL`), the Notes Life billboard, LUXNAS's shop link, and the NKENNEAi and
    Crossref User-Agents. Kept on purpose: the brand page, help articles stating an address (Exam Prep schools, the MCP address), the
    changelog, contact and test email addresses, the calendar UID `@notesapp.name.ng` in `lib/events.ts` (changing it would duplicate
    events in people's calendars), `media.notesapp.name.ng`, `lib/team-seed.ts` and `lib/config.ts` descriptions, comments. Member sites
    on their own domain link to `https://www.<NEXT_PUBLIC_ROOT_DOMAIN>`, so they show naapp.tech once that setting is changed in
    Vercel (docs/DOMAIN_SWITCH.md step 4). `npm run test:host` (with the setting unset and as naapp.tech). **Tickets** (owner: "Event
    tickets commissions should be like Gifts to a community, because they bring us more members"): no commission on any plan; giving's
    band per ticket by its price (`bandChargeKobo`, ₦10/₦25/₦50) plus Paystack's card charge at cost on the payment (`quoteTickets` in
    `lib/tickets.ts`, reusing `lib/giving.ts`, so a change to `GIVING_BANDS` moves both). Checkout records `bandKobo`,
    `cardChargeKobo` and `netKobo` on `payment.ticket` with `commissionRate: 0`; the `ticket` ledger entry is gross after the card
    charge, commission = the band, like a gift. A payment without those fields (sold before v0.117.0) keeps its recorded commission
    (`ledgerFor`). ₦5,000 on Pro: the organiser got ₦3,750 (25%), now ₦4,815 (₦10 + ₦175 card charge). Kept from tickets: paid out
    after the event ends (plus the usual hold), refunds void the tickets, card only, no discount codes. Not taken from gifts: the
    ₦20,000 cap until verified (a ticket is admission sold by a named host, held until the event is over and refundable, so a cap
    would only block ordinary gala and conference prices) and the giver's "cover the charges" (the buyer pays the ticket price).
    Giving's bands aren't in Admin → Pricing, so tickets' aren't either; both would move there together. **Explore and Trending**
    (owner: "explore and trending should also list events"): `listedEvents` (public, not cancelled, not over, not from an invite-only
    community; `isListedEvent` in `lib/events.ts`) feeds Explore's new Events tab (`GET /api/events?explore=1`, `EventCard`, soonest
    first, searchable) and `trendingEvents` Trending's new Events tab (in `/api/trending`): tickets sold ×5, RSVPs ×3 and visits to the
    event page in the period (`eventTrendScore`), then events with no interest yet, soonest first. Visits: `/api/views` takes kind
    `event` (public, not cancelled) and `EventDetail` records one per session (not the organiser's). Tests: `test:giving` (ticket
    charges, which events are listed), `test:giving-server` (ledger, the older-ticket case, listed and trending events). Docs:
    `docs/SITES.md` (phase 5, the Powered by link, live and planned), `docs/BUILD_LOG.md` (v0.82.1 to v0.117.0), and the new rule in §3
    and `docs/ENGINEERING_GUIDE.md`.

88. **Business books, the first working release (v0.118.0):** deploy `firebase deploy --only firestore` (rules: server-only
    `bookEntries`, `bookParties`, `bookItems`, `bookReceipts`, `bookReminders`, `bookImports`, `bookSettings`; index: `bookEntries
    (ownerUid ASC, on ASC)`; until it's built, reads fall back to the seller's entries and filter in memory). No new settings. The app
    is `/profile/books` (My account → Business books; `/books` stays the public page, now to say it's open): Record a sale (store items,
    Books-only items or typed; cash, transfer, POS, credit with a due date), Add expense (categories, up to 3 private receipt photos
    through the private bucket), Today, Sales, Expenses, Stock, Money owed (WhatsApp `wa.me` click-to-send for non-members with the
    footnote built from `ROOT_DOMAIN`, email and bell for members, one a day, stop from the statement), Profit and loss (day and week;
    month on Pro and above; stock value always apart), Import and export (CSV only; Tralo preset; dry run, dedupe, undo for 24 hours;
    templates; export everything). Receipts are `/receipt/<code>` (not `/r/`, which is referrals) and statements `/statement/<code>`.
    Paid store orders are written by `bookOnlineOrder` from `lib/payments.ts` and the admin refund, and caught up when Books opens.
    Walk-in sales move stock through Inventory (`bookStockMove` in `lib/inventory-server.ts`, moves carry `bookRef`). Free Basic caps
    in `lib/pricing.ts` `books` (150 entries a month, 20 customers owing, 500 rows a file), editable on Admin → Pricing. Who: the
    seller and an organisation's admins. Tests: `test:books`, `test:books-server`, and the rules test, in CI. Public pages: `/books` is the live landing
    (Open Business books / Start free, `components/books/BooksCta.tsx`); the waitlist form is gone, its leads stay in Admin → Leads. What differs from the
    plan, and what's next (Nana entries, offline, the monthly email, roles, paying a debt online): `docs/BUSINESS-BOOKS.md` section 10.

89. **Business books: Nana entries, offline entry, the monthly email, staff roles and paying a debt online (v0.119.0):** deploy
    `firebase deploy --only firestore:rules` (new server-only collections `bookStaff`, `bookStaffInvites`, `bookReports`,
    `bookReportRuns`; every Books collection stays server-only). **No new indexes** (the new queries are equality-only or a range on one
    field). **Cron:** nothing new to schedule; the reminders cron (`/api/cron/reminders`, every ~15 min) now runs `booksReports`
    (`lib/books-report-server.ts`): the 1st of each month from 08:00 Lagos, in batches of 40, catch-up for 3 days, one marker
    `bookReports/{uid}_{YYYY-MM}` per seller and month, `bookReportRuns/{YYYY-MM}`; only sellers with entries; preference
    `emailPrefs/{uid}.booksReport` (Email settings, on by default) and a signed one-click unsubscribe `/api/books/report/unsubscribe`
    (uses `EMAIL_LINK_SECRET` or `CRON_SECRET`, like the digest). No new settings.
    - **Nana entries** (`lib/books-nana.ts` pure, `lib/books-nana-server.ts`; `/api/books` action `nana`): Pearl reads a sentence into
      draft entries against a strict JSON shape, matched to the seller's items and customers; nothing saved until each draft is saved.
      Paid by the books' **owner** (their own AI key first, else their Nana allowance then credit, `meterCheck`/`meterCharge`); 40 an
      hour per person, 120 per shop, 200 a day per shop on our key. With no AI key and the emulator set (development), a stand-in reader.
    - **Offline** (`lib/books-outbox.ts` pure, `components/books/outbox.tsx`, `lib/books-sync-server.ts`, action `sync`; `public/sw.js`
      caches `/profile/books` and its scripts and runs Background Sync tag `books-outbox`): every entry kind is saved once at
      `bookEntries/{owner}_{clientId}`; offline entries keep the day they were recorded (14 days at most) and are marked `offline`.
    - **Staff** (`lib/books-staff-server.ts`; `lib/books.ts` `can`): Cashier and Manager, invited by the owner or an organisation's
      admins (bell and email; accept at `/invites/books/<id>`, also listed on `/invites`). Seats: `lib/pricing.ts`
      `books.staffSeatsBusiness` 4, `staffSeatsPro` 0 (open question 4 unanswered), Enterprise unlimited. Roles are checked in
      `/api/books` for every view and action. Entries keep who made them in `by` (the uid); the seller filters Sales and Expenses by person.
    - **Paying a debt online** (`lib/books-debt-server.ts`, `/api/books/debt`, Pay now on `/statement/<code>`): payment kind `debt`
      (Paystack card or bank transfer, no sign-in), fulfilled in `lib/payments.ts` (return page or webhook, once): a payment entry
      `debt_<ref>` applied oldest first, a receipt, and `ledger/<ref>` kind `debt` held `books.debtHoldDays` (7) then auto-paid like a
      download sale (`lib/payouts.ts`). Commission `books.debtCommission`: `"store"` (the seller's physical-goods rate, the default) or
      `"none"`, editable on Admin → Pricing → Business books until the owner answers open question 5.
    - Tests: `test:books`, `test:books-server` (both extended), `test:pricing`, `test:rules`. Plan and what's left:
      `docs/BUSINESS-BOOKS.md` section 10.

90. **Business books imports from other apps (v0.120.0, branch `push/books-imports`):** no deploy step (no new collections or
    indexes; entries gain `extRef`, customers `email`). `lib/books-import.ts` has a preset per source with the export headings and
    where they were checked: Shopify products and orders (help.shopify.com, verified), WooCommerce products (the Product CSV schema,
    verified) and orders (no built-in export: the Customer / Order / Coupon Export and Advanced Order Export plugins, matched, seller
    checks), Selar (not documented anywhere we found: guessed headings), Bumpa (export steps documented, columns not: guessed),
    Paystack (the export is documented, the default headings aren't: matched) and bank statements (GTBank, Access, Zenith, First
    Bank, UBA, Opay, Moniepoint, Kuda layouts from common statements, not from the banks). `detectSource` picks the source from the
    headings. Orders with several rows are one sale; only paid ones come in; refunds become refund entries; other currencies are
    refused. Re-imports match by `extRef` (`<source>:<order no.>`) before date + amount + item. Paystack skips `na_` references
    (`lib/paystack.ts` `newReference`) and any `bookEntries/online_<ref>`, and its fees become one Bank and POS charges expense a day.
    Bank lines come back in the plan (`plan.bank`) for the seller to tick and label (a rules-based guess from the narration; Nana
    isn't used, to keep it free); only the ticked `choices` are saved. Bank PDFs are read in the browser with `pdfjs-dist` (already a
    dependency) by `statementFromPdfLines`; a scan asks for CSV. **Open question:** Bumpa's customer export (and some bank apps) give
    Excel only; there's still no xlsx reader, so the wizard asks for CSV. The owner decided on 2 Nov 2026: no Excel library; sellers save Excel files as CSV (the wizard says how). Fixtures
    in `tests/books/fixtures/`, tests in `test:books` and `test:books-server`.

91. **Teen mode on Moments and Notes Life (v0.121.0, branch `push/teen-moments-life`):** deploy `firebase deploy --only
    firestore:rules` (`lifePresence`: a member with `users.teen` or a child profile can't read or write it; they can still delete
    their own entry). No new indexes or collections. Closes the team hub item `young-moments`. `lib/young.ts` has the pure rules
    (`hearsOnlyFromFollowed` = `teen` or `keepRepliesFollowers`, `mayReach`, `teenAudience`, `mayReshare`, `keptOffLists` = `teen` or
    `keepHidden`, `lifeRowShown`, `inviteeShown`). `lib/moments-server.ts`: `mentionGate` (a moment @mentioning a teen who doesn't
    follow the author is refused with a friendly message), `replyToMoment` checks the owner's follow, `reshare` refuses a teen's
    moment or a teen's reshare, and `rootOk` keeps older reshares of a teen's moment to the teen's audience in `canSee`,
    `listForOwner` (which now checks reshares one by one) and `listFeed`. `lib/mentions-server.ts` `notifyMentions`: no bell to a
    teen from someone they don't follow (every kind). `lib/life/server.ts`: `richList` drops teens (and `keepHidden`) for anyone but
    themselves and people they follow back (one `users` read per listed player, plus two follow reads per teen); `invites` masks
    teens who don't follow the inviter. Moments were already signed-in only (no public route), so nothing changed for signed-out
    pages. Not built because there's nothing to restrict: player-to-player gifts or trades, calls and room visits in Notes Life.
    Tests: `npm run test:young-social` (pure), `npm run test:young-server` (moments, mentions, the Billionaires List and invites
    against the emulator), `npm run test:rules` (presence).

92. **Courses step 3: course plans and limits in Admin → Limits (v0.122.0, branch `push/course-limits`):** no deploy step (no new
    collections or indexes; `serverConfig/limits` already exists and is server-only; course lessons gain `fileBytes` on PDFs and
    `videoSeconds` on videos, written by the server). `lib/limits.ts` has a Courses group: three switches (`freeCourses`,
    `paidCourses`, `courseVideoUploads`, `kind: "switch"`, 0/1, shown as tick boxes) whose defaults come from the new flags in
    `lib/tiers.ts`, and `coursesPerMember` (30), `coursesPerOrganisation` (90), `courseStorageGB` and `courseVideoHours` (0 = no limit,
    `noLimitAt0`). `canSellCourses` / `canUploadVideo` / `canTeachFreeCourses` / `canMakeCourses` / `courseCap` in `lib/courses.ts`
    take the saved overrides; with none they give exactly the old answers. Enforced in `lib/courses-server.ts` (`createCourse`,
    `updateCourse` price, `setPublished` free and paid, `checkUploadStart` for the upload route, `checkUpload` on lesson save with
    `uploadUse` across all the owner's courses; an edit that keeps the same upload is never stopped) and `courseCheckout`. Messages
    name the plans from the settings (`onPlans`), as do the editor, the Teach page (`maxCourses` from `teachingStatus`) and the
    pricing page's courses row and section. PDFs and videos uploaded before v0.122.0 have no measured size: a PDF counts as 0 bytes and
    a video by its minutes, which only matters once an admin sets a storage or hours cap. Marketing copy elsewhere (about, roadmap,
    Academy landing, FAQ) still describes the defaults in words. Tests: `test:limits` (new, in CI), `test:courses`,
    `test:courses-server` (adds `tests/courses/limits.emulator.ts`).

93. **Nana operator and Connect NotesApp, agent layer phase 1 (v0.123.0, branch `push/agent-operator`; 91 and 92 are reserved for
    other pending PRs):** design, decisions and code map in `docs/AGENT_LAYER.md`. **Deploy steps:** (1) `firebase deploy --only
    firestore` (server-only rules for `agentGrants`, `agentAuthRequests`, `agentCodes`, `agentClients`, `agentUsage`,
    `agentProposals`, `agentActions`, `agentEvents`, `nanaOps`; composite indexes `agentProposals` uid+createdAt and
    status+expiresAt, `agentActions` uid+at). (2) TTL policies on `agentActions.expireAt`, `agentProposals.purgeAt`,
    `agentUsage.expireAt`, `agentEvents.expireAt`. (3) cron-job.org: `GET https://www.<root>/api/cron/agents` every 15 minutes with
    `Authorization: Bearer $CRON_SECRET`; `vercel.json` now also has a daily Vercel Cron for it (06:05 UTC, inside Hobby's once a
    day). (4) Firebase → Authentication → Authorised domains: add `mcp.<root>` for every domain family (members sign in on the Connect
    screen there). (5) No new environment variables. (6) Admin → Limits → "Nana and connected agents": the plan flags (`nanaOperator`
    Business and Enterprise, `agentConnect` every plan) and the numbers (90 days, 100 actions, ₦2,000, 2 minutes, 24 hours, 48 hours,
    12 months, 10-minute codes, 3 days, Monday 07:00). **Decisions taken while building, for the owner to confirm:** Nana's jobs stay
    off until the member switches them on once; "confirmations go" means a thank-you to someone who already paid; journal drafts take
    pasted notes or a voice note's words (automatic transcription is phase 2); Standard accounts may connect an assistant; an
    account tool called without a credential answers HTTP 401 (so OAuth assistants start the Connect screen). Tests:
    `test:agents`, `test:agents-server`, `test:mcp-server` (updated for the 401), `test:rules`.

94. **Team hub "+ New task" and the rooms relay task (v0.123.1, branch `push/team-new-task`; 92 is reserved for a pending PR):**
    nothing to deploy. A "+ New task" button beside the hub's title opens a form with every field an item has (title, details with
    clickable links, due date with Today / In 1 week / In 2 weeks, when, status with the decision question or blocker, departments,
    people, monthly repeat); the quick "Add work" row stays lower down. Item details now show web addresses as links
    (`components/LinkedText.tsx`). Seed `rooms-relay-2026-11` (`ROOMS_RELAY_BACKLOG`) adds the owner's task "Audio rooms past 20
    listeners: Cloudflare relay (Realtime SFU)", due 9 Nov, with the Cloudflare steps for `CLOUDFLARE_REALTIME_APP_ID` /
    `_TOKEN` and the TURN keys; the standing "rooms-relay" signal in `lib/team-server.ts` is unchanged. Tests: `test:team`,
    `test:team-server`.

95. **Live commission and figures on booking, bookings, pricing and the help (v0.123.2, branch `push/live-rates`):** nothing to
    deploy (no rules or indexes). Owner, 2 Nov 2026: "booking, bookings, pricing didn't show commission rate for booking Session,
    subscription and gift cut... help should not hardwire figures that can be changed from admin limits/pricing". Root cause: the saved
    pricing (`platformSettings/pricing`) is applied to the live objects only by `ensurePricing()`, which only money paths called. Server
    pages (pricing, gifts, booking, badges, …) never called it, and most were built once at deploy, so they showed the defaults or
    whatever that server instance had last loaded; screens drawn in the browser always had the defaults bundled; the help
    (`lib/kb-server.ts`) never loaded pricing, limits or agent settings. Now: `loadLivePricing()` (`lib/pricing-server.ts`) at the top
    of every server page that shows prices, with `revalidate = 60`; `/api/pricing` + `useLivePricing()` for browser screens
    (Rates & payouts, BadgeCard, boosts, course editor, Academy FAQ, NoteForm…); `getArticles` loads pricing, `serverConfig/limits` and
    `serverConfig/agents` and passes them to `builtInArticles(live)`, rebuilding at once when a figure changes. Publishers' own rate:
    `/api/publisher/rates` (`lib/my-rates.ts`, `commissionRateFor(tier, customRates)`) shown by `components/MyCommission.tsx` on
    `/profile/publishing`, `/bookings` (publishers only), `/booking` and `/gifts`. Fixed figures (referral share, discount limits,
    giving bands, Paystack's card charge, ad-share hold and minimum, co-tutor limits) are quoted from their constants. Left as text on
    purpose: `/terms` (legal wording), `/roadmap` (history), Notes Life game prices, the challenge prize, example sentences. Tests:
    `test:help` (new: saves a non-default config in a stand-in database, loads it as the help does, checks the articles, the pricing
    row and the publisher lines, and guards `lib/kb-articles.ts` against literals equal to an admin default), `test:pricing`,
    `test:limits`, `test:nana`.

96. **Audio rooms on the Cloudflare relay (v0.124.0, branch `push/rooms-relay`; 95 is reserved for PR #251):** built and **off until
    the keys are set**: without `CLOUDFLARE_REALTIME_APP_ID` and `CLOUDFLARE_REALTIME_APP_TOKEN` every room runs phone to phone exactly
    as before (20 listeners). **Owner steps:** (1) dash.cloudflare.com → Realtime → Serverless SFU → Create application (e.g.
    notesapp-audio-rooms). (2) Vercel → Settings → Environment Variables, Production: `CLOUDFLARE_REALTIME_APP_ID` = the App ID,
    `CLOUDFLARE_REALTIME_APP_TOKEN` = the App Token (shown once; mark it **Sensitive**). (3) While in Realtime → TURN Server: the Turn
    Token ID into `CLOUDFLARE_TURN_KEY_ID` and its API token into `CLOUDFLARE_TURN_API_TOKEN` (same place, Production, token
    Sensitive); /status → "Calls and audio rooms" says exactly which is wrong if they don't match. (4) Redeploy. (5) `firebase deploy
    --only firestore:rules` (new server-only `communityRooms/{id}/relay/{uid}` and `communityRooms/{id}/people/{uid}`, listeners in
    people/ may read the room, and a relay room's chat is written only by the server). No new indexes (single-field only). (6) Check
    /status → "Audio rooms relay" says "relay ready" (it opens a free Cloudflare session to prove the App ID and token), then start a
    test room: the room line says "through the relay". The Team hub's standing "rooms-relay" reminder disappears once both keys are
    set; after that, relay trouble shows on /status only (with the reason a real room met in the last half hour).
    **Settings** (Admin → Limits → Audio rooms, `serverConfig/rooms`): "Use the Cloudflare relay" (on by default; only with the keys),
    listeners per room with the relay (500), phone to phone (20), slow mode above (200 listeners) and its gap (10 s). Rooms already open
    keep their mode; a room whose start can't reach Cloudflare runs phone to phone and the host sees why. **What limits a relay room is
    Firestore, not Cloudflare:** every person in a room keeps a live read on the room doc and on the chat, so each change to either is
    read by everyone in it. To keep that bounded, in relay rooms only the stage (host and speakers, at most 5) beats into the room doc;
    each listener's presence is its own `people/{uid}` doc; the listener count on the room doc is re-counted at most every 15 s
    (claimed in a transaction, one recount per window); listeners see the count and open a paged "People here" list; the chat goes
    through the server with slow mode past the setting. Roughly: a 500-listener room reads ~0.4 room-doc changes a second × 500 ≈ 200
    reads/s, plus 500 reads per chat message, so watch Firestore reads (Firebase console → Firestore → Usage, and the team hub's reads-per-member trigger) before raising the listener setting much past 500,
    and lower "slow mode above" if chat gets busy. Cloudflare bills egress only (first 1,000 GB a month free); a 500-listener hour is
    roughly 500 × ~25 MB. **Unverified until the keys exist:** the calls were written against Cloudflare's OpenAPI
    (`realtime-api-2024-05-21`: sessions/new, tracks/new local and remote, renegotiate, tracks/close with `force`) and tested against a
    stand-in; the exact error codes for a wrong App ID or token, and real audio through the SFU in browsers (Safari especially), need
    one live test room. Tests: `test:rooms` (mode choice, push/pull permissions, cap, settings, the count window, slow mode, the help
    and public page figures, the Cloudflare client against a stand-in fetch), `test:rooms-server` (emulator: the server flow with a
    stand-in Cloudflare, the fallback, the cap, people/, the recount, slow mode, the Team hub reminder), `test:rules` (two new tests),
    `test:community`, `test:community-server`.

97. **Calls: earpiece for voice, speaker for video, and a Sound picker (v0.124.3, branch `push/call-audio-route`; 95 and 96 are
    reserved for pending PRs, as are v0.123.2 and v0.124.0):** nothing to deploy. Root cause: iPhone Safari routes a page that has
    the microphone open to the loudspeaker unless `navigator.audioSession.type` is "play-and-record" (and Notes Life's game sound sets
    "playback"); Android Chrome, left on the "default" microphone, picks wired > USB > Bluetooth > speakerphone and only uses the
    earpiece when the microphone called "Headset earpiece" is opened. Also, 1:1 video played the remote voice through both the
    `<video>` and the `<audio>` element. Now `lib/call-audio.ts` (pure rules, `tests/calls/audio.test.ts` in `test:calls`) and
    `components/calls/useCallAudio.ts` (used by `CallManager.tsx` and `GroupCall.tsx`): iPhone sets the audio session for the call
    ("play-and-record" = earpiece, "auto" = speaker; the previous type comes back afterwards); Android opens Chrome's route by
    microphone id (with echo cancellation, which puts Android in call mode) and swaps it in with `replaceTrack`; computers use
    `setSinkId` for speakers (Firefox: "Choose another speaker…" via `selectAudioOutput`) and a separate microphone list. Remote
    sound always plays through `<audio>` elements (videos are muted). Headsets win on `devicechange` unless the person picked
    something in this call; choices are remembered per device in `localStorage` (`na-call-sound`). Can't be done from a web page:
    choosing AirPods/Bluetooth on iPhone (Control Centre), any route on iPad (no earpiece), and Android browsers other than Chrome
    (no route names: the note says so). Untested on real phones from here: please try a voice and a video call on an iPhone and an
    Android phone, with and without headphones.

101. **Pricing table without repeats (v0.124.2, branch `push/pricing-merge-cells`; 97–100 are reserved for pending PRs):** nothing to
    deploy. In the /pricing compare table, neighbouring plans whose cell says the same thing are shown once across those plans
    (`mergeCells` in `lib/pricing.ts`, worked out from the live text, so an Admin change that makes plans differ splits the cell again).

98. **Live mode in audio rooms: video, poster, Audio only, video-minutes budget, host prompts (v0.126.0, branch `push/live-mode`, cut
    from `push/rooms-relay`; 96 is PR #253 and 97 is reserved for the calls PR):** needs item 96 merged and the relay's keys set; on
    phone-to-phone rooms only the poster applies. **Deploy:** `firebase deploy --only firestore:rules` (new server-only
    `communityRooms/{id}/live/{doc}`); no new indexes; no new env vars (posters use the existing R2 upload, new purpose `poster`, kept
    under `posters/{uid}/`). **Settings** (Admin → Limits → Audio rooms → Live mode, `serverConfig/rooms`, read live in the help and on
    /community/audio-rooms): video on (on), video minutes per live (15; each camera on counts), grace when they run out (30 s), "back to
    audio" when this many minutes are left (2) or after a burst of (3 min), the drop prompt's suggested minutes (2), drop share (10%)
    and window (2 min), and the camera caps (600 kbps, 24 fps, 480p). The relay listener setting's ceiling went from 5,000 to 10,000
    (default still 500). **How it works:** `lib/rooms-live.ts` (pure: who may send/pull video, the minutes, samples, prompts, Audio
    only's default) and `lib/rooms-live-server.ts` (the shared state behind small functions: `noteListenerSample`, `markVideoOn`,
    `markVideoOff`, `stopVideo`, `enforceVideoBudget`, `hostLive`, `closeLive`, so step 2b can move the transport). The camera goes up
    through `/api/community/rooms` action "relay", op `video` (host; speakers only when the host ticks "Speakers can turn video on",
    `stageVideo`) as a second track on the person's existing Cloudflare session (track name on `relay/{uid}.video`), op `unvideo` closes
    it with `force` (no reconnect); `pull` with `video: true` pulls cameras (a viewer on Audio only never asks). The room doc carries only
    `videoOn` (uid → when), `stageVideo`, `poster`, `hostUsername`/`hostBooks`, and `videoUsedMs` when it ends; the minutes, open
    cameras, listener samples (one per 15-second count window, taken in `recount`) and prompt times are in `live/state`. The host's beat
    returns `host` (minutes left, prompt, grace); a speaker's beat with a camera up enforces the budget; listeners' beats never touch it.
    Budget: a camera can't go up once the minutes are used (checked before Cloudflare and again in the transaction); once used with a
    camera up, the grace starts and the next host or sending-speaker beat after it cuts every camera at Cloudflare. Posters: action
    "poster" (source upload | profile | challenge | none; an upload must be in the host's own `posters/{uid}/` folder), also accepted
    on "start". Audio only: `localStorage` "rooms.audioOnly", default on for `navigator.connection.effectiveType` slow-2g/2g/3g or
    `saveData`. **Teen mode:** rooms are community-scoped (members only, no follower audience), so a teen moderator hosting is unchanged
    from before; nothing new to mirror from `lib/young.ts`. **Scale:** nothing writes per listener or sends the full listener list;
    each camera on/off is one room-doc write (read by everyone in the room); samples and prompts go to `live/state`. **Step 2b**
    (`push/live-chat-edge`): the count and beats moving to a Durable Object should keep calling `noteListenerSample` (or its
    replacement) and pass the host's `hostLive` back on its beat; the camera ops stay on the relay route. **Untested live:** real video
    through Cloudflare's SFU in browsers (the `sendEncodings` caps, a second transceiver on the same connection, `replaceTrack(null)`
    then a new transceiver for the next burst, Safari), and the prompts' feel in a real room. Tests: `test:rooms` (new
    `rooms-live.test.ts`), `test:rooms-server` (new `rooms-live.emulator.ts`: video on/off, speakers, pulls, minutes, drop prompt,
    budget grace and refusal, posters, clean-up), `test:rules` (one new test), `test:help` (Live figures from a saved config),
    `test:limits`, `test:uploads`.
99. **Live chat and signals for big audio rooms on a Cloudflare Durable Object (v0.127.0, branch `push/live-chat-edge`, cut from
    `push/rooms-relay`; 97 and 98 are reserved for pending PRs):** built and **off until the worker is deployed and both settings are
    set**; until then relay rooms keep the Firestore chat and count exactly as in item 96. Why: in a relay room every chat message is
    read by everyone in it (10,000 listeners = 10,000 reads a message). Now each relay room opened while it's on (`edge: true` on the
    room doc) has one Durable Object (`workers/live-rooms`, class `LiveRoom`, WebSocket Hibernation API) holding everyone's socket: it
    broadcasts the chat (slow mode at the edge: automatic past the "slow mode above" setting, or the host's own switch; a rate limit per
    connection; 2 KB per frame), the live listener count, raised hands, stage moves and camera on/off (mirrored from step 2a's server
    state: `markVideoOn`/`markVideoOff` tell the room; browsers can't), and lets the host and moderators remove a message, mute and
    unmute, or ban for the room. Firestore stays the source of truth: a socket needs a 10-minute
    token our server mints only for someone the room already let in (`/api/community/rooms` action `livetoken`; joining still holds the
    cap), stage moves and the end are pushed by our server (signed), and the room sends back, signed, the chat in batches (every 3 s or
    50 messages) to `/api/community/rooms/edge`, which writes `communityRooms/{id}/chat` (the record, and what anyone on the fallback
    polls), removals, and into `communityRooms/{id}/edge/state` (server-only by the existing rules): bans, raised hands (the host's
    beat returns them, so they survive a socket failure) and the exact count every 15 s (the cap's count; Live mode's
    `noteListenerSample` runs on each report, so drop prompts work). The room doc, which everyone in the room reads, gets the count only
    once a minute (`edgeAt`). **Listeners on the worker don't heartbeat:** they write their people/ doc once on join; the worker reports
    each person's sessions (first tab in, last tab out), which mark people/`edgeIn` and add up in `communityRooms/{id}/listenTime/{uid}`
    (server-only: ms, sessions, first/last, role; one write per person per batch, kept after the room ends for the challenge's counted
    listeners; open sessions are closed at the end). "Here" for such a listener is `edgeIn` while the worker reports (`listenerPresent`
    in `lib/rooms.ts`); if it stops reporting for 150 s, listeners' apps (already on the fallback) heartbeat again and the people/
    recount takes over. The host's beat (and its `hostLive` minutes and prompts) is unchanged. The browser reconnects with backoff and,
    after 3 failures, polls Firestore for new chat every 10 s, heartbeats, and sends through the server (which also forwards to the
    room) while it keeps trying. **Still a live read:** everyone in an edge room still listens to the room doc (the stage, cameras,
    the poster and pulls come from it), so its writes are read by everyone: the stage's heartbeats (up to 5 people every 20 s), stage
    moves, cameras and the count once a minute, about 16 writes a minute, so roughly 160,000 reads a minute in a 10,000-listener room.
    Moving the stage and cameras onto the socket too (the room doc read once on join) would remove that, but it means reworking how
    the room screen pulls audio and video, which step 2a just built; left for a follow-up. **Owner steps:** (1) Cloudflare → Workers & Pages → Plans: the **Workers Paid** plan
    ($5 a month; Durable Objects with WebSockets need it for this load). (2) My Profile → API Tokens → Create Token → "Edit Cloudflare
    Workers" template (Account: Workers Scripts: Edit, which includes Durable Objects; your account only) → copy it; note the Account
    ID from the Workers overview. (3) GitHub → the repository → Settings → Secrets and variables → Actions: add `CLOUDFLARE_API_TOKEN`
    and `CLOUDFLARE_ACCOUNT_ID` (optionally `LIVE_ROOMS_SECRET` too, and the workflow sets it on the worker). (4) Make the shared secret
    once: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. (5) Actions → **Deploy live rooms** → Run
    workflow; it prints the worker's `https://notesapp-live-rooms.<subdomain>.workers.dev` address. (6) Set the worker's secret:
    `cd workers/live-rooms && npx wrangler@4.40.0 secret put LIVE_ROOMS_SECRET` (skip if you added the repository secret in 3);
    `https://…workers.dev/health` then answers `ok`. (7) Vercel → Settings → Environment Variables, Production: `LIVE_ROOMS_SECRET` =
    the same value (**Sensitive**), and `NEXT_PUBLIC_LIVE_ROOMS_URL` = `wss://notesapp-live-rooms.<subdomain>.workers.dev`. (8)
    Redeploy. /status → "Live room chat" says "worker ready" (it reaches the worker and proves both secrets match, or says which is
    wrong). Start a test room: the help's "Chat in big rooms" paragraph appears, and the host sees "Slow mode (automatic: off)" under
    the chat. No new Firestore rules or indexes (the `edge` subcollection is denied to browsers by default; the settings push queries
    `status ==` and `edge ==`, equality only). Without the workflow: `npx wrangler deploy` from `workers/live-rooms`
    (`workers/live-rooms/README.md`). The worker deploys again by itself on pushes to `main` that touch it, and skips (green) while the
    two repository secrets are missing. **Cost to watch:** Durable Objects bill requests (a WebSocket message counts as 1/20 of a
    request; "ping" keep-alives are answered by the runtime without waking the room) and duration (a hibernating room costs nothing
    between messages); each chat message is one incoming message and N outgoing sends. **Unverified until it is deployed:** no part ran
    on Cloudflare; the Durable Object was tested against an in-memory stand-in of the runtime (storage, alarm, hibernatable sockets
    with attachments and tags), so check in one live room: sockets connecting through `wss://`, hibernation and waking (attachments,
    storage), the alarm cadence, `setWebSocketAutoResponse` for "ping", the 101 upgrade, and the batch reaching Vercel. Tests:
    `test:live-rooms` (tokens and signatures, rate limits, slow mode, batching, the count cadence, the help; the Durable Object with
    fakes, including waking from hibernation, a failed batch and its retry, bans and the end; and `tsc -p workers/live-rooms`),
    `test:live-rooms-server` (emulator: tokens only for people let in, with their role and never past a ban, the cap with the edge's
    count, batch signatures, the chat record, removals, the count and the recount standing aside, stage/chat/unchat/end pushed to the
    room, and a real `LiveRoom` wired to the server code end to end), plus `test:rooms`, `test:rooms-server`, `test:help`.

100. **Live recording and replays, step 2c (v0.128.0, branch `push/live-replays`, cut from `push/rooms-relay`, with 2a `push/live-mode` (98) merged in; 97 and
    99 are reserved for pending PRs, including step 2b chat on the edge):** built and **off until the recorder is set up**: without
    `RECORDER_URL` and `RECORDER_SECRET` the Record this live switch is hidden (with a note), nothing is recorded and every room works as
    before. **Owner steps:** (1) Deploy the recorder on Google Cloud Run (Google Cloud credits) following `docs/RECORDER.md`: build
    `services/room-recorder` (Dockerfile included), deploy with CPU always allocated, at least 2 GiB memory, a 60-minute request timeout
    and `RECORDER_SECRET` (make one with `openssl rand -hex 32`) and `APP_ORIGIN` (the site's own address) set. (2) Vercel →
    Environment Variables, Production: `RECORDER_URL` = the Cloud Run service URL, `RECORDER_SECRET` = the same secret (Sensitive);
    `R2_PRIVATE_BUCKET` must already be set (recordings are kept there). Replays need `CLOUDFLARE_STREAM_TOKEN` (already used for course
    videos). Redeploy. (3) `firebase deploy --only firestore` (rules: new server-only `roomRecordings` and `replays`, and a post's
    `replayId` can't be added or changed from a browser; no new indexes, every query is single-field). (4) Optional transcripts:
    `REPLAY_TRANSCRIBE` = `nkenne-english` or `nkenne-swahili` uses NKENNEAi speech to text (`NKENNE_API_KEY`, already set for
    Kiswahili). It is the only speech-to-text provider in the codebase; it takes one file up to 25 MB, so only recordings whose sound file
    is under that (about an hour and a half at 32 kbps) get a transcript, and whether it accepts WebM/Opus (our recorder's format) must be
    checked with one real replay. Without it, transcripts are off and Share to Journal drafts without a transcript or Nana summary.
    (5) **Counsel review (NDPA):** the notice wording ("This live is being recorded", the speaker's one-tap agreement, the help article
    `live-recording-and-replays` and the new privacy paragraph) should be checked by counsel before recording is switched on. The privacy
    paragraph was added without bumping `LEGAL_VERSION` (no re-acceptance asked); bump it if counsel says the change is material.
    (6) A live test: start a relay room with Record this live, bring a speaker up (they agree), talk for a minute, end it, then check
    Media → Recordings (Play), publish a replay, open it from Explore → Replays, tap Share to Journal, and unpublish.
    **How it works:** the host's switch (or Admin's force switch) marks the room `recording` with a recording id; the server creates
    `roomRecordings/{rid}` and calls the recorder (`POST /start`, HMAC-signed, `lib/recorder-sign.ts`) with the hidden page URL
    `/rooms/record/{room}?token=…` (a 15-minute-plus-length, one-room, receive-only token: the page can only pull, answer and close on the
    relay, never push) and the upload URL `/api/rooms/recorder`. The recorder opens the page in headless Chromium, which mixes the stage's
    microphones (Web Audio) and draws the picture on a canvas (the host's video track when one arrives, else the room's `poster` field,
    else a title card) and records two files with MediaRecorder: `stage` (picture and sound) and `audio` (sound only, for transcripts).
    Every ~10 s each chunk is signed and uploaded; chunks wait as small objects in the private bucket until 5 MiB make a multipart part
    (R2's minimum), and finalize sends the rest as the last part. Ending the room calls `POST /stop`; the keep timer
    (`keepDays` after the end) starts then. The reminders cron deletes unpublished recordings past their date (job "recordings"), finishes
    any the recorder never finalized, and makes queued transcripts ("replayTranscripts"). Publishing copies the stage file to Cloudflare
    Stream (`/stream/copy` from a 6-hour signed link, `requireSignedURLs`), into `replays/{id}`; it shows in the host's Media area
    (`/profile/media`, a placeholder page around `components/replays/ReplaysList.tsx` for the Media studio to reuse) and, for everyone or
    subscribers, on Explore and Trending (new Replays tabs). **Owner change (2 Nov 2026):** a replay is not a journal post unless the
    host taps Share to Journal (a draft with `replayId`, Nana's summary and chapters, and the transcript; premium when the replay is for
    subscribers). Unpublishing removes the replay, its post and its Stream copy; inside the first keep window the timer restarts, after
    it the recording is deleted. Teen mode: a host or a speaker in teen mode keeps the replay inside the community and off every list.
    Admin → Live recordings (`/admin/recordings`, Trust & safety and Legal) plays any recording for safety review.
    **Settings:** Admin → Limits → Live recording (`serverConfig/recording`): days to keep (30), longest recording (4 hours), record
    every relay room (off); plan switches "Audio rooms and live" in the limits table: who can record and who can publish replays (every
    plan by default). The help reads all of them live (`tests/help/live-figures.test.ts`).
    **With 2a (Live mode, merged into this branch):** the recorder page pulls every stage microphone and every camera that's up
    (`videoPullsFor`, pulled with `video: true`; the host's camera and those of speakers the host allows, side by side on the canvas)
    and draws the room's `poster` while every camera is off (else a title card). In a recorded room a speaker's camera, like their
    microphone, waits for their agreement. The recorder has no `people/` doc and no heartbeat, so it's in no listener count, drop prompt
    or challenge figure, and pulling cameras never touches the video-minutes budget (it counts cameras up, not viewers). `startRoom`'s
    arguments are now `(…, deps, poster?, opts: { record })`. **With 2b (chat on the edge, to merge after):** nothing of the recorder
    goes through the chat or the count; keep it out of any listener presence the Durable Object adds.
    **Unverified until it runs for real:** the recorder in Cloud Run's headless Chromium against the real relay (audio mixing,
    MediaRecorder in headless mode, Cloud Run keeping CPU between requests), R2 multipart against the real bucket, Stream's copy-from-URL
    of a WebM with a still picture, and NKENNEAi with WebM. Tests: `test:recording` (consent and notice, whether a room records, keep
    dates, audiences and teen mode, the share card, signing in both the app and the service, the page token), `test:recording-server`
    (emulator with a real stand-in recorder HTTP server checking signatures: start and stop calls, consent before the mic, the
    receive-only page, chunk ingest and multipart finalize into a stand-in bucket, playing, the keep-days cron, publish, audiences,
    transcripts, Share to Journal, unpublish, the force switch and a recorder that can't start), `test:rules` (one new test),
    `test:help`, `test:rooms`, `test:rooms-server`.
102. **Media, phase M1 (v0.129.0, branch `push/media-core`; plan in `docs/MEDIA.md`):** before or after merging, the owner:
    - `firebase deploy --only firestore` (server-only rules for `mediaPosts` and its `views`, `mediaUploads`, `mediaUsage`, `mediaSettings`).
    - The TTL policy on `mediaUploads.expireAt` is in `firestore.indexes.json` (a video upload never posted goes after 2 days).
    - Media videos need `CLOUDFLARE_STREAM_TOKEN` (already set for courses; Stream:Edit). Media uses Stream's **public** playback
      (`requireSignedURLs: false`, `meta.purpose: "media"`), so nothing to change in the Stream dashboard; videos show in
      `/admin/stream` with the creator's uid. Without the token the studio takes pictures only.
    - Check Admin → Limits → **Media** (defaults from `docs/MEDIA.md`: videos a week 0/2/7/14/30, longest 60 s/60 s/3 min/3 min/10 min,
      picture posts a day 5/10/20/40/100, storage 1/5/20/50/200 GB).
    - `NEXT_PUBLIC_MEDIA_LIVE=false` hides Media everywhere (it is on by default).
    Code: `lib/media-rules.ts` (pure: audiences, teen rule, site pictures, settings), `lib/media-server.ts` (posting, quotas in
    `mediaUsage/{uid}`, Stream processing via `refreshVideo` and the cron's `mediaVideos` job, creator page, studio, downloads),
    `lib/media-watermark.tsx` (next/og badge + Next's own WebAssembly codecs: decode, stamp @username + mark bottom right, JPEG out;
    traced in `next.config.js`), `lib/media-replays.ts` (`replaysFor`: the creator's ready, listed replays from #256, newest first, the host's picture as the tile),
    `/api/media/*`, `components/media/*`, `/u/[username]/media`, `/profile/media`. Moments: `pinMoment` / `listPinnedMoments` in
    `lib/moments-server.ts` (pinned ones lose their TTL field and are skipped by the sweep; unpinning an expired one deletes it).
    Profile picture history: the picture in use is recorded server-side when Media reads the album (`profileAlbum`), on top of the
    browser's note after each change. **Merged with #256:** the studio's Lives & replays tab is `<ReplaysList />`, and `/profile/media`
    shows `ReplaysList` alone while Media is switched off, so hosts keep their recordings either way. **Not done in M1 (docs/MEDIA.md "M2"):** the `/media` feed,
    comments, reactions, gifts UI, shares to Moments/Journals of a Media post, reports on Media posts, the automatic safety check,
    and **video downloads** (Stream burns a watermark profile into every rendition at upload, so a per-creator watermarked MP4 needs
    a second, watermarked copy: `POST /stream/copy` with `watermark.uid`, then `POST /stream/{uid}/downloads`; see `docs/MEDIA.md`).
103. **Animated gifts, VIP gifts and daily gift targets (v0.133.0, branch `push/gifts-animated`):** deploy the Firestore rules
    (`giftDaily` server-only, `giftShows` read by signed-in members, `giftBursts` public read) and the two new `giftDaily` indexes
    (`day` + `grossKobo` desc, `day` + `netKobo` desc) before the code. Owner decisions of 3 Nov 2026. The catalogue
    (`lib/gift-catalogue.ts`), the owner's list: six **premium** gifts (Garden Egg ₦200, Kola Nut ₦1,000, Zobo Bottle ₦2,000, Jollof
    Plate ₦5,000, Talking Drum ₦10,000, Adire Fan ₦20,000) and eight **VIP** gifts for verified senders (Golden Gele ₦25,000, Kente
    Crown ₦50,000, Baobab of Blessings ₦100,000, Circova Champagne ₦150,000, Argungu Fishing ₦250,000, Durbar Horse ₦500,000, Ijele
    Masquerade ₦750,000, Kilimanjaro Sunrise ₦1,000,000). The owner wrote "Arugungu"; it is spelt Argungu (the festival) here and
    can be renamed in Admin. Settings saved with the pricing config (`platformSettings/pricing`, `gifts`) from Admin → Pricing →
    Gifts and applied live; a config saved before keeps the defaults: `grand` (VIP from ₦25,000, announce on), `uplift` (premium
    +10%, VIP +20% **of the creator's rate**, e.g. 8% → 8.8% / 9.6%; typed-amount gifts keep the normal rate) and `daily` (target
    ₦50,000 gross, 6 places, 3 different senders). The uplifted rate is fixed at checkout (`commissionRate`, `gift.uplift`) and a
    co-author's share gets the same uplift on their own rate. Every gift plays full screen (`components/GiftOverlay.tsx`) with its
    fixed mix of rays, stars, fireworks, confetti and sound (`MOTIF_EFFECTS`); drawings are inline SVG in `components/GiftArt.tsx`.
    VIP gifts need the ✔ or gold badge (`senderVerified`), as does anything over `UNVERIFIED_GIFT_CAP_KOBO` (₦20,000). **Sitewide
    announcement:** after a VIP gift is paid, `announceGrandGift` writes `giftBursts/latest`; `components/GiftBurstBanner.tsx` (main
    layout, signed in or not) shows it for 15 s, fresh for 2 minutes, once per tab, with **Join to witness** (`/c/{cid}?room={id}`
    while the live is on; `CommunityView` opens `?room=`) or **See it** (`/u/{username}`). Never for a teen-mode receiver; anonymous
    stays anonymous. One document read by every open page: each VIP gift costs one read per open page. `playGift()` / the
    `notesapp:gift-play` event (`lib/gift-play.ts`) is what the live room calls on each gift broadcast (not wired yet: Media M2). In
    `fulfillPayment`'s transaction the receiver's `giftDaily/{lagosDay}_{uid}` is read first and updated, and `giftShows/{uid}` is
    set for animated gifts. The shelf (`topGiftedToday`, `/api/gifts/top-today`, `components/TopGiftedShelf.tsx`) is cached a minute
    in `statCache/giftShelf_{day}`; teens show only to followers. **Open:** no linked-account check yet (same device, bank or phone);
    teen mode does not stop teens receiving money gifts from strangers (owner to decide); the GiftButton isn't in the live room yet,
    so `liveId` is only set once Media M2 puts it there. Tests: `test:gifts`, `test:gifts-server`, the rules test, `test:help`.

108. **Watermarked video downloads for Media (v0.134.0, branch `push/media-video-downloads`, cut from `push/media-core` (102); merge
    after #259):** a creator who allows downloads on a video gets a second Cloudflare Stream copy with a see-through mark burned in
    (transparent PNG: "na" mark, @username, NotesApp), and MP4 downloads only on that copy; the video people watch stays clean. One
    Stream watermark profile per creator (`mediaWatermarks/{uid}`), the look from Admin → Limits → **Video download watermark**
    (`serverConfig/mediaWatermark`: opacity 40%, width 22%, padding 4%, bottom right by default). The copy counts in Media storage
    (about double per downloadable video). Owner, after merge: `firebase deploy --only firestore` (the new server-only
    `mediaWatermarks` rule); nothing new in Vercel (`CLOUDFLARE_STREAM_TOKEN` with Stream:Edit covers watermarks, copies and downloads);
    if `docs/OWNER_SETUP.md` has landed (#261), add a line to its section 5 (Stream) saying video downloads use the same token. Then try one: post a
    video, switch downloads on, wait for "Download ready" in the studio, download it signed out, and check the mark is see-through.
    **Not run against real Stream:** the watermark upload, copy-from-URL, signed MP4 links and `?filename=`. Code and steps in
    `docs/MEDIA.md` ("Watermarked video downloads").

All of these are on the team hub board with departments and dates (`lib/team-seed.ts`: `FUND_BACKLOG`, `LAUNCH_BACKLOG`, `COURSES_BACKLOG`, `TOPICS_BACKLOG`, `BIMI_BACKLOG`). Items can have several people (`ownerUids`; `ownerUid` stays as the first of them for older readers) and can repeat monthly (`repeat: "monthly"`: done moves the due date on a month).

104. **Chief of Staff in Team access (team hub, no changelog entry; branch `push/cos-departments`):** nothing to deploy (custom claims only). The owner
    names the Chief of Staff from Team access (an admin's row → Edit departments → tick Chief of Staff). Test: `npm run test:access`.

105. **Passkeys (v0.132.0, branch `push/passkeys`):** deploy `firebase deploy --only firestore` (server-only rules for `passkeys` and
    `passkeyChallenges`, and the TTL on `passkeyChallenges.expireAt`). New dependencies `@simplewebauthn/server` and `@simplewebauthn/browser`.
    A passkey belongs to one domain family, so members add one again after the move to naapp.tech. Test: `npm run test:passkeys`.

106. **Careers (v0.131.0), with Nana-HR and the staff library in the team hub (no changelog entry for the team hub parts; branch `push/nana-hr`, built on `push/cos-departments` (104)):** deploy
    `firebase deploy --only firestore` (server-only rules for `careerRoles`, `careerApplications`, `hrDrafts`, `staffMeta`; the TTL on
    `careerApplications.purgeAt`). New dependency `remark-gfm`. The library and the five vacancies seed themselves on first use. After
    editing the handbook, SOPs or briefs, export them to `content/staff-library/` and run `node scripts/staff-library-content.mjs`.
    Interview booking by Nana-HR is not built yet (the hiring manager messages the applicant on NotesApp). Test: `npm run test:hr`.

107. **Help backfill (no version, no changelog entry; branch `push/help-backfill`):** nothing to deploy. New help articles for
    questions Nana couldn't answer: posting a moment (status/story), verifying your email (Resend link), Nana's suggestions on
    forms, and currency (naira only, no exchange rates), plus a team hub article on adding a task. Search synonyms for status,
    story, dp, photo and dollar (`lib/kb.ts`); a short follow-up such as "what about mcp?" is now searched on its own first
    (`lib/nana-prompt.ts`). The Add item "Nana suggests" box now has **Not now**. When "Couldn't answer" fills up in
    [Help & Nana](/admin/help), write the missing article or a synonym, then check it with `searchArticles`.

110. **Calls reconnect after a network change (v0.136.0, branch `push/calls-ice-recovery`):** deploy `firebase deploy --only firestore`
    (the new `restart` / `restartAnswer` writes on `calls/{id}` and `groupCalls/{id}/links/{linkId}`; until it's deployed a restart is refused
    and a dropped call ends after about 30 seconds, as before but later). Once a call has connected, a drop is recovered by an ICE restart
    (`lib/ice-recovery.ts`, the state machine; `components/calls/ice-recovery-client.ts`, the browser side): the caller restarts in a 1:1
    call, the smaller uid of each pair in a group call; the other side answers. "disconnected" waits 2 seconds, "failed" restarts at once;
    two direct restarts of 8 seconds each, then one restart forced through the TURN relay (`iceTransportPolicy: "relay"`, only when TURN is
    configured; it stays forced for the rest of that call); the call ends 28 seconds after the drop (the answering side waits 32). Fresh
    relay credentials come from `GET /api/calls` before every restart. The safety code is recomputed after each reconnect and shown again
    if it ever changes. Candidates sent for a restart's offer wait until that offer arrives (`candidateFits`). **Not yet tried on real
    phones or real network changes:** test a call switching Wi-Fi to mobile data, on iPhone Safari and Android Chrome, and a group call of
    three, before relying on it. Tests: `npm run test:calls` (`tests/calls/ice-recovery.test.ts`) and the rules test.
111. **Staff test pass (no version, no changelog entry: staff only; branch `push/staff-live-pass`):** deploy `firebase deploy --only firestore`
    (the server-only rule for `staffPassLog`; `serverConfig/staffPass` is covered by the existing `serverConfig` rule). A super admin turns it on
    from **Admin → Limits → Staff test pass** with an end ("on until", 7 days by default, at most 30); it turns itself off then. While on,
    #NotesApp team accounts (`isTeamMember`: role admin, staff or volunteer, not suspended) skip the listener cap when they join a room, and
    every room they host skips it too (up to the relay's ceiling, or the top of the phone-to-phone setting) and the video-minutes budget;
    their recordings may run to the top of the "Longest recording" range; and the plan switches for recording and publishing replays don't
    stop them. Teen rules, suspensions, recording notices and consent, moderation, the stage size, rate limits and keep days are unchanged.
    Turning it off puts every limit back at once, even in rooms already open. Every change is in `staffPassLog` (shown on the panel, with
    who made it), and super admins see a strip across the admin area while it's on. Code: `lib/staff-pass.ts`, `lib/staff-pass-server.ts`,
    `app/api/admin/staff-pass`, `components/admin/StaffPassPanel.tsx`, `StaffPassNotice.tsx`. Tests: `npm run test:limits` (pure),
    `npm run test:rooms-server` (`tests/community/staff-pass.emulator.ts`) and the rules test. Before the challenge: turn it on, test, turn it off.
109. **Fan levels and Premium / VIP / VVIP subscriptions (v0.135.0, branch `push/fan-levels`; 108 is left for the video downloads PR
    to renumber into):** deploy the Firestore rules (`fanScores` and `fanPrefs` server-only) and the two `fanScores` indexes
    (`creatorUid` + `points` desc and asc) before the code. Owner decisions of 3 Nov 2026, mockups approved. Pure rules in
    `lib/fans.ts` (tiers, ranges and shares, `tierOffers` for settings from before tiers, audiences, points, rank badges, next band,
    entrance vehicles); server in `lib/fans-server.ts` (settings in `serverConfig/fans` with a 30 s cache, Admin → Limits →
    Subscriptions and fans via `/api/admin/fans`; `addFanPoints` with daily caps per Lagos day; `topFanList` cached a minute;
    `fanBadges`, `fanBoard`, `setVehicle`, `liveEntrance`). **Tiers:** `publisherSettings.subscription.tiers` (premium/vip/vvip, each
    with its own Paystack plan); the old `enabled/priceKobo/planCode` mirror Premium. Checkout takes `tier`; the payment's
    `commissionRate` is `tierRate` (rate + share of it) and the subscription record gets `tier` (Premium when missing). A tier
    change starts now, carries the days left, records `previousPlanCode` and best-effort disables the old Paystack subscription
    (`findPaystackSubscription` + `disableSubscription`); renewals keep the tier's share. Posts get `minTier` (`premium` stays true
    for any tier); `PremiumGate` checks the tier. **Points:** subscriptions and gifts (`afterFanPayment`, renewals), comments
    (`postComment`), the first like per journal (`notifyLike`), shares to Moments (`shareToMoment`, by the card's creator).
    **Badges:** `components/fans/FanBadges.tsx` on journal comments and shop/course reviews (one `/api/fans/badges` call per list).
    **Top fans:** `/u/{username}/fans` (`/api/fans/board`), with the creator's hide switch (`publisherSettings.fansHidden`) and teen
    rules (teens only for followers; a teen creator has no public list). **Live entrances:** `joinRoom`/`leaveRoom` write the
    latest `entrance` on the room doc for a top-three fan who qualifies; `components/fans/LiveEntrance.tsx` plays it. **Not done:**
    Media and profile-picture comments don't exist yet (the badge component is ready for them); course notes, replays and Media
    posts keep their own audiences (only journal posts take a tier); gifts' fan points use the gift payment on main (the animated
    gifts branch adds no separate hook); an upgrade charges the full new price (no proration in kobo). Tests: `test:fans`,
    `test:fans-server`, rules, `test:help` (live figures), `test:pricing`, `test:limits`.

112. **Duplicate-account warning on Users (admin only, no version, no changelog entry; branch `push/duplicate-accounts`):** nothing
    to deploy. A shared display name alone no longer flags an account. The warning shows only for accounts that sign in with the
    same email (`/api/admin/user-emails` returns which accounts share one, Gmail dots and +tags ignored, never the address) or
    that have the same name and the same job title, workplace and field.

113. **Printed QR codes (v0.136.2, branch `push/receipt-qr-print`):** nothing to deploy. Receipt and certificate QR
    codes (`lib/certificate-qr.ts`) are now drawn as filled rectangles instead of the 1-unit lines the `qrcode` package draws. A receipt
    saved as PDF on an Android phone came out with a faint pink, unreadable QR while the screen showed it clearly. Same modules as before.

114. **Anya smart glasses: the /anya page and the brand guidelines (v0.137.0, branch `push/anya-trademark`):** nothing to deploy.
    The owner adopted the names for NotesApp's own Qualcomm-based glasses: **Anya Display** (screen, side camera, mic, speakers,
    translation, transcripts, teleprompter), **Anya Nana** (audio with Nana) and **Anya Audio** (audio without AI); "anya" is Igbo for
    "eye". `lib/brand-guidelines.ts` now lists them with the other product names and trademarks on /brand. Still to do: file Anya in
    class 9 (Nigeria, and the US, UK and EU when the products go there), after a clearance search.
    The page (`app/(main)/anya/page.tsx`) uses the owner's launch artwork (`public/anya/anya-launch.webp`) as its hero; pricing and
    pre-orders say "coming soon". Its one action opens the contact form on the new lead topic **anya** (`lib/leads.ts`) with a
    starter message, so interest lands in Admin → Leads. Footer (Company), sitemap, Nana's pages and the help article
    `anya-smart-glasses` link to it.
    **v0.137.1:** the hero is now `public/anya/anya-display-hero.webp`, made from the official logo (logo pack) and the supplier's
    product photo with its app screen removed and arm markings toned down, plus Anya Display's eight functions (AI voice assistant,
    real-time translation, 139 languages, voice recording, image recognition, 1080p video, music, app control). The Display card,
    comparison table and help article list the same functions.
    **v0.137.2:** a hero for each model (`public/anya/anya-{display,nana,audio}-hero.webp`, same layout), shown by
    `components/anya/AnyaHeroCarousel.tsx`: a dissolve every 5.5 s, paused on hover or focus, model buttons underneath, and no
    auto-advance with reduced motion. Nana and Audio use the same product photo with the camera removed and tinted lenses (blue,
    dark). Anya Nana also has AI real-time translation (139 languages), with Nana as a companion.
    Each model's case is in the "In the box" section: Display's battery-display case (`anya-display-case.webp`, the owner's photo),
    Nana's tan leather case and Audio's black leather pouch (`anya-nana-case.webp`, `anya-audio-case.webp`: the supplier's photos with
    the glasses removed, since those frames have cameras).
    **v0.137.3:** Audio's is a plain leather pouch (no charging); Nana's case photo shows its glasses again (the owner's choice);
    Display's case comes in black or brown (`anya-display-case-{black,brown}.webp`), switched by swatches (`components/anya/AnyaCasePicture.tsx`).

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
- **Our own tools first.** Never suggest setting up something on an outside platform that #NotesApp already does (groups → Community,
  Spaces, Circles; calls → our calls and audio rooms; booking → Booking; selling → the Store; events and tickets → Events; courses →
  Notes Academy). Suggest ours with its link and help article (owner, 1 Nov 2026). Where ours can't do it yet (a video class bigger than
  an audio room), say so plainly and keep the outside link as the fallback.
- **Public pages ship with the feature.** Every new feature or change updates, in the same push: the changelog, and every public
  page that describes that area (home, About, pricing, the feature's own page, the roadmap's live and not-live lists, status, help
  articles, footer links), plus README and HANDOVER. A feature isn't done until its public pages say so (owner, 1 Nov 2026: "as a
  rule any new feature or update, should be updated on public pages as you push same with changelog").
- **Always update docs/BUILD_LOG.md** with every release, alongside the changelog (owner, 2 Nov 2026). One short entry per version in
  the file's style: `**Title (v0.x.y)** — what was built and where`, newest at the bottom.
- **No written-in domains.** Links to our own sites use `lib/host.ts` (`SITE_URL`, `MAIN_HOST`, `PREP_URL`, or `mainSiteUrl(host)` for
  the domain being viewed), never `notesapp.name.ng` or `naapp.tech` in code (owner, 2 Nov 2026). Text that is about the domain on
  purpose (legal pages, the brand page, help articles stating an address, changelog history, email addresses, tests) stays.
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
| Partner API | `app/api/v1/*` behind `v1()` in `lib/api-v1.ts` (key, API access, plan, rate limit), keys `lib/api-keys.ts`, docs `lib/api-docs.ts` (the /docs page), webhooks `lib/webhooks.ts`; image uploads `app/api/v1/uploads` (presigned R2, `api/<uid>/`, v0.125.0) |
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
npm run test:host              # links to the main site follow the domain being viewed (mainSiteUrl)
npm run test:smoke             # Playwright, against a running site (SMOKE_BASE_URL)
```
The emulator-based tests start their own emulator on port 8080, so stop any emulator you started yourself first.

**Secret scanning:** the CI job `secrets` runs gitleaks (v8.30.1, the default rules) over the whole git history on every pull request
and push, with values redacted in the log. `.gitleaks.toml` lists the only three known non-secrets (an example key, a test value, a
storage key name). On 24 Oct 2026 the full history (446 commits, every branch) had nothing else. A real hit: rotate the key first
(`docs/DEPLOY.md`, "If a key leaks"), then remove it; never add a real key to the allowlist. Locally:
`go install github.com/zricethezav/gitleaks/v8@v8.30.1 && gitleaks git --config .gitleaks.toml --redact .`

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
