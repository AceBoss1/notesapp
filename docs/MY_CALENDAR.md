# 📅 My Calendar

One calendar for everything a member has booked, bought or been invited to on #NotesApp. It sits in the menu and syncs to the phone's
own calendar. The owner asked for it on 14 Nov 2026: "there should be a my calendar in the menu which syncs with user default calendar
on device". **Status: built in v0.166.0** (mockups approved by the owner on 14 Nov 2026, "calendar approved build"). What was built, and what
wasn't, is at the end of this page.

## The mockups

All screens on one sheet: [all-screens.webp](mockups/my-calendar/all-screens.webp). HTML source: [mockups.html](mockups/my-calendar/mockups.html).

1. In the menu: "📅 My Calendar" with today's count ([1-in-the-menu](mockups/my-calendar/1-in-the-menu.webp))
2. Month and today, in the booking-calendar look, with a dot per kind ([2-month-and-today](mockups/my-calendar/2-month-and-today.webp))
3. A day, and one event, with "Add to my calendar" ([3-a-day-and-one-event](mockups/my-calendar/3-a-day-and-one-event.webp))
4. Sync to your phone's calendar: a private link, and a choice of what goes out ([4-sync-to-your-phone](mockups/my-calendar/4-sync-to-your-phone.webp))
5. In the installed app, events written straight into the phone's calendar ([5-installed-app](mockups/my-calendar/5-installed-app.webp))
6. Reminders, and two-way sync later ([6-reminders-and-later](mockups/my-calendar/6-reminders-and-later.webp))

## What goes in it

Each entry is read from where it already lives. Nothing is copied, so a change or cancellation shows everywhere.

- 1:1 sessions and pay-per-minute calls, as the client or the host.
- Hotel stays (check-in, nights, check-out). For hotel staff, their hotel's bookings.
- Event tickets and paid lives, plus community events the member said they're going to.
- Interviews from Notes Jobs.
- Money due in Business books. Off by default in the phone sync.
- My Cycle's predicted period. Only if she turns it on, and only ever as "Private". It is never sent anywhere without her choice.
- Teens and kids see only what their mode already allows.

## How syncing with the phone works

A website can't write into a phone's calendar app by itself, so there are three ways, from simplest to fullest:

1. **"Add to my calendar"** on any single entry, and on booking, ticket and interview confirmations and emails. It is a standard
   `.ics` invite that the phone opens in its own default calendar.
2. **A private calendar link** (`webcal://…/api/calendar/<token>.ics`).
   - iPhone Calendar, Google Calendar (Android's default) and Outlook subscribe to it and refresh it themselves.
   - iPhone checks about hourly; Google can take several hours.
   - The member chooses which kinds go out.
   - The token is long and random, and "Make a new link" stops the old one at once.
   - The feed carries titles and times only, never money amounts or private notes.
3. **The installed #NotesApp app** (Capacitor, `docs/MOBILE-APPS.md`).
   - With the member's permission, it writes events straight into the phone's default calendar.
   - Changes and cancellations update there too.
   - This needs an app update in both stores.

**Later:** connect Google or Outlook for two-way sync, so busy times in the phone's calendar block the member's own booking slots.
That needs Google's app verification for calendar access.

## Build order (after approval)

1. `lib/my-calendar.ts` (pure: gather entries, the `.ics` writer, tested) and `lib/my-calendar-server.ts` (reads each source, the
   private token).
2. The `/calendar` page and its menu entry, using `components/MonthCalendar.tsx`.
3. "Add to my calendar" on confirmations and in emails.
4. The private feed `/api/calendar/[token]`, and the sync settings.
5. Reminder settings.
6. The installed app's calendar plugin, in the next app release.
7. Public page, help article, changelog, HANDOVER and BUILD_LOG.

## Built in v0.166.0

- **The pure rules** `lib/my-calendar.ts`: the entry shape (`CalEntry`: kind, in-app title, feed title, start and end, all day, hotel
  stay, where, the link it came from), merge and sort (the same thing from two sources once), filters by kind, the day's agenda (a stay
  shows on its check-in and check-out days, nights shaded), the month's dots, who sees what (`allowedKinds`: teens get no Business books
  money, child profiles no calendar), her choices (`cleanPrefs`), when a bell is due, the week-ahead email text, and the `.ics` writer
  (RFC 5545: VCALENDAR/VEVENT, UID, DTSTAMP, DTSTART/DTEND in UTC or as dates for all day, SUMMARY, URL; escaping and folding at 75
  octets). Lagos days and times are worked out by hand; day names come from `dayLabel`, now in `lib/month-calendar.ts` (pure) and
  re-exported by `components/MonthCalendar.tsx`.
