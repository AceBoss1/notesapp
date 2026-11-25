# No Excuses Fund: our application, step by step

> Internal: not for the changelog, the roadmap or public pages. The owner's checklist for the .tech **No Excuses Fund**
> (USD 1 million in equity-free grants). The terms we have to meet are in `docs/FUNDING.md` §3 and the team hub's
> "No Excuses Fund" tasks (`FUND_BACKLOG` and `FUND_SUBMIT_BACKLOG` in `lib/team-seed.ts`).

**Our dashboard:** <https://noexcuses.get.tech/apply/dashboard> (sign in with LinkedIn, as the owner).

## Timeline

| When | What | Team hub task |
|---|---|---|
| 2 Nov 2026 | Registered ✓ ("you're in", cohort one, 14:57). This is the registration, not a decision: we still submit by 8 Dec. The first part is saved (who we are, what NotesApp does, why us, the company), and the draft stops at "show us". | `fund-timeline` |
| by 22 Nov | Pitch deck **and/or** walkthrough video (one is enough). **Not sent yet (19 Nov).** The deck is ready; the video script is below, under "Show us" | `fund-deck-video` |
| by 26 Nov | The remaining answers drafted (below) | `fund-answers` |
| by 29 Nov | NotesApp checked working on **naapp.tech** | `fund-live-check`, `fund-site-live` |
| **25 Nov** | **Submitted ✓** (owner, 25 November 2026). Reference **NEF-CDT7MT**; questions to noexcuses@get.tech | `fund-final-review`, `fund-submit` |
| until 15 Jan 2027 | **Answer any question from them within 3 business days** (terms 4.4), and keep NotesApp live on naapp.tech (the consent says it stays live there; 24 months if granted) | |
| 15 Dec 2026, 23:59 US Pacific | Submissions close (16 Dec, 08:59 Lagos) | |
| 15 Jan 2027 | Everyone hears back, selected or not | |
| within 60 days of that | Grants are paid; they come with up to USD 100K in credits, mentorship and investor introductions | |

Nothing can be edited after submitting. Their last screen shows exactly what the panel sees.

## Before submitting, have these ready

1. **A pitch deck or a video.** Introduce yourself (and any co-founders), demo the product, and cover customers and revenue if we
   have them. Keep the link private: set access to Restricted and invite `noexcuses@get.tech`.
2. **The product live on its .tech domain.** Their form checks the address when it's entered, and the second consent box says it
   will *stay* live there.

## The questions still to answer ("start my submission")

| Section | Question | Rules | Our answer |
|---|---|---|---|
| The product | Where can we try it? | the live .tech URL | `naapp.tech` |
| The product | If this works, how big could it get? | 100–1,500 characters | draft below |
| Traction & funding | Where are you with your funding? | none · bootstrapped · angels, friends and family · pre-series A (series A or later is out) | from `fund-funding-history` |
| Traction & funding | How much have you raised? / Who has backed you? | only for angels or pre-series A; don't count our own savings | from `fund-funding-history` |
| Traction & funding | Users in the last 30 days | unique users, 0 if none | `[ ]` from `/admin` on the day |
| Traction & funding | Revenue in the last 30 days | a band: none · under $1k · $1k–10k · $10k–50k · $50k–250k · $250k+ (rough USD) | `[ ]` from `/admin` on the day |
| Who's behind it | Co-founders? | up to two, with their details | `[ ]` |
| Who's behind it | Registered company | name and country | NotesApp Technologies Ltd, Nigeria |
| Show us | Pitch deck and/or video | links, one is enough | `fund-deck-video` |
| Before you submit | Two consents | founder with authority to accept for the company; we own the work, it's live on the .tech domain and will stay live, the details are accurate | owner |

Never send a figure we can't show (`docs/FUNDING.md`).

### Draft: "If this works, how big could it get?"

> Africa has millions of creators, teachers, coaches, consultants and small sellers who earn from what they know, and almost all of
> them run it on WhatsApp, a booking link and bank transfers. NotesApp is the one place to publish, teach, sell, keep the books and
> get paid in local currency. Nigeria alone has tens of millions of small businesses and around 1.9 million students sitting JAMB each
> year; Kenya, Ghana and South Africa have the same gap, and M-Pesa in Kenya is next. We earn from plans, a share of sales, courses,
> Exam Prep and Business books, so we grow as our members earn. If it works, NotesApp becomes the default home for knowledge work
> and small trade across Africa's English and Swahili speaking markets, and later French speaking West Africa.

