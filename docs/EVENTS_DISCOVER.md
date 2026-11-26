# 🎟️ Discover events, and events, meetings and sessions with their prices

The owner asked on 26 Nov 2026, with a screenshot of an event discovery page and a plan-pricing page as the idea: "scaffold and show me
sample screenshot before build; adjust events to look like attached screenshot; adjust booking to appear as events/meetings/session with
Pricing". **Status: built in v0.210.0 (26 Nov 2026)** after the owner's "Decisions approved, build with your recommendations", with "the bookings section of events/meetings/sessions should support physical and virtual" and "Should we have event kit/theme too" (yes: themes and the African pattern). What was built, and what changed, is at the end.

## Today

- **Events** (`lib/events.ts`, `components/events/`): title, time, place, state and city, a Join live link, repeats, public or
  members-only, Going and Interested, reminders 24 hours and 1 hour before, and paid tickets (`lib/tickets.ts`: ticket types, up to 10 an
  order, QR codes and check-in; ₦10 / ₦25 / ₦50 a ticket by price band, no commission, card charge at cost).
- **No cover pictures, categories, city pages, or calendars to follow.** `/events` is a short list (`EventsHub`) and an explainer.
- **Booking** (`/booking`) explains 1:1 sessions only: the publisher's price (₦5,000–₦500,000), length and weekly times, with the plan's
  commission (live: Free Basic 20%, Pro 15%, Business 8%, Enterprise from 6%).
- **No group meetings** (a set time, several paid seats).

## The mockups

- Discover events: [all-screens.webp](mockups/events-discover/all-screens.webp) ([HTML](mockups/events-discover/mockups.html))
  1. Discover events: featured events for your city, categories with counts, calendars to follow, events by city
  2. An event page with a cover, tickets, who's going and its calendar
  3. A calendar to follow
  4. Create: an event, a meeting or sessions, each with its price
  5. A new event with a cover, category, calendar, approval and a guest limit
- Events, meetings and sessions, and pricing: [all-screens.webp](mockups/events-pricing/all-screens.webp)
  ([HTML](mockups/events-pricing/mockups.html))
  1. /booking as "Events, meetings and sessions"
  2. An events-and-bookings section on /pricing, plan by plan, with invitation add-ons

## Decisions for the owner

Each has a recommendation; the build follows it unless the owner says otherwise.

| Question | Recommendation |
|---|---|
| What we take on tickets | **Keep today's ₦10–₦50 a ticket, no commission, on every plan.** It is already lower than a percentage fee, and the owner chose it so events bring members. |
| Meetings (new) | Paid seats at **the plan's session commission** (20 / 15 / 8 / from 6%); 2 to 50 seats; on #NotesApp video (group calls) or the host's link. Free meetings cost nothing. |
| Categories | The 12 on the sheet (Faith, Business & careers, Tech, Education, Food & drink, Arts & culture, Fitness & running, Health & wellness, Family & kids, Music & nightlife, Networking, Community & causes). Every event picks one. |
| Cities | Nigeria's states first (the cities with the most events shown), then Rest of Africa, Diaspora and Online as events are posted there. A city appears once it has 3 upcoming public events. |
| Calendars | Every profile, community and organisation has one, at `/u/<name>/events`. Follow sends a bell and an email when a new event goes up. |
| Featured events | Upcoming public events in the visitor's city with the most Going in the last 7 days, never members-only; Admin can pin one. |
| Invitations | **New:** invite people who aren't registered yet (from your followers, members or a pasted list) and send event newsletters. Weekly allowance: 500 Free Basic, 2,000 Pro, 5,000 Business, agreed on Enterprise; messages to people already on the guest list are always unlimited. Add-ons ₦10,000 / ₦25,000 / ₦45,000 a month for 10k / 25k / 50k. |
| Extras by plan | Approval to join, guest limits and co-hosts on every plan; check-in helpers and registration questions from Pro; events on your own domain and 5 calendar admins on Business; API and webhooks on Enterprise. |
| Cover pictures | Uploaded like Media pictures, with the NotesApp mark, through the content checks. |

## Build order (after approval)

1. `lib/events.ts`: category, cover, approval, guest limit, calendar; the discover queries (featured, by category, by city) with counts
   kept on a daily rollup so the page doesn't read every event. Tests.
