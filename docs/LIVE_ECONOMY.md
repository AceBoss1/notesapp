# Live economy: paid lives, pay-per-minute, gifting everywhere and the weekend incentive pool

**Status:** plan, for the owner's approval with the mockups in this branch's description. Nothing here is built yet.
**Owner's decisions:** 3 and 4 November 2026, quoted where they set a rule.
**Rule for every number below:** it is a default. Each one is editable in Admin (Pricing, Limits or the new Live economy page), and
the help and public pages read the live value, never a figure typed into them (`tests/help/live-figures.test.ts`).

---

## 0. What already exists and is reused

| Piece | Where | Used for |
|---|---|---|
| Audio rooms with video (Live mode), poster, video-minutes budget | `lib/rooms*.ts`, `lib/rooms-live*.ts` | Every live: free, paid and pay-per-minute |
| Cloudflare relay (SFU) for rooms, TURN for calls | `lib/rooms-relay-server.ts`, `lib/calls-server.ts` | Lives at scale; the session notetaker (P4) |
| Live chat on a Durable Object, listener counts, `listenTime` | `workers/live-rooms`, `lib/live-rooms*.ts` | Who is present (drops, sprinkles, the 20-minute late window) |
| Recording with consent, replays on Stream | `lib/live-recording*.ts`, `services/room-recorder` | The recording choice on a paid live; the notetaker's audio |
| Pluggable transcriber, Nana summary | `Transcriber` in `lib/live-recording-server.ts` | Notetaker transcripts and summaries |
| Animated gifts, VIP gifts, sitewide burst, uplift on commission | `lib/gift-catalogue.ts`, `lib/gifts-server.ts` | Gifting everywhere, the drops (P3) |
| Event tickets with reminders | `lib/tickets*.ts`, `lib/events-server.ts` | Paid-live tickets and their reminders |
| Bookings, paid sessions, `PAYOUT_HOLD_HOURS` (24 h problem window) | `lib/bookings-server.ts`, `lib/cancellation.ts` | Pay-per-minute sessions |
| NotesApp Credit, bonus credits (`BONUS_KINDS`) | `lib/wallet*.ts` | Paying for lives and minutes; sprinkles are paid in bonus credit |
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

## Phase 3: the weekend incentive pool

