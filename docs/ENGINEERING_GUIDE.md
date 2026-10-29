# The NotesApp Engineering Guide

**NotesApp speed, infrastructure and language plan**

Oct 1, 2026 · Emmanuel Adams, Founder, CEO & CTO #NotesApp Inc.

## A note from the founder

This guide is for everyone who builds NotesApp: the engineers here today and the many who will join as we grow. It says what we run, what we will build and when, what we name it, and how we protect members' data on the way.

NotesApp is built to become one of Africa's largest platforms. The way there is not a heroic rewrite. It is the same codebase growing in measured steps: each step starts when a number on our admin dashboard says it's time, ships with its security from day one, and can be undone. When you are unsure what to do, come back to the principles below; when a number crosses its line, come back to the stage beside it.

Read it in order once. After that, use it as a reference: the stages, the names and the targets are the parts you'll return to.

## Our vision and mission

**Vision: Africa's knowledge, shared, valued and rewarded.**

**Mission:** #NotesApp gives Africa's creators, teachers, professionals and businesses one home to share what they know, teach it, sell it and get paid for it, in their own currency and, in time, their own language.

- **Share:** journals, communities, messages and calls take what people know to the people who need it.
- **Learn:** Notes Academy, Naija Exam Prep and certificates anyone can check turn knowledge into qualifications.
- **Earn:** bookings, subscriptions, gifts, Notes Market and course sales pay out in Naira, with our commissions set out in the open.
- **Belong:** everyone is welcome as family: readers become buyers, learners become teachers, customers become creators.
- **Include:** built for African realities: phone-first, light on data, local payments, and African languages, starting with Kiswahili.

What it means for engineering: a feature earns its place when it helps a member share, learn or earn; it has to work on a mid-range Android phone on a slow, costly connection; payments are Naira first; and every word we show can later be translated. The same words are on the About page and in `lib/site.ts` (`VISION`, `MISSION`), so change them there and here together.

## Principles we build by

1. **Measure, then move.** Nothing is rebuilt because it might be slow. Five numbers on the admin dashboard decide when each stage starts.
2. **One language, one team.** NotesApp is TypeScript from the page to the server. A second language comes in only for one measured hot path, never for the whole product.
3. **Security before speed.** Every stage ships with its controls on day one. A breach or a lost database costs more than any speed gain.
4. **Members' data is never in one place.** Every record of truth has a copy the attacker can't reach, and we prove we can restore it.
5. **Every change can be undone.** Dry runs before writes, before-images before backfills, the old path kept ready for one release.
6. **Buy the specialist, build the core.** Search engines, media servers and payment rails are bought; what makes NotesApp NotesApp is ours.
7. **Write it down.** Every feature ships with its changelog line, its help article, its docs and its tests.

## Our names

The systems we build ourselves carry the Na- name, so anyone reading code, dashboards or this guide knows at once what is ours.

| Name | What it is | Modelled on | When we build it |
| --- | --- | --- | --- |
| **Na-Em-Press** | Our data layer at scale: members' data split across databases by member id, and a cache in front of the follow-and-like graph that answers "who follows whom, who liked what" in a millisecond | Facebook's sharded MySQL and TAO | Its first pieces at 1 million daily members (data split by member, the graph cache); in full at 20 million |
| **Na-Conqueror** | Faster, leaner TypeScript: a strict, fully typed subset of our TypeScript for hot paths, measured by benchmarks, and in time compiled ahead of time to native code | Facebook's Hack language and HHVM engine, built to keep PHP and make it fast | The coding standard from 100,000 daily members; the compiler only at 20 million, and only if the numbers pay for it |
| **Na-Emperor** | Everything else we run in-house: the worker and its queues, the vault and recovery, feed ranking, and the serving layer that runs Nana AI | The always-on service tier around any large platform | Starts now with the Stage 1 worker, and grows stage by stage |

Everything else keeps its supplier's name: Firestore, Postgres, Redis, Cloudflare, Paystack, Paylony, Resend, Anthropic's Claude for Nana, NKENNEAi for Kiswahili.

## Where we stand today

