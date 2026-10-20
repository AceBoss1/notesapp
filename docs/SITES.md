# Sites: looks, sections, kits and analytics

The plan for growing Your site into sites for every kind of member and business, and for giving members their own analytics. The owner's
decisions of 20 Oct 2026 are below; nothing here is built until its phase starts. Today's Your site (`lib/site-themes.ts`,
`lib/site-settings.ts`) has three looks (Legacy, Aurora, Maroon) and four sections (Journals, Shop, Courses, Track), on Business and
Enterprise only.

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
   | Shop | Pro and above |
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
| Pro | Also Fashion, Food & baking, Services, Healthcare; Shop sections; custom brand colours |
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

## Phase 1: analytics

An Analytics page for every member who sells, teaches, books sessions or publishes:

- **Overview**: money earned, orders placed and paid, average order value, best sellers, items running low, visits.
- **Tabs**: Sales, Orders, Products, Customers, Content (journal reads, course enrolments, bookings), Promotion (boosts and adverts).
- **Customers**: who bought, how much in total, how many orders, when they last ordered; most valuable first. Contact details only for the
  seller.
- A date range and a chart; a download of the sales (Pro and above).
- New: daily visit counts per page for each site and store, and where visitors came from (Business and above see them).
