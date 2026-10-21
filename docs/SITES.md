# Sites: looks, sections, kits and analytics

The plan for growing Your site into sites for every kind of member and business, and for giving members their own analytics. The owner's
decisions of 20 Oct 2026 are below. Phase 1 (analytics, v0.63.0) and phase 2 (sections, the Clean look, colour sets and the first kits,
v0.64.0) phase 3 (the Scholar look and the academic sections, v0.65.0) and phase 4 (more kits and the cover photo, v0.69.0) are built.

## Decisions (owner, 20 Oct 2026)

| Question | Decision |
|---|---|
| Who gets a site | Free Basic and Pro get a site at `/s/<username>`; their own domain stays Business and Enterprise. Free Basic can use the **Personal** kit only: for anyone personal, including content creators, not only academics. |
| Analytics by plan | Everyone sees the last 7 days. Pro: 90 days, the Customers tab and the download. Business and Enterprise: everything, including visits by page and where visitors came from. |
| First kits | Personal, Fashion, Food & baking, Services, Healthcare, School, Church/NGO. |
| Order of work | 1. Analytics. 2. Sections and kits, with the Clean look and the first kits. 3. Scholar and the academic sections. 4. More kits. |
| Academic sections | Publications, Awards, Talks (with the globe) and In the news are open from Free Basic. |
| Track | The Track section starts at Business (owner, 20 Oct 2026). |
| Colours | Every look has colour sets to choose from. |
| Competitors | We take ideas (kits by type of business, a seller dashboard), never their design or words. |

## Three layers

1. **Looks**: how a site appears. Legacy, Aurora and Maroon stay; new: **Clean** (white, rounded cards, a clear call to action) and
   **Scholar** (plain and academic, with dark mode). Each look has preset **colour sets**; custom brand colours come with Pro.
