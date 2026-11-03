# Media: the plan, and what is built

2 November 2026: plan and mockups (`media-*.html`, with a `-phone.png` and `-desktop.png` for each screen; sources in `media-mockups-src/`,
`node build.js` rebuilds them). 3 November 2026: the owner approved the mockups and decided the points below. **Phase M1 is built
(v0.129.0)**; see "Phase M1: what is built" at the end.

## Owner decisions (3 Nov 2026)

- **Where Media lives:** a **tab on the public profile** `/u/{username}`: Notes · Media · Store · Courses, with its own count. The phone
  bottom tab bar does **not** change (this replaces "Phone navigation" below and open question 3). `/u/{username}/media` is that tab as a page.
- **The creator's Media:** their videos and pictures; an album of past profile pictures (keep profile picture history from now, recorded on
  the server); the site kit's pictures **shown by default**, each hideable, with a "hide all site pictures" switch (open question 8); a
  Lives & Replays tab (open question 1: they stay on the creator page); pinned Moments and pinned posts at the top.
- **Pinned Moments stay past their 24 to 72 hours while pinned** (open question 2). Unpinning an expired one lets it go.
- **No picture:** a tile or background with no image uses the default chat background, the African pattern.
- **Studio (`/profile/media`):** upload (video to Cloudflare Stream by direct upload, open question 5; pictures to R2 as WebP like every other
  upload), caption, who can see it (**everyone / followers / subscribers**, replacing "only me"), comments on/off, allow shares, allow gifts,
  pin, **allow watermarked downloads** (default off; open question 9), my posts with stats, and "From your site" pictures with Hide switches.
- **Music:** original sound only, no music library (open question 4).
- **Plan limits:** a new "Media" group in Admin → Limits (below), read live by the help and the pricing table.
- **Teen mode:** a teen's Media is for mutual followers only, no downloads of it, and comments and mentions only from people they follow.
- **Data:** a server-written `mediaPosts` collection read through our API (like Moments), with counts on the profile. Phase M1 doesn't
  include the `/media` feed, comments, reactions or gifts UI (M2), but every post already has `commentsCount`, `reactions`,
  `reactionsCount`, `giftsTotal`, `giftsCount` and `sharesCount`.

## What Media is

Media is NotesApp's own full-screen feed of short videos and pictures. You scroll it one item at a time. It is also where Live happens, and where the #1MillionNairaNotesAppChallenge is run.

| | Moments | Media | Journals |
|---|---|---|---|
| Lasts | 24, 48 or 72 hours, then gone | Stays until the creator deletes it | Stays |
| Shape | Ring on the profile picture | Full-screen, one item per screen | Article |
| Who sees it | Followers only | Everyone, followers, or only me (the creator chooses) | Public or members |
| Good for | Today's update | Recipes, tips, looks, clips, lives | Long writing |

Media and Journals link to each other. A post can say "Full recipe in her journal". A replay can be turned into a journal post with Nana's transcript and summary.

## Routes

- `/media`: the feed, with three tabs: For you, Following and Live now.
- `/u/{username}/media`: a creator's Media. It is a grid of videos and pictures. It includes their **past profile pictures as an album** and their **Lives and Replays**. **Pinned Moments and pinned posts** sit at the top.
- `/profile/media`: my Media studio. It has four tabs: Posts, Live & replays, Challenge and Settings. **Pictures already on my site** (Gallery, cover and services pictures from the site kit) appear in my Media automatically, and each one has a Hide switch.
- **Lives** appear in `/media` (Live now), and also on **Explore and on Trending**, which gets a Lives tab.
- **Replays** appear only in the owner's `/profile/media` and on **Explore and Trending**, which gets a Replays tab. They never enter the Media feed. If the host shares a replay to Journal, it appears in the journal feed like any other post.
- ~~Phone navigation: Media becomes a bottom tab between Explore and Market.~~ Decided 3 Nov 2026: no change to the phone tab bar; Media is a profile tab, and the `/media` feed (M2) is reached from there and from Explore.

