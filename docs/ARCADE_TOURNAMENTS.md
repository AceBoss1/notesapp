# 🏆 Notes Arcade tournaments, backed by sponsors

The owner, 20 Nov 2026: "plan tournaments on games that can be powered with sponsor[s] backed tournament and get tournament sponsors,
plus only logged in players can participate". **Status: plan approved with the owner's answers (21 Nov 2026, §8). Phase 0 (saving progress for signed-in members) is being built; tournaments come next.**

It builds on what's already there: the eight games (`lib/arcade/`), the free-to-play rule (guests play, nothing is saved; signing in
saves progress, N$, scores and referral credit through the Notes Life wallet), the advert spots and the partnership page
(`/arcade/partners`, v0.189.0).

## 1. The rules that don't move

- **Only signed-in #NotesApp members can enter.** Guests can watch a tournament's page and leaderboard, and still play every game for free.
- **Entry is always free.** No entry fee in naira, Credit or N$. A paid entry with a prize is a bet; we don't run those.
- **Games never pay out real naira.** Prizes come from the sponsor (goods, vouchers, services, their own credit) or are N$, the game money.
- **Skill decides, not luck.** Every entrant plays the same deal (§3), so a better player wins, not a luckier roll.
- **Young members:** prize tournaments are for adults (18+) unless the owner decides otherwise. Kids and teens can play "practice"
  tournaments with no prizes, following `docs/YOUNG_MEMBERS.md` (no public names for kids, teens visible only to people they follow).
- **No Nana in tournaments** (owner, 21 Nov 2026). The Arcade's free Nana (hints and takes, `lib/arcade/nana.ts`) never shows on a
  tournament page (`nanaAvailability({ mode: "tournament" })`). In player-to-player duels she's off unless the duel's rules allow her.

## 2. What a sponsor gets

| | What it is |
|---|---|
| The name | "The Ariaria Cup, Naija Landlord, 29–30 Nov": the tournament carries the sponsor's name |
| The page | A tournament page with their logo, words, link and prizes; shareable, in the sitemap |
| The board | Every advert spot in that game (Ludo centre, Landlord middle, under the board) shows only them while the tournament runs |
| The winners | A results page and a post on #NotesApp's own account naming the winners and the sponsor |
| The numbers | A report after: entrants, games played, page views, advert impressions and clicks (the same counts as Admin → Ads) |

Built (owner, 24 Nov 2026: "page-view counts in the sponsor's report; share cards and sitemap entries for each tournament"): each
public tournament has its own title, description and share card (`app/(arcade)/arcade/tournaments/[id]/opengraph-image.tsx`) and is in
the sitemap; drafts never are. The report counts the tournament page's views and the list page's views on the days it ran, once per
visitor per Lagos day like adverts (a salted hash of IP and browser, never the IP; bots and link previews left out).

Built (owner, 24 Nov 2026: "the results post on #NotesApp's account naming the winners and the sponsor"): once "Results checked" is
ticked, Admin → Arcade tournaments → **Results post** makes a draft (`lib/arcade/tournament-results.ts`): "Winners of …", thanks to the
sponsor by name with their link and words, the winners in order with their checked results and prizes, the prizes as listed, how many
entered, "same deal for everyone, every try checked by replaying it", the final leaderboard, and the next tournament and the partners
page. Admin edits it (Markdown, like any journal) and presses **Publish as #NotesApp**: it becomes a published journal post on
@na-notesapp, written exactly as an admin's post under NoteForm's "NotesApp" author toggle (`notes/{id}` with author "NotesApp",
authorUsername "na-notesapp", topic Gaming, the share card as its cover), so it's on /u/na-notesapp, in feeds, Explore and the sitemap,
with the usual followers' bell and mention bells. The tournament keeps `resultsPost` (note id, slug, address, when, which admin), so it
can't be posted twice; the public page's results and the sponsor's report link to it. It names the same winners "Tell winners" tells:
the ones told once anyone has been, otherwise the checked board with the same skips. Teens (practice tournaments) and members who keep
their profile private (`keepHidden`) aren't named: the post says "a player in teen mode" or "a member who keeps their profile private"
instead (docs/YOUNG_MEMBERS.md: nickname only, kept off public lists).