2. **Sections**: blocks any look can switch on, each with what it needs:

   | Section | Needs |
   |---|---|
   | Top banner with buttons (Book now, Order on WhatsApp, Call us); an info strip (opening hours, WhatsApp, map) | Every site |
   | About, Contact, Services and price list, Gallery, Testimonials, Team, FAQ | Every site |
   | Publications, Awards, Talks (globe), In the news | Every site (from Free Basic) |
   | Journals | Every site |
   | Shop | Every site (the plan's store commission: higher on Free Basic) |
   | Courses | Pro and above for paid courses; the Academy packages for academy pages |
   | Track | Business and above |
   | Events, Community, Giving | The Community plan and add-ons ([Community](COMMUNITY.md)) |

   A section the member's plan doesn't cover shows locked, with what it needs and a button to get it: kits sell plans and add-ons.
3. **Kits**: one-tap starting points by type of member: a look, the sections in order, starter words and pictures, and the main
   button. Everything can be changed after.

## Kits by plan (advice given 20 Oct 2026, for the owner to confirm)

Kits themselves cost nothing and switching between them is free; what a member can use follows their plan and add-ons.

| Plan | Kits |
|---|---|
| Free Basic | Personal: for a person or a content creator (bio, links, journals, videos, Gallery, and the academic sections for those who want them), the Clean and Scholar looks, preset colour sets, at `/s/<username>` |
| Pro | Also the business kits (Fashion, Food & baking, Services, Healthcare, Spa, Salons, Fitness, Events, Electronics, Motor parts, Solar, Real estate); custom brand colours (Shop is on every site, at the plan's commission) |
| Business, Enterprise | Everything, including School and Church/NGO, on their own domain |
| Add-ons | Community live streaming, Giving, the Enterprise Academy packages: their sections show locked inside kits until added (Track is part of Business) |

Later, optional: a paid **"Set it up for me"** service (our team fills a kit with the business's photos, prices and words), and premium
looks once there are many.

## The Community theme

For churches, NGOs, schools and clubs ([COMMUNITY.md](COMMUNITY.md)):

- **Visitors who aren't signed in and non-members** can see a public home page that explains the organisation, the General channel in
  public with slow mode, a Join or invite button (when the admins turn joining on), and the About and Contact pages. **The admins choose
  which of these non-members see.**
- **Signed-in members** get the full group, the way they would use a Facebook group: posts (the public and members-only Spaces), Circles,
  Events and the member list.
- **View as**: admins preview the community as a non-member, a member, a moderator and an admin before they change anything.
- **Admins** get what a Facebook group gives its admins (approving members, join questions, roles, removing and banning, pinned posts,
  announcements, member insights), made easier where we can, plus what Facebook doesn't do: giving, paid event tickets, the
  organisation's own site and domain.

## Phase 1: analytics (built, v0.63.0)

An Analytics page for every member who sells, teaches, books sessions or publishes:

- **Overview**: money earned, orders placed and paid, average order value, best sellers, items running low, visits.
- **Tabs**: Sales, Orders, Products, Customers, Content (journal reads, course enrolments, bookings), Promotion (boosts and adverts).
- **Customers**: who bought, how much in total, how many orders, when they last ordered; most valuable first. Contact details only for the
  seller.
- A date range and a chart; a download of the sales (Pro and above).
- New: daily visit counts per page for each site and store, and where visitors came from (Business and above see them).

## Phase 2: sections, the Clean look, colour sets and kits (built, v0.64.0)

- **Who has a site:** Free Basic and above, at `/s/<username>` (`canHaveSite`); readers don't. Own domain stays Business and Enterprise.
- **Looks** (`lib/site-themes.ts`): Legacy and **Clean** from Free Basic; Aurora and Maroon from Pro (our choice, for the owner to
  confirm). A look the plan no longer covers shows as Legacy.
- **Colour sets:** crimson, forest, ocean, royal, sunset, gold, charcoal on every look; a custom brand colour from Pro (too-light colours are
  darkened). **Background** (owner, 21 Oct 2026): every look and colour set on white or paper (`palette.bg`; `--c-paper`); Clean defaults
  to white, the others to paper.
- **Booking** (owner, 21 Oct 2026): the hours strip can show the booking calendar's hours (`info.bookingHours`, `bookingHoursText`), and
  while sessions are on the hours card opens the booking card; a "Book me" card under every post on the site (`bookBelowPosts`). The site sets three CSS variables (`--c-crimson`, `--c-crimson-bright`, `--c-crimson-deep`) that the Tailwind crimson colours
  read, with today's values as the fallback, so the main site never changes.
- **Sections** (`lib/site-kits.ts`, stored in `sites/{uid}`, written only by `lib/site-server.ts`): top banner with up to two buttons (Book
  now, Order on WhatsApp, Call us, Shop, Contact, a link), hours and contacts strip with a Google Maps link, services and prices, gallery
  (opens larger), testimonials, team, questions and answers; each on or off, in the member's order, shown only once filled in. Every
  section is open from Free Basic. Pages: Journals, Shop and Courses from Free Basic (owner, 21 Oct 2026: Shop stays open, at the plan's higher commission), Track from Business.
- **Kits:** Personal and creators (Free Basic); Fashion, Food & baking, Services, Healthcare (Pro); School, Church/NGO (Business). A kit
  sets the look, colour set, pages, sections and their order, and fills only empty parts with starter words: it never overwrites the
  member's words.
- **Settings:** Your site has five steps: kit, look and colours, what shows (with order arrows), words prices and pictures, About and
  Contact. Help → "Your own site".

## Phase 3: Scholar and the academic sections (built, v0.65.0)

- **Scholar look** (Free Basic): a narrow reading column, the name in the serif face, the academic sections before journals, and a light and
  dark switch in the header. Dark mode follows the visitor's device until they choose, and remembers their choice on that device
  (`SITE_DARK_KEY`); an inline script sets it before the first paint. The page colours are CSS variables, turned round under
  `[data-site-dark]`, and the accent takes lighter shades of the colour set.
- **Sections** (Free Basic): Publications (by year, newest first; the member's name in bold among the authors; link and label), Awards,
  Talks (a canvas dot-globe that turns slowly, pauses off screen, doesn't move for reduced motion; drag to turn, tap a dot; a place from
  `lib/places.ts` or typed coordinates), In the news.
- **Kit:** Academics and researchers, a personal kit, so free with Free Basic like Personal and creators.
- **Import** (owner, 21 Oct 2026; v0.68.0): BibTeX (Google Scholar's own export, since Scholar has no way for other sites to read a
  profile), a DOI (Crossref), or an ORCID iD (ORCID's public API) with an optional daily sync (`sites/{uid}.orcid`, the reminders cron).
  Merged by DOI or title, never twice; the member checks and saves (`lib/publications-import.ts`, `lib/publications-server.ts`).

## Phase 4: more kits and the cover photo (built, v0.69.0)

- **Kits** (owner, 21 Oct 2026), Pro like the other business kits: Massage and spa, Salons and beauty, Fitness trainers, Events and
  photography, Electronics and mobile devices, Motor and motorcycle spare parts, Solar and energy solutions, Real estate. Fashion now
  covers clothes, bags, shoes and jewellery. 16 kits in all.
- **Cover photo** on every look (`sites/{uid}.cover`), behind the profile header, with the logo over its edge and the social links under
  the name.
- **Team tags**: a person's @username links their name to their #NotesApp profile. A mention only: seats are Business and above.
