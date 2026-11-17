# 🗓 Notes Planner

A personal planner built on My Calendar (`docs/MY_CALENDAR.md`). Nana interviews the member, one question at a time, then writes
their next 12 months the way a product team plans a launch: one goal, three numbers, a project for every month, a few moves for
every day and a Sunday review. The plan lands in My Calendar beside their bookings, stays and tickets.

The owner asked for it on 15 Nov 2026 ("new product built on top of my calendar called my personal planner", then "start with Notes
Planner"). **Status: built in v0.178.0 (16 Nov 2026)**, from the mockups the owner approved that day ("planner approved build"). What was
built, and what wasn't, is at the end of this page.

The idea comes from Charlie Hills' article "5 things to build with Fable 5.2" (build 4, "Plan your 2027 like a product launch").
Only the idea is used: an interview that pushes back, then a plan in a fixed shape. The questions and Nana's instructions are
written here in our own words; none of the article's prompt is copied.

## The mockups

All screens on one sheet: [all-screens.webp](mockups/notes-planner/all-screens.webp). HTML source: [mockups.html](mockups/notes-planner/mockups.html).

1. In My Calendar: a Planner tab and the start screen ([1-in-my-calendar](mockups/notes-planner/1-in-my-calendar.webp))
2. Nana's interview, one question at a time ([2-nanas-interview](mockups/notes-planner/2-nanas-interview.webp))
3. "Did I get you right?" before anything is written ([3-did-i-get-you-right](mockups/notes-planner/3-did-i-get-you-right.webp))
4. My plan: the goal, who I'm becoming, three numbers ([4-my-plan](mockups/notes-planner/4-my-plan.webp))
5. Month by month: twelve projects ([5-month-by-month](mockups/notes-planner/5-month-by-month.webp))
6. Today, in the calendar: moves to tick, beside bookings ([6-today-in-the-calendar](mockups/notes-planner/6-today-in-the-calendar.webp))
7. Sunday review ([7-sunday-review](mockups/notes-planner/7-sunday-review.webp))
8. Settings, privacy and the teen version ([8-settings-privacy-teens](mockups/notes-planner/8-settings-privacy-teens.webp))

## Decisions for the owner

Each has a recommendation. The build follows the recommendation unless the owner says otherwise.

| Question | Recommendation |
|---|---|
| Name and place | **Notes Planner**, a second tab inside My Calendar (`/calendar/planner`), not a new menu entry. |
| What it plans | **The next 12 months**, starting on the 1st of next month. Started in November or December, it plans January to December of the next year. One live plan per member; an old plan is kept to read. |
| Who gets it | Every signed-in adult, and teens in a gentler school version. Child profiles don't get it (they have no calendar). |
| What Nana costs | The interview and plan come out of the member's normal Nana allowance (`lib/nana-meter.ts`), like any Nana chat. "Write it myself" is free and uses no Nana. The real cost of one interview is measured on staging before any limit or price is set. |
| Where it's kept | **Encrypted on our server**, the way My Cycle is (`ACCOUNT_DATA_KEY`). Staff can't read it in Admin. It is never used for ads, analytics or other Nana features. |
| The lock | A passkey lock is **optional, off by default**. A planner opened every morning shouldn't need a fingerprint each time, but she can turn it on. |
| The phone's calendar | **Off by default.** Turned on, entries go out titled "Planner" only; real titles are a second, separate choice. |
| Nana's tone | **Kind and direct** by default: she asks for a number, a date or an example when an answer is vague. "Go gentler" softens it at any point, and any question can be skipped. |

## How the interview works

About 25 questions in four parts. Nana asks one, waits, and gives no advice until the plan.

1. **Where you are now.** What she puts up with, what she complains about but doesn't change, what her actions say she wants.
2. **If nothing changes.** An ordinary day five years on, in detail. What it costs, and what her habits are protecting her from.
3. **What you want.** The same ordinary day in the life she wants. Who she'd need to be for it to feel normal.
4. **Did I get you right?** Five lines in her own words. She corrects them. Only then is the plan written.

It can be stopped and picked up later. Answers are saved as she goes.

**Care.** This is planning, not therapy, and Nana says so. If an answer suggests she is in distress or unsafe, Nana stops pushing,
answers kindly, and points to proper help, as Nana already does elsewhere. Nana never invents facts about her life: the plan uses
only what she said.

**Our own tools first** (Engineering Guide, principle 8). Where a monthly project matches something #NotesApp does (a site, Booking,
Business books, a shop, a course), Nana links ours and never suggests an outside tool for it.

## The plan

Always the same shape, and every line can be edited by hand:

- **The life I refuse** and **the life I'm building**: one sentence each.
- **Who I'm becoming**: "I am the type of person who…"
- **The goal**: one concrete thing, true by the last day of the plan.
- **Three numbers**, each with a start and a target.
- **What I'll stop, and what I won't give up.**
- **Month by month**: one project a month, and what "finished" means.
- **Three risks**: the habits most likely to stop her, each with its early warning sign and what she does when she sees it.
- **Daily moves**: two or three, every day.
- **First three tasks**, each under 30 minutes.
- **Sunday review**: three questions, and the three numbers.