- **The reads** `lib/my-calendar-server.ts`, each source on its own, from where it lives (nothing copied):
  `bookings` (client and publisher), `ppmSessions` (viewer and host), `hotelBookings` (the guest's own by `uid`; for staff whose role
  handles bookings, their hotel's arrivals and departures through `myHotels`), `tickets` (`myTickets`), `eventRsvps` (going) and
  `events` (hosting), `liveTickets` and `liveEvents` (`myLiveTickets`, `hostLives`), `interviews` (applicant and interviewer), and
  Business books (`bookParties`, open `bookEntries`, `debtors`): customers' debts by due date and suppliers' due dates. A source that
  fails is left out and named; the rest still show.
- **The page** `/calendar` (`components/calendar/MyCalendar.tsx`): `MonthCalendar` with new optional `dots`, `shade`, `legend` and
  `onMonth` props (its current users are unchanged; `npm run test:calendar`), the legend's kinds tap to hide or show, the day's agenda,
  and each entry's card (When, Where, Reminder, Open, Add to my calendar). `/calendar/sync` and `/calendar/settings`
  (`components/calendar/CalendarSettings.tsx`) are screens 4 and 6. The menu entry with today's count is in `components/AuthNav.tsx`
  and `components/shell/AccountSheet.tsx` (`useCalendarToday`, cached 10 minutes per tab; hidden on child profiles).
- **Add to my calendar** (`components/calendar/AddToCalendar.tsx`): on every agenda entry, the booking confirmation
  (`components/BookingConfirm.tsx`), a hotel booking's page (`components/hotel/HotelGuest.tsx`) and each ticket in My tickets
  (`components/events/Tickets.tsx`). Emails were left as they are: the email builder has no attachments.
- **The private link** `/api/calendar/<token>.ics` (`app/api/calendar/[token]/route.ts`): a 43-character random token; only its SHA-256
  is stored (`calendarFeeds/{hash}` → uid, and `myCalendar/{uid}.feedHash`). So she can see her link again, an encrypted copy is kept
  with `ACCOUNT_DATA_KEY` (as My Cycle and payout numbers are); without that key the link is shown once. Make a new link deletes the old
  hash at once. Unknown or replaced tokens get 404; 30 reads an hour per token and 300 per address. The feed carries titles and times
  only (`feedTitle`, no amounts, no notes, no location), the kinds she chose, a month back to six months ahead. The `webcal://` link is
  built from `SITE_URL` (`lib/host.ts`).
- **Reminders** (the 15-minute job, `app/api/cron/reminders`): `calendarBells` sends only what nothing else did: a bell 5 to 30
  minutes before 1:1 sessions and per-minute calls (bookings already send a day and an hour before; an hour isn't offered so it never
  doubles), an hour before an event for ticket holders who didn't also say they're going (going and interested already get one; paid
  lives already remind ticket holders), and the day before a hotel check-in from 9 AM. Each once (`calendarBells/{key}`).
  `weekAheadEmails`: Mondays from 7 AM Lagos, 25 a run, once a Monday.
- **Server-only collections** `myCalendar`, `calendarFeeds`, `calendarBells` are closed in `firestore.rules` (rules test added).
- **Tests:** `npm run test:my-calendar` (pure) and `npm run test:my-calendar-server` (Firestore emulator), both in CI.

## Not built in this release

- **My Cycle.** Her periods and predictions are kept only encrypted (`cycleProfiles.data`, `ACCOUNT_DATA_KEY`) and open with her
  passkey. There are no coarse predicted dates stored in a form the calendar could read without decrypting, so My Cycle is left out;
  the sync screen shows its switch, off and greyed, with the reason.
- **The installed app writing into the phone's calendar.** The web side is ready (`lib/native-calendar.ts`): inside the app, when the
  calendar plugin is there, "Add to my calendar" asks for calendar access and writes the entry; anywhere else it downloads the `.ics`.
  The apps themselves aren't built yet (`docs/MOBILE-APPS.md`), so nothing native was added. Owner and app-release step:
  1. In `mobile/`: `npm install @ebarooni/capacitor-calendar` and `npx cap sync`.
  2. iPhone: add `NSCalendarsWriteOnlyAccessUsageDescription` (iOS 17 and later) and `NSCalendarsUsageDescription` to `Info.plist`,
     for example "So your bookings, stays, tickets and interviews are added to your calendar."
  3. Android: add `android.permission.READ_CALENDAR` and `android.permission.WRITE_CALENDAR` to `AndroidManifest.xml`.
  4. Test on a phone: open an entry in My Calendar, Add to my calendar, Allow, and check the phone's calendar. Then release both apps.
  Keeping those entries in step when a booking changes (screen 5's "changes and cancellations update there too") needs native code in
  the app and is left for that release; until then the private link (screen 4) keeps phones up to date.
- **"Change in Settings → Region"** (screen 6): the site has no time-zone setting; times stay in Lagos time like the rest of booking,
  and the screen says so.
- **Reminders in emails and "Prepare with Nana"** on interviews were not added.