**Legal first.** Random prizes of cash value given to people because they took part in paid activity may count as a **sales
promotion** (FCCPC approval needed before it runs) or a **lottery** (the National Lottery Act, and since the Supreme Court's
November 2024 ruling, the states' gaming laws such as Lagos). Counsel must review the mechanics and the terms **before P3
goes live**. Until then P3 can be built and run with staff accounts only, behind the staff test pass.

### The weekly calculation (Thursday 23:59 → Friday 00:00, Lagos time)
1. **Gift commission this week** = what NotesApp kept from gifts Friday 00:00 to Thursday 23:59 (the uplifted rates included).
2. **Infrastructure cost this week** (see §3 below for where each figure comes from): API, servers, relay, Firestore, Vercel,
   Cloudflare.
3. **The test** (owner: "80% above our infrastructure"): gift commission ≥ **1.8 ×** infrastructure cost (`poolTestRatio`,
   default 1.8).
4. If it passes, **10% of that week's gift commission** goes into the weekend pool (`poolSharePct`, default 10). If it fails,
   there is no pool that weekend. A pool under `poolMinKobo` (default ₦50,000) rolls into next week instead of running.
5. The pool is split: **60% VIP-gift drops**, **40% bonus-credit sprinkles** (`dropSharePct` 60).

### Where drops and sprinkles happen
- The weekend runs **Friday 18:00 to Sunday 23:00** (53 hours; `weekendStart`, `weekendEnd`).
- **Burst windows:** every 5 minutes the system compares lives, replays, journals and Media pages against the hour's normal. A
  window is a burst when concurrent viewers are at least `burstFactor` (default 1.5) × the weekend's running average. Drops only
  fire inside bursts, at least `dropGapHours` (default 3) apart.
- **Never** on paid lives or pay-per-minute sessions (owner).
- **VIP-gift drop:** the system picks, at random, one of the biggest gifters in the burst (the top `dropCandidates`, default 10,
  by gift points in the last hour). It "gifts" them a random VIP gift that fits the drop budget. The gift plays full screen
  where they are, and the sitewide banner says "Incentive drop: @name just received a Kente Crown from #NotesApp", with a link.
  Two minutes earlier, the place shows "An incentive drop is about to happen here".
  - The value is paid to the winner as **bonus credit** (it can't be gifted on or withdrawn), so the drop never becomes
    withdrawable cash. Owner to confirm (open questions).
- **Sprinkles:** at the same moment, a share of the people present (`sprinkleSharePct`, default 30%, verified and eligible) get
  bonus credit between ₦100 and ₦5,000:
  - 70% of winners get ₦100–₦500.
  - 25% get ₦500–₦2,000.
  - 5% get ₦2,000–₦5,000.
  - Expected value per winner: 0.7 × ₦300 + 0.25 × ₦1,250 + 0.05 × ₦3,500 ≈ **₦700**.
- **Caps per person per weekend:** one VIP drop, and ₦5,000 of sprinkles in total.
- **Eligibility and anti-abuse:**
  - accounts at least 30 days old with a verified email
  - one prize per device and per bank account
  - no prizes when sender and receiver share a device or bank (self-gifting farms)
  - accounts with a gifting reversal or chargeback in 90 days are excluded
  - teens are excluded from cash-value drops
  - staff are excluded unless the staff test pass is on (then only staff)

### Worked example A (qualifies)
| | Figure |
|---|---|
| Gifts sent this week (gross) | ₦20,000,000 |
| Gift commission kept (average effective rate about 15%) | ₦3,000,000 |
| Infrastructure cost this week | ₦1,200,000 |
| Test: 3,000,000 ≥ 1.8 × 1,200,000 = 2,160,000 | **passes** (ratio 2.5) |
| Pool: 10% × ₦3,000,000 | **₦300,000** |
| Drops (60%) | ₦180,000 |
| Sprinkles (40%) | ₦120,000 |

- **Drops:** 5 bursts across the weekend, about ₦36,000 each.
  - The draws (₦150,000 in all): Fri 9 pm Golden Gele ₦25,000; Sat 1 pm Golden Gele ₦25,000; Sat 9 pm Kente Crown ₦50,000; Sun 5 pm Golden Gele ₦25,000; Sun 9 pm Golden Gele ₦25,000.
  - The ₦30,000 left rolls into next week's pool.
- **Sprinkles:** ₦120,000 ÷ about ₦700 each ≈ **170 winners**, about 34 per burst, from roughly 110 eligible people present at each.

### Worked example B (doesn't qualify)
| | Figure |
|---|---|
| Gifts sent this week (gross) | ₦6,000,000 |
| Gift commission kept | ₦900,000 |
| Infrastructure cost this week | ₦600,000 |
| Test: 900,000 ≥ 1.8 × 600,000 = 1,080,000 | **fails** (ratio 1.5) |
| Pool | ₦0. No drops this weekend; nothing is announced. |

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

## Phase 4: the session notetaker

Booked sessions run on the NotesApp call (phone to phone; paid sessions and pay-per-minute alike).

| Option | How | Verdict |
|---|---|---|
| A. Recorder joins | The session runs through the relay (SFU) instead of phone to phone; our Cloud Run recorder joins as a silent, receive-only participant and records audio only. The transcriber turns it into text, and Nana writes a summary and action points. | **Recommended** |
| B. Host's browser records | MediaRecorder on the host's device | Unreliable (phone sleeps, tab closes), and only the host's side is reliable |
| C. Outside notetaker bot | Otter, Fireflies and similar | Data leaves our control; no fit with our consent rules |

**Recommendation: A.**
- The notetaker is offered when booking ("Add notetaker", price `notetakerKobo`, default free on Business+).
- Both people must agree, before the call and again on screen.
- Audio is deleted once the transcript is made (`notetakerKeepDays`, default 0).
- Transcript and summary go to both people, in their messages, and to the publisher's Business books client record if they use it.
- Cost:
  - Relay: about ₦0.10 a minute for two people on voice.
  - Recorder: Cloud Run minutes.
  - Transcription: NKENNEAi, which today only takes files up to 25 MB, so long sessions are split into parts.

---

## Phase 5: Notes Life TGIF (Fridays only)

Funded in **Notesville Naira** (game money), never real money, so it isn't a cash promotion.
Budget: `tgifPoolNn` per Friday, set in Admin.

- **TGIF banner** from Friday 06:00 to 23:59: the city wears Friday colours and plays highlife on the street.
- **Happy hour:** two random hours on Friday, when the chef and street jobs pay double Notesville Naira.
- **Friday drops:** at random moments, a drop lands in a busy spot (the market, the Emerald, the hotel pool). The first `tgifDropClaims` players (default 20) to walk there claim it. Each claim is N$50–N$2,000, skewed small like the sprinkles.
- **Friday streak:** playing three Fridays in a row unlocks a TGIF outfit or rug. Cosmetic only.
- Caps per player per Friday, and the same anti-abuse as P3: one account per device, so no farming with second accounts.

---

## December: public lives and the challenge

- Lives open to the public, not only paid lives and pay-per-minute.
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
- **Pool:** `poolTestRatio` 1.8, `poolSharePct` 10, `poolMinKobo` ₦50,000, `dropSharePct` 60.
- **Weekend timing:** `weekendStart` Fri 18:00, `weekendEnd` Sun 23:00.
- **Bursts and drops:** `burstFactor` 1.5, `dropGapHours` 3, `dropCandidates` 10.
- **Sprinkles:** `sprinkleSharePct` 30, the band shares (70/25/5) and limits (₦100–500 / 500–2,000 / 2,000–5,000), per-person
  weekend caps.
- **Eligibility:** account age 30 days.
- **Infrastructure:** the monthly cost lines and the dollar rate.

**Pricing**
- `liveTicketUpliftPct` 10
- `ppmUpliftPct` 20
- `notetakerKobo`
- `videoBoostStepKobo` ₦50,000, `videoBoostMinutes` 15

**Limits**
- `lateWindowMin` 20
- `ppmMinMinutes` 10
- `quantityMaxPerSend` 99
- `autoWithdrawMaxKobo` ₦20,000
- `notetakerKeepDays` 0
- `tgifPoolNn`, `tgifDropClaims` 20

---

## Open questions for the owner
1. VIP-gift drops: pay the winner the gift's value as **bonus credit** (not withdrawable, safest), or as a real gift they can
   withdraw?
2. Teens and money gifts from strangers: block them (recommended) or allow?
3. Do subscribers get a discount on paid-live tickets, or only access?
4. Notetaker: free on Business and Enterprise and paid on other plans, or paid for everyone?
5. Weekly boards reset on **Monday 00:00** (proposed) or right after the Thursday calculation?
6. Counsel: who reviews P3 before it switches on, and do we apply to the FCCPC for promotion approval or run it as a
   loyalty programme?
