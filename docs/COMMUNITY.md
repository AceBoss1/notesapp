# Community

Like a Facebook group with a channel, run by an organisation's own admins: churches, NGOs, schools, clubs and associations with many
members. Phase 1 is live (v0.71.0): `/community`, `/c/<id>`, `/events`; the rules are `lib/community.ts` and `lib/events.ts`.

## Decisions (owner, 19 Oct 2026)

| Question | Decision |
|---|---|
| Who can start a community | Any account. It shows the default notice ("This community hasn't been verified yet…") until the organisation is verified; verification removes it. |
| Plans and limits | Free up to 200 members (Spaces, General, Events). Business: unlimited members and private Circles. Live streaming: a paid add-on. |
| General chat | An announcement channel: admins post, members react and comment. |
| What non-members see (20 Oct 2026) | The admins choose: a public home, the General channel in public with slow mode, a Join or invite button (when joining is on), About and Contact. Members get the full group (posts, Circles, Events, the member list). Admins can **view as** a non-member, member, moderator or admin. See also [SITES.md](SITES.md), the Community theme. |
| Live | Start with Join live links (YouTube Live, Facebook Live, Zoom, Google Meet) on events; our own streaming (Cloudflare Stream Live) later, as the add-on. |
| Names | **Community**, with **Spaces** (public or members only) and **Circles** (private rooms). "Groups" stays the name of group chats in Messages. (The owner first chose "Network", then "Circles", which doesn't clash with the logistics network.) |
| Giving | In scope (phase 2). Charges look like bank charges and are cheaper wallet to wallet: the charges below, approved by the owner on 19 Oct 2026. |

## Phases

1. **Community, Spaces and Events** (built, v0.71.0; also built: insights, slow mode, View as, what non-members see. Not yet: an Events tab on
   profiles and Upcoming events in Explore (events are listed on `/events` by state and city), reports from inside a community to #NotesApp).
   - Members and roles: owner, admins, moderators and members. Joining is open, by approval or by invite link, with optional join questions.
   - Public and members-only Spaces. Members-only posts never reach Explore, search, Open Graph previews, the sitemap, the Weekly Digest, Nana or the MCP server.
   - The General announcement channel.
   - Circles on Business, using today's group chats (up to 50 people).
   - Events for every account: RSVP (Going / Interested), reminders 24 h and 1 h before (bell, push, email), .ics, repeating events, an Events tab on profiles and Upcoming events in Explore (public only, by state and city).
   - Join live links on events.
2. **Bigger rooms, giving and tickets.**
   - Circles without the 50-person cap. That needs a channel model: membership kept in its own collection rather than the `participants` array, and push sent in batches.
   - Giving.
   - Paid event tickets with QR check-in, reusing checkout and the ledger.
3. **Our own live streaming, then group meetings.**
   - Live streaming through Cloudflare Stream Live: RTMPS or SRT from OBS or a phone, WHIP from the browser, HLS to viewers, and the recording kept as a replay in the members-only Space. Cost is per minute watched, so it is the add-on.
   - Group video meetings need an SFU (LiveKit, Cloudflare Realtime, Daily).

## Giving: charges (approved by the owner, 19 Oct 2026)

- **From the wallet:** a flat charge in bands, as for a Nigerian bank transfer: ₦10 up to ₦5,000, ₦25 up to ₦50,000, ₦50 above.
  - The donor can choose to cover it.
  - Payouts to the organisation are batched, so one transfer covers many gifts and the band charge is our margin.
- **By card or bank transfer (Paystack):** Paystack's own charge at cost, shown as "card charge", plus the same band.
  - This is always a little more than the wallet, which nudges givers to the wallet.
  - Check Paystack's current rates before launch.
- **Commission:** none on top of the bands. Admin → Pricing would hold the bands.
- **Receipts:** every gift gets one.
- **Payouts:** only to the organisation's verified bank account.
- **Unverified communities:** giving waits for verification, or is capped until then.
