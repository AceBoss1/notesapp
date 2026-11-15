# 🛡️ AI content checks: checked before it's published

Every photo, video frame and text that people other than the author can see on #NotesApp is checked by AI **before it is published**.
Private 1:1 and group messages are never checked. Child sexual abuse material is an instant permanent ban and is reported.
**Status: built in v0.174.0 (15 Nov 2026).** The owner approved the mockups on 15 Nov 2026 and they were built as drawn. Notes on the build,
and what differs, are at the end.

## Decisions (owner, 15 Nov 2026)

| Question | Decision |
|---|---|
| What is checked | Every photo, video frame and text that people other than the author can see, before it is published: journals, community posts and comments, Moments, Media posts, shop items, events, and profile name, bio and pictures. **Private 1:1 and group messages are not checked.** |
| Paid and private audiences | The same rules for public, followers-only and subscriber-only content. **No sexual-content exception**: Paystack, Apple and Google can see paid content and forbid it. |
| Categories | Sexual content, gore, violence, self-harm, drugs, weapons, hate or extremism. News, medical and art are judged in context. Borderline cases (under a confidence level set in Admin) go to the review queue instead of being blocked outright. |
| The checker | Anthropic's Claude, through the SDK Nana already uses (`ANTHROPIC_API_KEY`), the smallest current model (the default in `lib/content-checks-ai.ts`; `CONTENT_CHECK_MODEL` changes it), with structured output: category, confidence 0–1, which item (the text, picture n, video n) and a short reason. |
| Video | The poster and a few frames, from Cloudflare Stream's thumbnails. |
| Cost | Pictures shrunk to 768 px on the long side and sent as WebP (base64; the link if it can't be read here). Only new or changed items are checked: every item's answer is kept by a hash of its text or picture link. |
| AI unavailable (no key, an error, a timeout) | **Posting is not blocked.** The post is published, recorded, and queued; the scheduled re-check checks it as soon as the AI answers and takes it down if it breaks the rules. |
| A post that breaks the rules | Not published. It stays as a draft, and the member is told what was found and in which photo. |
| Strikes | Each break is a strike. **3 strikes in 90 days suspends posting for 14 days** (both figures in Admin, with these defaults; help text never prints them). A further strike after a suspension is a ban. |
| Appeals | Every strike can be appealed ("Ask for a review"). Restoring a post on review publishes it and removes the strike. |
| Communities | Closed only if its owner or moderators keep posting or approving rule-breaking content. Members are warned first, and the owner can appeal. |
| Child sexual abuse material | Instant permanent ban, and reported: a flag plus the Legal team's queue, and an owner step for NCMEC and the authorities. The owner also switches on Cloudflare's CSAM Scanning Tool. |
| Teens | The same check with stricter thresholds. |
| Suspension tools | Use the existing ones (`lib/moderation.ts`, the bells) where they fit. A suspended member can still read and message but can't post. |

## The mockups

All screens on one sheet: [all-screens.webp](mockups/content-checks/all-screens.webp). HTML source: [mockups.html](mockups/content-checks/mockups.html).

1. **The rules, everywhere people post:** each community's About tab, the journal editor, the Media studio, and Terms ([1-rules-everywhere](mockups/content-checks/1-rules-everywhere.webp))
2. **Blocked before anyone sees it:** what was found and in which photo, with "Remove the photo" and "Ask for a review" ([2-blocked-before-published](mockups/content-checks/2-blocked-before-published.webp))
3. **Trust & safety queue:** Admin → Reports → Content checks: counts, the review queue with Restore / Keep blocked, strike stats ([3-trust-and-safety-queue](mockups/content-checks/3-trust-and-safety-queue.webp))
4. **Strikes and appeals:** the member's account page, with the suspension, the strikes and "Appeal the suspension" ([4-strikes-and-appeals](mockups/content-checks/4-strikes-and-appeals.webp))

## How it works

**One gate.** Every create or update path that publishes something other people see calls `gateContent` (`lib/content-checks-server.ts`)
before it writes. The gate:

1. refuses while the member's posting is paused, the account is closed for content, or the community is closed;
2. builds the items: the text, each picture (up to 12), and each Stream video's poster and frames (`streamFrames`: 1 s, 25%, 50%, 75%);
3. looks each item up in `contentCheckCache` (a hash of the text or link; a video frame by its Stream id and index) and sends only the
   new ones to the checker (`lib/content-checks-ai.ts`, one call per post);
4. decides (`decide` in `lib/content-checks.ts`, pure): the most serious finding wins.

| Finding | Adults | Teens | What happens |
|---|---|---|---|
| Below the review level (0.5 / teens 0.3) | pass | pass | Published. |
| Review level up to the block level | hold | hold | Not published; `held` in the queue for a person. No strike. |
| At or above the block level (0.85 / teens 0.6) | block | block | Not published; a strike. |
| News, medical or art context, block level, not sexual or hate | hold | block | A person decides (adults). |
| The checker declined to look | hold | hold | A person decides ("Unclear"). |
| Child sexual abuse material, at the ban level (0.8) | ban | ban | Not published; permanent ban, Legal queue, bell. |
| Child sexual abuse material, lower (0.2 and up) | hold | hold | Held for the Legal team only. |

Every figure is in Admin → Reports → Content checks (super admins change them; teens' levels must be the same or stricter).

**When the AI can't answer** (no `ANTHROPIC_API_KEY`, an error, a timeout, or against the emulators): the gate returns `queued`, the post is
published, and a `queued` flag records it. The cron job `contentRechecks` (in `/api/cron/reminders`, every ~15 minutes) re-checks up to 20 at
a time. A pass is cleared; a hold or block takes the item down (a journal back to drafts, a Media post hidden, a comment, post, event or
Moment removed and kept on the flag so Restore can put it back, a profile's bio or picture cleared) and tells the member; a block also
counts as a strike. After about a day of failures (100 tries) the item goes to a person instead.

**Strikes and pauses** (`contentStanding/{uid}`): each block adds a strike. At the Admin figure inside the window, posting is paused for the
Admin number of days. That pause is ours, not the account suspension: `users/{uid}.suspended` would also stop messages and calls and hide
the profile, and the owner said a suspended member can still read and message. A further strike after a pause is a **ban**, and that does use
the existing suspension records (`suspensions/{uid}` with the reason, `suspended` on the profile, the bell from `moderationMessage`, the appeal
on the profile and the Users page in Admin). Overturning the strike that caused a pause or a ban lifts it.

**Browser-saved content.** Journals, shop items and profiles are written from the browser, so `firestore.rules` ask for a **check pass**
(`contentPasses/{id}`, server-written, for this member, for exactly that content, for an hour) when a journal is published, or when a shop
item's or profile's words or pictures change. The journal editor saves a draft, asks `/api/content-checks` for a pass (the server reads the
draft itself), then publishes with it; a blocked or held journal simply stays a draft. `addStoreItem`, `updateStoreItem` (`lib/store.ts`) and
`updateProfile` (`lib/users.ts`) ask for a pass first. Admin (`contentCheckSettings/current` `enabled: false`) switches the rules' check off too.

**Paths checked:** journals (editor pass; partner API `POST/PATCH /api/v1/posts`; an agent's `publish_post`, `lib/agents/execute-server.ts`),
comments on journals (`lib/comments-server.ts`), communities (create and settings), community posts and comments
(`lib/community-server.ts`), Moments (`createMoment`, the caption on `shareToMoment`), Media posts (pictures before the post is made; the
caption; a video's poster and frames in `refreshVideo` before it is shown; caption edits), shop items (pass; an agent's `store_edit`), events
(create and edit, `lib/events-server.ts`), and profiles (name, bio, picture: pass).

**Not checked:** private 1:1 and group messages (by decision); the voice-over audio on Moments and audio rooms (not pictures or text);
reshares of a Moment (already checked); content written by staff in Admin; the profile set at sign-up (checked from the first edit).

**Reviews** (Admin → People & Trust → **Content checks**, `/admin/content-checks`, also a tab on Reports; `components/admin/ContentChecksAdmin.tsx`, `/api/admin/content-checks`, Trust & safety
or Legal): today's numbers, the queue (held and appealed, oldest first, with the photo found ringed), Restore (publishes the stored write, or
for a shop item or profile, clears the content so saving again goes straight through; removes the strike and lifts a pause or ban it caused)
and Keep blocked (a held item becomes a strike; an appeal is refused), the week's strikes, pauses, bans and overturned, and the figures.
**Legal team** (Legal department or super admins) also sees the child-safety queue: Reported (with the report's reference), Keep blocked, or
Not child abuse (restore). Trust & safety never sees those items.

**Members:** the blocked message (`components/content-checks/BlockedNotice.tsx`) in the journal editor, the community composer, the Media
studio and the Moments composer; other screens show the same words as their error. The account page (`/profile/account#content-checks`,
`components/content-checks/ContentStanding.tsx`): the pause with the list of strikes and "Appeal the suspension", each strike with "Ask for a
review", and anything waiting for a person. Bells (type `content_check`, or `suspended` for a pause or ban). The rules card
(`components/content-checks/RulesCard.tsx`) on each community's About tab, the journal editor and the Media studio; Terms section 2e; the
public page `/content-rules` (footer: Company → Content rules); the help article `content-checks`.

**Communities:** a strike on the community's owner, admins or moderators for content in it counts on `communityChecks/{cid}`. At the Admin
figure (default 3 in the window) its owner and moderators get a bell and every visitor sees a warning; the next one closes it
(`closedForRules`): nothing new can be posted, and the owner can "Ask for a review" from their account page (Restore reopens it).

**Collections** (all server-only in `firestore.rules`, covered by the rules test): `contentCheckSettings`, `contentFlags`, `contentStanding`,
`contentCheckCache` (TTL on `expireAt`, 180 days), `contentCheckStats/{day}`, `contentPasses` (TTL on `expireAt`), `communityChecks`,
`legalQueue`. No new composite indexes (every query is on one field).

## Owner steps

1. **Deploy the rules and TTLs:** `firebase deploy --only firestore:rules,firestore:indexes` (the indexes file adds two TTL policies).
2. **The AI key:** `ANTHROPIC_API_KEY` is already set for Nana; content checks use the same key. Optional: `CONTENT_CHECK_MODEL` (default: the
   smallest current model). Without a key, posts are published and queued (nothing is blocked) until it is set.
3. **Cron:** nothing new; the re-check runs in the existing `/api/cron/reminders` job.
4. **Figures:** Admin → Reports → Content checks → The figures (super admin). Defaults: block at 0.85, review at 0.5, teens 0.6 / 0.3,
   child-safety ban at 0.8, 3 strikes in 90 days, 14 days' pause, 3 community strikes.
5. **Cloudflare CSAM Scanning Tool:** Cloudflare dashboard → the zone serving the R2 public bucket and the site → Caching → Configuration →
   CSAM Scanning Tool → enable, with the notification email of the Legal lead (Cloudflare needs NCMEC verification of the email).
6. **Child-safety reports:** register #NotesApp with NCMEC's CyberTipline (report.cybertip.org, "ESP registration"), and agree with
   counsel the Nigerian route (the Nigeria Police Force's cybercrime unit (NPF-NCCC) and NAPTIP under the Cybercrimes Act 2015 and the Child
   Rights Act). When an item appears in the Legal queue: preserve it (do not delete it or the account), report it, and record the
   reference with **Reported**. Never download, forward or show the files to anyone outside the report.
7. **Counsel:** review Terms section 2e (content checks) and decide whether to bump the Terms version.
8. **Give the Legal department to the Legal lead** in Admin → Access so they see the child-safety queue.

## As built (v0.174.0)

- Built as drawn, with these differences, all from the owner's own rules:
  - **The rules card has no figures** ("Too many in a short time and posting is paused for a while"): the mockup said "three in 90 days",
    and help text must never print Admin figures. The blocked message to the member does say "strike 1 of 3" and "clear after 90 days",
    read from the settings, as drawn.
  - The account page says "Your account is suspended **from posting** until …", because it is a pause from posting (reading and messages
    keep working), not the whole-account suspension.
  - Screen 3's "Waiting for review" also shows appeals, the photo that was found, and the text; the strikes card adds "Accounts closed".
- **Video:** Media and Moments videos are checked by their poster and up to three frames from Stream's thumbnails. **Journal videos are
  checked by their poster only** (the journal's `videoPoster`); live replays shared to a journal are not checked.
- A Media video still processing when it is posted is checked when Stream says it is ready, before it is shown; a blocked or held one stays
  hidden with the reason ("rejected"), and Restore shows it.
- A Media picture post that is blocked or held isn't made; its uploads stay so the member can take the photo out and post again. Restoring
  one clears it (post it again and it goes straight through), as for shop items and profiles.
- Against the Firestore emulator the AI is never called (`FIRESTORE_EMULATOR_HOST`), so tests and local runs never reach the network; the
  tests inject their own checker with `setContentCheckDeps`.
- Tests: `npm run test:content-checks` (pure: thresholds, deciding, strikes, communities, the words, the error) and
  `npm run test:content-checks-server` (emulator: the gate, cache, holds, blocks, pauses, bans, child safety, appeals and reviews, the
  re-check, passes, the create paths and communities), both in CI; `npm run test:rules` covers the passes and the server-only collections.