(About 700 characters. Check the market figures before sending, or drop them.)

## Show us: the walkthrough video and the deck (added 19 November 2026)

**Send the video and the deck.** The deck is ready (below). One is enough, but a video shows that the product works on naapp.tech, which is
what the panel checks. The same video serves Vercel X (`docs/FUNDING.md` §25), and the deck serves the HubSpot pitch (§26), HBS Angels
(§23) and YASR30 (§27).

### The video: three minutes, recorded on a laptop

**Set-up.** Record the screen with the founder's face in a corner (Loom, or OBS, or the phone on a stand beside the laptop). Use a
real account with real data, on **naapp.tech** in the address bar the whole time. Quiet room, phone on silent. One take per part is
fine; cut them together. Don't show any member's private details: use the team's own accounts, or blur names.

**Show only what works on naapp.tech that day**: open each screen once before recording, and leave out any feature that isn't
switched on yet.

**Before recording:** take today's numbers from `/admin` and write them on a card. Say only figures you can show (`docs/FUNDING.md` §1).

| Time | On screen | Say (in your own words; this is the shape) |
|---|---|---|
| 0:00–0:20 | Face, full screen | "I'm Emmanuel Adams, founder of NotesApp, building from Nigeria. With me are Emmanuela Emmanuel, our Chief Legal Officer; Ifenyinwa Akujobi, Chief Compliance Officer; and Ezurukam Ijeoma Pearl, who runs our community." (A two-second clip or photo of each co-founder, if they can.) |
| 0:20–0:45 | Face, or a phone showing WhatsApp, a booking link and a bank-transfer screenshot | "A tutor in Abuja, a hair stylist in Lagos, a coach in Nairobi: they earn from what they know, but they run it across WhatsApp, a booking link, a blog and bank transfers. They lose bookings and trust in the gaps, and global tools want dollars and cards." |
| 0:45–1:05 | naapp.tech home, then a member's public profile | "NotesApp is one home for all of it. This is a member's page on naapp.tech: what they write, what they sell, and when you can book them." |
| 1:05–1:30 | Book a session: pick a time, pay in naira (test mode, or a real ₦ payment) | "A client books and pays in naira in under a minute. The money is held until the session happens, then paid out to the member's bank." |
| 1:30–1:50 | The shop item, then Business books: type a sentence to Nana and show the entries | "They sell from the same page, with delivery, and keep their books by just telling Nana: 'sold three wigs, forty-five thousand cash'." |
| 1:50–2:10 | Your site: Nana's interview and the draft site; or Nana's inbox | "Nana, our AI, sets up their website from a short interview and drafts replies for them to approve. Money never moves through the AI." |
| 2:10–2:25 | Exam Prep: a WAEC question, Ask Nana Lite (only if `NANA_LITE_URL` is switched on; otherwise show the written explanation and drop the Nana Lite line) | "For students: 2,150 WAEC and NECO practice questions, and Nana Lite, a small tutor model we run ourselves, so it's cheap enough for every student." |
| 2:25–2:45 | `/admin` numbers, or a slide with them | "We're live in Nigeria and Kenya. `[N]` members, `[N]` in the last 30 days; `[₦N]` processed; `[₦N]` in commission, our revenue. We were recognised at the NKENNEAi Hackathon for our Kiswahili work." |
| 2:45–3:00 | Face | "A No Excuses grant takes us to `[the plan: M-Pesa in Kenya and the mobile apps]`, on naapp.tech, where we'll stay. Thank you." |

**Then:**
1. Upload to **Google Drive** (or YouTube as *Private*, not Unlisted). Drive: Share → General access **Restricted** → add
   `noexcuses@get.tech` as **Viewer** → untick "Notify" only if you want; copy the link.
2. Open the link in a private window: it should ask for access. If it plays, it's public: fix it.
3. Paste the link under **Show us** on the [dashboard](https://noexcuses.get.tech/apply/dashboard). Tick `fund-deck-video` on the
   team hub.

### The deck

Use the **#NotesApp Pitch Deck** (https://claude.ai/artifact/HUL4xzNmksy1a9YXzRK3if), the one deck for every submission (`docs/FUNDING.md`, "The pitch deck"). Export it as PDF,
upload it to Google Drive, set General access to **Restricted**, add `noexcuses@get.tech` as Viewer, and paste the link under **Show
us** next to the video's. On slide 15, put "Applying for the No Excuses Fund" in the headline and keep "live on naapp.tech, and staying
there". Refresh slide 10 from `/admin` first.
