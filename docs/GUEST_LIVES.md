# 👀 Watch a live without an account

A public live's link opens straight into the live for anyone, signed in or not. Guests watch, read the chat and share. Chatting,
hearts, gifts, following and coming on stage need a free account, and signing in brings them back to the same live.

The owner asked for it on 17 Nov 2026 ("our live links that are not private links can allow non logged in viewers who don't have
notesapp account to view/share, but can only interact once they login") and put it after Merch; on 19 Nov 2026 they asked for it next,
with sample screens first. **Status: mockups drawn 19 Nov 2026, waiting for the owner's approval. Nothing is built.**

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
