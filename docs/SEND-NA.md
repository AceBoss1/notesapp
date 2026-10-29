# Send-Na by NotesApp — the plan

> Status: **plan only, nothing built.** Written 29 October 2026 from the owner's brief: an email platform for Nigerian builders, priced in Naira, from NOTESAPP TECHNOLOGIES LTD. It also carries the **WhatsApp and SMS** channel that booking reminders need, so that work is planned once, here. Updated the same day with the owner's answers: sign-in codes now and wallet codes later, new-account limits, and the Pearl, Emerald and Ruby prices, also sold as a NotesApp add-on. Updated again on 29 October 2026: the email counts, the SMS gateway, who verifies WhatsApp, who owns deliverability and abuse, and WhatsApp booking reminders as a paid add-on (§9).

## 1. What Send-Na is

An email API and dashboard for developers and businesses, priced in Naira and paid in Naira. On top of email it can send **WhatsApp and SMS**, so an important message (a one-time code, a receipt, a session reminder) still arrives when email is slow or ignored.

It follows the Na- naming in `docs/ENGINEERING_GUIDE.md`: something we build and run ourselves. The suppliers under it keep their own names (Amazon SES, Meta's WhatsApp, an SMS gateway).

**Why it can work:**

- **Dollar pricing hurts Nigerian builders.** You budget ₦20,000 and the card is charged ₦30,000 once the exchange rate has moved. Send-Na plans have one Naira price, paid by card, bank transfer or USSD through the Paystack setup we already run. No dollar card is needed.
- **NotesApp is its own first big customer.** Today `lib/email.ts` sends every NotesApp email through Resend, which bills us in dollars:
  - sign-up and password-reset emails;
  - booking confirmations and the 24-hour and 1-hour reminders;
  - receipts;
  - the Weekly Digest;
  - message emails;
  - white-label emails sent in a member's name;
  - **sign-in codes**, now;
  - **wallet one-time codes** (confirming a wallet payment, a transfer or a payout change), when the wallet needs them.

  Moving that traffic onto Send-Na proves the platform before anyone else pays for it.
- **Members already need it.** Sites, shops, bookings, Community, Events and Exam Prep all send mail. Any member's receipts and newsletters should come from their own domain, with Send-Na added to their plan.

**Competitors:**

- **Resend** and **SendGrid** are good products, priced in dollars.
- **SendByte** (sendbyte.africa) already sells Naira-priced email: 3,000 free emails, ₦2,000 for 6,000, ₦15,000 for 50,000 and ₦45,000 for 200,000.

Send-Na shouldn't race to the bottom on price. It should win on three things:

1. the WhatsApp and SMS fallback;
2. being an add-on to every NotesApp plan;
3. being built into the products members already use.

## 2. What it does

### For developers

- **One dashboard, two routes.** Transactional mail (codes, receipts, resets, reminders) goes on one set of IP addresses and a subdomain such as `mail.` Marketing mail (newsletters, campaigns) goes on another, such as `news.` A big newsletter can never slow down a password reset, and a complaint about a newsletter can't hurt receipts.
- **Ways to send:**
  - a REST API;
  - SDKs for Node.js, Python, PHP and Go;
  - an SMTP relay for older software (WordPress, Laravel, ERPs);
  - an **MCP server**, so AI agents can send and track messages. Our MCP server already reads NotesApp data, and this adds sending, under its own keys.
- **A timeline for every message:** queued → sent → delivered → opened → clicked, or bounced and complained, with the exact SMTP code and the receiving server's reply. Logs can be searched by address, tag and date. Webhooks are sent for every event.
- **Sandbox mode.** Test keys work at once, before a domain is verified. Everything is logged in full and nothing is delivered.
- **Domain set-up.** Send-Na generates the exact SPF, DKIM, DMARC and return-path records to paste. It checks them every few minutes and says in plain words what is still missing. A domain that is already on NotesApp (sites, white label, the go54 domain sales on the roadmap) gets its records added for you.
- **Lists the law requires us to keep:** an unsubscribe list for each sender, and one-click unsubscribe headers on all marketing mail. Bounced and complaining addresses are suppressed automatically.
- **Templates** with variables, previewed on a phone and a computer, and versioned.
- **Team access:** keys scoped by domain and route, and roles (owner, developer, viewer).

### For NotesApp members

- Members on any plan add Send-Na (§6) and send receipts, booking messages and shop updates **from their own domain**. This finishes the white label: "their own sending address" is already listed on the roadmap as next.
- **Newsletters from a journal:** pick posts and send them to your subscribers from your own domain, with a one-click unsubscribe. The Weekly Digest is the model.
- Community and Events reminders go to members by email, WhatsApp or SMS, whichever they chose.

## 3. The WhatsApp and SMS channel (shared with booking reminders)

The roadmap's last open booking item is **"WhatsApp reminders alongside email and the bell"**. Send-Na's channel layer does that job, so we build it once and use it twice.

### How a fallback works

A message is sent with a list of channels in order, for example `email → whatsapp → sms`, and a rule for when to move on:

| Message | First | Then | When to move on |
|---|---|---|---|
| Sign-in code (now) | Email, or WhatsApp or SMS (the member's choice) | the next channel | not delivered within 30 seconds |
| Wallet one-time code (later: confirming a payment, a transfer or a payout change) | WhatsApp or SMS (the member's choice) | the other, then email | not delivered within 30 seconds |
| Booking reminder (24 h and 1 h) | Email **and** WhatsApp together | SMS | WhatsApp not delivered within 10 minutes (the 1-hour reminder: 2 minutes) |
| Receipt | Email | WhatsApp | email bounced |
| Event starting soon | WhatsApp | SMS | not delivered within 5 minutes |
| Newsletter | Email only | — | never: marketing never falls back to paid channels |

Every attempt goes into the same timeline as email, so the sender sees one message travel across all its channels.

### WhatsApp

- **We use Meta's WhatsApp Business Platform (Cloud API)**, on a NotesApp business number that has completed Meta's business verification.
- **Every message outside a 24-hour chat window must use a template Meta has approved.** We submit:
  - "utility" templates for reminders, receipts and event notices;
  - "authentication" templates for sign-in codes now, and for wallet codes later.
- **People must agree to WhatsApp messages first.** Each person adds their number and ticks a box, separately for:
  - booking reminders;
  - codes;
  - Community and Events messages.

  They can stop at any time by replying STOP, or in Settings.
- **Meta bills each message in dollars.** That is the one cost here we can't fix in Naira, so it gets the biggest buffer (§6). Reminders to people who have just written to us, inside the 24-hour window, cost less or nothing.
- **Members sending on their own WhatsApp number** (their own Business account, linked through Meta) come in phase 3. Until then, members' messages go out from the NotesApp number with the member's name in the template.

### SMS

- **We use a Nigerian SMS gateway** that offers a transactional route which reaches numbers on the DND (do not disturb) list, and registers sender IDs with the networks as NCC rules require.
- **Suggested: Termii first, Africa's Talking as the backup.**
  - **Termii** is a Lagos company, bills in Naira, and has a DND-cleared transactional route, a one-time-code API (with voice codes) and sender ID registration. It also sells WhatsApp, which could serve as a fallback for Meta.
  - **Africa's Talking** reaches the rest of Africa when we grow past Nigeria, and keeps codes flowing if Termii has a bad day.
  - Before signing, get written quotes from both, and from one local gateway (for example Multitexter or SmartSMSSolutions) to compare. Then test how fast each delivers to MTN, Airtel, Glo and 9mobile numbers on DND.
- **Sender IDs:** NotesApp first. Members on Business and Enterprise can register their own name, which takes the networks a few days.
- **Content rules:** SMS is for codes, reminders and alerts only. No marketing over SMS in the first phases.

### Booking reminders, concretely (phase 0)

**WhatsApp booking reminders are a paid add-on** (the owner's decision, 29 October 2026). Email and bell reminders stay free on every plan, as they are today.

- **Who switches it on:** the publisher, on their booking settings.
- **Who gets the reminders:** their clients (and the publisher, for their side of the session).
- **How it's billed:** a monthly add-on with a reminder allowance. Anything past the allowance comes from WhatsApp and SMS credit (§6). The price is set once Meta's and the SMS gateway's rates are confirmed.

Once a publisher has it on:

1. The booking form asks for a WhatsApp number (pre-filled from the profile) and offers "Remind me on WhatsApp", ticked when the person has already agreed to WhatsApp messages.
2. The 24-hour and 1-hour reminders that already send by email and the bell (`reminder24Sent`, `reminder1Sent` in `lib/bookings-server.ts`) also go to WhatsApp. They fall back to SMS when WhatsApp isn't delivered.
3. Publishers get the same reminder for their side of the session, plus a WhatsApp message when a client reschedules or cancels.
4. The roadmap item "Client-driven session management" moves to fully live.

## 4. Getting into the inbox (the hard part)

Most of the work is here, not in the API, and it never stops.

- **Sending:**
  - start on **Amazon SES** (about $0.10 per 1,000 emails; Resend reportedly started there too);
  - a second provider is kept ready to take over if SES fails or suspends us;
  - later, our own mail servers (KumoMTA or Postal) carry the marketing route, and then more, once volume pays for it (§5).
- **IP addresses:**
  - shared pools at first, kept separate for the two routes;
  - **dedicated IPs** as a paid add-on for big senders, warmed up over 4 to 6 weeks;
  - our own servers are hosted in Europe or the US, not on Nigerian IP ranges, which inbox providers trust less.
- **The rules big mailbox providers enforce** (Gmail and Yahoo since 2024, Microsoft since 2025):
  - SPF and DKIM aligned with DMARC;
  - one-click unsubscribe on marketing mail;
  - spam complaints kept under 0.3%.

  Send-Na makes each of these the default, not a setting.
- **Feedback loops:** we sign up to the mailbox providers' complaint reports and act on them, by suppressing the address and warning the sender.
- **Watching:**
  - every sender has bounce and complaint rates on their dashboard;
  - past a limit (bounces 4%, complaints 0.1%) sending is slowed;
  - past a hard limit (8% and 0.3%) it pauses until we review it;
  - Postmaster Tools for Gmail and Microsoft SNDS are checked daily by the person who owns deliverability.

## 5. Stopping abuse

A free plan attracts phishers and 419 scams. If one gets through, our addresses are blacklisted for every customer. Rules from day one:

- **New accounts have limits:**
  - sandbox only until a domain is verified;
  - then **100 emails a day**, which is the Free plan (3,000 a month);
  - a paid plan's full daily rate opens after the first week, as long as bounce and complaint rates stay clean.
- **Verification before real volume:**
  - an email and phone check on sign-up;
  - a check of the website on the sending domain;
  - **CAC or identity checks** (the Dojah set-up behind the gold badge) before any plan above ₦15,000, or any marketing over 10,000 a month.
- **Content checks** on the first sends and on samples after:
  - links checked against phishing lists;
  - known scam wording;
  - lookalike bank and brand names in the "from" line.
- **Bought lists are banned.** Marketing only goes to people who opted in, with proof kept for each list. Imported lists are checked first.
- **One owner for abuse.** A named person reviews flagged accounts every day and can pause any sender at once. Every pause is written down with its reason.

## 6. Prices (the owner's plans, 29 October 2026)

Fixed Naira prices mean **NotesApp carries the exchange-rate risk**. The plans stay safe because:

- prices change at most **once a year, with 60 days' notice**;
- a plan's price never changes in the middle of a paid period;
- the email counts below are suggestions, checked against cost in the next section.

### Email plans

**Free is in every plan.** The first 3,000 emails each month are free on every account and are used first; a paid plan's emails come on top. A free account sends up to 100 a day.

| Plan | Price a month | Plan emails (recommended) | With the free 3,000 | Per plan email | Extras |
|---|---|---|---|---|---|
| Free | ₦0, no card needed | — | 3,000 (100 a day) | — | 1 domain, sandbox, 3 days of logs |
| **Pearl** | ₦1,500 | 4,000 | **7,000** | ₦0.375 | 3 domains, 15 days of logs |
| **Emerald** | ₦12,500 | 50,000 | **53,000** | ₦0.25 | 10 domains, marketing route, 30 days of logs, webhooks |
| **Ruby** | ₦40,000 | 175,000 | **178,000** | ₦0.23 | unlimited domains, 90 days of logs, priority support, dedicated IP as an add-on |

- **Over the plan:** ₦0.35 an email, or move up a plan in the middle of a month (you pay the difference for the days left).
- **Bigger than Ruby:** agreed terms, from ₦120,000 a month for 750,000+.
- **Against SendByte** (₦2,000 for 6,000, ₦15,000 for 50,000, ₦45,000 for 200,000, 3,000 free): Pearl gives 7,000 for ₦1,500, Emerald 53,000 for ₦12,500 and Ruby 178,000 for ₦40,000. That is cheaper or level at each step, and nearer on Ruby, where SendByte's ₦0.225 an email sits close to what SES costs us.
- The names match Nana's three gems, so members already know the order.

### The cost behind the counts

Amazon SES charges **$0.10 per 1,000 emails**: about **₦0.16 an email** at a working rate of ₦1,600 to the dollar (check the day's rate before launch). At that rate the free 3,000 costs us about ₦480 an account each month.

| Plan | Emails at most | SES cost at ₦1,600 | Left for logs, support and margin | The plan stops paying at |
|---|---|---|---|---|
| Pearl | 7,000 | ₦1,120 | ₦380 (25%) | about ₦2,140 to the dollar |
| Emerald | 53,000 | ₦8,480 | ₦4,020 (32%) | about ₦2,360 |
| Ruby | 178,000 | ₦28,480 | ₦11,520 (29%) | about ₦2,250 |

What this means:

- **Recommended counts:** Pearl 4,000 (7,000 with the free 3,000), Emerald 50,000 and Ruby 175,000.
  - All three plans stop paying at about the same exchange rate, ₦2,140 to ₦2,360 to the dollar.
  - Pearl still beats SendByte's cheapest plan (6,000 for ₦2,000).
  - The free 3,000 is most of Pearl's cost. Most accounts won't use their full allowance, which helps, but we shouldn't count on it.
- **Our own mail servers fix this.** In phase 3, servers we run (a few hundred dollars a month, whatever the volume) carry the marketing route and then more, and the cost of each email falls far below SES. Until then, Emerald and Ruby carry the margin.
- **If the Naira falls past about ₦2,100 to the dollar before our own servers are running:** raise Pearl to ₦2,000 at the first yearly review, rather than cutting its emails.

### As a NotesApp add-on

Send-Na is also an **add-on on every NotesApp plan** (Free Basic, Pro, Business and Enterprise):

- The same Free, Pearl, Emerald and Ruby plans at the same prices, paid with the NotesApp plan by Paystack, or from the NotesApp Credit wallet.
- The free 3,000 comes with every NotesApp account that switches Send-Na on, and is used first.
- Members send from their own domain (receipts, booking messages, shop updates, newsletters from their journals), with their usage on the plan page.
- The same login, keys and dashboard serve the API, so a member who is also a developer has one account.

### WhatsApp and SMS

These are **credit packs in Naira**, paid from the NotesApp Credit wallet or by Paystack, because Meta and the SMS gateways bill per message. Each message type has a Naira price per message, set from the supplier's rate plus a buffer, and reviewed at most once every 3 months with notice.

**What NotesApp pays for itself:**

- NotesApp's own sign-in codes;
- later, wallet one-time codes.

Members never pay for these. **WhatsApp booking reminders are not on this list:** they are the publisher's paid add-on (§3).

## 7. How it's built (for the engineering team; nothing built yet)

- **It runs on Na-Emperor, not on Vercel functions.** Sending is a queue with retries and steady rates, which is exactly what `docs/ENGINEERING_GUIDE.md` says hurts on serverless today: time limits, cron at best every 15 minutes, no retries, and shared US addresses that partners refuse. The Stage 1 worker, with its own queues and fixed outbound addresses, is where Send-Na lives.
- **The pieces:**
  1. **The API** takes in requests, checks keys and limits, and writes a message record.
  2. **The queues:** one for each route (transactional, marketing) and one for each channel (email, WhatsApp, SMS). Transactional traffic is always served first.
  3. **Senders** talk to SES, Meta and the SMS gateway, and send the next channel when a fallback rule fires.
  4. **The event store** holds the timelines, in Postgres or an analytics store, not Firestore, because every message makes several events. It is kept for each plan's log period and then deleted.
  5. **The dashboard:** a new section in NotesApp, with its own `send.` address later.
- **NotesApp's own email moves first.** `sendEmail()` in `lib/email.ts` keeps its shape and calls Send-Na instead of Resend. Resend stays as the fallback until Send-Na has run cleanly for a month.
- **Data and law:**
  - Nigeria Data Protection Act 2023 duties (lawful basis, consent records for WhatsApp, SMS and marketing, deletion on request);
  - a data processing agreement for business customers;
  - the message body is kept only as long as the plan's log period.

## 8. Phases

| Phase | What ships | Who it's for |
|---|---|---|
| **0 — Our own mail, sign-in codes and WhatsApp reminders** | The channel layer on Na-Emperor. NotesApp email moves to Send-Na over SES (Resend as fallback). Sign-in codes by email, WhatsApp or SMS. WhatsApp booking reminders with SMS fallback. One timeline for each message in admin. | NotesApp itself, and every booking |
| **1 — Members** | Send-Na as an add-on on every NotesApp plan (Free, Pearl, Emerald, Ruby). Members send from their own domains (records added for them). Newsletters from journals. WhatsApp and SMS for Community and Events reminders. Usage on the plan page. Wallet one-time codes when the wallet needs them. | NotesApp members |
| **2 — Public developer platform** | Sign-up at its own address. API keys and sandbox. SDKs (Node.js, Python, PHP, Go). SMTP relay. Webhooks. MCP send tools. Naira plans. Abuse checks in full. Public status in `/status`. | Developers and businesses outside NotesApp |
| **3 — Scale** | Our own mail servers for marketing. Dedicated IPs as an add-on. Members' own WhatsApp numbers. SMS marketing with strict opt-in. Inbound email (replies parsed into the app). | Big senders |

## 9. What the owner decides

**Decided (29 October 2026):**

1. **Prices:**
   - Free: 3,000 a month, used first on every plan.
   - Pearl ₦1,500, Emerald ₦12,500 and Ruby ₦40,000, also sold as a NotesApp add-on.
   - Counts: Pearl 4,000 (decided), Emerald 50,000 and Ruby 175,000 (recommended), on top of the free 3,000 (§6).
2. **WhatsApp verification:** NotesApp (NOTESAPP TECHNOLOGIES LTD) registers the WhatsApp Business number and completes Meta's business verification. The CAC documents are in `lib/site.ts`.
3. **People:**
   - The **NotesApp team** owns deliverability: Postmaster Tools, SNDS, warm-up and the dashboards in §4.
   - The **NotesApp compliance department** reviews abuse: flagged accounts, pauses, identity and CAC checks (§5).
   - Both start in phase 0.
4. **WhatsApp booking reminders:** a paid add-on for publishers. Email and bell reminders stay free (§3).

5. **SMS gateway:** Termii first (the owner's yes, 29 October 2026), Africa's Talking as the backup, after quotes and a delivery test (§3).

6. **Pearl's count:** 4,000 emails a month on top of the free 3,000, 7,000 in all for ₦1,500 (the owner's yes, 29 October 2026; §6).

**Suggested, for the owner's yes:**

7. **Second email provider:** Resend, which already sends our mail today, so the fallback costs no new integration.

**Still open:**

8. **The name and address:** Send-Na, at `send.notesapp.name.ng` first and later its own domain. Check the trademark and the domains before anything public.
9. **Message prices:** the Naira price for each WhatsApp and SMS message, and for the reminders add-on, once suppliers quote.
10. **When phase 2 opens to the public:** only after phase 0 and phase 1 have run cleanly for at least two months.

## 10. Risks

| Risk | What we do |
|---|---|
| A spammer gets our addresses blacklisted | §5 from day one; separate pools; one named owner who can pause any sender |
| The Naira falls and plans lose money | Break-even rates in §6 watched monthly; a yearly price review with notice; our own mail servers in phase 3; WhatsApp and SMS sold as credit packs, not unlimited |
| Meta changes WhatsApp prices or rules | Reminders also go by email; SMS fallback; templates kept simple and utility-only |
| SES suspends us after a bad week | A second provider kept ready; complaint limits pause bad senders long before SES would |
| It distracts from NotesApp | Phases 0 and 1 serve NotesApp itself; phase 2 waits for the owner's go-ahead |