## In My Calendar

My Calendar reads everything from where it already lives. The plan is the first thing a member writes there herself.

- A new kind, **Plan**, with its own colour. It can be hidden like the others.
- The month's project shows as a banner above the day.
- The day's moves and tasks are tick boxes above the agenda. Ticks are kept per day.
- A bell each morning with the day's moves, and one on Sunday evening for the review. Both can be changed or switched off.
- The private phone feed leaves Plan out unless she turns it on.

## The teen version (13 to 17)

- Plans a school term or year: exams, a skill, habits.
- Gentle questions only. No "life you refuse", no questions about money or work.
- A parent never sees the answers or the plan.
- Kids mode has no Planner.

## Build order (after approval)

1. `lib/planner.ts` (pure, tested): the plan's shape and its checks, the interview's parts and progress, the plan's dates, the
   day's moves as calendar entries, ticks and the streak, when the bells are due, the numbers' progress.
2. `lib/planner-nana.ts` (pure, tested): what Nana is told for the interview, the summary, the plan and the review note, with the
   teen wording.
3. `lib/planner-server.ts`: encrypted storage in server-only collections, the Nana calls through the meter, download and delete.
   Emulator tests and rules tests.
4. The Planner tab: start screen, interview, summary, plan, month by month, "Write it myself".
5. The Plan kind in My Calendar: banner, tick boxes, legend, feed choice.
6. Sunday review and the two bells in the 15-minute job.
7. Settings, the optional lock, the teen version.
8. Phone and desktop screenshots from the real code for the owner. Then the public page, help article, changelog, Status, Roadmap,
   README, HANDOVER and BUILD_LOG.

## Not in the first release

- Sharing a plan with a partner or a coach.
- Plans for a team or a business.
- Ready-made plan templates.
- Nana changing the plan on her own. She can suggest a change at a review; the member makes it.

## Built in v0.178.0

- **The pure rules** `lib/planner.ts`: plan dates, `cleanPlan`, Nana's reply markers, the interview's progress, ticks and the
  streak, the Sunday review, `planEntries`, her choices, the bells. **What Nana is told** `lib/planner-nana.ts`.
- **The server** `lib/planner-server.ts`: `plannerPlans/{uid}` (the interview, the plan and the plan before it, encrypted; her
  choices beside it for the bells job), `plannerDays/{uid}_{day}` (ticks), `plannerReviews/{uid}_{week}` (reviews). All three are
  server-only in `firestore.rules`, and deleted with the account.
- **Nana:** the first question is ours, so the interview opens at once. Each answer is saved before Nana is asked, so nothing is
  lost if she can't reply. Calls go through the member's Nana allowance (Pearl, Quick), or their own AI account if they connected one.
- **Screens** (`components/planner/`): `/calendar/planner` (start, interview, summary, plan, month by month, the form),
  `/calendar/planner/review`, `/calendar/planner/settings`. My Calendar has Calendar | Planner tabs, the Plan kind in its legend, and
  the month's project and tick boxes above the day (`PlannerDay`).
- **On the calendar:** each month's project on its last day and the Sunday review are entries. Daily moves are tick boxes, not
  entries, so the month isn't a dot on every day.
- **The lock:** off by default. Turning it on needs a passkey on that device. While it's on, the plan is left out of My Calendar and
  the private feed.
- **Teens:** always gentle, 14 questions, a term (3 months) or a year, no "life I refuse", links to learning only.
- **Tests:** `npm run test:planner` (pure) and `npm run test:planner-server` (Firestore emulator), both in CI, plus the rules test.

Screenshots from the real code, with sample data on the emulators: [phone](mockups/notes-planner/built-phone.webp) and
[desktop](mockups/notes-planner/built-desktop.webp). (On a phone the plan page now puts today's moves and the months above the rest
of the plan; the phone sheet was taken just before that change.)

## Changed from the mockups

- **Three screens, not eight routes.** The plan and "month by month" are one page; on a phone today's moves and the months come first.
- **"Send to my phone's calendar"** also appears on My Calendar's Sync screen, as "Notes Planner".
- **A streak** counts days with at least one move ticked.
- **"Answer and sum up"** appears after eight questions, for members who want to finish sooner.

## Not built, or still to do

- **The cost of an interview isn't measured.** It needs the real model, which this build environment doesn't have. Measure one adult
  interview and plan on staging, then decide whether Free plans need a separate allowance for it.
- **No public page of its own.** It is described on `/my-calendar`, About, the roadmap and in the help article.
- **The installed app** doesn't write Planner entries into the phone's calendar; the private link does that job.

## What comes after Notes Planner

The owner's order (15 Nov 2026, changed the same day to put Moments first), each from the same article and each with its own mockups first:

1. **Moments**: trim the pauses from a video moment; captions that land on the spoken word.
2. **Themes and kits**: Nana interviews a site owner and drafts their kit blocks; "Review my site" lists what stops visitors signing up.
3. **Merch**: a 3D view that turns, with the logo and colour chosen and the price updating (`three` is already installed).