NotesApp is one TypeScript codebase: Next.js 14 pages and API routes on Vercel serverless functions (US East); Firestore and Firebase Auth for data and sign-in; Cloudflare R2 for files and Stream for course video; Upstash Redis for rate limits and caches; Paystack and Paylony for payments; Resend for email; a scheduled call every 15 minutes for reminders and payouts. The shared rules in `lib/*.ts` run on both the page and the server. Nana AI runs on Anthropic's Claude; Kiswahili on NKENNEAi.

What has hurt so far:

- **Partners block us.** Serverless functions call out from shared US addresses, so partners' firewalls refuse them (NKENNEAi, 23 October 2026).
- **Long jobs hit the time limit.** Audio, digests and backfills fight the function time limit, and the scheduled call runs at best every 15 minutes, with no retries.
- **Firestore can't join or sum,** so finance reports read many documents and cost more as data grows.
- **Recovery was never switched on.** Point-in-time recovery and scheduled backups are off by default on the Blaze plan, R2 files have no second copy, and nothing is kept outside our Google Cloud project.

## The stages, and the five numbers that start them

We grow the infrastructure in six stages. Stage 0 starts now; every later stage waits for its number, because each adds cost, moving parts and new places for data to leak.

| Stage | What | Starts when |
| --- | --- | --- |
| 0 | Protect what we have: security, backups, recovery | Now |
| 1 | The **Na-Emperor** worker: always-on, queues, one fixed outbound address | A partner blocks our calls, or a job outgrows the time limit (already true) |
| 2 | Postgres for money: ledger, payouts, payroll, invoices | About 50,000 ledger entries, or a finance report over 30 seconds |
| 3 | Speed: caching, counters, a ranked feed | Pages or the feed over 1 second at the 95th percentile, or about 10,000 daily members |
| 4 | Search, large live rooms, video at scale, bought as services | Search over 500 ms, rooms past 20 people, video near the plan's limit |
| 5 | Na-Conqueror: one measured hot path made faster | One service still too slow or costly after Stages 1 to 4 |

The admin dashboard's card **When to grow the infrastructure** (built in v0.92.0) shows the five numbers against these lines every day: scheduled runs cut off and partner calls blocked; ledger entries and the slowest finance report; page and feed load time; daily active members and Firestore reads per member; search speed, the biggest live room and video stored. When one crosses its line, the stage beside it starts. The lines are starting points; adjust them as we learn, and write down why.

## Stage 0: protect what we have

Every exposure we had, what closes it, who does it, and where it stands. Settings cost almost nothing; backups and second copies add storage costs that grow with the data, small at our size.

| Exposure | Settings (no code) | Code | Who | Status |
| --- | --- | --- | --- | --- |
| Secrets in Vercel | Mark every key Sensitive; security keys on Vercel, GitHub, Google Cloud, Firebase, Cloudflare, Paystack and Paylony; production keys kept out of Preview and Development; rotate the service-account, payment and NKENNEAi keys now and every 90 days; GitHub secret scanning with push protection | A secret scanner on every change (gitleaks); Vercel signs in to Google Cloud with short-lived tokens (OIDC) so no long-lived key exists | Owner (settings), engineering | Scanner built; OIDC to build |
| Firestore rules are the only wall around browser reads | App Check with reCAPTCHA Enterprise; Google Cloud budget and usage alerts | Sensitive collections server-only; rules tests for every collection in CI; a monthly rules review | Owner, engineering | Rules and tests built; App Check to switch on |
| Staff see member data | Security keys for every staff account; two super admins at most; access removed the day someone leaves; staff list reviewed monthly | Emails and phones masked, shown only with a logged reason; Admin → View log | Owner, engineering | Built (v0.91.0) |
| No backups or recovery | Point-in-time recovery, delete protection, daily and weekly backups | Admin → Backups switches these on and restores, with the owner's own Google sign-in; the vault and a quarterly restore drill | Owner, engineering | Panel built (v0.93.0); vault to build |
| R2 files have no second copy | A second bucket in a separate Cloudflare account; a delete-capable token used only by the clean-up job | A nightly copy of new and changed files | Engineering | To build |
| One bad backfill or rules deploy | Rules deploy only from CI after the tests pass, by named people | Backfills need a ticked backup and their dry run's plan; every run keeps before-images and can be undone from Admin → Maintenance | Engineering | Built (v0.91.0) |

