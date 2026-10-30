# How the newer pieces fit together

The map of the code is in `HANDOVER.md` ("Map of the code"); the history of every part is in `docs/BUILD_LOG.md`. This file
explains the pieces added from v0.37.0 on.

## Addresses, @mention bells and the weekly digest (v0.37.0)
- **Addresses:** `lib/host.ts`. Every domain on the Vercel project serves the site under its own name (no redirects between
  our domains; `www.`, `app.`, `life.` and any subdomain). `NEXT_PUBLIC_ROOT_DOMAIN` picks the primary address used by
  emails, share links, webhooks, sign-in callbacks and the `rel=canonical` header that other domains send. Moving to
  naapp.tech: `docs/DOMAIN_SWITCH.md`. In page code, use relative links, `FamilyLink` / `useFamilyUrl` to reach app. or
  life. on the visitor's own domain, and `SITE_URL` only for things that leave the site (emails, shares).
- **@mention bells:** `lib/mentions-server.ts` (once per person per thing in `mentionNotices`, server-only; blocks respected;
  max 10). Comments and journals are saved by the browser, which then calls `POST /api/notify/mentions` (the server reads what
  was saved and checks the caller wrote it); reviews, seller replies, approved recommendations and moments notify on the
  server. Never chats.
- **Weekly digest:** template `lib/digest.ts` (Medium's layout, Quora's text wrapping round the picture), sending
  `lib/digest-server.ts`, cron job `weeklyDigest` in `/api/cron/reminders` (Sundays from 5 PM Lagos, in batches,
  `digestRuns/{sunday}`), choices in `emailPrefs/{uid}` (server-only) via `/api/account/email-prefs` and Account settings →
  Emails, one-click unsubscribe `/api/digest/unsubscribe` with List-Unsubscribe headers. Interests: `users/{uid}.interests`
  (hashtags) are already used for ranking; the hashtag picker that fills them is the next step.


## Server-owned writes (v0.38.0)
Browsers no longer create notifications or comments (`firestore.rules`: `allow create: if false`). Comments go through
`POST /api/comments` (`lib/comments-server.ts`), which takes the name and picture from the account (so nobody can comment as
someone else) and sends the comment, reply and @mention bells. A like is still recorded by the browser
(`notes/{id}/likes/{uid}`), then `POST /api/notify/like` checks it's there and tells the author once (a fixed notification id).
Moderation bells (`lib/moderation.ts`) ask `POST /api/admin/notify`, which builds the message from what is stored.

## Shared limits and caches (v0.38.0)
`lib/shared-store.ts` talks to Upstash Redis over REST when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
`rateLimit()` (`lib/rate-limit.ts`, now `await`ed everywhere) counts there, so a limit holds across every Vercel instance;
link previews are cached there. Without Upstash, or if it doesn't answer within 0.8 s, each instance counts and caches in
memory as before. Test: `npm run test:shared`.

## One place for settings (v0.38.0)
`lib/config.ts` lists every environment setting (group, secret or not, what it does) and `setting(name)` reads it. Code never
reads `process.env` directly: CI fails if it does (`npx -y tsx scripts/settings-doc.ts --check`), and also when
`docs/ENVIRONMENT.md` is out of date (`npm run docs:settings` rewrites it). To add a setting: add it to `SETTINGS`, read it
with `setting()`, run `npm run docs:settings`.

## Journals belong to accounts, not names (v0.38.0)
A journal records its author's `authorUid` and `authorUsername` (and `coAuthorUids`); the display name `author` is only for
showing. `isNoteBy()` (`lib/firestore-notes.ts`) and `getAuthorProfile()` (`lib/users.ts`) match on ids first. Posts an admin
publishes under a founder's or @na-notesapp's name record the username. Older posts: `scripts/backfill-author-uids.ts`
(dry run by default, `--apply` to write; test `npm run test:authors`).