## Who can post (Admin → Limits, "Media" group, built in M1)

The defaults follow the existing video ladder (`VIDEO_WEEKLY_LIMIT`, the same as video moments). An admin can change any of them; the help
article (`/help/media`) and the pricing table's Media row read the saved values.

| Limit (key) | Free Standard | Basic | Pro | Business | Enterprise |
|---|---|---|---|---|---|
| Media videos a week (`mediaVideosPerWeek`) | 0 | 2 | 7 | 14 | 30 |
| Longest Media video (`mediaVideoMaxSeconds`) | (60 s, unused while 0 videos) | 60 s | 3 min | 3 min | 10 min |
| Picture posts a day, up to 10 pictures each (`mediaPicturePostsPerDay`) | 5 | 10 | 20 | 40 | 100 |
| Media storage, pictures and videos (`mediaStorageGB`, 0 = no limit) | 1 GB | 5 GB | 20 GB | 50 GB | 200 GB |
| Go live (audio), later phase | No | Yes | Yes | Yes | Yes |
| Video minutes in lives a month, later phase | 0 | 30 | 120 | 300 | 1,000 |

These rules apply on every plan:
- Posting needs a verified email.
- Suspended accounts can't post.
- A rejected upload gives its slot back.
- Media videos are counted separately from post videos and video moments.

## Upload and storage (what the repo already uses)

- **Pictures**: the browser converts them to WebP (`lib/upload.ts`, `webpPlan`) and they go to the public R2 bucket through `/api/upload`, with a new purpose `media`. Site-kit pictures and past profile pictures are not copied. Media points at the files that already exist.
- **Video**: today's post video goes straight to R2 (`lib/video-server.ts`: signed PUT, size and first-bytes check, weekly quota). Courses already use **Cloudflare Stream** (`/admin/stream`, signed playback). For Media, the proposal is to upload to Cloudflare Stream through direct creator upload. Stream gives adaptive bitrate, which matters on 3G and 4G, plus thumbnails and a poster frame. Media videos are public, so they would use public playback, not signed playback. The quota check stays in our server before the upload link is issued.
- **Lives** run on the Cloudflare Realtime relay that is being built for audio rooms (host video on/off, poster image, video-minutes budget, recording). Recordings are kept 30 days and then deleted unless they are published. A published replay is copied into Stream.

## Feed ranking v1 (simple and explainable)

The score combines:
- **Follows**: items from people you follow get a strong boost in For you. The Following tab shows only them, newest first.
- **Recent**: the score decays with age (half-life about 2 days).
- **Engagement**: completion rate, reactions, comments, shares, saves and gifts, each per view. Completion counts most.
- **Variety**: at most 2 items in a row from the same creator.
- **Live**: a live from someone you follow is placed in your next 3 items.

The score is computed by a scheduled job into a `mediaRank` field, so the feed is a single sorted query. There is no personal model yet. Each item gets a "Not interested" option, and a "Why am I seeing this" line ("You follow Chidinma" or "Popular in Food this week").

## Moderation and reporting

- An automatic safety check runs on each upload before it goes public (status "Checking"). It covers nudity, violence and known scam patterns.
- Reports use the Moments reasons and `/admin/reports`, which keeps a copy until resolved, plus "Copyright" and "Under 18 in danger".
- Comments with links wait for the creator's approval. Creators can turn comments off per post.
- Live chat has these controls: who can chat (everyone, followers, or followers of 7+ days), slow mode, blocked words, links off by default, and host and moderator removal. The host can end the live, and admins can end any live.
- Three upheld reports in 30 days pause the creator's uploads until an admin review.

## Teen mode (`lib/young.ts`, same rules as Moments and replies)