Also part of Stage 0: a write-once log of admin actions (grants, refunds, role changes, exports) kept 12 months; a record of what personal data we hold, where, why and for how long, as the Nigeria Data Protection Act requires; and a breach plan that reaches the NDPC within 72 hours.

## If we're hacked and everything is wiped

Picture it: NotesApp takes the Nigerian market from Meta, and a week later we wake up to find someone got in and wiped the database. Two questions decide how bad that week is: could they read members' data on the way, and how fast do we come back with members' data current?

### What keeps them out of the data

Attackers rarely break Firestore itself. They walk in through a login or a key. The ways in, most likely first:

| Way in | What stops it | Where we are |
| --- | --- | --- |
| An owner's or staff member's login is phished | Hardware security keys (passkeys) on Google, Vercel, GitHub, Cloudflare, Paystack, Paylony, the domain registrar and email; Google's Advanced Protection for the two owners; the owner account used only to administer, never for daily email | Owner settings, this week |
| The server's key leaks | No long-lived key (OIDC). Until then: rotated every 90 days, and the secret scanner on every change | Scanner built; OIDC to build |
| The server's key is used to destroy | The app's account can read and write documents, but cannot delete a database, delete a backup, change who has access or switch off recovery: a narrow custom role, an IAM deny rule on those actions, and delete protection. Backups and restores run only with the owner's own Google sign-in (Admin → Backups) | Panel built; role and deny rule to set up |
| A staff account is misused | Each department sees only its pages; emails and phones masked, shown only with a logged reason | Built |
| A browser abuses the database | Rules deny by default; sensitive collections server-only; App Check; rules tests in CI | App Check to switch on |
| A poisoned package | Lockfile, the CI scan, monthly updates; secrets only on the server | Partly |
| Nobody notices for days | Alerts to the owner's phone within minutes: a change to who has access, a new service-account key, recovery or delete protection switched off, a backup or schedule deleted, a database deleted, a burst of deletes | To build |

If they still read data, restoring doesn't undo it. So the most sensitive fields are stored encrypted with a key kept outside Firestore (payout bank numbers already are), and we keep only what we use. The Nigeria Data Protection Act 2023 requires telling the NDPC within 72 hours of a breach that puts members at risk, and telling the members affected.

## Coming back fast with 99% of members' data current

A copy is only safe if the attacker can't reach it. Everything inside our Google Cloud project, including the database, point-in-time recovery and scheduled backups, can be deleted by whoever takes the project's owner role. So recovery has three layers, each surviving a worse attack than the one before.

| Layer | What it is | Survives | Data lost | Back in |
| --- | --- | --- | --- | --- |
| 1. Point-in-time recovery | Every document's history, minute by minute, for 7 days | A bad deploy or backfill, an accidental or malicious delete while the database still exists | Up to 1 minute | 1 to 2 hours |
| 2. Scheduled backups | A full copy every day and week, kept up to 14 weeks; they outlive the database | An attacker who deletes the database but not the backups | Up to 24 hours; minutes with the change log | 2 to 4 hours |
| 3. The Na-Emperor vault | A second Google Cloud project under a separate organisation and billing account, its owner login on a hardware key kept offline | Anything, including losing our whole Google Cloud project, Vercel or GitHub | Minutes for members' core data; up to 24 hours for the rest | 4 to 8 hours |

The vault holds:

- A nightly full export of Firestore into a storage bucket with a locked retention policy (30 days): nobody can delete or shorten it, not even the vault's owner, and the lock stops the project being deleted.
- A change log: every write to members' core data (accounts, journals, messages, money, orders) sent to the vault within a minute, append-only, by the Na-Emperor worker.
- A daily export of sign-in accounts with their password-hash settings, so members keep their passwords after a rebuild.
- R2 files copied nightly to a locked bucket in a separate Cloudflare account, and a mirror of the code.

This is what makes "99% current" true: the nightly export plus the change log, replayed to the minute before the first bad action, brings back everything except the last few minutes of activity, even if the whole project is gone. Without the vault, an attacker with owner access takes everything.

### Targets