## Topics and interests (v0.39.0)
`lib/topics.ts` is the one list of hashtags (about 60 topics in 8 groups, each with the spellings people use as aliases).
A journal has `topics` (1 to 3 slugs, picked in the journal form with `components/TopicPicker.tsx`) and `tags` (the writer's
own hashtags, tidied by `parseTags`); `categories` now holds the topics' names for anything that still reads it. Older
journals have no `topics`: `topicsOf()` reads their categories and tags through the aliases, so they're filed too
(`scripts/backfill-topics.ts` writes it down; `npm run test:topics`). Members choose up to 12 interests at `/interests`
(saved by the server, `POST /api/account/interests`, into `users/{uid}.interests`). The journal feed shows **For you**
(journals on their interests) before everything else, the Topics tab groups topics with theirs first, a journal's hashtags
link to `/journals?topic=…`, and the weekly digest ranks by them. API v1 accepts and returns `topics`.

## The frame (v0.40.0, the owner's Moda designs)
`lib/chrome.ts` decides the frame from the address, so every piece agrees: an open conversation (`isThreadRoute`) is full
screen on a phone (no masthead, banners, tab bar or footer); the app frame (`usesAppFrame`: /journals, /explore, /saved
everywhere, and every page on the app address except Messages, writing, admin and sign-in) gives computers the app header
(wide search, Write, bell, picture) and the left menu (`AppSidebar`); the phone tab bar (`showsBottomTabs`) shows for
signed-in members, and for everyone on the app address. Phones always get the light header (`Masthead`): the mark, search,
the bell and your picture, which opens `AccountSheet` (the account menu plus the site links the footer had); visitors get
Sign in and ☰. Signed-in members on a phone get the tab bar and the sheet instead of the site footer (`FooterGate`). The member
is read once for the whole frame (`MemberProvider`, `useMember`). Nana's button and the feed's write button sit above the tab
bar (`useBottomTabs`). Banners step aside on Messages pages (`ChromeGate`).

Journals is now a feed (`JournalsPageClient`, `FeedPost`): tabs For you (`byForYou`, then newest), Following, Latest, Top · 7d;
Most read this week and Who to follow between posts on a phone and in the right column on a computer; boosted journals inline
as Promoted (impressions and clicks through `useBoostImpression` / `beacon` from `BoostedStrip`); the journals ad slot after
the fifth post; the badge suggestion (`BadgePitchCard`) based on the member's plan and badge. The bookmark saves to
`savedJournals/{uid}_{noteId}` through `POST /api/journals/save` (server-only writes; a member reads their own). The feed's
"Share a thought" box hands its text to the journal editor's draft (`notesapp:draft:new`).

## Discovery: one order everywhere (v0.40.0)
Journals, Notes Market (`/shop`), Notes Academy (`/academy`), profile tabs and Trending share `lib/discovery.ts`:
`shelves(list, reader)` gives **For you** (on the reader's interests, people they follow first), **Most viewed** (the true
ranking by this week's views, `viewsWeek`, or all-time views when nothing was counted this week) and **Recent** (newest,
leaving out what For you already shows, unless that would leave it empty). This week's views come from the daily
`pageViews/{kind}_{id}_{yyyymmdd}` buckets (kinds `note`, `profile`, `item`; store items are counted by
`lib/store-stats-server.ts`), summed by `lib/discovery-server.ts` and served at `/api/public/weekly-views?kind=` (cached 5
minutes). The market is `getMarket()` in `lib/shop-directory.ts`: every listed store's items with seller, topics (the item's
own, or its category's through `CATEGORY_TOPICS`), views and favourites, at `/api/public/market`. Badges next to names come
from one batched call, `/api/public/badges`, drawn by `NameBadgeIcons`.

## Weekly digest switch (v0.38.0)
Admin → Weekly digest (`/admin/digest`, owner and super admins): status, preview, send yourself a test, and the on/off switch
(`digestConfig/main`). `WEEKLY_DIGEST=on` in Vercel keeps it on regardless. Unsubscribe links are signed with
`EMAIL_LINK_SECRET`, or `CRON_SECRET` when that isn't set.

