# 🎟️ Discover events, and events, meetings and sessions with their prices

The owner asked on 26 Nov 2026, with a screenshot of an event discovery page and a plan-pricing page as the idea: "scaffold and show me
sample screenshot before build; adjust events to look like attached screenshot; adjust booking to appear as events/meetings/session with
Pricing". **Status: sample screens, waiting for the owner's approval.** Nothing is built yet.

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