- **Data lost (RPO):** at most 1 minute after a mistake; at most 15 minutes of core data after a full takeover; at most 24 hours for everything else.
- **Time to come back (RTO):** sign-in, profiles, journals and messages within 4 hours; everything within 24 hours.
- **Proved, not assumed:** a timed restore drill into a throwaway project every quarter. The drill's times are the real targets.

### The first hours after an attack

1. **0 to 15 minutes:** the alert reaches the owner. Lock the doors: maintenance mode, disable the compromised logins, delete every service-account key, end sessions, pause payouts at Paystack and Paylony.
2. **15 to 60 minutes:** find the first bad action in the audit logs; that minute is the restore point. Pick the layer: point-in-time recovery if the project and database are intact, backups if the database is gone, the vault if the project is lost.
3. **1 to 4 hours:** restore into a new database from Admin → Backups (Firestore always restores into a new one), give it the rules and indexes, set `NEXT_PUBLIC_FIRESTORE_DATABASE_ID` to it and redeploy, test, reopen reading first and writing after.
4. **The same day:** reconcile money against Paystack's and Paylony's own records, rotate every other secret, tell members and the NDPC within 72 hours if personal data was read.
5. **Within a week:** write up what happened, why, and what changes.

### The order

1. **This week:** security keys on every owner and staff login; point-in-time recovery, daily and weekly backups and delete protection switched on in Admin → Backups; the server's narrow custom role.
2. **Next two weeks:** the vault project, its locked bucket, the nightly Firestore and sign-in exports, the R2 copy, and the alerts.
3. **Within a month:** the change log, OIDC instead of the server key, and the first timed restore drill.

The cost is small at our size: Google lists point-in-time recovery at about $0.15 per GB a month and backup storage at about $0.03.

## Stage 1: the Na-Emperor worker

One small always-on TypeScript service beside Vercel, reusing the same `lib/` code and tests. The design for approval is in its own doc (**Stage 1 worker: design for approval**): Fly.io in London with one fixed outbound address, about $20 a month with a fixed-price Upstash plan for the queue.

**When:** now for partner calls, since NKENNEAi's firewall blocks Vercel; for the rest, when a job needs more than the time limit, must run more often than every 15 minutes, or must retry until it succeeds.

**What moves there first:** calls to partners from our own address (NKENNEAi; later banks and exam bodies); scheduled jobs as a queue with retries (BullMQ: reminders, payouts, digests, invoice reminders, Kiswahili audio, backfills); payment webhooks recorded first and processed from the queue. Then the vault's change log.

**Why not a rewrite:** it fixes what actually hurts (region, time limits, retries) with the language and tests we have, and Vercel keeps serving pages.

**Security:** no public pages, only signed internal requests; its own narrow service account; queue messages carry ids, never personal data or keys; the fixed address is used only for outgoing partner calls.

**Data loss:** a job that fails half-way could double-pay or skip a payout. Every job is keyed by its reference so it can run twice safely, failures go to a dead-letter list staff can replay, and Redis is never the record of truth.

## Stage 2: money in Postgres

The ledger, payouts, payroll, invoices and finance reports move to managed Postgres (Neon preferably, or Supabase, in Europe); Firestore keeps the social and real-time parts.

**When:** about 50,000 ledger entries, a finance report over 30 seconds, or auditors and investors asking for a standard SQL export.

**Why Postgres:** money needs transactions across several tables, constraints that stop a bad row (a payout without a ledger entry), and reports in one query. It is the most common database for this, easy to hire for, and works with the same TypeScript through a typed query layer (Drizzle or Prisma).

**How, safely:** write new money records to both stores for a month and compare totals every night; switch reads to Postgres one report at a time; stop writing money to Firestore only after a month with no difference.

**Security:** reachable only from the worker and Vercel, never from browsers; bank details encrypted; staff read finance through admin pages, never database logins; a read-only role for reports.

**Data loss:** point-in-time recovery from day one, every migration tried on a copy first, and the nightly totals check catches drift before money moves.

## Stage 3: speed through caching and feed ranking

Most of the speed NotesApp will need comes from not doing the same work twice, not from a faster language.

**When:** pages or the feed over 1 second at the 95th percentile, Firestore reads per member rising month on month, or about 10,000 daily members.

