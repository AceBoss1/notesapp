# 👀 Watch a live without an account

A public live's link opens straight into the live for anyone, signed in or not. Guests watch, read the chat and share. Chatting,
hearts, gifts, following and coming on stage need a free account, and signing in brings them back to the same live.

The owner asked for it on 17 Nov 2026 ("our live links that are not private links can allow non logged in viewers who don't have
notesapp account to view/share, but can only interact once they login") and put it after Merch; on 19 Nov 2026 they asked for it next,
with sample screens first. **Status: built in v0.188.0 (19 Nov 2026)** after the owner's "approve build, hope admin can set guest number limits". What was
built, and what wasn't, is at the end of this page.

## Today

- `docs/GO_LIVE.md` already says signed-out visitors can watch public lives, but the code doesn't do it: a signed-out visitor who
  opens `/live/<id>` sees the lobby and **"Sign in to join"** (`components/lives/ProfileLive.tsx`).
- Everything a viewer needs is tied to an account: joining (`/api/community/rooms`, which needs a signed-in user), the stream (the
  relay pulls only for someone in the room's `people` list), the chat and count (the live-rooms worker's token carries a uid), and
  the Firestore rules on `communityRooms` and its chat.
- The link preview is just "Live", with no picture (`app/(main)/live/[id]/page.tsx`).
- Share works, but only signed-in viewers can reach it.
- Replays already work signed-out when public (`/replays/<id>`), with an anonymous rate limit by IP; that is the pattern to follow.

## The mockups

All screens on one sheet: [all-screens.webp](mockups/guest-lives/all-screens.webp). HTML source: [mockups.html](mockups/guest-lives/mockups.html).

1. The link, shared anywhere, with a real preview ([1-the-link](mockups/guest-lives/1-the-link.webp))
2. Watching without an account ([2-watching-as-a-guest](mockups/guest-lives/2-watching-as-a-guest.webp))
3. Tapping chat, a heart, a gift or Follow: join, and come back ([3-sign-in-sheet](mockups/guest-lives/3-sign-in-sheet.webp))
4. Sharing, for everyone ([4-share](mockups/guest-lives/4-share.webp))
5. Lives a guest can't watch, and the one step that gets them in ([5-lives-guests-cant-watch](mockups/guest-lives/5-lives-guests-cant-watch.webp))
6. The host's choice, and what guests brought them ([6-host-settings](mockups/guest-lives/6-host-settings.webp))
7. A link opened after the live ended ([7-live-ended](mockups/guest-lives/7-live-ended.webp))
8. Admin: guests on or off, a cap, the cost and the sign-ups ([8-admin](mockups/guest-lives/8-admin.webp))

## Decisions for the owner

Each has a recommendation. The build follows it unless the owner says otherwise.

| Question | Recommendation |
|---|---|
| Which lives guests can watch | **Profile lives open to Everyone**, while live. Followers-only, subscribers-only, paid (ticketed) and community lives stay as they are: the page explains why and offers the one step (sign in and follow, buy a ticket, ask to join). |
| Who decides | **The host**, with "People without an account can watch", **on by default** for Everyone lives. **Admin** can switch guests off everywhere. |
| What guests can do | **Watch, listen, read the chat, see the count and hearts, share.** Everything else (chat, hearts, gifts, follow, raise a hand, come on stage, report) opens the join sheet and returns them to the live. |
| How many guests | **A cap per live set in Admin** (300 to start). Guests count toward the live's listener limit but stop at their own cap, so members always have room. |
| Which lives carry guests | **Only lives on the relay** (Cloudflare Realtime). A small phone-to-phone live is carried by the host's phone, so guests there would see "Sign in to watch". |
| Teens | A **teen host's** live is never open to guests. A live open to guests **can't bring a teen on stage**. Teens' own chat lines aren't shown to guests. Teens watch only signed in, as today. |
| Who a guest is | **No account and no name.** A guest gets a random guest id in a signed, http-only cookie for that browser, used only to count them, give them a seat in the stream and limit how often they can ask. Nothing about them is stored after the live, and they don't appear in the viewer list. |
| What the host sees | "1,214 watching · 316 as guests" during the live; afterwards how many joined #NotesApp from it and how many followed. |
| Cost | Each guest on video costs about what a member does on the relay (about ₦1 a minute at 480p, `docs/LIVE_ECONOMY.md`). The Admin cap and the switch keep it in hand; Admin sees the cost of guests each week. |
| Link previews | Every live link gets a proper preview: who is live, the title, a picture, and "No account needed to watch" when guests can watch. Lives aren't listed in search engines. |

## How it will work

- **A guest pass** (`lib/live-guests.ts`, pure, tested): a random `g_` id, signed with the server's secret, in an http-only cookie for
  the live's path, renewed while they watch; the rules for who may watch as a guest; the guest cap.
- **Joining as a guest** (`/api/lives/watch`, no sign-in): checks the live is open to guests, the cap and the rate limit by IP, then
  records the guest in the room's guest count (not in `people`), and returns what the viewer needs: a relay session for listening
  only, and a live-rooms worker token with role `guest` that can read the chat and count but send nothing.
- **The page** `/live/<id>`: server-rendered with Open Graph; for a signed-out visitor on a guest-open live it plays the live with a
  read-only chat and the join sheet for every action; otherwise the states on screen 5.
- **Signing in from a live** returns to `/live/<id>` with what they tapped (chat, gift, follow) ready.
- **Counts:** guests in the live's count, a guest share for the host, and "joined from a live" for the host and Admin.
- **Admin → Limits:** guests on or off, guests per live, relay only, and the week's guest views, cost and sign-ups.

## Build order (after approval)

1. `lib/live-guests.ts` (pure): the pass, who may watch as a guest, the cap. Tests.
2. The guest join route, the guest's relay session and worker token (read-only), the guest count. Emulator tests; rules tests stay
   closed for guests (they read through the server, never Firestore).
3. The `/live/<id>` page for guests: the player, the read-only chat, the join sheet and return, Share, the closed and ended states,
   the link preview.
4. The host's switch and numbers; the teen rules; Admin → Limits.
5. Screenshots from the real code for the owner. Then the help article, changelog, README, HANDOVER, BUILD_LOG, and `docs/GO_LIVE.md`
   corrected.

## Not in the first release

- Guests watching paid, followers-only or community lives.
- Big-audience broadcasting (HLS / Stream Live, `docs/COMMUNITY.md`): guests use the relay like members.
- Guests chatting under a nickname.

## Built in v0.188.0

- **The rules** `lib/live-guests.ts` (pure, tested): `guestNo` (why a guest can't watch: ended, followers, subscribers, paid,
  community, off, teen, phone, full), `guestLimit`, `openToGuests`, `guestChat` (never a teen's line, never an account id) and the
  link preview. **The pass** `lib/live-guest-pass.ts` (server only): a random `g_` id, signed with a key derived from
  `ACCOUNT_DATA_KEY` (or `LIVE_ROOMS_SECRET`), six hours, in an http-only cookie on `/api/lives/watch`.
- **Admin's limits** (owner: "hope admin can set guest number limits"): Admin → Limits → **Guests in lives**: `guestsOn` (switch them
  off everywhere) and `guestsPerLive` (300 to start; 0 lets none in), with the last seven days' guest views, sign-ups and minutes.
  Guests also stop when members and guests together reach the room's listener limit, so members always have room.
- **The server** `lib/live-guests-server.ts`, route `/api/lives/watch` (no sign-in; limited by address): the guest view (shared by every
  guest of a live for two seconds), joining (`communityRooms/{id}/guests/{gid}`, server-only), the beat, leaving, **receive-only**
  relay steps on the guest's own Cloudflare session (pull, answer, close; never push), the guest count on the live, and counting a
  guest who joins or signs in (`guestJoins`, `guestSignIns`; `liveGuestStats/{day}`). Guests never read Firestore.
- **Teens:** a teen host's live is never open to guests; `stageBarred` keeps a teen off the stage of a live guests can watch; a teen's
  chat lines are marked `teen` when sent there and never shown to guests.
- **Screens:** `/live/<id>` renders `components/lives/GuestLive.tsx` for anyone not signed in: the live with ▶ Watch, the read-only chat,
  the count and likes, the join sheet (sign up or sign in, back to the live), Share, and the states for lives a guest can't watch or
  that have ended. The page now has a real link preview (Open Graph and X). Going live has "People without an account can watch"; the
  room shows "N as guests"; the summary shows who joined from the live. Back from signing in, the member goes straight into the live.
- **Tests:** `npm run test:live-guests` and `npm run test:live-guests-server` (both in CI), the rules test, and the room tests updated.

Screenshots from the real code, with sample data on the emulators: [built.webp](mockups/guest-lives/built.webp).

## Changed from the mockups

- **"Watch" needs a tap.** Phones don't play a live's sound until the visitor taps, so the live opens with ▶ Watch over it.
- **The join sheet** offers "Create a free account" and "I have an account: sign in"; the Google button is on the sign-in page itself.
- **Admin shows guest minutes** and the per-minute cost from `docs/LIVE_ECONOMY.md`, not a naira total.

## Not built, or still to do

- **Not tried on a real relay.** The tests use a stand-in Cloudflare relay; watch a real live as a guest on staging (the relay keys must
  be set, and `ACCOUNT_DATA_KEY`, which is already set for My Cycle and the Planner).
- **Deploy:** `firebase deploy --only firestore:rules` for the guest seats and the daily figures.
- **A guest's view refreshes every three seconds** through the server, not the live-rooms worker, so the chat a guest reads can lag the
  room by a few seconds.