## Notes Academy: free courses (step 1 of docs/COURSES.md)
- **Data** (every write on the server, `lib/courses-server.ts`): `courses/{id}` (teacher, title, `slug`, summary, up to 3
  `topics`, `cover`, `status` draft or published, `lessonIds` in order, `lessonCount`, `minutes`, `enrolCount`, `viewCount`,
  dates), `courses/{id}/lessons/{lessonId}` (`order`, `title`, `kind` youtube or text, `youtubeId`, `minutes`, Markdown
  `body` up to 50,000 characters), `enrolments/{courseId}_{uid}` (`done`: lesson id → when, `lastLessonId`, `completedAt`) and
  `courseSlugs/{slug}` (reserves each address with a create that fails when it's taken). `firestore.rules`: published courses
  and their lessons are public, drafts are not even readable by their teacher in the browser (the editor and the draft preview
  go through the server), learners read their own enrolments, browsers write none of it. Limits: 30 courses a member, 100
  lessons a course. The pure checks (YouTube links, addresses, fields, progress) are in `lib/courses.ts`.
- **Routes** (signed in, rate-limited): `/api/academy/courses` (GET mine or `?slug=` one draft, POST new), `/courses/[id]`
  (GET, PATCH, DELETE, POST publish/unpublish), `/courses/[id]/lessons` (POST add, PUT order), `/courses/[id]/lessons/[lessonId]`
  (PATCH, DELETE), `/api/academy/enrol`, `/api/academy/progress`, `/api/academy/view` (one per visitor a day, not the teacher;
  also writes `pageViews/course_{id}_{day}`, kind `course`) and the public list `/api/public/academy` (`?owner=`, cached a minute).
  Only publishing accounts (`canPublish`) teach.
- **Pages**: `/academy` (`AcademyPageClient`: Continue learning, For you, Most viewed, New, topic chips, Teach a course),
  `/academy/teach` and `/academy/teach/[id]` (the editor), `/academy/[slug]` (`CourseView`; share card from `courseMetadata` in
  `lib/og.ts`) and `/academy/[slug]/[lessonId]` (`LessonPlayer`: YouTube's privacy-enhanced player through the IFrame Player
  API, loaded only there; a video ticks itself off at 90% of the seconds actually played; text lessons rendered like journals).
  The first lesson is a free preview; the rest open on enrolling. Courses also show on profiles (Courses tab), Trending (Courses
  tab), members' sites (`COURSES_LIVE` follows the switch) and the weekly digest (`weekCourses`).
- **Switch**: `NEXT_PUBLIC_ACADEMY_LIVE=false` brings back the opening-soon page and hides courses everywhere.
- **Tests**: `npm run test:courses` (pure), `npm run test:courses-server` (emulator), the rules and digest tests.

## Notes Academy: paid courses, co-tutors, organisations and certificates (steps 2 and 3 of docs/COURSES.md)
- **Paid courses** (`lib/course-sales-server.ts`): a course with `priceKobo` > 0 is sold through `/api/paystack/initialize` with
  `kind: "course"` (card, bank transfer or wallet). `fulfillPayment` calls `fulfilCourseInTransaction`, which writes
  `coursePurchases/{reference}`, the learner's enrolment and each tutor's held `ledger` share (split like gift co-authors, each at
  their own plan's digital fee). Payouts for kind `course` release on their own 7 days after the sale (`lib/payouts.ts`).
  Refunds within `COURSE_REFUND_DAYS` only while `startedAt` is empty (Admin → Payments or the learner's own button).
- **Lessons**: Pro can price courses with text, PDF (private R2, `lib/course-uploads-server.ts`) and YouTube lessons; Business and
  Enterprise also upload video to Cloudflare Stream (signed playback, a drifting @username + email watermark in `LessonPlayer`).
  Paid lessons are served only by `POST /api/academy/lesson` (previews for anyone, the rest for buyers on at most two devices
  through `viewAccess`, `lib/view-access.ts`); `firestore.rules` refuse reads of a paid course's `lessons` subcollection.
- **Co-tutors and organisations**: `courseTutorInvites` (up to 4, each with a share; accept to edit content), `/api/academy/courses/[id]/tutors`;
  `orgUid` on create teaches as the organisation (its admins and writers), which then owns the course and its sales.
- **Course details**: level, language, format, outcomes, requirements, schedule, modules; the live-class and group links in
  `courseLinks/{courseId}` (server-only, `/api/academy/links`, shown to learners only). Likes, saves and reviews (teacher replies once).
- **Certificates** (`lib/certificates-server.ts`): `academies/{uid}` (name, logo, signer, accreditation, margin),
  `certificates/{id}` (NA-C-…, QR); claim and pay at `/api/academy/certificate` (late fee after 7 days; `included` on paid
  courses that carry it in the price), verify at `/certificates`, PNG and PDF, revoke in Admin.
- **Webhooks**: `course.sold` (Enterprise). **Tests**: `tests/courses/paid.emulator.ts`, `courses.test.ts`, the rules tests.

## Staff and members' details; safe backfills (v0.91.0)

- **Masking** (`lib/pii.ts` pure, `lib/pii-server.ts`): admin APIs send members' emails and phones masked (`maskContacts`:
  every `email`/`…Email` and `phone`/`…Phone` field at any depth). `payments`, `merchOrders` and `leads` are closed to staff
  browsers by the rules, so Payments, Merch and Leads read through `/api/admin/payments`, `/api/admin/merch` and
  `/api/admin/leads`. `<Masked>` (`components/admin/Masked.tsx`) shows one with a reason through `/api/admin/reveal`, which
  checks the department (`REVEALS`), reads the value from its one source and writes `adminViewLog` (server-only). Admin →
  View log reads it (super admins and Legal). Payout bank numbers were already encrypted with the last four shown.
- **Backfills** (`lib/backfills.ts`): a dry run returns the change list and its `planHash`; apply recomputes the plan and refuses
  a different hash (`PlanChanged`, 409 with the fresh list) and needs `backupConfirmed`. Each apply is a
  `maintenanceRuns/{runId}` with `changes/{noteId}` `{ before, missing, after }`, written in the same batch as the journal, so
  a run cut short can still be undone; `undoRun` restores only journals whose fields still equal `after`. Server-only.
- **Tests**: `npm run test:pii`, `test:pii-server`, `test:maintenance`, and the rules tests.
## The stage-trigger numbers (v0.92.0)

The speed and infrastructure plan starts each stage when a number crosses its line; the admin dashboard shows the five
(`components/admin/StageTriggers.tsx`, `/api/admin/triggers`, super admins, product and engineering).
- **Lines and statuses** (`lib/ops-metrics.ts`, pure): `LINES`, `against` (crossed at the line, near from 70%), nearest-rank
  `percentile`.
- **Gathering** (`lib/ops-metrics-server.ts`, `storedTriggers`, cached 30 minutes in `statCache/triggers`): timings from Upstash
  Redis (`perf:<metric>:<day>`, 1,000 a day, 35 days; in memory without Redis); `opsDaily/<day>` counters (`trackJob`,
  `bumpDaily`); a count of `ledger`; presence in the last 24 hours; `communityRooms.peak` over 30 days; Cloud Monitoring
  Firestore reads per day (Monitoring Viewer role); Cloudflare Stream storage usage.
- **Timings from browsers**: `components/WebVitals.tsx` (LCP), the journal feed and the search box, through
  `lib/perf-client.ts` (a quarter of tabs, `sendBeacon`) to `/api/perf` (rate limited, metric and milliseconds only).
- **Tests**: `npm run test:ops`, `test:ops-server`.
## Backups and restoring (v0.93.0)

- **Admin → Backups** (`app/(main)/admin/backups`, the owner only): the owner signs in with Google in the page (Google Identity
  Services token, scope `datastore`, kept in the tab's memory) and the page calls Google's Firestore Admin API directly
  (`lib/backups-client.ts`; requests and rules in `lib/backups.ts`): the database (PITR, delete protection), backup schedules,
  backups (`locations/-`), `databases:restore` and `databases:clone`, and their operations. The server key never holds these
  rights; `/api/admin/backups` only gates the page and writes `backupLog`.
- **Which database the site uses:** `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` ((default) when unset), read by `lib/firebase.ts`
  (browser) and `getAdminDb()` (server), so a recovery switches the whole site with one setting.
- **Tests**: `npm run test:backups` (a stand-in fetch checks every request).

