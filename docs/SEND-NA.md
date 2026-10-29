# Send-Na by NotesApp — the plan

> Status: **plan only, nothing built.** Written 29 October 2026 from the owner's brief: an email platform for Nigerian builders, priced in Naira, from NOTESAPP TECHNOLOGIES LTD. It also carries the **WhatsApp and SMS** channel that booking reminders need, so that work is planned once, here.

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
  - white-label emails sent in a member's name.

  Moving that traffic onto Send-Na proves the platform before anyone else pays for it.
- **Members already need it.** Sites, shops, bookings, Community, Events and Exam Prep all send mail. A Business member's receipts and newsletters should come from their own domain and fit inside their plan.

**Competitors:**

- **Resend** and **SendGrid** are good products, priced in dollars.
- **SendByte** (sendbyte.africa) already sells Naira-priced email: 3,000 free emails, ₦2,000 for 6,000, ₦15,000 for 50,000 and ₦45,000 for 200,000.

Send-Na shouldn't race to the bottom on price. It should win on three things:

1. the WhatsApp and SMS fallback;
2. being bundled into NotesApp plans;
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

- Business and Enterprise members send receipts, booking messages and shop updates **from their own domain**. This finishes the white label: "their own sending address" is already listed on the roadmap as next.
- **Newsletters from a journal:** pick posts and send them to your subscribers from your own domain, with a one-click unsubscribe. The Weekly Digest is the model.
- Community and Events reminders go to members by email, WhatsApp or SMS, whichever they chose.

## 3. The WhatsApp and SMS channel (shared with booking reminders)

The roadmap's last open booking item is **"WhatsApp reminders alongside email and the bell"**. Send-Na's channel layer does that job, so we build it once and use it twice.

### How a fallback works

A message is sent with a list of channels in order, for example `email → whatsapp → sms`, and a rule for when to move on:

