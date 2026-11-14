# 📅 My Calendar

One calendar for everything a member has booked, bought or been invited to on #NotesApp. It sits in the menu and syncs to the phone's
own calendar. The owner asked for it on 14 Nov 2026: "there should be a my calendar in the menu which syncs with user default calendar
on device". **Status: mockups awaiting the owner's approval. Nothing has been built yet.**

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
