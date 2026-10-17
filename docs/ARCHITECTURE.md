# How the newer pieces fit together

The map of the code is in `HANDOVER.md` ("Map of the code"); the history of every part is in `docs/BUILD_LOG.md`. This file
explains the pieces added from v0.37.0 on.

## Addresses, @mention bells and the weekly digest (v0.37.0)
- **Addresses:** `lib/host.ts`. Every domain on the Vercel project serves the site under its own name (no redirects between
  our domains; `www.`, `app.`, `life.` and any subdomain). `NEXT_PUBLIC_ROOT_DOMAIN` picks the primary address used by
  emails, share links, webhooks, sign-in callbacks and the `rel=canonical` header that other domains send. Moving to
  notesapp.tech: `docs/DOMAIN_SWITCH.md`. In page code, use relative links, `FamilyLink` / `useFamilyUrl` to reach app. or
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

## Weekly digest switch (v0.38.0)
Admin → Weekly digest (`/admin/digest`, owner and super admins): status, preview, send yourself a test, and the on/off switch
(`digestConfig/main`). `WEEKLY_DIGEST=on` in Vercel keeps it on regardless. Unsubscribe links are signed with
`EMAIL_LINK_SECRET`, or `CRON_SECRET` when that isn't set.