- A teen's Media is visible only to mutual followers (`teenAudience`). It never appears in For you, on Explore or on Trending, and never signed out.
- Only people the teen follows can comment on, mention or reply to a teen (`mayReach`).
- No shares or reshares of a teen's Media (`mayReshare`). Share options are hidden on their posts.
- Teens can't go live and can't receive gifts. They can listen to lives, and they never count towards the challenge or appear on a host's pick list.
- Teens get a softer For you feed: no live chat from strangers, and gifts are hidden.

## Live and replays in Media

- **Going live**: the host sets a title and a poster image, chooses who can join, sets the chat rules, and decides whether to record for a replay. There is a consent note. Everyone is told on joining that the live is recorded, speakers agree again before they go on stage, and a speaker can ask for their part to be cut.
- **In the room**:
  - The host's video can be on, or the poster is shown while it is off.
  - Listeners have an "Audio only" data saver.
  - The room has chat, raised hands, a speaker stage and gifts.
  - "Book a session" is always visible.
  - The listener count is shown.
  - The video-minutes left are shown to the host.
  - The host sees the drop prompt ("Listeners are dropping. Try 2 minutes of video?") when listeners fall by about 10% within 5 minutes.
- **Replays**: they are kept 30 days with a visible countdown. The host can:
  - publish or unpublish a replay;
  - edit its chapters;
  - make it a journal post: Nana drafts the transcript, a summary and chapters, and nothing is published until the host does.

  A published replay shows chapters, a transcript toggle and Book a session.

## How the challenge counts (as decided in BUILD_LOG)

- **Unlock**: 100,000 all-time views and 10,000 qualified new followers.
- **Win**: a single live reaches 2,000 counted listeners at the same time. Counted means signed in, verified email, account 7+ days old, 5+ minutes of foreground heartbeats, and passed the device, network, linked-account and bot-score checks.
- **Prize**: ₦1,000,000 per winning live (₦500k cash after the identity check and a 7-day hold, ₦250k NotesApp Credit, and ₦250k Bonus Credits for 10 to 50 chosen listeners at ₦5k to ₦25k each). The first 10 winners each month are paid. Each creator can win once.
- **Badge**: in the room, everyone sees "1,240 / 2,000 counted".
- **Dashboard**: the host's private dashboard shows numbers only, never who wasn't counted or why.

## Open questions for the owner (answered 3 Nov 2026, see "Owner decisions" above; 6 and 7 wait for the live phases)

1. **Replays on the creator page.** Note 4 says replays appear only on /profile/media, Explore and Trending. Note 3 lists Lives and Replays on /u/{username}/media. The mockups show them on the creator page. Should we drop them from there?
2. **Pinned Moments.** Does pinning keep a Moment past its 24 to 72 hours, like a highlight, or does it show only while the Moment is live? The mockups show the time left.
3. **Phone tab bar.** It already has six tabs. Should Media replace Academy (Academy moves into Explore), or Market?
4. **Music.** For v1, the proposal is original sound plus a small NotesApp licensed sound library, with no commercial music until we have a licence.
5. **Video hosting.** Cloudflare Stream for Media video (adaptive, costs per minute stored and delivered) or plain R2 like post video (cheaper, no adaptive bitrate)?
6. **Audio edition.** In month one, does "LIVE video unlocked" mean the challenge lives (audio with optional video), as shown?
7. **Gifts in lives.** Same 7-day hold and commission as post gifts?
8. **Site-kit pictures.** Should they be on by default for everyone, or opt in?
9. **Downloads.** Should creators be able to allow downloads of their videos? Downloads would carry a NotesApp watermark.

## Build phases

