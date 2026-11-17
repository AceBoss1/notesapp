# 🎨 Themes and kits: Nana sets up your site, and Review my site

Two additions to Your site (`docs/SITES.md`). Nana interviews a member about what they do, picks a kit and look, and drafts the
words for each section; the member keeps, changes or skips each one. **Review my site** lists what is stopping visitors from
booking, buying or getting in touch, each with a button to the fix.

The owner put it third in their order on 15 Nov 2026 ("Themes and kits"), after Notes Planner and Moments, with Merch last.
**Status: mockups drawn 17 Nov 2026, waiting for the owner's approval. Nothing is built.**

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

## What comes after

Merch last (owner, 17 Nov 2026): a 3D view that turns, with the logo and colour chosen and the price updating.