2. `/events` as Discover, the event page, the calendar page with Follow, the Create chooser and the new event form.
3. Meetings: `lib/meetings.ts` (seats, price per seat, the plan's commission, cancellation), booking and payment through the existing
   checkout, reminders, the group call room. Emulator tests.
4. Invitations with weekly allowances and add-ons (Admin → Pricing), sent by email and the bell.
5. `/booking` as Events, meetings and sessions; the events-and-bookings section on `/pricing`; help articles, changelog, README,
   HANDOVER, BUILD_LOG.

## Built in v0.210.0

Screenshots from the real code on the emulators (sample data): [Discover](mockups/events-built/1-discover.webp), [a category](mockups/events-built/1b-category.webp),
[an event](mockups/events-built/2-event-page.webp), [a calendar](mockups/events-built/3-calendar.webp), [Create](mockups/events-built/4-create.webp),
[a new event](mockups/events-built/4b-new-event.webp), [a meeting](mockups/events-built/5-meeting.webp), [Booking](mockups/events-built/6-booking.webp),
[Pricing](mockups/events-built/7-pricing-events.webp), [Invite people](mockups/events-built/9-invite-host.webp).

- **The kit** `lib/event-kit.ts` (pure): the 12 categories, 8 themes and the African pattern, where (in person / online / both; online
  on #NotesApp or the host's link), Discover's places and regions, featured events and the counts.
- **Events** (`lib/events.ts`, `lib/events-server.ts`): category, cover (marked, purpose `event`, checked with the event), theme,
  format, approval (free events only: Going becomes a request; `joinRequests`, `decideRequest`), guest limit, `priceFromKobo` for cards.
  The online link of an event with tickets or approval is only for people who are in (`getEvent`), and lists never carry it.
  Followers hear of a new public event (`eventAnnouncements`, sent by the reminders cron in batches).
- **Discover** (`lib/events-discover-server.ts`, `components/events/Discover.tsx`): one statCache snapshot every 10 minutes;
  `/api/events?discover=1&city=` and `?list=1&category=&city=&region=`. Calendars to follow are the hosts with the most people going.
- **Calendars** `/events/calendar/<username>` with Follow (the account follow) and a subscribable feed `/api/events/calendar/<username>`.
- **+ Create** `/events/new`: an event, a meeting or sessions, each with its live price.
- **Meetings** (`lib/meetings.ts`, `lib/meetings-server.ts`, `/api/meetings`, `/meetings/new`, `/meetings/<id>`): 2–50 seats, free or ₦500–
  ₦500,000 a seat, in person / online (the host's link) / both; paid seats are payments of kind `meeting` at the host's session
  commission, held to the end; refunds by `refundFraction` (host cancelling: full); reminders a day and an hour before.
- **Sessions in person or online**: `session.where` on Rates & payouts; the address and link are in `sessionPlaces/{uid}`
  (server-only, as publisher settings are public) and copied onto the booking; hybrid lets the client choose. A booked online session
  on #NotesApp lets the two call each other from 15 minutes before to 15 after (`lib/calls-server.ts bookedSessionNow`).
- **Invitations** (`lib/event-invites.ts`, `lib/event-invites-server.ts`, `/api/event-invites`): followers and pasted emails, the
  week's allowance by plan from Admin → Pricing → Event invitations, packs (payment kind `invite_pack`, 31 days), sent in batches.
- **Pages:** `/booking` is Events, meetings and sessions; `/pricing#events` is the plan-by-plan section.
- **Tests:** `npm run test:events-discover` (pure) and `npm run test:events-discover-server` (emulator), both in CI; the rules test.

## Changed from the mockups

- **Meetings online on #NotesApp** (owner, 26 Nov 2026: "with the Cloudflare it has 10,000 capacity"): a meeting room is a profile live on
  the Cloudflare relay with `profile.meetingId`; `mayWatchProfileLive` lets in only the host and people with a seat. The host opens it
  from 30 minutes before (`startMeetingRoom`); seat holders get a bell. The host's own link stays an option.
- **Meetings don't repeat yet** (owner: "OK"); **Set up the next one** (`/meetings/new?from=<id>`, a week on) and New meeting's "start from
  your last meeting" (`/api/meetings?last=1`) make a weekly meeting two taps.
- **Admin can't pin a featured event yet** (owner: "OK"): featured is pinned (the `pinned` field) then most Going this week, then soonest.
- **Discover's counts are up to 10 minutes behind** (owner: "OK").
- **Discount codes and referrals** (owner: "REFERRAL and DISCOUNT SHOULD ALWAYS WORK"): new targets `meeting` and `ticket` (the host's
  codes) and `invite_pack` (#NotesApp's codes) in `lib/discounts.ts`, applied at checkout; an invitation pack records a referral
  earning like a plan (`recordPlanEarning`).

## Owner steps

- `firebase deploy --only firestore:rules,firestore:indexes` (new server-only collections, and indexes for join requests and meetings).
- Check the invitation allowances and pack prices in Admin → Pricing → Event invitations.