Packages (names and prices set by the owner in Admin, not in code): for example a **Weekend** (one game, two days), a **Month**
(one game, weekly rounds and a final) and a **Season** (several games, a league table).

Sponsors come in through `/arcade/partners` ("Sponsored tournaments" is already there) and the contact form. Admin creates the
tournament once the sponsor has agreed and paid.

## 3. How a tournament is played (and kept fair)

**Format 1, "Same deal" (first to build).** For the tournament's window, every entrant plays the same game against the computer,
with the same seed: the same Ludo dice, the same Whot deal, the same Landlord cards, the same computer level. Ranked by result, then
score, then fewest moves or time. A set number of tries each (say 3; best counts).

This works today because every game's rules are plain code with a seeded random number (`lib/arcade/<game>.ts`):

- **Start:** the server gives the player the seed and a one-time run id.
- **Finish:** the browser sends back the list of moves.
- **Check:** the server **replays the moves with the same code** and works out the result itself. A made-up score can't pass, because
  the server never takes the browser's word for the result.
- **Limits:** runs expire (say 30 minutes), one run at a time, and tries are counted on the server.

Games and what decides the ranking:

| Game | Ranked by | Note |
|---|---|---|
| Snake | Score | Same food positions for everyone |
| Chess, Draughts | Win, then fewest moves | Against the computer at a set level |
| Ncho, Aka-Hausa | Seed difference | Against the computer at a set level |
| Whot | Win, then cards left to the computer | Same deal |
| Naija Landlord, Ludo | Win, then net worth / seeds home | Same dice and cards; computer opponents |
| Ace of Spades | Points over a set number of hands | Same deals; computer partner and opponents |

**Format 2, live knockouts (later).** Player against player, brackets, a final. Needs live multiplayer first (the "friends: chat,
call and play together" work), so it comes after Format 1.

## 4. Leaderboards

- **Each tournament:** top members, with the sponsor's name on top. Ties broken as in §3.
- **Each game (always on):** the top computer players 🤖 and the top people, as the owner asked, shown side by side.
- **Notesville rich list:** N$ prizes land in the Notes Life wallet, so they count on the Billionaires List like any other N$.
- Names follow each member's privacy settings and the young-member rules.

## 5. Prizes, paid out safely

- The sponsor's prizes are listed on the page before entry opens, with how many winners and how they're delivered.
- After the window closes: the top results are checked (replays re-run, odd patterns looked at by a person), then winners are told in
  Messages and asked to confirm their details. Nothing is handed over before that check.
  **Built (owner, 24 Nov 2026: "telling winners in Messages"):** Admin → Arcade tournaments → "Tell winners", only after "Results
  checked": pick how many (one per prize), preview each message, send. Each winner gets a direct message from #NotesApp's messaging
  account (`OFFICIAL_MESSAGES_USERNAME`, `lib/official-messages-server.ts`): by default the official account @na-notesapp itself
  (owner, 24 Nov 2026: "Set OFFICIAL_MESSAGES_USERNAME is #NotesApp: naapp.tech/u/na-notesapp"), whose replies Customer care reads
  and answers in Admin → #NotesApp inbox (`lib/official-inbox-server.ts`; members can only reply where it wrote first), or a real
  account the team signs in as) and a bell linking to the tournament. Deleted and suspended accounts, and anyone under 18, are skipped and the next player moves up.
  Who was told is kept on the tournament (`winners`, `winnersNotifiedAt`), so it never tells anyone twice, and it's in the sponsor's
  report. Practice and no-prize tournaments get "Tell the top players", a congratulations with nothing to claim; teens get the bell only.
  **"Mark prizes sent" waits until winners have been told** (owner, 24 Nov 2026): refused by the server and greyed out in Admin with the
  reason (`prizesSentBlocker`) until winners have been told (`winnersNotifiedAt`) and **every prize place** has been told, unless the
  board ran out of players who can take one (fewer eligible finishers than prizes; then every place that can be told must be). A place
  whose message failed was given back, so it counts as not told. Tournaments without prizes have no "Mark prizes sent" at all.
