# Funding applications: .tech domain, pitch.tech and Emergent Ventures

> Status: **drafts for the owner to submit (30 October 2026).** Nothing here has been sent. Fill the `[brackets]` with current
> numbers before submitting; never send a figure we can't show. Internal: not for the changelog, the roadmap or public pages.

| # | What | Where | Deadline | Costs us | Order |
|---|---|---|---|---|---|
| 1 | .tech startup programme: **naapp.tech**, sponsored for 10 years | [startup.tech](https://startup.tech/) | none (do it this week) | nothing | first: the pitch form asks for our .tech domain |
| 2 | .tech pitch competition | [pitch.tech](https://pitch.tech/) | **20 November 2026** | nothing | second |
| 3 | Emergent Ventures (Mercatus Center), Africa & Caribbean | [mercatus.org/emergentventures](https://www.mercatus.org/emergentventures) | none (funds are limited: soon) | nothing | third |

Declined for now: **Peachscore** (its "grant" is applied toward an enrollment fee; apply only if it's confirmed in writing that we pay
nothing).

---

## 1. Company summary (reuse anywhere)

**One line:** NotesApp is one home for Africa's creators, teachers and professionals to share what they know, teach it, sell it and
get paid for it, in their own currency.

**One paragraph:**

> NotesApp is where Africa's knowledge is shared, valued and rewarded. Creators, teachers, coaches, consultants and small businesses
> today stitch together WhatsApp, a booking link, a blog, a shop page and bank transfers to earn from what they know, and they lose
> sales and trust in the gaps. NotesApp puts it in one place: a public journal, a booking calendar, paid courses (Notes Academy), a
> shop with delivery, communities, encrypted calls and payouts in Naira, with M-Pesa in Kenya next. It is live in Nigeria, with
> members already in Kenya; its Exam Prep has 2,150+ WAEC and NECO practice questions in 18 subjects (some free, the rest ₦1,000 for a year), and its Swahili translation and
> speech work earned a Special Recognition at the Build With NKENNEAi Hackathon (October 2026). NotesApp Technologies Ltd
> (RC 9825642) runs it from Nigeria; NotesApp Inc (Delaware) is being incorporated for the iOS and Android apps. Founder: Emmanuel
> Adams, Adams Consults.

**Vision:** Africa's knowledge, shared, valued and rewarded. (`lib/site.ts`, `VISION`)

**Numbers to fill before sending:** members `[ ]`, publishers `[ ]`, paid transactions in the last 90 days `[ ]`, Kenyan members `[ ]`.
Take them from `/admin` on the day.

---

## 2. startup.tech: the domain application (naapp.tech)

What the programme asks of us (from startup.tech, 30 October 2026): a tech-first product, a clear intent to use the domain as the
startup's **primary domain**, in use within **4 months** of receiving it, kept primary for 10 years, and **never redirected, parked
or resold**. Any stage is welcome. After 10 years we renew at our own cost.

| Field | Answer |
|---|---|
| Domain wanted | **naapp.tech** |
| Founder | Emmanuel Adams (Adams Consults) |
| Startup | NotesApp |
| Stage | Live product, bootstrapped (pre-seed) |
| Category | SaaS / creator economy / edtech, for Africa |
| Current website | notesapp.com.ng |
| How we'll use it | As the primary domain of the app, the website and company email, and in the iOS and Android apps' links |

**About the startup (paste the company paragraph above, then):**

> We will make naapp.tech the home of NotesApp within four months of receiving it: the web app, every member's profile and shop
> link, our referral and affiliate links, company email and the mobile apps all move to it. Our current domain will forward to
> naapp.tech, not the other way round. The short name matters to us: our members share their links on WhatsApp, Instagram and
> flyers across Nigeria and Kenya, and naapp.tech is short enough to say out loud and type on a phone.

**Founder track record (short):**

> Emmanuel Adams has built and runs NotesApp end to end: payments and payouts with Paystack and Paylony, bookings, courses, a shop
> with delivery, encrypted calls and an AI assistant (Nana). NotesApp's Swahili work was recognised at the Build With NKENNEAi
> Hackathon (October 2026). `[add prior roles or companies]`

**Before the move (engineering, when it's granted):** the app reads its address from `SITE_URL` (`lib/host.ts`), so the move is a
setting, DNS, the Firebase Auth authorised domains, Paystack and Paylony callback URLs, email sender domain (SPF, DKIM, DMARC) and a
permanent redirect from notesapp.com.ng to naapp.tech. Start it the week the domain arrives; the 4 months run from then.

---

## 3. pitch.tech (before 20 November 2026)

The form (as seen 30 October 2026): name, startup name, email, .tech domain, funding details, "What problem is your startup
solving?" (500 characters), and "I agree to switch to a .tech domain if selected to pitch".

| Field | Answer |
|---|---|
| Your name | Emmanuel Adams |
| Your startup's name | NotesApp |
| Your email | the owner's usual address |
| Your .tech domain name | **naapp.tech**. If it hasn't been granted yet, choose "Not using a .tech domain? Apply anyway" and name it in the problem box |
| Funding details | Bootstrapped / pre-seed (the closest option in the list) |
| Agree to switch | Yes |

**What problem is your startup solving?** (about 470 characters; check the counter)

> Africa's creators, teachers and professionals have knowledge people will pay for, but no single place to publish it, teach it,
> sell it and get paid. They stitch together WhatsApp, a booking link, a blog and bank transfers, and lose sales and trust. NotesApp
> gives them one home: a journal, bookings, courses, a shop, and payouts in local currency. Live in Nigeria with members in Kenya
> (M-Pesa next), 2,150+ WAEC/NECO practice questions, and an NKENNEAi hackathon award.

**If selected to pitch (prepare now):** a 3-minute story.
1. **The problem (30 s):** a Lagos hair stylist, an Abuja tutor and a Nairobi coach each run their business across five apps and
   chase payments by bank transfer.
2. **The product (60 s):** one link: their journal, booking calendar, courses, shop and payouts. Show a live profile, a booking and a
   payout.
3. **Why now and why us (30 s):** mobile money and instant bank transfers are everywhere, creators are growing fast, and nobody has
   built the whole home for them in naira and shillings. We have, and it's live.
4. **Traction (30 s):** `[members]`, `[publishers]`, `[paid transactions]`, Kenyan members already joining, the NKENNEAi award.
5. **The ask (30 s):** what we'd do with the prize: Kenya launch (M-Pesa) and the mobile apps.

Reuse the investor deck (it opens with the vision slide; HANDOVER item 65).

---

## 4. Emergent Ventures (Africa & Caribbean)

EV funds people and unusual, high-ambition projects, worldwide, with no equity taken. Grants are usually a few thousand to tens of
thousands of dollars. Apply under the founder's own name. The questionnaire is short; the questions below are the usual ones, so
check the live form and fit the answers to it. Check the form's eligibility for the Africa track before applying (a third-party
listing mentions nationality rules that Mercatus's own page doesn't show).

**Project title:** Free exam prep for every Nigerian student, written by teachers who get paid for it.

(Making every question free is a product decision for the owner: the ₦1,000 pack would then become optional support, or close.)

**Describe your project:**

> Every year well over a million Nigerian students sit WAEC and NECO `[check the latest WAEC and NECO registration figures]`, and most prepare with photocopied past questions or paid apps
> their families can't afford. On NotesApp, the platform I built for Africans to share, teach and sell what they know, I have put
> 2,150+ WAEC and NECO practice questions across 18 subjects online. Some are free; the rest cost ₦1,000 for a year.
>
> I want to make all of it free, for every student, and finish the job: every subject, every year's syllabus, each question checked
> and explained by a Nigerian teacher, and each teacher paid through NotesApp for the questions they write and review. Students get the best free exam prep in the country;
> teachers earn from what they know without leaving their classrooms; and it shows that African knowledge can be shared, valued and
> rewarded at the same time, which is what NotesApp is for.
>
> NotesApp is live in Nigeria, with members in Kenya, and its Swahili translation and speech work was recognised at the Build With
> NKENNEAi Hackathon (October 2026). The same model (free for learners, paid for the teachers who write it) works for KCSE in Kenya
> next.

**How much, and what will you do with it:** `[confirm the amount]` USD 15,000:
- USD 9,000: pay about 60 teachers to write, check and explain questions for 18 subjects (₦ per approved question, paid through
  NotesApp payouts).
- USD 3,000: subject leads who review every question before it goes live.
- USD 2,000: hosting and SMS/WhatsApp reminders for students on low-end phones.
- USD 1,000: reaching schools in three states outside Lagos and Abuja.

**What will success look like in 12 months:** every question free; every WAEC and NECO subject covered with checked, explained questions; `[N]`
students practising each month; `[N]` teachers paid; the KCSE version started in Kenya.

**About you:**

> I'm Emmanuel Adams, founder of NotesApp and of Adams Consults, based in Nigeria. I built NotesApp's whole platform myself:
> publishing, bookings, courses, a shop with delivery, encrypted calls, payouts and an AI assistant. `[add your background: education,
> prior work, anything unusual]`

**Links:** notesapp.com.ng (later naapp.tech) · Exam Prep (`/exam-prep`) · NKENNEAi results (Discord
announcement, 2026) · `[LinkedIn]`.

**What else should we know:** an honest line on what's hard, e.g. "the hard part is quality: one wrong answer in an exam bank costs
a student marks, so every question is reviewed by a second teacher before it goes live".

---

## 5. After submitting

- Log each one here with the date and what was sent.
- Use the same numbers everywhere; keep the filled-in version off the public repo if it holds private figures.
- If naapp.tech is granted, start the move (§2) and note the 4-month deadline in HANDOVER.