| Message | First | Then | When to move on |
|---|---|---|---|
| One-time code (sign-in, payment) | WhatsApp or SMS (the member's choice) | the other | not delivered within 30 seconds |
| Booking reminder (24 h and 1 h) | Email **and** WhatsApp together | SMS | WhatsApp not delivered within 10 minutes (the 1-hour reminder: 2 minutes) |
| Receipt | Email | WhatsApp | email bounced |
| Event starting soon | WhatsApp | SMS | not delivered within 5 minutes |
| Newsletter | Email only | — | never: marketing never falls back to paid channels |

Every attempt goes into the same timeline as email, so the sender sees one message travel across all its channels.

### WhatsApp

- **We use Meta's WhatsApp Business Platform (Cloud API)**, on a NotesApp business number that has completed Meta's business verification.
- **Every message outside a 24-hour chat window must use a template Meta has approved.** We submit:
  - "utility" templates for reminders, receipts and event notices;
  - "authentication" templates for codes.
- **People must agree to WhatsApp messages first.** Each person adds their number and ticks a box, separately for:
  - booking reminders;
  - codes;
  - Community and Events messages.

  They can stop at any time by replying STOP, or in Settings.
- **Meta bills each message in dollars.** That is the one cost here we can't fix in Naira, so it gets the biggest buffer (§6). Reminders to people who have just written to us, inside the 24-hour window, cost less or nothing.
- **Members sending on their own WhatsApp number** (their own Business account, linked through Meta) come in phase 3. Until then, members' messages go out from the NotesApp number with the member's name in the template.

### SMS

- **We use a Nigerian SMS gateway** that offers a transactional route which reaches numbers on the DND (do not disturb) list, and registers sender IDs with the networks as NCC rules require. **Supplier to be chosen** (§8).
- **Sender IDs:** NotesApp first. Members on Business and Enterprise can register their own name, which takes the networks a few days.
- **Content rules:** SMS is for codes, reminders and alerts only. No marketing over SMS in the first phases.

### Booking reminders, concretely (phase 0)

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
  - then 200 emails a day in the first week, raised as bounce and complaint rates stay clean.
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

## 6. Prices (a sketch for the owner to decide)

Fixed Naira prices mean **NotesApp carries the exchange-rate risk**. The plans stay safe because:

- costs are calculated at about **twice today's exchange rate**;
- prices change at most **once a year, with 60 days' notice**;
- a plan's price never changes in the middle of a paid period.

### Email

| Plan | Price a month | Emails a month | Extras |
|---|---|---|---|
| Free | ₦0 | 3,000 (100 a day) | 1 domain, sandbox, 3 days of logs |
| Starter | ₦2,500 | 10,000 | 3 domains, 15 days of logs |
| Business | ₦15,000 | 60,000 | 10 domains, marketing route, 30 days of logs |
| Growth | ₦45,000 | 250,000 | unlimited domains, 90 days of logs, priority support |
| Scale | from ₦120,000 | 1,000,000+ | dedicated IP (add-on), agreed delivery terms |

Emails over the plan cost about ₦0.30 each.

The cost behind this: 60,000 emails on SES is about $6. Even at ₦3,200 to the dollar that is under ₦20,000 a year against ₦180,000 of revenue, which leaves room for support, logs, and the people watching deliverability and abuse.

### Inside NotesApp plans

| NotesApp plan | Send-Na included |
|---|---|
| Free Basic and Pro | NotesApp's own messages only (as today) |
| Business | 10,000 emails a month from your own domain, and WhatsApp booking reminders |
| Enterprise | 50,000 emails a month, WhatsApp and SMS reminders and codes, and your own SMS sender ID |

### WhatsApp and SMS

These are **credit packs in Naira**, paid from the NotesApp Credit wallet or by Paystack, because Meta and the SMS gateways bill per message. Each message type has a Naira price per message, set from the supplier's rate plus a buffer, and reviewed at most once every 3 months with notice.

**Booking reminders sent for NotesApp bookings cost the member nothing:** we pay for them as part of the booking fee.

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
| **0 — Our own mail and WhatsApp reminders** | The channel layer on Na-Emperor. NotesApp email moves to Send-Na over SES (Resend as fallback). WhatsApp booking reminders with SMS fallback. One timeline for each message in admin. | NotesApp itself, and every booking |
| **1 — Members** | Business and Enterprise send from their own domains (records added for them). Newsletters from journals. WhatsApp and SMS for Community and Events reminders. Codes over WhatsApp and SMS. Send-Na usage on the plan page. | NotesApp members |
| **2 — Public developer platform** | Sign-up at its own address. API keys and sandbox. SDKs (Node.js, Python, PHP, Go). SMTP relay. Webhooks. MCP send tools. Naira plans. Abuse checks in full. Public status in `/status`. | Developers and businesses outside NotesApp |
| **3 — Scale** | Our own mail servers for marketing. Dedicated IPs as an add-on. Members' own WhatsApp numbers. SMS marketing with strict opt-in. Inbound email (replies parsed into the app). | Big senders |

## 9. What the owner decides

1. **The name and address:** Send-Na, at `send.notesapp.name.ng` first and later its own domain. Check the trademark and the domains before anything public.
2. **Prices:** the email plans in §6, and the Naira price for each WhatsApp and SMS message once suppliers quote.
3. **Suppliers:**
   - SES as the first email sender;
   - the second email provider;
   - which Nigerian SMS gateway;
   - who registers our WhatsApp Business number and completes Meta's verification (the CAC documents are in `lib/site.ts`).
4. **People:** who owns deliverability, and who owns abuse review, from phase 0.
5. **Free booking reminders:** whether WhatsApp booking reminders are free on every plan (recommended: yes for the client, Business and above for the publisher's own reminders), or a Business feature.
6. **When phase 2 opens to the public:** only after phase 0 and phase 1 have run cleanly for at least two months.

## 10. Risks

| Risk | What we do |
|---|---|
| A spammer gets our addresses blacklisted | §5 from day one; separate pools; one named owner who can pause any sender |
| The Naira falls and plans lose money | Costs at twice the rate; a yearly price review with notice; WhatsApp and SMS sold as credit packs, not unlimited |
| Meta changes WhatsApp prices or rules | Reminders also go by email; SMS fallback; templates kept simple and utility-only |
| SES suspends us after a bad week | A second provider kept ready; complaint limits pause bad senders long before SES would |
| It distracts from NotesApp | Phases 0 and 1 serve NotesApp itself; phase 2 waits for the owner's go-ahead |
