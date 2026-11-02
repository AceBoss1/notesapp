# Funding applications: .tech domain, pitch.tech, Emergent Ventures and the accelerators

> Status: **drafts for the owner to submit (30 October 2026; accelerators §5–§7 added 2 November 2026).** Nothing here has been
> sent. Fill the `[brackets]` with current numbers before submitting; never send a figure we can't show. Internal: not for the
> changelog, the roadmap or public pages.

| # | What | Where | Deadline | Costs us | Order |
|---|---|---|---|---|---|
| 1 | .tech startup programme: **naapp.tech**, sponsored for 10 years | [startup.tech](https://startup.tech/) | none (do it this week) | nothing | first: the pitch form asks for our .tech domain |
| 2 | .tech pitch competition | [pitch.tech](https://pitch.tech/) | **20 November 2026** | nothing | second |
| 3 | .tech **No Excuses Fund** (grants up to USD 1 million): registered 2 Nov 2026, steps in `docs/NO_EXCUSES_APPLICATION.md` | [our dashboard](https://noexcuses.get.tech/apply/dashboard) | **15 December 2026**, 23:59 US Pacific; decisions by 15 January 2027 | nothing | after naapp.tech is our primary site: the product must run on .tech, and stay there 24 months (team hub tasks `fund-*`, HANDOVER item 6) |
| 4 | Emergent Ventures (Mercatus Center), Africa & Caribbean | [mercatus.org/emergentventures](https://www.mercatus.org/emergentventures) | none (funds are limited: soon) | nothing | third |
| 5 | **Alliance** accelerator, cohort ALL19 (USD 400k on a SAFE at a USD 4M post-money valuation, about **10%**): §5 | [alliance.xyz/apply](https://alliance.xyz/apply) | **18 November 2026** (Regular Admission; Early Admission closed 23 Sep); programme starts 11 January 2027 in New York | 10% of the company + a 1:1 token side letter | after NotesApp Inc exists; decide the stablecoin question first |
| 6 | **Village Global Velocity** (pre-seed, up to USD 1M, rolling): §6 | [villageglobal.com/velocity](https://www.villageglobal.com/velocity) | none (rolling) | equity; terms set per company, not published | same week as Alliance: the answers are shared |
| 7 | **Capital Wings** (Bahrain): §7 | capital-wings.com | — | unknown ("fee arrangements" discussed later) | **not applying**: share no data, pay no fees |

Declined for now: **Peachscore** (its "grant" is applied toward an enrollment fee; apply only if it's confirmed in writing that we pay
nothing) and **Capital Wings** (§7: nobody named, no registration number or licence, placeholder legal pages).

---

## 1. Company summary (reuse anywhere)

**One line:** NotesApp is one home for Africa's creators, teachers and professionals to share what they know, teach it, sell it and
get paid for it, in their own currency.

**One paragraph:**

> NotesApp is where Africa's knowledge is shared, valued and rewarded. Creators, teachers, coaches, consultants and small businesses
> today stitch together WhatsApp, a booking link, a blog, a shop page and bank transfers to earn from what they know, and they lose
> sales and trust in the gaps. NotesApp puts it in one place: a public journal, a booking calendar, paid courses (Notes Academy), a
> shop with delivery, communities, encrypted calls and payouts in Naira, with M-Pesa in Kenya next. It is live, with members in
> Nigeria and Kenya; its Exam Prep has 2,150+ WAEC and NECO practice questions in 18 subjects (some free, the rest ₦1,000 for a year), and its Swahili translation and
> speech work earned a Special Recognition at the Build With NKENNEAi Hackathon (October 2026). NotesApp Technologies Ltd
> (RC 9825642) runs it from Nigeria; NotesApp Inc (Delaware) is being incorporated for the iOS and Android apps. Founder: Emmanuel
> Adams, Adams Consults.

**Vision:** Africa's knowledge, shared, valued and rewarded. (`lib/site.ts`, `VISION`)

**Numbers to fill before sending:** members `[ ]` (Nigeria `[ ]`, Kenya `[ ]`), publishers `[ ]`, paid transactions in the last 90 days `[ ]`.
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
| Current website | notesapp.name.ng |
| How we'll use it | As the primary domain of the app, the website and company email, and in the iOS and Android apps' links |

**About the startup (paste the company paragraph above, then):**

> We will make naapp.tech the home of NotesApp within four months of receiving it: the web app, every member's profile and shop
> link, our referral and affiliate links, company email and the mobile apps all move to it. Our current domain stays only for people
> who already use it; nothing we publish will point anywhere but naapp.tech. The short name matters to us: our members share their links on WhatsApp, Instagram and
> flyers across Nigeria and Kenya, and naapp.tech is short enough to say out loud and type on a phone.

**Founder track record (short):**

> Emmanuel Adams has built and runs NotesApp end to end: payments and payouts with Paystack and Paylony, bookings, courses, a shop
> with delivery, encrypted calls and an AI assistant (Nana). NotesApp's Swahili work was recognised at the Build With NKENNEAi
> Hackathon (October 2026). `[add prior roles or companies]`

**Before the move (engineering, when it's granted):** follow `docs/DOMAIN_SWITCH.md` (on `push/naapp` it names naapp.tech). One
setting, `NEXT_PUBLIC_ROOT_DOMAIN=naapp.tech` (`lib/host.ts`), makes it the address everything we send out uses; before that come
DNS on Vercel, the Firebase Auth authorised domains, the email sender domain (SPF, DKIM, DMARC), and after it the Paystack, Paylony
and Dojah webhooks, the LinkedIn and X callbacks and cron-job.org. notesapp.name.ng keeps working for people who already use it.
Start the week the domain arrives; the 4 months run from then.

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
> gives them one home: a journal, bookings, courses, a shop, and payouts in local currency. Live with members in Nigeria and
> Kenya (M-Pesa next), 2,150+ WAEC/NECO practice questions, and an NKENNEAi hackathon award.

**If selected to pitch (prepare now):** a 3-minute story.
1. **The problem (30 s):** a Lagos hair stylist, an Abuja tutor and a Nairobi coach each run their business across five apps and
   chase payments by bank transfer.
2. **The product (60 s):** one link: their journal, booking calendar, courses, shop and payouts. Show a live profile, a booking and a
   payout.
3. **Why now and why us (30 s):** mobile money and instant bank transfers are everywhere, creators are growing fast, and nobody has
   built the whole home for them in naira and shillings. We have, and it's live.
4. **Traction (30 s):** `[members in Nigeria and Kenya]`, `[publishers]`, `[paid transactions]`, the NKENNEAi award.
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
> NotesApp is live, with members in Nigeria and Kenya, and its Swahili translation and speech work was recognised at the Build With
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

**Links:** notesapp.name.ng (later naapp.tech) · Exam Prep (`/exam-prep`) · NKENNEAi results (Discord
announcement, 2026) · `[LinkedIn]`.

**What else should we know:** an honest line on what's hard, e.g. "the hard part is quality: one wrong answer in an exam bank costs
a student marks, so every question is reviewed by a second teacher before it goes live".

---

## 5. Alliance (crypto and fintech accelerator, New York)

> Status: **draft, not applied (2 November 2026).** Apply by **18 November 2026** for ALL19, after NotesApp Inc exists and after
> the stablecoin decision below. **Decided (owner, 2 November 2026): we pitch the stablecoin payouts angle.** Team hub: `accel-*` tasks (seed `accelerators-2026-11`).

**Published terms** (alliance.xyz home page and FAQ, read 2 November 2026; the application page alliance.xyz/apply the same day):

| | What the page says |
|---|---|
| Money | "we offer $400k in funding to all admitted startups." "Immediate funding upon admission." |
| Instrument and price | "Alliance invests at a $4M post-money valuation via SAFE with a 1:1 token side letter." |
| Token side letter | "standard for all investments and simply means that if you ever do launch one, Alliance as your investor would have a claim to it." "Most Alliance startups never launch a token." |
| Cost | "Nothing, the program is entirely free. We only require a $400k investment in your company." |
| Who | "We've always backed startups with varying degrees of crypto involvement – including fintechs, payment APIs, SaaS for crypto startups, AI products and more." Pre-product and pre-revenue welcome. |
| Next cohort | "ALL19, our next cohort, starts on January 11, 2027." Apply page: Early Admission "Closed on Sep 23", **Regular Admission "November 18"**, "Interview invites sent within 1 week of application". |
| Format | "2-week in-person onboarding followed by an 8-week fully remote program" (weeks 1–2 New York, 3–9 remote, week 10 Demo Day in New York and online); "full commitment during the program's 3 months". Cohorts of 15–30 teams. |
| Funding before the cohort | "If you'd like to take advantage of Alliance's funding but your fundraise timeline doesn't match the next cohort, don't worry. We've often supported startups by funding them before they're accelerated. Just submit your application as you normally would." |
| Money timing | "Once you're accepted into the program, we immediately start the investment and KYC process. For most teams, this takes less than a week." "After paperwork is signed, KYC is completed, and payment details are verified, we wire funds. This typically takes 1 to 2 weeks and happens before the program starts." (The owner's quote of the FAQ is right.) |
| Visas | Admission "is recognized as strong evidence of 'extraordinary ability'" (O-1); they connect founders to immigration lawyers. |

**Unconfirmed, ask in the interview:**
- **A second USD 400k "follow-on at seed".** One reading of the home page on 2 November showed "$400k upon admission + $400k follow-on
  at seed"; another the same day showed only "$400k Funding". The page runs an A/B test named `follow-on-terms`, so treat the
  follow-on as unconfirmed until it's in writing, and its price (cap or valuation) is not published anywhere.
- **Entity.** The page says nothing about the company type. A SAFE at a "post-money valuation" from a US investor is normally signed
  by a **Delaware C-corporation** (NotesApp Inc), with NotesApp Technologies Ltd becoming its subsidiary. Assume we need the Inc
  incorporated, with the founder's shares issued, before signing; confirm with Alliance and with counsel.
- **Whether they lead seed rounds.** Nothing on the page says Alliance leads; it talks of Demo Day intros ("an average of over 50
  intro requests"). "Maybe they'll lead our seed" is a question for the interview, not a plan.
- **The form's questions.** The application starts with the first founder's email and loads the rest after it; we did not enter an
  email (that would start an application). They say it "takes about 20 minutes". The usual questions are drafted below.
- Third-party listings (for example older guides) quote USD 500k at USD 5M post with a 1:1.25 side letter: that's an older deal.
  Use only what alliance.xyz shows on the day.

### The owner's ask, and the arithmetic

The ask was "USD 400k as our pre-seed, and we can offer up to 7%", and also "the USD 4M post-money SAFE". These are two different
prices:

- **USD 400k at USD 4M post-money = 10%.** On a post-money SAFE the investor's share is simply money ÷ post-money valuation:
  400,000 ÷ 4,000,000 = **10%**, fixed (before any later round dilutes everyone).
- **7% for USD 400k** means a post-money valuation of 400,000 ÷ 0.07 = **about USD 5.71M** (pre-money about USD 5.31M).
- **7% at USD 4M post** buys only **USD 280k**.

Alliance's terms are "standard for all investments" and the same for every admitted startup, so a 7% counter is unlikely to work.
If we take Alliance's money, plan on **10% plus the token side letter**, and decide whether that's worth the programme.

**How a post-money SAFE dilutes (illustration only; the seed numbers are made up to show the mechanics):** today the founder
holds `[ ]`% (from the cap table). After Alliance's SAFE, the founder has 90% of what he had. A later seed of USD 2M at a USD 10M
post-money price takes 20% from everyone, so Alliance's 10% becomes 8% and a founder who started at 100% ends at 72% (before any
option pool). Every extra post-money SAFE (Village Global, angels) comes **out of the founders' share only**, because each SAFE's
percentage is fixed; add them up before signing the second one. The token side letter costs nothing unless we ever launch a token
(we have no plans to).

### Fit: honest view

NotesApp is not a crypto company and has no crypto in the product or the roadmap. Alliance does take fintechs and payment
companies "along a spectrum within crypto", and our payments work is real (Paystack and Paylony, the NotesApp Credit wallet, Naira
payouts, M-Pesa via Flutterwave next, dollars through NotesApp Inc: `docs/PAYMENTS.md`). So the fit is **weak to moderate**: we'd be
one of the least crypto-native teams in the room, pitching to mentors whose network is crypto and payments.

**Stablecoin angles that genuinely fit (only if the owner would actually build them):**
1. **Cross-border creator payouts.** A Kenyan student buys a Nigerian tutor's course; a diaspora buyer in the US pays a Lagos
   stylist. Today that's a Naira card through Paystack at the day's rate, and later Flutterwave and dollars through the Inc. Settling
   between our countries in a dollar stablecoin and paying out in Naira or shillings is a real, testable idea for the Nigeria ↔
   Kenya ↔ Ghana corridor we're opening.
2. **A dollar-stable balance for creators.** Members who earn in Naira and are paid in dollars by foreign buyers could hold part of
   their earnings in a dollar balance. This touches licensing and consumer protection in Nigeria and Kenya; nothing here is advice,
   and counsel must say what's allowed before we say it out loud.

What does **not** fit: tokens, points or "Credit" on a chain, or anything that lets an agent move money (our rule is that money never
moves through an agent: `docs/AGENT_LAYER.md`).

**Verdict:** apply **only if** the owner decides the stablecoin payout corridor is something we'd really build in 2027 (team hub
decision `accel-alliance-angle`); otherwise skip Alliance and put the time into Village Global. Also check that the founder can be
in New York for the two in-person weeks from 11 January 2027 (a US visa appointment can take months; Kenya's pilot is in
December and launch in January).

### What to prepare

1. **NotesApp Inc (Delaware)** incorporated, founder shares issued, EIN; the plan for how NotesApp Technologies Ltd becomes its
   subsidiary and the code and brand are assigned to it (counsel). Due this week.
2. **Cap table**: who owns what today (founder, Adams Consults if relevant, any promised shares or options), as a simple sheet.
3. **Funding history**: none institutional; perks (Claude for Startups, Moda, Granola) are credits, not investment
   (`fund-funding-history`).
4. **SAFE understanding**: read the post-money SAFE and the token side letter with counsel before any interview ends in an offer
   (`accel-legal-safe`).
5. **Deck and a short video**: reuse the No Excuses Fund deck or walkthrough (`fund-deck-video`); keep it under 2 minutes for
   Village Global.
6. **Numbers** in `[brackets]` from `/admin` on the day.

### Draft answers (the usual accelerator questions; fit them to the live form)

**One line:** NotesApp is one home for Africa's creators, teachers and professionals to share what they know, teach it, sell it and
get paid for it, in their own currency.

**What are you building?** Use the company paragraph (§1). Add: "Live today: journals, bookings, courses, a shop with delivery,
Business books, the NotesApp Credit wallet and payouts in Naira through Paystack, Exam Prep, our assistant Nana, and an MCP agent
layer so outside AI assistants can work on a member's account with permission. Kenya with M-Pesa is next."

**How are you involved in crypto or stablecoins?** (only if `accel-alliance-angle` says yes)

> Not yet, and we won't pretend otherwise. We are a payments-heavy platform: members are paid in Naira today, Kenya (M-Pesa) opens
> next and dollar payments come through our US company. The problem we want to solve with Alliance is moving a creator's earnings
> between African countries and from diaspora buyers without losing them to exchange rates and slow transfers. We want to test a
> stablecoin settlement layer behind our payouts for the Nigeria ↔ Kenya ↔ Ghana corridor, with members still paid in their own
> currency.

**Traction:** members `[ ]` (Nigeria `[ ]`, Kenya `[ ]`), publishers `[ ]`, paid transactions in the last 90 days `[ ]`, MRR `[ ]`;
2,150+ WAEC and NECO practice questions in 18 subjects; Special Recognition at the Build With NKENNEAi Hackathon (October 2026).

**Team:** Emmanuel Adams, founder (Adams Consults), built the whole platform. `[co-founders, if any]` `[background]`

**Funding so far:** bootstrapped; no institutional money. Startup perks from Claude for Startups, Moda and Granola (credits).
Applying to the .tech No Excuses Fund (a grant).

**What would you do with the money?** `[the owner's split]` across: the Kenya launch (Flutterwave, M-Pesa, January 2027) and Ghana
after it; the iOS and Android apps under NotesApp Inc; paid hosting before the agent-layer pilot; `[first hires]`. No amounts until
the owner sets them.

---

## 6. Village Global Velocity (pre-seed, rolling)

> Status: **draft, not applied (2 November 2026).** Rolling, no deadline: apply in the same week as Alliance (target 20 November
> 2026). Team hub: `accel-village-global`.

**Published terms** (villageglobal.vc now redirects to villageglobal.com; the Velocity page and its application form, read
2 November 2026):

| | What the page says |
|---|---|
| What it is | "Velocity is our bespoke program for pre-seed founders. We give you the capital, peer cohort, and network to go from 0 to 1. Applications are accepted on a rolling basis." |
| Money | "We invest up to $1M in your company to help you get to your next key milestone." |
| Stage | "We're happy to be your first investor, pre-traction and pre-revenue. Even if you just have an idea and no formal company yet – drop us a line." |
| Where | "Founders can join from anywhere in the world." "We invest around the world." Immigration legal services (Alma) covered if a founder relocates to the US. |
| Lead | "We can lead or participate, depending on the round dynamics." Board seats "typically" not. |
| Process | "A typical pre-seed or seed round process will take 2-3 weeks from initial intro to investment decision." "Pitch us by submitting a Velocity application." References are "a critical part of our investment process". |
| Perks | For AI founders: Azure credits up to $350K, an OpenAI credit package of $10K, Anthropic API credits of $1.5K (as listed). |

**Unconfirmed:** the instrument, valuation cap and ownership are **not published** on the current page. Search engines still show
an older Velocity page saying "there are no fixed investment terms" and "we typically invest on a post-money SAFE with pro-rata
rights"; that text isn't on the live page, so ask. "Up to USD 1M" is a ceiling, not an offer.

**Fit:** good. Pre-seed, any country, consumer software and fintech both listed as categories, no cohort to wait for and no
programme in another city. **Verdict: apply.** The company can apply before NotesApp Inc exists, but any SAFE will be signed by
the Inc (same Delaware dependency as Alliance).

**Category on the form:** top-level "Consumer Software & Services" (honest: members are creators and small businesses; "AI & ML"
would put us on their AI track, which isn't what we are). Secondary: Education & Training, Consumer Services, Personal Finance,
AI & Machine Learning.

### Draft answers to their form (questions as on the form, 2 November 2026; 1,000 characters maximum each)

**The basics:** Emmanuel Adams · Founder & CEO · the owner's usual email · `[LinkedIn]` · NotesApp · naapp.tech (once it's the
primary site; until then the current address) · `[city]`, `[state]`, Nigeria.

**1-line descriptor:** One home for Africa's creators, teachers and professionals to share what they know, teach it, sell it and get
paid in their own currency.

**What problem do you solve?**

> Africa's creators, teachers, coaches, consultants and small sellers earn from what they know, but they run it across WhatsApp, a
> booking link, a blog, a shop page and bank transfers. They lose sales and trust in the gaps: missed bookings, payments chased by
> hand, no receipts and no books. The tools built abroad are priced in dollars, so a Nigerian budget is charged whatever the exchange
> rate says that day, and none of them pays out in Naira or shillings. Their buyers have it no better: no single place to find a
> tutor, book them, take their course and pay them. There is no home built for African knowledge work, in local currency, from
> publishing to getting paid.

**What's your unique insight, approach, or advantage?**

> In Africa, knowledge work and small trade are one business: a tutor sells a course and books sessions; a stylist books clients and
> sells products; a coach writes, teaches and invoices. Tools from abroad split that into five dollar subscriptions. We built the
> whole loop in one place, priced and paid out in Naira, with M-Pesa in Kenya next: journal, bookings, courses, a shop with
> delivery, Business books, a wallet and payouts. We are also early on agents: Nana, our assistant, prepares routine work for a
> member to approve, and our MCP server lets any outside AI assistant work on a member's account with permission, while money never
> moves through an agent. And we build for local languages: our Kiswahili work won a Special Recognition at the NKENNEAi Hackathon.

**What is the business model and who is the customer?**

> The customer is the person earning: creators, teachers, coaches, consultants and small businesses in Nigeria, then Kenya and
> Ghana. Their buyers and students pay them through NotesApp. We earn from monthly plans (Pro, Business, Enterprise) and add-ons such as
> inventory, the logistics network and the team hub; a share of sales made on the platform; courses; Exam Prep (₦1,000 a year for
> the full WAEC and NECO bank); and Business books. So we grow as our members earn. Next: dollar payments through NotesApp Inc for
> diaspora buyers, and Send-Na, a Naira-priced email, SMS and WhatsApp API for Nigerian builders, with NotesApp as its first
> customer.

**How big is the market? Walk us through how there will be a player worth $10B in this market.**

> `[Number of small businesses in Nigeria, Kenya and Ghana, with the source]` and `[number of creators and tutors, with the source]`
> earn from what they know and sell, and most run on WhatsApp and bank transfers. The $10B player is the one that becomes their
> default home: the software they pay for monthly and the payments layer every sale runs through, across Africa's English and
> Swahili speaking markets and then French speaking West Africa. Software fees plus a share of every sale compound as members grow;
> payouts in local currency and their books keep them. `[Add one comparable, e.g. the value of a creator or merchant platform in
> another market, with the source.]` We start with Nigeria, where we are live, then Kenya (M-Pesa) in January 2027 and Ghana after.

**What traction have you had to-date?**

> Live with members in Nigeria and Kenya: `[members]` members (`[Nigeria]` / `[Kenya]`), `[publishers]` publishers, `[paid
> transactions]` paid transactions in the last 90 days, MRR `[ ]`. Live features: journals, bookings, courses, a shop with
> delivery, Business books, the NotesApp Credit wallet, Naira payouts through Paystack, Exam Prep with 2,150+ WAEC and NECO
> questions in 18 subjects, and Nana. The agent layer (our MCP server and Nana as an operator) shipped on 2 November 2026, with a
> 20-creator pilot from 7 December. Special Recognition at the Build With NKENNEAi Hackathon (October 2026). Bootstrapped: no
> outside investment.

**Who are your competitors? How are you different & better?**

> Members today stitch together WhatsApp, Selar or Bumpa for selling, Calendly for bookings, Substack for writing, a course tool,
> a spreadsheet for the books and bank transfers. Each does one job, and the ones built abroad are priced in dollars.
> NotesApp is the whole home in one link: publish, book, teach, sell and deliver, keep the books, get paid in local currency. Business
> books imports a member's records from Selar, Bumpa, Shopify and WooCommerce, so they don't start from zero. And Nana plus our MCP server let a
> member's AI assistant do the routine work with their approval, which none of these tools offers for African payments.

**Why are you passionate about this problem? What makes your team exceptional?**

> `[In the founder's words: why this problem, a person you built it for.]` I built NotesApp end to end myself: publishing, bookings,
> courses, a shop with delivery, encrypted calls, the wallet, payouts with Paystack and Paylony, Business books, an AI assistant and
> an MCP agent layer, shipped in small releases (version 0.123 as of November 2026). I run Adams Consults. `[Background: education,
> prior work.]` `[Co-founders, if any.]`

**The numbers:**
- When did you start the company? NotesApp Technologies Ltd was registered on **2 September 2026** (RC 9825642); work on the
  product began `[date]`. NotesApp Inc (Delaware) `[incorporated on / being incorporated]`.
- Monthly burn and runway: `[ ]` (from the books on the day).
- Current MRR: `[ ]` (from `/admin` on the day).
- Already raised money? **No** (bootstrapped; perks and credits are not investment). Confirm against `fund-funding-history`.

**Founding team:** "How many founders full-time, and for how long": `[ ]`. Co-founder fields: `[ ]` or blank.

**References (up to 3):** `[three people who can speak to the work first hand, with their permission]`. Ask them before listing them.

**Extras:** deck (reuse `fund-deck-video`), a video under 2 minutes, a demo link on naapp.tech.

**It takes a Village:** encouraged by `[ ]`; recommended founder `[ ]`; helpful angels or advisors `[ ]`. How we heard: `[ ]`.

---

## 7. Capital Wings: assessment

> Status: **not applying (2 November 2026).** Share no deck, numbers, cap table or ID documents and pay no fee until the checks
> below pass. Team hub: `accel-capital-wings`.

**What the site says** (capital-wings.com, read 2 November 2026): "a full-spectrum global platform connecting ambitious founders
with everything they need to build, fund, and scale"; "Capital Wings is not a traditional accelerator." It **connects** founders
with "angel networks, VCs, family offices, and sovereign wealth funds", "manage[s] outreach, warm introductions, and term sheet
navigation", and offers deck, financial-model and legal help. On money: "No equity taken at application stage. Zero obligation."
and (FAQ) "Any equity or fee arrangements are only discussed if both parties decide to proceed further". Address "Manama, Kingdom
of Bahrain", "Registered in Bahrain". The phrase "indicative targets" is **not on the site** as of 2 November; if it came in an email
to us, treat it the same way.

**So who invests?** On its own words it's an **introducer/broker**: it promises introductions and help, not a cheque, and leaves
"fee arrangements" for later. It doesn't say it invests its own money.

**Red flags:**
1. **Nobody is named.** No founder, partner, "investment committee" member or team page.
2. **No registration number and no licence or regulator** named, though it claims to arrange investments.
3. **Placeholder legal pages:** the Terms of Service, Privacy Policy and Media Kit links go nowhere (`#`); the social icons aren't
   linked.
4. **Inconsistent claims:** "$50M+ Funding Facilitated" in one place and "$50M+ Capital Deployed" in another; the phone number shown
   (+973 3398 02207) doesn't match the one it dials (+97333980227); "within 7 days", "7 business days" and "5–7 business days".
5. **Unverifiable proof:** testimonials with initials only ("PayFlow Global", "MedAI Solutions"), and the deals are labelled
   "Sample deals shown for illustration".
6. **No outside footprint:** no press, reviews or founder accounts found (web search, 2 November 2026). A "Capital Wings" on CB
   Insights is a Shanghai investment manager, apparently unrelated. The domain was registered on 23 February 2024 (registry record).
7. The pattern (free to apply, "limited cohort", fees "discussed later") is the one founders are warned about: the cost comes as a
   retainer, a "due diligence" or "listing" fee, or paid deck and model work.

None of this proves it's a scam; it means **we can't tell who we'd be dealing with**.

**Recommendation: don't apply.** Revisit only if they show, in writing: the people's names, a Bahrain company registration number
and any licence to arrange investments, and two founders they actually helped raise money whom we can reach independently. Even
then: never pay a fee before money arrives from an investor, and never send ID or bank documents to an introducer.

---

## 8. After submitting

- Log each one here with the date and what was sent.
- Use the same numbers everywhere; keep the filled-in version off the public repo if it holds private figures.
- If naapp.tech is granted, start the move (§2) and note the 4-month deadline in HANDOVER.
- Nothing that sells shares or a SAFE is signed before counsel has read it and the dilution is added up (§5, team hub
  `accel-legal-safe`).