1. **Pictures first**: `/media` with pictures and carousels, `/u/{username}/media` (with site pictures and the profile picture album), the studio Posts tab, comments, share, gifts, reports, teen rules and limits in Admin → Limits.
2. **Video**: Stream upload, the player, the progress bar, sound labels and ranking v1.
3. **Live in Media**: this depends on the relay. It covers the Live now tab, the room, the poster, audio only, the drop prompt, video minutes, and Lives on Explore and Trending.
4. **Replays**: recording consent, the 30-day timer, publish, chapters and transcript, Replays on Explore and Trending, and Nana's journal post.
5. **Challenge**: counting service, private dashboard, prize flow and admin review queue.

## Phase M1: what is built (v0.129.0, 3 Nov 2026)

- **Profile tab and page:** `components/ProfileTabs.tsx` (Media tab with its count), `components/media/CreatorMedia.tsx` (pinned Moments row,
  All · Videos · Pictures · Profile pictures · Lives & replays, 9:16 tiles, pinned posts first, the album tile, site pictures),
  `components/media/MediaViewer.tsx` (pictures with ‹ ›, Stream's player for video, the watermarked download button),
  `app/(main)/u/[username]/media/page.tsx`.
- **Studio:** `app/(main)/profile/media/page.tsx`, `components/media/MediaStudio.tsx` (Posts, Live & replays, Settings; new post, your posts
  with ⋯ settings, From your site with Hide switches, the album switch). Linked from the account menu.
- **Server:** `lib/media-rules.ts` (pure), `lib/media-server.ts`, `lib/media-api.ts`, routes under `app/api/media/`. Collections (all
  server-only in `firestore.rules`): `mediaPosts/{id}` (+ `views/{uid}`), `mediaUploads/{id}` (a Stream upload until it is posted; TTL
  `expireAt`), `mediaUsage/{uid}` (week's videos, day's picture posts, bytes), `mediaSettings/{uid}` (hidden site pictures, hide all, album).
- **Video:** Stream direct creator upload with public playback (`createPublicDirectUpload` in `lib/stream.ts`, `maxDurationSeconds` = the
  plan's longest video). A post is "processing" until Stream has it ready; it is checked when the studio opens and by the cron. Rejected
  (too long, failed, never arrived in a day): removed from Stream, slot and bytes given back.
- **Watermarked downloads:** pictures only in M1 (`lib/media-watermark.tsx`): server-side, @username + the NotesApp mark, JPEG out, never the
  original. **Videos (TODO, M2):** Cloudflare Stream can burn a *watermark profile* (`POST /accounts/{id}/stream/watermarks`, an image) into a
  video, but only when the video is uploaded or copied (`watermark: { uid }` on `direct_upload` or `POST /stream/copy`), and it then shows in
  every rendition, playback included. MP4 downloads are made with `POST /stream/{uid}/downloads`. So a watermarked video download means a
  second, watermarked copy per video (one watermark profile per creator, made from their @username badge), with downloads enabled on the copy
  only: about double the storage for each video that allows downloads. Until then the switch says video downloads are coming.
- **Pinned Moments:** `pinMoment` and `listPinnedMoments` in `lib/moments-server.ts`; the moment viewer has 📌 Pin / Unpin; up to 10.
- **Profile picture history:** `profilePictures` (kept since v0.43); the picture in use is now also recorded server-side by
  `profileAlbum` whenever Media reads it.
- **Lives & replays:** `replaysFor` in `lib/media-replays.ts` returns none until PR #256 (recording and replays) lands; that PR's
  `/profile/media` placeholder around `ReplaysList` goes into the studio's "Live & replays" tab (marked MERGE POINT).
- **Tests:** `npm run test:media`, `npm run test:media-server`, and the rules test.

### Left for M2 and later

The `/media` vertical feed (For you, Following, Live now) and ranking; comments (with `mayCommentOnMedia` for teens), reactions, gifts and
their UI; sharing a Media post to Moments, Journals and chats (`lib/share-targets.ts` gets a `media` kind); reports on Media posts and the
automatic safety check ("Checking"); video downloads (above); Explore and Trending tabs; live, replays and the challenge (phases 3 to 5).
