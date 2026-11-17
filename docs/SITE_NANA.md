# 🎨 Themes and kits: Nana sets up your site, and Review my site

Two additions to Your site (`docs/SITES.md`). Nana interviews a member about what they do, picks a kit and look, and drafts the
words for each section; the member keeps, changes or skips each one. **Review my site** lists what is stopping visitors from
booking, buying or getting in touch, each with a button to the fix.

The owner put it third in their order on 15 Nov 2026 ("Themes and kits"), after Notes Planner and Moments, with Merch last.
**Status: built in v0.184.0 (17 Nov 2026)** from the mockups the owner approved that day ("approved, build"). What was built, and what
wasn't, is at the end of this page.

The idea comes from Charlie Hills' article "5 things to build with Fable 5.2" (an interview that drafts a landing page, and a
review of what stops sign-ups). Only the idea is used; the questions and Nana's instructions are our own words.

## The mockups

All screens on one sheet: [all-screens.webp](mockups/site-nana/all-screens.webp). HTML source: [mockups.html](mockups/site-nana/mockups.html).

1. Where it starts: a new first card in the kit picker ([1-where-it-starts](mockups/site-nana/1-where-it-starts.webp))
2. Nana's interview, about eight questions ([2-nanas-interview](mockups/site-nana/2-nanas-interview.webp))
3. Nana's suggestion: kit, look, colours, main button ([3-nanas-suggestion](mockups/site-nana/3-nanas-suggestion.webp))
4. The draft, section by section ([4-the-draft](mockups/site-nana/4-the-draft.webp))
5. See it first, and what will change ([5-see-it-first](mockups/site-nana/5-see-it-first.webp))
6. Review my site: the checklist ([6-review-my-site](mockups/site-nana/6-review-my-site.webp))
7. Nana's read: where visitors drop off, and rewrites ([7-nanas-read](mockups/site-nana/7-nanas-read.webp))
8. The rules, and who gets it ([8-rules-and-plans](mockups/site-nana/8-rules-and-plans.webp))

## Decisions for the owner

Each has a recommendation. The build follows it unless the owner says otherwise.

| Question | Recommendation |
|---|---|
| Where it lives | **Inside Your site** (`/profile/site`): "Let Nana set it up" as the first card of step 1, and a "Review my site" button. No new menu entry. |
| What Nana may write | **Only what the member told her**, plus what is already in their shop, booking calendar and profile. A price not given stays empty ("Add a price"). She never writes a review, an award, a number or a health or results claim. |
| When it goes live | **Only on "Put it on my site."** Empty sections are filled. A line the member already wrote is replaced only where they leave its switch on. |
| Undo | The site before is **kept for 30 days** and can be put back in one tap. |
| Plans | Kits and looks **keep today's plans**. Nana suggests within the member's plan and shows what Pro or Business would add. |
| What it costs | The **checklist is free** for everyone with a site and uses no Nana. The interview, the draft and Nana's read come from the member's normal Nana allowance (`lib/nana-meter.ts`). The real cost is measured on staging before any limit is set. |
| Nana's read and numbers | Uses the Analytics already collected. Visits by page stay Business and above; other plans see totals. |
| Testimonials | Nana leaves them empty. "Send a link" to a customer is **not in the first release** unless the owner wants it (it needs a new form and moderation). |

## How it works

**The interview.** About eight questions, one at a time, any of which can be skipped: what you do and who for; where; what you
sell and its prices; hours; what sets you apart; the one thing a visitor should do; anything that must not be said. It can be
stopped and picked up later. Before asking, Nana is given the member's shop items, booking hours and profile, so she asks only
what is missing.

**The suggestion.** A kit from `KITS`, a look, a colour set, the main and second button, and the section order, each with one
line of reasoning. Chosen from the lists in code, so Nana cannot name a kit or look that doesn't exist.

**The draft.** Words in the shape `Blocks` already has (`lib/site-kits.ts`): banner, services, questions and answers, hours and
contacts, plus About. It passes through `cleanBlocks`, so the limits and checks are the ones a hand-typed site gets.

**Applying it.** Like `applyKitTo`: fills empty parts, and replaces the member's words only where they agreed. The server writes
`sites/{uid}` as it does today, and keeps the earlier site beside it for 30 days.