**Caching, in this order:**

- **Public pages at the edge:** journals, profiles, course pages and the Exam Prep catalogue served from Cloudflare for a few minutes, refreshed when the author edits.
- **Hot data in Redis:** profile cards, follower counts, trending lists and course summaries, each with a short expiry, cleared when the source changes. This is the seed of **Na-Em-Press**'s graph cache.
- **Counters:** likes, views and plays counted in Redis and written to the database in batches every minute, not once per tap.

**Feed ranking, in two steps:** rules first (people you follow, recency, early likes and comments, topics you read, boosts, a cap per author), with the **Na-Emperor** worker pre-computing each active member's next feed page into Redis so opening the app is one fast read; a learned model later, once there are about 100,000 interactions a week to learn from.

**Security:** a cache never mixes people. Anything personal (a member's feed, a private post, a subscriber-only journal) is cached under that member's id, never at the CDN. Caches are cleared when a post is deleted, someone blocks someone, or a teen or kids profile changes.

**Data loss:** low. Caches and pre-computed feeds can be rebuilt; counters flush every minute, so a Redis failure loses at most a minute of likes or views, never money or messages.

## Stage 4: search, media and real time

Bought as services: each is a specialist job a small team shouldn't run.

| Need | When | Choice | Security and data-loss guard |
| --- | --- | --- | --- |
| Search across journals, people, courses and stores | Search over 500 ms, or about 100,000 items | Typesense or Meilisearch (open source, can run in Europe) or Algolia (managed) | Only public fields indexed; private, premium and teen content stays out; the index can be rebuilt |
| Large live sessions (Community, Events, classes) | Rooms past 20 people, which phone-to-phone calls can't carry | LiveKit Cloud, Daily or Agora | Join tokens per person and room, expiring within hours; no recording without a visible notice; recordings kept in our R2 |
| Course video | Video stored or watched outgrows the Cloudflare Stream plan | Stay on Stream and raise the plan | Signed playback and watermark kept; originals in R2 as the second copy |
| Real-time chat and notifications | Firestore listeners cost too much at peak | Keep Firestore; a WebSocket service on the worker for presence only | Messages stay in Firestore under today's rules; presence holds no message content |
| Mobile apps | On the roadmap | React Native (TypeScript), sharing `lib/` | Tokens in the phone's secure storage; certificate pinning for payments |

## Stage 5: Na-Conqueror, speed only where measured

NotesApp is never rewritten whole. Facebook kept PHP and built Hack and HHVM to make it fast; **Na-Conqueror** is our version of that idea, grown in three steps, each only when the numbers ask for it.

1. **The standard (from 100,000 daily members):** hot-path code is written in **Na-Conqueror** style: strict TypeScript, no `any`, no hidden allocations in loops, data in plain typed shapes, every hot function with a benchmark in CI that fails when it slows down.
2. **One separate service (when one path still misses its target after Stages 1 to 4):** that path alone becomes a service behind the same internal API. Go or Rust for heavy computation (feed scoring, fan-out, media); Python for machine learning; C# or Java only for a partner whose tools demand it. It runs beside the TypeScript version on a copy of the traffic until results match, then takes over; the TypeScript path stays ready for one release.
3. **The compiler (at 20 million, only if it pays):** **Na-Conqueror** code compiled ahead of time to native code, so the product team keeps writing TypeScript while the hot paths run at native speed. This is a platform team's multi-year project, like HHVM was; we start it only when servers cost more than the team that would build it.

**Why not a full rewrite:** it would stop features for months, re-open every bug 140-plus releases fixed, and split the rules shared by pages and server.

**Security:** a second language means a second set of dependencies to patch: scanning for both, the same secrets rules and narrow service accounts.

**Data loss:** a Na-Conqueror service reads, computes and returns; it owns no records, so a failure falls back to the TypeScript path without losing anything.

## Nana AI at 100,000, 1 million and 20 million daily members

Nana answers members' questions, helps them write, summarises and translates chats, and suggests topics, using Anthropic's Claude. Today each answer is a paid model call, kept affordable by three things already built: each plan's monthly allowance of gems, with a credit add-on; a shared answer bank, where a general first question answered once is given free to the next person for 7 days; and answering only from matching help articles, cached for an hour. Members can also connect their own Anthropic account.

Nana's cost grows with questions, not members, and questions grow faster than members once Nana is useful. The rough load below assumes one member in ten asks Nana three times a day; the dashboard will give real figures.

|  | 100,000 daily members | 1 million | 20 million |
| --- | --- | --- | --- |
| Questions a day (rough) | About 30,000 | About 300,000 | About 6 million |
| What breaks first | The bill, if the answer bank and allowances aren't tuned | The provider's rate limits at peak; slow answers when many ask at once | One provider as a single point of failure; cost across many languages |
| How Nana is served | As today, with the shared answer bank and prompt caching (the same instructions reused, billed at a fraction) | The **Na-Emperor serving layer** on the worker: a queue in front of the model, a smaller, faster model for simple questions and a larger one for hard ones, non-urgent work (digest summaries, topic suggestions) sent in cheaper batches | Several providers behind the serving layer with automatic failover; small open models we run for cheap, high-volume tasks (sorting, moderation, language detection); answers served from the region nearest the member |
| What Nana knows | Help articles | Help articles plus public journals and courses, through our own search index (Stage 4) | The same, plus each member's own data only when they ask, never shared between members |
| Languages | English, with Kiswahili through NKENNEAi | Kiswahili, Yoruba, Igbo, Hausa and Pidgin as partners offer them | Every major African language we serve |
| Cost control | Allowances tied to plans, so cost tracks revenue; the answer bank's hit rate on the dashboard | Per-feature budgets with alerts; model routing reviewed monthly | A dedicated AI platform team; contracted volume pricing |

**Security:** a member's private data reaches the model only when that member asks about it; what we log is the question's size and cost, not its words; teen and kids accounts get Nana's protected mode; prompts are guarded against members trying to make Nana reveal others' data; a data processing agreement with each AI provider covers transfers out of Nigeria under the NDPA.

**Data loss:** Nana holds no records of truth. If a provider is down, Nana says so and falls back to the help centre, as it does today.

## The platform at 100,000, 1 million and 20 million daily members

No size on this path needs a rewrite. What changes is how data is laid out, where it runs, the size of the team and the depth of security. Stage 0 work is needed at every size.

|  | 100,000 daily members | 1 million | 20 million |
| --- | --- | --- | --- |
| Rough load | About 230 requests a second, 1,000 at peak | About 2,300 a second, 10,000 at peak | About 46,000 a second, 200,000 at peak |
| What breaks first | Feed and notification fan-out for popular authors; the Firestore bill; cold starts at peak | Hot documents (Firestore takes about one sustained write a second per document); chat delivery; one region down takes everything down | Managed-service prices; delay across Africa; one cloud as a single point of failure |
| Where it runs | Vercel for pages; the Na-Emperor worker on Fly.io; Cloudflare in front of everything (it serves from Lagos) | Steady load moves to rented servers (see below); a main region and a warm standby | Our own hardware in Lagos colocation plus a European region, active in both at once |
| Data | Firestore for social, Postgres for money with a read replica; counters split across documents | **Na-Em-Press begins:** social data split by member id; the graph cache in front of follows and likes; feed timelines in a fast store; events streamed to an analytics warehouse | **Na-Em-Press in full:** databases sharded by member id, the graph cache across regions, cold storage for old media |
| Feed | Rules-based ranking, pre-computed per active member; popular authors' posts pulled when read | A learned ranking model served by a Python service | A machine-learning platform with GPUs, live signals and experiments |
| Chat and live | Firestore chat plus a presence service; managed live rooms | A dedicated WebSocket gateway | Regional chat gateways and media servers near members |
| Language | TypeScript, **Na-Conqueror** standard on hot paths | TypeScript; first separate Go or Rust services (chat gateway, fan-out) | TypeScript for the product; the Na-Conqueror compiler if it pays; core services in Go or Rust |
| Team (rough) | 6 to 10, with a security lead and an on-call rota | 30 to 60: platform, security, data, trust and safety | Several hundred |
| Security | Yearly penetration test; bug bounty; single sign-on for staff; bot and fraud checks; NDPC registration and a data protection officer | A security team; central logs and alerts; keys in a key-management service; zero-trust staff access; known child-abuse image matching; 24-hour incident response; ISO 27001 | A red team; transparency reports; a law-enforcement request process; defences against state-level attackers |
| Money and regulation | Card data stays with Paystack and Paylony; legal advice on whether wallet balances need a licensed partner | Wallet funds held by a licensed partner; yearly payment-security review | Our own licence or a deep banking partnership; regular CBN and NDPC reporting |
| Data-loss targets | Money: 5 minutes at risk, back in 1 hour; the rest: 1 hour; monthly drills | Money: near zero (synchronous copy), back in 15 minutes; backups that can't be altered | Near zero across regions, back in minutes; backups in a second cloud |

The load row assumes about 200 requests per member a day and a peak four to five times the average. Nigeria has over 100 million internet users (DataReportal, early 2024), so 20 million daily members would make NotesApp one of Africa's largest platforms.

### Cloud, rented servers, or our own data centre

We move a workload off the cloud only when it is steady, predictable and big enough that rented or owned machines plus the people to run them cost clearly less than the cloud bill, and never before the team can run it safely at 3 a.m.

| Step | What it means | When | What moves first |
| --- | --- | --- | --- |
| Serverless and managed (today) | Vercel, Firestore, managed Redis, R2, Stream | Up to about 100,000 daily members | – |
| Containers we run on rented virtual servers (VPS) | The Na-Emperor worker and services in containers on Fly.io, Hetzner or similar, still in their data centres | From Stage 1 (the worker) and for most services by about 1 million daily members, when a steady service costs more on serverless than a few rented machines | The worker, the WebSocket gateway, the feed pre-computer, search (self-hosted Typesense) |
| Rented dedicated servers | Whole physical machines rented monthly, ours alone | Around 1 to 5 million daily members, once compute bills run into five figures a month and a platform team of five or more can run them | Steady compute: feed, chat gateways, caches, search; databases stay managed until the team has database specialists |
| Our own hardware in a Lagos colocation centre | Our servers in a professional building (power, cooling, connectivity) such as Rack Centre or Equinix's Lagos sites, with a second site in Europe | From about 10 million daily members, or earlier if a customer, the CBN or the NDPC requires data kept in Nigeria | Media storage and delivery, caches, Na-Em-Press's graph cache, AI inference for small open models, then databases |
| Our own data centre building | A building we own and run | Only far beyond 20 million, and only if colocation can't give us the space, power or price; Meta built its own after hundreds of millions of members | Everything, region by region |

**Which outsourced services we take back, and when:** the ones that are expensive at volume and simple to run come first; the ones that are specialist and risky stay bought longest.

| Service | Outsourced to today | Take it in-house | Keep buying |
| --- | --- | --- | --- |
| Caches and queues | Upstash Redis | From about 1 million (Redis on our own servers) | – |
| Search | (Stage 4) Algolia or managed Typesense | From about 1 million (self-hosted) | – |
| File storage and delivery | Cloudflare R2 and CDN | Storage from about 10 million, in colocation; keep Cloudflare's network in front | The CDN, at every size |
| Video | Cloudflare Stream | From about 10 million, if price demands | Until then |
| Live rooms and calls | Managed media service | From about 1 million (our own media servers on rented machines) | Until then |
| AI | Anthropic's Claude; NKENNEAi | Small open models for cheap tasks from about 1 million | Large models, at every size |
| Email | Resend | Rarely worth it; deliverability is a specialist job | At every size |
| Payments | Paystack, Paylony | Only with our own licence, at 20 million and beyond | Until then |
| Databases | Firestore; Postgres (Neon or Supabase) | **Na-Em-Press** on our own hardware from about 10 million, with database specialists | Until then |
| Sign-in | Firebase Auth | From about 1 million if cost or control demands, as part of **Na-Em-Press** | Until then |

**Security when we run our own machines:** we become responsible for patching, physical access, disk encryption, network firewalls and hardware disposal. Each move ships with these on day one, a second site from the start, and the vault kept with a different provider.

## Security and data loss, decision by decision

Every decision adds a new place data lives or travels, so each ships with its control on day one.

| Decision | New leak risk | New loss risk | Control that ships with it |
| --- | --- | --- | --- |
| Stay on TypeScript | None new | None new | Dependency scanning and monthly updates |
| **Na-Emperor** worker (Stage 1) | A second place holding keys; queue messages | A job dies half-way | Narrow service account, signed internal requests, ids-only messages; jobs safe to run twice, a dead-letter list |
| Fixed outbound address | Partners trust that address | None | Used only for outgoing partner calls, never for incoming traffic |
| Postgres for money (Stage 2) | A database reachable from outside; bank details | A migration drops or doubles records | Private access only, encrypted bank details, read-only report role; recovery from day one, dual writes with a nightly totals check |
| Caching (Stage 3) | One member's data served to another; deleted content lingering | A minute of counters | Personal data cached only per member, never at the CDN; caches cleared on delete, block and teen or kids changes |
| Feed ranking (Stage 3) | Ranking signals reveal what someone reads | None (rebuildable) | Signals kept per member, never shown to others; teen and kids profiles left out of public signals |
| Search (Stage 4) | Private or teen content becoming searchable | None (rebuildable) | Only public fields indexed; a test that private items never reach the index |
| Live rooms (Stage 4) | Uninvited people joining; recordings | Recordings lost | Per-person, per-room join tokens that expire; recording notice; recordings copied to our storage |
| **Na-Conqueror** services (Stage 5) | Two sets of dependencies to patch | None (they own no records) | Scanning for both languages, same secrets rules, fallback to the TypeScript path |
| Nana at scale | Members' data reaching an AI provider; prompts that try to extract others' data | None (no records) | Private data sent only when its owner asks; sizes logged, not words; protected mode for young members; prompt guards; data processing agreements |
| **Na-Em-Press** | Shards and caches holding members' data in more places | A shard lost | Encryption at rest everywhere; every shard in the vault and its change log; per-shard recovery drills |
| Our own hardware | Physical access; unpatched machines | A site lost | Encrypted disks, patching, access logs, a second site from day one, the vault with another provider |

## How we work

- **Branches and pull requests:** each piece of work on its own branch; a pull request is opened only when the owner asks, carries only the items named, and is merged (squashed) once the `checks`, `secrets` and `smoke` jobs are green. Check `main` is current before every push.
- **Tests:** every server change ships with tests; Firestore work is tested against the emulators; the rules tests cover every collection. CI runs them all on every pull request.
- **Settings:** read only through `setting()` in `lib/config.ts`; `docs/ENVIRONMENT.md` is generated from it.
- **Screens:** a new page or redesign is shown as phone and desktop screenshots, rendered from the real code, before it ships; game features get mockups first.
- **Docs:** every feature ships with its changelog line, help article (Nana answers from these), README and architecture notes, and a handover note with any deploy steps.
- **Secrets:** never in code, chat or email; the scanner fails any change that carries one; a leaked key is rotated first, then removed.
- **Production data:** only through admin pages, with masking and the view log; never copied to laptops; backfills only with a dry run, a backup and before-images.
- **Writing:** short, plain sentences, British spelling, prices in **₦**.

## What to watch, and what's next

Watch the five numbers on the admin dashboard's **When to grow the infrastructure** card every week; when one crosses its line, start the stage beside it and update this guide.

**Built and scheduled (waiting to deploy on 24 October 2026):** backfill safety and masked member details with the view log (v0.91.0); the secret scanner in CI; the five numbers on the dashboard (v0.92.0); Admin → Backups (v0.93.0).

**Next:**

1. **Owner, this month:** the settings column of Stage 0 (security keys, Sensitive keys, rotation, App Check, budget alerts); create the Google sign-in client for Admin → Backups, then switch on recovery, delete protection and the backup schedules; give the service account the Monitoring Viewer role for the reads number.
2. **Owner:** approve the Stage 1 worker design.
3. **Engineering:** the Na-Emperor worker (NKENNEAi calls, then the scheduled jobs, then webhooks); the server's narrow role and the IAM deny rule; the security alerts.
4. **Engineering, within the next month:** the vault, its change log and the first timed restore drill; OIDC instead of the server key.
