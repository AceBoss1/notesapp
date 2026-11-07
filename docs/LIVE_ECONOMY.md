# Live economy: paid lives, pay-per-minute, gifting everywhere and the weekend incentive pool

**Status:** approved plan. Built so far: phase 2 (gifting everywhere, v0.140.0), phase 1a (paid lives, v0.141.0) and phase 1b (pay-per-minute sessions, v0.142.0). Phases 3 to 5 are not built yet.
**Owner's decisions:** 3 and 4 November 2026, quoted where they set a rule.
**Rule for every number below:** it is a default. Each one is editable in Admin (Pricing, Limits or the new Live economy page), and
the help and public pages read the live value, never a figure typed into them (`tests/help/live-figures.test.ts`).

---

## 0. What already exists and is reused

| Piece | Where | Used for |
|---|---|---|
| Audio rooms with video (Live mode), poster, video-minutes budget | `lib/rooms*.ts`, `lib/rooms-live*.ts` | Every live: free, paid and pay-per-minute |
| Cloudflare relay (SFU) for rooms, TURN for calls | `lib/rooms-relay-server.ts`, `lib/calls-server.ts` | Lives at scale; the fallback for Nana minutes (P4) |
| Live chat on a Durable Object, listener counts, `listenTime` | `workers/live-rooms`, `lib/live-rooms*.ts` | Who is present (sprints, the 20-minute late window) |
| Recording with consent, replays on Stream | `lib/live-recording*.ts`, `services/room-recorder` | The recording choice on a paid live; the fallback recorder for Nana minutes |
| Pluggable transcriber, Nana summary | `Transcriber` in `lib/live-recording-server.ts` | Nana minutes: transcripts and summaries |
| Animated gifts, VIP gifts, sitewide burst, uplift on commission | `lib/gift-catalogue.ts`, `lib/gifts-server.ts` | Gifting everywhere, sprint prizes (P3) |
| Event tickets with reminders | `lib/tickets*.ts`, `lib/events-server.ts` | Paid-live tickets and their reminders |
| Bookings, paid sessions, `PAYOUT_HOLD_HOURS` (24 h problem window) | `lib/bookings-server.ts`, `lib/cancellation.ts` | Pay-per-minute sessions |
| NotesApp Credit, bonus credits (`BONUS_KINDS`) | `lib/wallet*.ts` | Paying for lives and minutes; prizes are paid in bonus credit |
| Ledger (held → released), Paystack transfers, payout OTP | `lib/payments.ts`, `lib/payouts.ts`, `lib/payout-otp-server.ts` | Gift withdrawals |
| Fan points, Top fans, subscription tiers Premium / VIP / VVIP | `lib/fans*.ts` (PR #267, merging) | Audiences for paid lives; gift points feed fan levels |

---

## Phase 1: paid lives and pay-per-minute sessions

### 1a. Flat paid lives (a scheduled event)
- The publisher schedules a live: a date and time, a title, a poster, and **three prices**:
  - **Early bird:** until a date and time the publisher picks (owner: "yes").
  - **Normal:** from then until the live starts.
  - **Late fee:** from the start until the live has run **20 minutes** (owner: "till live goes 20 mins"). After that, no more tickets.
- **Audience** (owner): everyone, **Premium and up**, or **VIP and up** (subscribers of that publisher's tiers). Subscribers of the
  chosen tiers still pay the ticket price; "available to" means who may buy.
- **Recording choice** is set when the event is created: off, record for safety only, or record and offer a replay. It is announced
  to each person as they join, using the consent flow that exists (speakers agree before their mic or camera goes on).
- Only ticket holders get in. The lobby checks the ticket at the door. Reminders go out as for event tickets today (a day before,
  an hour before, at the start).
- **Commission** (owner): the creator's normal rate **plus 10% of it**, the same uplift as premium gifts. Fixed on the payment at
  checkout. `liveTicketUpliftPct` (default 10).
- Payout like event tickets: held until the live ends plus the 24-hour problem window, then released.
- Refunds: if the host cancels or never starts, everyone is refunded to their NotesApp Credit automatically.

### 1b. Pay-per-minute sessions (a booking)
- The publisher sets a **price per minute** for voice and for video, and which tiers may book: **Premium, VIP or VVIP**
  subscribers (owner), or everyone.
- The viewer books a slot like today's paid sessions, choosing how many minutes to hold (minimum `ppmMinMinutes`, default 10).
  That amount is held from NotesApp Credit (not charged).
- During the call a meter runs. Charged per started minute after a 60-second grace; unused minutes go back at the end. If the
  hold runs out the viewer is asked to add minutes; the call ends 60 seconds later if they don't.
- **Commission** (owner): the creator's rate **plus 20% of it**, the VIP uplift. `ppmUpliftPct` (default 20).
- Calls go phone to phone first and through the relay only when needed (PR #269). Relay cost for two people is under ₦0.10 a
  minute for voice and about ₦1 a minute for 480p video (worked out on 4 Nov), so the price per minute always covers it.
- Teens: can't sell or book pay-per-minute sessions.

**Data:** `liveEvents/{id}` (host, title, poster, startAt, earlyUntil, prices {early, normal, late}, lateWindowMin 20, audience,
recording, status, roomId), `liveTickets/{eventId}_{uid}` (price paid, band, paymentRef), `ppmOffers/{uid}` (perMinute voice/video,
audience), `ppmSessions/{id}` (booking, holdKobo, startedAt, minutesBilled, status), server-only like bookings.

---

## Phase 2: gifting everywhere, quantity, archive and withdraw, weekly boards, points

- **Gift anyone** (owner): a speaker on stage, a person in a live's chat, a comment on a journal, Media post or replay, and the
  host of a replay. Each name gets a ⋯ menu with **Gift**, **Block**, **Report**.
- **Same rules as gifts today:** the catalogue, VIP gifts from ₦25,000 for verified senders only, the premium +10% / VIP +20%
  commission, never to yourself, teens can't receive money gifts from strangers (owner to confirm; see open questions).
- **No gifting with bonus credit** (owner). Gifts are paid only from real NotesApp Credit or by card.
- **Quantity** (owner): tapping a small gift twice in a row opens "How many?" with a number field. The sheet sends N of that gift
  as one payment and the animation plays with a ×N counter. `quantityMaxPerSend` (default 99) and a total cap per send equal to
  the existing gift maximum.
- **Gifts are earnings** (owner). On the receiver's side:
  - **Received gifts** lists each gift with its count and value, and stays on the profile after Media.
  - **Archive** moves a gift out of the main list. Archived gifts keep their count and total value, still show under "Archived" on
    the profile, and remain withdrawable.
  - **Withdraw** requests a payout of what is eligible. **Eligible** means the earning has passed the stated review days
    (gifts: 7 days today).
  - Requests go to Payouts. Up to `autoWithdrawMaxKobo` (default **₦20,000**, owner's line, editable) they are paid
    automatically; above it a person approves in Admin → Payments with the existing payout OTP.
  - Today gifts are released by hand; P2 adds them to `autoReleasePayouts` under that line.
- **Weekly boards** (owner): "Top gifted" (receivers) and each publisher's "Top gifters" (senders) reset every week, Monday 00:00
  Lagos time. The daily "Top gifted today" shelf stays as it is. Past weeks are kept for the analytics.
- **Points** (owner): **1 point per ₦100 spent on gifts**, as a running serial count per sender (`giftPoints/{uid}`:
  total, thisWeek). They feed fan levels with each creator (1 point per ₦100 already) and the sender's own lifetime count.

**Data:** `gifts/{ref}` gains `toKind` (host / speaker / commenter / replayHost), `context` (live / journal / media / replay),
`quantity`, `archivedAt`. `giftWeekly/{week}_{uid}` and `gifterWeekly/{week}_{publisherUid}_{uid}`. `withdrawals/{id}` (uid,
amountKobo, entries[], status: auto / waiting / approved / paid / failed).

---

## Phase 3: the weekend incentive pool and the Top gifters sprint

**Legal first.** Both rewards are **merit contests**, never chance draws (owner, 4 Nov):
- the **Top gifters sprint** (most gift points in a set time)
- the **Top activity board** (most activity points over the weekend)

There is no random draw anywhere in P3. That is lower risk than a lottery. But it is still a **sales promotion**: rewards of cash
value, tied to activity that includes paying. So counsel must confirm both under the FCCPC's promotion rules before launch.
Until counsel signs off, P3 runs with staff accounts only, behind the staff test pass.

### The weekly calculation (Thursday 23:59 → Friday 00:00, Lagos time)
1. **Gift commission this week:** what NotesApp kept from gifts, Friday 00:00 to Thursday 23:59, uplifted rates included.
2. **Infrastructure cost this week:** API, servers, relay, Firestore, Vercel, Cloudflare. §3 below says where each figure comes from.
3. **The test** (owner: "80% above our infrastructure"): gift commission ≥ **1.8 ×** infrastructure cost (`poolTestRatio`,
   default 1.8).
4. **The pool:** if it passes, **10% of that week's gift commission** goes into the weekend pool (`poolSharePct`, default 10).
   If it fails, there's no pool that weekend. A pool under `poolMinKobo` (default ₦50,000) rolls into next week instead.
5. **The split:**
   - **60%** to Top gifters sprint prizes (`sprintSharePct`).
   - **40%** to the Top activity board (`activitySharePct`).
   - A sprint budget that can't fill a whole prize ladder rolls into next week's pool.

### The Top gifters sprint
- **When:** the weekend runs **Friday 18:00 to Sunday 23:00**. The system starts a sprint at a peak: concurrent viewers across
  lives, replays, journals and Media at least `burstFactor` (1.5) × the weekend's running average, with sprints at least
  `sprintGapHours` (3) apart.
- **Where it doesn't count:** never on paid lives or pay-per-minute sessions (owner). Gifts there don't count towards a sprint.
- **The announcement:** a sitewide banner on every open page: "Top gifters sprint: the top 3 gifters by points in the next
  10 minutes win VIP gifts", with a countdown to zero (`sprintMinutes`, default 10).
- **Points:** gift points earned during the sprint (1 point per ₦100), from gifts to other people anywhere on #NotesApp except
  paid lives and pay-per-minute. A tie goes to whoever reached the score first.
- **The leaderboard:** for the top 100 by points so far, a sheet shows:
  - their position, the timer, their points
  - **how many points they need to reach #3, #2 and #1**

  Everyone else sees the top 10 and "Gift to join".
- **Winners:** when the timer hits zero, the top 3 win the prize ladder (`sprintPrizes`, default #1 Kente Crown ₦50,000, #2 and
  #3 Golden Gele ₦25,000; ₦100,000 a sprint). A winner needs at least `sprintMinPoints` (default 50 points, ₦5,000 of gifts);
  an unwon prize rolls over. The VIP gift plays full screen for them, and a sitewide banner names the three winners.
- **How the prize is paid:** credited as **bonus credit** of the gift's value (can't be gifted on or withdrawn), unless the owner
  chooses otherwise.
- **Number of sprints:** floor(sprint budget ÷ ₦100,000), at most `sprintMax` (default 6) a weekend.
- **Caps and anti-abuse:**
  - one sprint win per person per weekend
  - accounts at least 30 days old with a verified email
  - gifts between accounts sharing a device or bank account don't count
  - accounts with a gift reversal or chargeback in 90 days can't win
  - teens can't win
  - staff only while the staff test pass is on

### The Top activity board (the 40%)
Merit, not chance: the most active members of the weekend win bonus credit.

**Activity points**, counted Friday 18:00 to Sunday 23:00. The daily caps are the fan-level caps, so they can't be farmed:

| Action | Points | Daily cap |
|---|---|---|
| Share of a post, item, course, Media post or replay | 10 | 5 shares (50 points) |
| Comment | 3 | 10 comments (30 points) |
| Reaction | 1 | 20 reactions (20 points) |
| Premium (non-VIP) gift | 1 per ₦100 | none |

- Most a member can earn without gifting: 100 a day, 300 a weekend. Premium gifts add on top. VIP gifts count for the sprint
  instead, not here.
- Only actions on **other people's** content count. Comments must stay up (not deleted or removed after a report) and be at
  least `activityMinChars` (default 15) characters. An undone reaction doesn't count.

**Winners** (`activityWinners`, default 200), ranked when the weekend closes on Sunday at 23:00 and announced with the board.
A tie goes to whoever reached the score first. A winner needs at least `activityMinPoints` (default 30).

| Rank | Bonus credit each | Winners | Total |
|---|---|---|---|
| #1 | ₦5,000 | 1 | ₦5,000 |
| #2–10 | ₦3,000 | 9 | ₦27,000 |
| #11–30 | ₦1,500 | 20 | ₦30,000 |
| #31–80 | ₦600 | 50 | ₦30,000 |
| #81–200 | ₦200 | 120 | ₦24,000 |
| **All** | | **200** | **₦116,000** |

- Every prize is between ₦100 and ₦5,000, and **₦5,000 is the cap per person per weekend**.
- When the activity budget is smaller than the ladder, ranks are paid from the top down until it runs out. When it's bigger, the
  rest rolls into next week's pool.
- Paid as **bonus credit**: usable on boosts, the badge and ads, but it can't be gifted on or withdrawn.
- **Anti-abuse:**
  - accounts at least 30 days old with a verified email
  - one prize per device and per bank account
  - no points for actions between accounts that share a device or bank account
  - no points for actions on your own content
  - teens are excluded
  - accounts with a gift reversal or chargeback in 90 days are excluded
  - staff are excluded unless the staff test pass is on

### Worked example A (qualifies)
| | Figure |
|---|---|
| Gifts sent this week (gross) | ₦20,000,000 |
| Gift commission kept (average effective rate about 15%) | ₦3,000,000 |
| Infrastructure cost this week | ₦1,200,000 |
| Test: 3,000,000 ≥ 1.8 × 1,200,000 = 2,160,000 | **passes** (ratio 2.5) |
| Pool: 10% × ₦3,000,000 | **₦300,000** |
| Sprints (60%) | ₦180,000: **1 sprint** at ₦100,000 (Saturday at peak); ₦80,000 rolls into next week |
| Top activity (40%) | ₦120,000: the full ladder, **200 winners**, ₦116,000; ₦4,000 rolls into next week |

### Worked example B (doesn't qualify)
| | Figure |
|---|---|
| Gifts sent this week (gross) | ₦6,000,000 |
| Gift commission kept | ₦900,000 |
| Infrastructure cost this week | ₦600,000 |
| Test: 900,000 ≥ 1.8 × 600,000 = 1,080,000 | **fails** (ratio 1.5) |
| Pool | ₦0. No sprints and no activity board this weekend, and nothing is announced. |

---

## §3. Where the infrastructure figure comes from

Honest status per source:

| Cost | Read automatically? | How |
|---|---|---|
| Google Cloud (Firestore, Cloud Run recorder) | Yes, with set-up | Cloud Billing export to BigQuery, read weekly |
| Cloudflare (relay, TURN, Stream, Workers, R2) | Usage yes, money no | GraphQL Analytics gives GB and minutes; we multiply by the prices entered in Admin |
| Vercel | Partly | The usage API reports usage for Pro teams; the plan fee is entered by hand |
| AI and other APIs (Anthropic, NKENNEAi, Resend, SMS) | Mostly no | Admin-entered monthly figures |
| Paystack and bank fees | Not infrastructure | Excluded from the test |

To start: Admin enters each **monthly** cost in naira (with the dollar rate used); the job prorates by days (× 7 ÷ days in
month). As each automatic source is connected it replaces its hand-entered line, and the Admin page shows which lines are live
and which are typed.

---

## Phase 4: Nana minutes (the session notetaker)

**Recommended and approved by the owner (4 Nov): Nana minutes, recorded on the host's own device.** The relay and recorder are
only the fallback, for group calls or when the host's device can't record.

The owner first asked for a standalone Nana minute-taker app that joins after the call connects, with encryption off. We do it
inside the NotesApp call instead, and encryption stays on.

**Why:**
- **One app can't record another app's call:** on iOS and Android, an app can't capture another app's call audio; both
  platforms block it.
- **Encryption doesn't need to come off:** the host's own NotesApp already has both audio streams, their microphone and the
  other person's incoming audio.

**How it works:**
- **Recording on the host's device:** the host's NotesApp records the two streams mixed together (Web Audio mix →
  MediaRecorder). The call stays phone to phone and encrypted in transit (DTLS-SRTP).
- **Consent:** when the host taps **Nana minutes**, both people hear a short tone and see "This call is being recorded for
  notes". The other person can tap Leave; staying counts as agreeing, and a "● Recording for notes" badge shows throughout.
  The host can stop it at any time.
- **Afterwards:** the audio is uploaded to our private storage and transcribed by the pluggable transcriber. Nana writes the
  minutes: a summary, decisions, action points with owners, and any follow-up date. The minutes go to **both people**, in their
  messages and by email, and to the host's Business books client record if they use it.
- **Deletion:** the audio is deleted once the transcript is made (`minutesKeepDays`, default 0).
- **Fallback:** for group calls, or when the host's device can't record (an older iPhone browser, or the app is in the
  background), the relay and our Cloud Run recorder join as a silent, receive-only participant with the same consent banner.
- **Price:** free on Business and Enterprise; `minutesKobo` per session on other plans.
- **Limits:**
  - NKENNEAi takes files of up to 25 MB, so long sessions are split into parts.
  - Recording on the device stops if the phone locks the browser. The app warns the host to keep the screen on, and the upload
    sends what was recorded.

---

## Phase 5: Notes Life TGIF, "Thank God It's Friday" (Fridays only)

A Friday celebration in Notesville, paid **only in Notesville Naira** (game money), never real money, so it isn't a cash
promotion. Budget: `tgifPoolNn` per Friday, set in Admin.

- **The look:** from Friday 16:00 (after work) to 23:59, Notesville turns into a Friday-evening party.
  - The banner reads **"Thank God It's Friday"**.
  - Street lights and string lights come on early, and highlife and Afrobeats play on the street.
  - After-work hangout spots light up: the Emerald lounge, the hotel pool, suya by Wuse Market, the rooftop.
  - Morning to 16:00 shows a "TGIF tonight" teaser.
- **Happy hour:** two hours on Friday evening (`tgifHappyHours`, default 17:00–19:00) when the chef, street and errand jobs pay
  double Notesville Naira.
- **Friday drops:** at random moments a party drop lands at a hangout spot. The first `tgifDropClaims` players (default 20) to
  walk there claim it, each getting N$50–N$2,000, skewed small.
- **Friday streak:** playing three Fridays in a row unlocks a TGIF outfit or rug. Cosmetic only.
- **Caps and anti-abuse:** caps per player per Friday, and one account per device, so no farming with second accounts.

---

## December: public lives and the challenge

- Lives open to the public, not only paid lives and pay-per-minute.
  The free **Go live from your profile** is planned, with mockups, in [GO_LIVE.md](GO_LIVE.md); the team tries it first (staff test pass).
- The **challenge dashboard** shows each creator whether they qualify for the #1MillionNairaNotesAppChallenge (from listening
  time, gifts and fan figures).
- A qualified creator **applies**, then promotes their challenge-attempt event. They can pay for ads or boosts, or **apply for
  NotesApp promotion support** (a review queue in the team hub).
- Video limits rise with gifts: each `videoBoostStepKobo` of gifts in a live (default ₦50,000) adds `videoBoostMinutes`
  (default 15) to that live's video budget, up to a cap. Live gift analytics feed the giveaway mega-launch plan.

---

## Admin settings added (all editable, all audit-logged)

These are new.

**Live economy page**
- **Pool:** `poolTestRatio` 1.8, `poolSharePct` 10, `poolMinKobo` ₦50,000.
- **Weekend timing:** `weekendStart` Fri 18:00, `weekendEnd` Sun 23:00.
- **Sprints:** `burstFactor` 1.5, `sprintGapHours` 3, `sprintMinutes` 10, `sprintPrizes` (#1 Kente Crown, #2 and #3 Golden Gele), `sprintMinPoints` 50, `sprintMax` 6.
- **Split:** `sprintSharePct` 60, `activitySharePct` 40.
- **Activity board:** `activityWinners` 200, `activityMinPoints` 30, `activityMinChars` 15, the prize ladder (₦5,000 / 3,000 /
  1,500 / 600 / 200), and a ₦5,000 cap per person per weekend. Point values and daily caps come from fan levels.
- **Eligibility:** account age 30 days.
- **Infrastructure:** the monthly cost lines and the dollar rate.

**Pricing**
- `liveTicketUpliftPct` 10
- `ppmUpliftPct` 20
- `minutesKobo`
- `videoBoostStepKobo` ₦50,000, `videoBoostMinutes` 15

**Limits**
- `lateWindowMin` 20
- `ppmMinMinutes` 10
- `quantityMaxPerSend` 99
- `autoWithdrawMaxKobo` ₦20,000
- `minutesKeepDays` 0
- `tgifPoolNn`, `tgifDropClaims` 20

---

## Owner decisions (4 Nov 2026)
1. **Sprint prizes are real gifts the winner can withdraw** (not bonus credit). They count as the winner's earnings, go through the
   same 7-day review and payout rules, and are paid from the weekend pool.
2. **Teens are blocked from receiving money gifts from strangers.** A member in teen mode can receive gifts only from people they
   follow back (mutual followers); everyone else sees the gift button switched off for them. Teens still can't win cash-value prizes.
3. **Subscribers get a discount on paid-live tickets.** The publisher sets the discount per tier once, when setting up their
   subscription tiers (Rates & payouts → Subscriptions, beside each tier's price; e.g. Premium 10%, VIP 20%, VVIP 30%; 0–100%,
   admin-capped), not per live. It applies to every paid live on top of whichever price stage applies (early bird, normal, late).
4. **Nana minutes are paid on every plan** (price per session minute set in Admin; billed to the host from NotesApp Credit).
5. **Weekly boards reset at midnight going into Monday** (Lagos time).
6. **Counsel for the FCCPC check is Legal** (the Legal department on the team hub): the sprint and the activity board stay staff-only
   until Legal signs off.

**5 Nov 2026, moderation in lives:** a community's own moderators keep their chat powers only in lives hosted as community lives. In a member's own live inside a community (paid lives and pay-per-minute included), they have no moderation powers unless that host names them; only the community owner can moderate there.