**The checklist.** Pure rules over the site document, the profile and the shop: no button in the banner; a button that leads
nowhere (Book with booking off, Shop with nothing in it); services without prices; a photo look with no photo; no hours or
contacts; an empty About or Contact page; a section switched on but empty; a kit's starter words left unchanged. Ordered by how
much each matters, each linking to its step in Your site.

**Nana's read.** Optional. She is given the public words of the site, the checklist's findings and the visit numbers, and
returns a few rewrites, each shown old against new and applied only when the member accepts.

## Build order (after approval)

1. `lib/site-review.ts` (pure, tested): the checklist's rules and their order.
2. `lib/site-nana.ts` (pure, tested): the questions, what Nana is told, reading her reply into a suggestion and a draft, and
   the list of what will change.
3. `lib/site-nana-server.ts` and its route: the interview's state, the Nana calls through the meter, applying a draft, the
   30-day copy and putting it back. Emulator tests and rules tests.
4. Screens in `components/site-setup/`, wired into `/profile/site`.
5. Screenshots from the real code for the owner. Then the help article, changelog, README, HANDOVER, BUILD_LOG and
   `docs/SITES.md`.

## Not in the first release

- Nana choosing or making pictures.
- Customers leaving reviews through a link.
- Counting taps on the main button (the drop-off uses visits and orders only).
- Nana changing a site on her own, or on a schedule.

## Built in v0.184.0

- **The checklist** `lib/site-review.ts` (pure): no banner, no main button, a button that leads nowhere (Book with bookings off, Shop
  with nothing to buy, Call with no number, Contact with nothing behind it), the kit's sample headline or prices left in, prices
  missing, a photo look with no photo, no way to reach them, no hours or address, an empty About page, sections on but empty.
  Ordered by weight; each links to its step on Your site, `/shop` or `/profile/publishing`.
- **Nana** `lib/site-nana.ts` (pure): the questions are ours and fixed (8, or 9 with "use what's on your account"), so the interview
  costs nothing; **one Nana call** chooses and drafts from all the answers. `cleanDraft` keeps her to the facts in code: a price,
  duration, number or sentence with a number the member didn't give is dropped, a phone or email they didn't type is dropped, no
  testimonials, kits and looks the plan doesn't cover become the nearest covered choice with Nana's first choice shown as `wanted`, and
  a button with nothing behind it becomes Contact us. The member's own edits aren't fact-checked.
- **Putting it on** (`applyDraft`): the kit's look, colours and page sections as choosing it by hand does, but **none of the kit's
  sample words or prices**; only kept parts, only where the part was empty, the member switched "Replace" on, or the words were the
  kit's samples. A section is switched on only if it has something in it. Hours and contacts only fill empty fields.
- **The server** `lib/site-nana-server.ts`, route `/api/site/nana`: `siteSetups/{uid}` (answers, draft, the site before and when),
  server-only in `firestore.rules`, deleted with the account. Nana calls go through `runAi` with the member's Nana allowance (Pearl),
  30 a day on our account, rate limited 30 an hour. Nana's read uses `ownerViews`, `storeOrders` and `bookings` for the last 30 days;
  visits by page on Business and above.
- **Screens** `components/site-setup/`: `/profile/site/nana`, `/profile/site/review`, and two cards above the kits on Your site.
- **Tests:** `npm run test:site-nana` (pure) and `npm run test:site-nana-server` (Firestore emulator), both in CI, plus the rules test.

Screenshots from the real code, with sample data on the emulators: [built.webp](mockups/site-nana/built.webp).

## Changed from the mockups

- **The questions are ours, not Nana's**, and fixed, so they open at once and cost nothing; Nana writes only once, at the end.
  "Draft my site with what I've said" appears once there's enough to go on.
- **No "Send a link" for reviews.** The testimonials card says Nana doesn't write them and where to add real ones.
- **The preview** is a sketch of the banner and the first prices in the chosen colours, not the full site.

## Not built, or still to do

- **The cost of one draft isn't measured.** It needs the real model, which this build environment doesn't have. Measure a draft and
  a read on staging.
- **Nana's real replies aren't tested.** The tests use stand-in replies; how often the real model's choices survive the checks should
  be watched on staging.
- **Deploy:** `firebase deploy --only firestore:rules` for `siteSetups`.

## What comes after

Merch last (owner, 17 Nov 2026): a 3D view that turns, with the logo and colour chosen and the price updating.