- One account per person: an entrant needs a confirmed email; prize winners may be asked for their phone number too.
- N$ prizes are paid straight into the Notes Life wallet.
- **Legal check before the first prize tournament:** whether a free, skill-based contest with sponsor prizes needs any promotion
  approval in Nigeria, and the Terms clause for tournaments (§8, decision 5).

## 6. What gets built (Format 1)

**Phase 0: the signed-in Arcade.** It has to exist before tournaments.
- Swap `lib/arcade/store.ts` for an account store that saves wins and records for signed-in members.
- N$ through the Notes Life wallet (`lib/life/server.ts`).
- The per-game leaderboards (§4).

**Phase 1: tournaments.**
- **Firestore:**
  - `tournaments/{id}`: game, format, window, seed, level, tries, sponsor (name, logo, link, words), prizes, eligibility, status.
  - `tournaments/{id}/entries/{uid}`: the best result and the number of tries.
  - `tournaments/{id}/runs/{runId}`: the seed, the moves, the checked result and the times.
  - Only the server writes.
- **API:**
  - `/api/arcade/tournaments` (list).
  - `.../[id]/enter` (signed in, eligible).
  - `.../[id]/start` (gives the seed and run id).
  - `.../[id]/finish` (replays the moves and records the result).
- **Pages:**
  - `/arcade/tournaments` (on now, coming up, results).
  - `/arcade/tournaments/[id]` (the sponsor, prizes, rules, leaderboard, Enter / Play).
  - The game runs in tournament mode: the seed is fixed, Undo is off, and the level is locked.
- **Admin → Arcade → Tournaments:** create, edit, open, close, check results, mark prizes sent, and the sponsor's report.
- **Advert spots:** while a sponsor's tournament runs, `ArcadeAdSpot` in that game shows the sponsor only.
- **Tests:**
  - Each game's replay matches play.
  - A tampered move list is refused.
  - Tries and windows are enforced.
  - Guests and ineligible members can't enter.
  - Firestore rules.

**Phase 2:** Format 2 (live knockouts) after multiplayer; private tournaments for a member's own playing group (no prizes).

## 7. Order and size

1. Phase 0, the signed-in Arcade (needed anyway).
2. Phase 1 with Snake, Chess and Whot first (the simplest replays), then the other games.
3. A first sponsored weekend with one sponsor and one game, then the packages.

## 8. The owner's decisions (21 Nov 2026)

1. **Prizes:** yes, a sponsor may fund **NotesApp Credit** as a prize, as well as goods, vouchers and N$. Only when the sponsor pays for it.
2. **Age:** **yes, prize tournaments are 18+ only**, with practice tournaments (no prizes) for teens.
3. **Packages:** called **sponsor packages**, and they must be **rewarding** for the sponsor. Names, prices and what each includes are set
   by admin in the dashboard, not in code. Suggested starting set (admin can change it):
   - **Weekend:** one game for two days. The sponsor's name on the tournament, every advert spot in that game, the results post.
   - **Month:** weekly rounds and a final. All of the Weekend, plus a square of their own on the Naija Landlord board and their
     colours on the Whot cards for the month.
   - **Season:** several games and a league table. All of the Month, plus a game page dressed in their brand and a mid-season report.
4. **First tournament:** our pick is a **Whot weekend** (the best known, quickest to learn, and simple to replay on the server), then
   Ludo. **Admin can change the game, dates and sponsor from the dashboard.** The sponsor is whoever signs first.
5. **Legal:** **admin** checks the promotion-approval question and the Terms clause before the first prize tournament. The
   dashboard won't open a prize tournament for entries until admin has ticked that this check is done.
