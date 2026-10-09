import { AD_PACKAGES } from "./ad-packages";
import { BOOST_PACKAGES, GIFT_MAX_KOBO, GIFT_MIN_KOBO } from "./boost-config";
import { LIMITS, formatNaira } from "./booking-time";
import { GOLD_KIND_LIVE } from "./badges";
import { POLICY_TEXT } from "./cancellation";
import { MAX_CO_AUTHORS, MIN_CO_PERCENT, MIN_LEAD_PERCENT } from "./coauthors";
import { GOLD_PRICING } from "./gold";
import { MERCH_DELIVERY_KOBO } from "./merch";
import { MESSAGES_LIVE, MOMENTS_LIVE } from "./moments-rules";
import { ORG_TRIAL_DAYS } from "./org";
import { COMPANY_INFO } from "./site";
import { BADGE_PRICE_KOBO, TIERS, formatPercent } from "./tiers";
import { VIDEO_MAX_SECONDS } from "./video-rules";
import type { KbArticle } from "./kb";

// The built-in help articles. Prices, rates and limits are read from the same code the rest of the site uses, so these cannot disagree with
// the pricing page. Plain facts only; if something is not live yet, the article says so. Staff can add articles or override one by slug
// at Admin → Help & Nana.
const t = (id: string) => TIERS.find((x) => x.tier === id)!;
const pct = (id: string, f: "sessionAndUnlockCommission" | "physicalCommission" | "digitalCommission", floor: "sessionAndUnlockCommissionFloor" | "physicalCommissionFloor" | "digitalCommissionFloor") =>
  formatPercent(t(id)[f] as number | "custom", t(id)[floor] as number | undefined);
const money = (kobo: number) => formatNaira(kobo);
const n = (x: number) => x.toLocaleString("en-NG");

export function builtInArticles(): KbArticle[] {
  const A = (slug: string, title: string, category: KbArticle["category"], body: string): KbArticle => ({ slug, title, category, body: body.trim(), source: "built-in" });
  const goldNow = GOLD_KIND_LIVE.identity ? "open now" : "coming soon";
  const list: KbArticle[] = [
    // ── Getting started
    A("what-is-notesapp", "What is #NotesApp?", "Getting started", `
#NotesApp is where African creators, professionals, coaches, consultants, therapists and businesses publish their work, build an audience they can talk to directly, and get paid in Naira. You can write journals, take bookings for private sessions, sell products, PDF and video courses and other digital downloads, earn subscriptions and gifts, and run it all under your own name or your own domain, in one place.

Anyone can read, comment, book a session, subscribe, send a gift or buy from a shop for free. To publish and earn, you move up the plan ladder (see [Plans and prices](/help/plans-and-prices)).

Start at [Journals](/journals) to look around, or [create a free account](/signup). The [About page](/about) has the longer story.`),
    A("create-an-account", "Creating an account", "Getting started", `
Go to [Sign up](/signup). Choose **Personal** for a person, or **Organisation** for a company, NGO, church, school or club (organisations also enter their CAC registration number). Pick a display name, a username, an email and a password, tick that you are 18 or older and agree to the [Terms](/terms) and [Privacy Policy](/privacy), and you are in.

You will be asked to follow a few journals so your feed is not empty. Verify your email using the link we send: you need a verified email before you can pay for sessions, subscriptions or gifts.

You can also tell us, if you like, what you do, your role and where you work. It is optional and shows under your name on your profile; change it any time in [Edit profile](/profile/edit).

Forgot your password? Use [Reset password](/forgot-password).`),
    A("free-standard-and-publishing", "Free Standard, Free Basic and publishing", "Getting started", `
Every new account is **Free Standard**: you can read, comment, follow, book sessions, subscribe, send gifts and buy, but not publish.

To publish your own journal and earn, apply for **Free Basic** from your own profile under Rates & payouts. It costs nothing and an admin reviews it; no payment is involved. After that, [Pro, Business and Enterprise](/help/plans-and-prices) are paid plans with lower commission and more features.

Your publishing tier shows under your name on your profile, for example "Pro Publisher". A reader shows as "Viewer".`),
    // ── Plans and pricing
    A("plans-and-prices", "Plans and prices", "Plans and pricing", `
- **Free Standard**: ${t("standard").price}. Read, comment, book and buy. No publishing.
- **Free Basic**: ${t("basic").price}. Publish and earn. Commission is highest here.
- **Pro**: ${t("pro").price}, or ${money(t("pro").yearlyKobo!)} a year (two months free).
- **Business**: ${t("business").price}, or ${money(t("business").yearlyKobo!)} a year (two months free). Includes the verified badge, your own domain, and four team seats.
- **Enterprise**: ${t("enterprise").price}. Rates and seats are agreed with us; [contact us](/contact).

Paid plans renew automatically through Paystack, monthly or yearly. Cancel any time under Rates & payouts and you keep the plan until the period you paid for ends; there are no partial refunds. Every price and difference is on the [pricing page](/pricing).`),
    A("commission-rates", "What #NotesApp takes (commission) on each plan", "Plans and pricing", `
On paid sessions, journal subscriptions and gifts, #NotesApp takes a commission that falls as you move up:
- Free Basic: ${pct("basic", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")}
- Pro: ${pct("pro", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")}
- Business: ${pct("business", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")}
- Enterprise: ${pct("enterprise", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")}

On store sales, the commission is on the item price only (your delivery fee is yours): physical goods ${pct("basic", "physicalCommission", "physicalCommissionFloor")} on Free Basic, ${pct("pro", "physicalCommission", "physicalCommissionFloor")} on Pro, ${pct("business", "physicalCommission", "physicalCommissionFloor")} on Business; digital downloads ${pct("basic", "digitalCommission", "digitalCommissionFloor")}, ${pct("pro", "digitalCommission", "digitalCommissionFloor")} and ${pct("business", "digitalCommission", "digitalCommissionFloor")}. Enterprise rates are agreed with us.

Boosts have no commission: the price is the price. See the [pricing page](/pricing) for the full table.`),
    // ── Publishing and earning
    A("publishing-journals", "Publishing journals", "Publishing and earning", `
Once you have a publishing account (Free Basic or above), write from [Write](/write/new). The composer has formatting, a preview, images and drafts that are never lost. Each entry can be public, or kept private as a client journal.

You can add one video per post (MP4 or WebM, up to ${VIDEO_MAX_SECONDS / 60} minutes), played in our own player. How many videos you can upload a week depends on your plan.

Readers can follow your journal, comment, like and share. You can also [boost a post](/help/boost-a-post) to reach more readers, or [co-author](/help/co-authoring) with other members. Browse examples on [Journals](/journals).`),
    A("paid-sessions", "Paid 1:1 sessions and bookings", "Publishing and earning", `
Publishers set a session price (${money(LIMITS.sessionMinKobo)} to ${money(LIMITS.sessionMaxKobo)}), a length and their weekly availability, shown in Lagos time. A visitor picks a time on the publisher's profile, pays in Naira through Paystack, and both of you get a confirmation email and reminders 24 hours and 1 hour before.

**Cancellations and refunds:** ${POLICY_TEXT}

To earn from sessions, add a verified bank account under Rates & payouts. Manage your own bookings on [My bookings](/bookings). More at [Booking](/booking).`),
    A("subscriptions", "Journal subscriptions", "Publishing and earning", `
A publisher can offer a paid monthly subscription (${money(LIMITS.subscriptionMinKobo)} to ${money(LIMITS.subscriptionMaxKobo)} a month) that unlocks their premium entries. Readers subscribe from the publisher's profile, pay by Paystack, and renew automatically; cancel any time.

For the publisher, subscription money is released to their verified bank account after a 7-day window, minus the commission for their plan (see [commission rates](/help/commission-rates)).`),
    A("gifts", "Gifts", "Publishing and earning", `
A reader can send a publisher, or one single post, a gift from ${money(GIFT_MIN_KOBO)} to ${money(GIFT_MAX_KOBO)}, with a short note, or anonymously. The 🎁 button appears on a publisher's profile and posts once they have added a payout account.

You need a verified email to send a gift, and you cannot gift yourself. Gifts are paid to the publisher's bank account 7 days after they arrive (a short dispute window), minus their plan's commission. More at [Gifts](/gifts).`),
    A("payouts", "Getting paid: payouts and when money is released", "Publishing and earning", `
Add a bank account under Rates & payouts. We verify the account name first and store only the account name, bank and last four digits. Then:
- **Sessions:** paid 24 hours after the session ends.
- **Subscriptions and gifts:** released after 7 days.
- **Physical store orders:** released when the buyer confirms delivery, or 7 days after you mark it delivered if they say nothing.
- **Digital downloads:** after a 7-day dispute window.
- **Ad share:** monthly, after review (see [Ads and ad share](/help/ads-and-ad-share)).

Money can be held while we review a reported problem. Commission depends on your plan: see [commission rates](/help/commission-rates).`),
    A("boost-a-post", "Boosting a post or a store item", "Publishing and earning", `
A boost puts a published post, or an item in your store, in front of more readers in the Boosted slots on the home and Journals pages. You pay for validated impressions (a real visitor had it at least half on screen for about a second, counted once per visitor per day), not for clicks.

Packages:
${BOOST_PACKAGES.map((p) => `- **${p.name}**: ${money(p.priceKobo)} for ${n(p.impressions)} impressions, delivered over at least ${p.minDays} days, running up to ${p.windowDays} days.`).join("\n")}

Boosts have no commission, and anything not delivered by the end is refunded pro rata. See [Boost](/boost).`),
    A("co-authoring", "Co-authoring a post", "Publishing and earning", `
Pro, Business and Enterprise publishers can write a post with other members. The lead invites up to ${MAX_CO_AUTHORS} co-authors by username on a draft and sets each person's share of what the post earns (the lead keeps at least ${MIN_LEAD_PERCENT}%, each co-author at least ${MIN_CO_PERCENT}%). Everyone must accept before being listed, and the split locks when you publish.

Co-authors need a publishing account (Free Basic or above) to accept, because their share is paid to a bank account. Gifts on the post are split in the agreed percentages; sessions stay personal to each author. See [Co-authoring](/coauthoring).`),
    A("ads-and-ad-share", "Ads and ad share", "Publishing and earning", `
**Advertising on #NotesApp:** anyone can buy a banner campaign, paid online and priced by validated impressions:
${AD_PACKAGES.map((p) => `- **${p.name}**: ${money(p.priceKobo)} for ${n(p.impressions)} impressions, up to ${p.windowDays} days.`).join("\n")}
Every ad is reviewed; if we cannot run it you are refunded in full, and impressions not delivered by the end are refunded pro rata. Start at [Advertise](/advertise).

**Ad share for publishers:** Pro publishers earn ${formatPercent(t("pro").adRevenueShare!)} and Business publishers ${formatPercent(t("business").adRevenueShare!)} of the ad revenue on their pages if they opt in, with no follower or view threshold. Free journals always show ads and have no share. Shares are calculated monthly, reviewed, held for 30 days and paid to your verified bank account; amounts under ₦1,000 roll into the next month.`),
    ...(MESSAGES_LIVE || MOMENTS_LIVE
      ? [A("messages-moments-groups", "Messages, group chats and moments", "Publishing and earning", `
${MESSAGES_LIVE ? `**Messages:** talk one to one, with bold, italic and underline, sent and read ticks, pictures, videos and documents (how big and how many depends on your plan), voice notes of up to 5 minutes and stickers. You can block or report anyone. Open [Messages](/messages).

**Group chats:** start a group from Messages with up to 50 people you follow or who follow you. Group admins can rename it, add and remove people and make others admin; anyone can leave, and any message from someone else can be reported.` : ""}

${MOMENTS_LIVE ? `**Moments:** share a picture, a video of up to 90 seconds or a line of text on your profile picture for 24, 48 or 72 hours. Followers see them in the Moments row on [Journals](/journals); you choose whether only followers, or everyone, can see yours.` : ""}`)]
      : []),
    A("social-sharing", "Sharing posts to social media", "Publishing and earning", `
Every post has a share menu (WhatsApp, X, Facebook, LinkedIn, copy link) that works without connecting anything. Connected publishing, where you connect LinkedIn and X once and publish an excerpt with a link back to your journal, is built and is being switched on; see the [roadmap](/roadmap) for the latest. You always see and can edit the words before anything is posted.`),
    // ── Selling
    A("selling-physical-goods", "Selling physical goods from your store", "Selling", `
Your store lives at /u/yourname/store. Add an item, tick that it is sold through #NotesApp checkout, and set the price, your delivery fee and your stock. You need a payout account under Rates & payouts.

The buyer pays here with their delivery address and gets a parcel ID by email; their money is held until delivery. You dispatch and keep the log (courier and tracking number, or who holds the parcel by bike, bus or motor park). Payout is released when the buyer confirms delivery, or 7 days after you mark it delivered. If the buyer reports a problem the money stays held while we review.

Commission applies to the item price only (see [commission rates](/help/commission-rates)). Stores do not link out to other shops. Full details: [Store selling](/store-selling).`),
    A("digital-downloads-and-courses", "Selling digital downloads, PDFs and video courses", "Selling", `
Choose **Digital download** when you add an item and upload your file (PDF, ePub, ZIP, audio, video, Office files or images, up to 200 MB). It is stored privately; only people who pay can download it, instantly. The sale is final once downloaded, and your share is paid after a 7-day dispute window.

On **Pro and above** you can instead choose **View only**: add lessons (videos or PDFs) that buyers watch or read on #NotesApp with no download, on up to two devices per purchase, with the buyer's email faintly stamped on the content. One lesson is a single view-only file; several make a course. See [Store selling](/store-selling#view-only).`),
    A("track-a-parcel", "Tracking a parcel", "Selling", `
Every store order gets a parcel ID that looks like NA-7K2M9QXD, sent to the buyer by email. Enter it on [Track a parcel](/track) to see where the parcel is, who holds it and the courier details if there are any.`),
    A("merch-store", "The official #NotesApp merch store", "Selling", `
T-shirts, caps, mugs and more, with the core mark or a seasonal logo from the [Brand page](/brand). You pre-order and pay with Paystack; we print after the batch closes and deliver anywhere in Nigeria for a flat ${money(MERCH_DELIVERY_KOBO)}. See the [Merch store](/merchstore); every publisher's own shop is listed there too.`),
    // ── Badges and trust
    A("verified-badge", "The verified badge (maroon ✔)", "Badges and trust", `
The maroon ✔ shows an account in good standing on an eligible plan, or with the badge subscription. **Business and Enterprise include it**; on other plans it is an add-on for ${money(BADGE_PRICE_KOBO)} a month. It is not an identity check. For organisations it also needs us to have confirmed the CAC registration.

For an identity check or an endorsement, apply for the [gold badge](/help/gold-badge). More at [Verification badges](/badges).`),
    A("gold-badge", "The gold badge", "Badges and trust", `
The gold ✔ is for accounts #NotesApp has vouched for, in two kinds: **endorsed** (we review your public work and back you) and **identity-checked** (you pass an ID check: NIN plus a live face check for people, CAC registration for organisations; identity checks are ${goldNow}).

It costs the same on every plan: ${money(GOLD_PRICING.personal.monthlyKobo)} a month for a person or ${money(GOLD_PRICING.corporate.monthlyKobo)} a month for an organisation. An endorsement review is free; an identity check adds a one-off non-refundable deposit (${money(GOLD_PRICING.personal.identityDepositKobo)} personal, ${money(GOLD_PRICING.corporate.identityDepositKobo)} organisation) that covers the third-party check whether or not it passes. We do not collect or store your ID documents; our partner Dojah runs the check and an admin sees only the outcome. You can cancel any time and keep the badge until the period you paid for ends. Apply at [Verification badges](/badges).`),
    // ── Teams and organisations
    A("organisation-accounts", "Organisation accounts", "Teams and organisations", `
Companies, NGOs, churches, schools and clubs can run a verified channel. Sign up as an Organisation with your CAC number (RC, BN or IT) and a work email, verify the email, and start a free ${ORG_TRIAL_DAYS}-day Business trial (no card, one per registration number). We then confirm the registration against the CAC register; until then the channel shows an "unverified organisation" notice.

Already have a personal account? You do not need a new one: open [Make an organisation](/organisation), enter the CAC number, and the same account (with its username, posts and followers) becomes an organisation. If the account is more than a day old, an admin approves the change first.

You can invite writers and admins by username or email; they publish under your channel's name and earnings go to one payout account. Business includes four seats (the owner plus three); Enterprise has as many as you need. See [Organisations](/organisations).`),
    A("your-own-domain", "Your own domain", "Teams and organisations", `
Business and Enterprise accounts can serve their page, journals and store on their own domain (for example notes.yourbrand.com or yourbrand.com), with Home, Notes and Shop pages, and visitors who sign in, book and pay without leaving the site. Business is semi white-label (the footer says "powered by #NotesApp"); Enterprise adds fully branded sign-in and sign-up in your name.

You connect the domain in the Console by adding the DNS records we show. Buying and managing domains inside #NotesApp, with our partner Whogohost (go54), is coming soon; see [Domains](/domains).`),
    A("api-and-console", "The API and Console (Enterprise)", "Teams and organisations", `
Enterprise accounts can use a server-to-server API (switched on per account by our team) to publish posts and read bookings, orders and earnings, with signed webhooks for events like a booking or a paid order. Keys and webhooks are managed in the Console. Ask for access on the [contact page](/contact); the documentation is public at [API docs](/docs).`),
    A("team-hub", "Team hub and team messaging (coming soon)", "Teams and organisations", `
A shared workspace for your team, with a work board, milestones, a morning summary, a weekly review, meetings and a team room, is coming to Business and Enterprise accounts after our own team finishes testing it. It is not available yet and there is no date. See the [Team hub page](/teams) and the [roadmap](/roadmap).`),
    // ── Safety and your data
    A("reports-blocking-appeals", "Reporting, blocking, suspensions and appeals", "Safety and your data", `
You can block anyone in Messages, and report a post, account, moment or conversation with the Report button, or through the [contact form](/contact). Our team reviews reports; anything marked as nudity or violence is reviewed within 24 hours.

Accounts can be suspended for a set time or until lifted. A suspended member sees the reason and can submit an appeal, which an admin reviews. For a problem with a payment, gift or order, contact us with the details and an admin will review it.`),
    A("payment-safety", "How your money is kept safe", "Safety and your data", `
Payments run through Paystack's hosted checkout, so card and bank details never touch our servers. Money is held until it is earned: store payments until delivery is confirmed, session earnings for 24 hours after the session, and subscriptions, gifts and downloads for a short dispute window. You need a verified email to pay. Refund rules are shown before you pay and in the [Terms](/terms). The full picture is on [Trust & security](/security).`),
    A("your-data", "Downloading or deleting your data", "Safety and your data", `
You can download a copy of your data or delete your account yourself from [Account settings](/profile/account). Deleting an account removes your profile, and payment and order records are kept only without your name, email, address or phone number, as the law requires. If you are in a group chat, you leave it; your connected LinkedIn or X access is removed. Read the [Privacy Policy](/privacy) for details.`),
    // ── Company
    A("contact-and-support", "Contacting #NotesApp", "Company", `
Use the [contact form](/contact) and pick the topic (bookings, payments and refunds, store orders and parcels, advertising, organisations, the gold badge, reporting, partnerships, press, investment or anything else). It goes straight to our admins. For a parcel, include its ID. Nana AI can answer most how-to questions, and can pass you to a person when it cannot.`),
    A("about-and-status", "About #NotesApp, status and updates", "Company", `
#NotesApp is run by ${COMPANY_INFO.legalName} (RC ${COMPANY_INFO.rcNumber}), a private company limited by shares registered in Nigeria. Read [About](/about), see live service health on [Status](/status), what changed on the [Changelog](/changelog) and what is coming on the [roadmap](/roadmap). Our domain partner is Whogohost (go54), and we connect to services such as Paystack, Paylony, Cloudflare, Firebase, Vercel, Resend and Dojah.`),
    A("roadmap-whats-coming", "What is coming next", "Company", `
Not live yet, with no promised dates: connected publishing to LinkedIn and X, AI drafting from your past notes, domain sales and DNS management inside #NotesApp, the team hub and team messaging for Business and Enterprise, NotesApp Credit and Bonus Credits, Paylony payments and Tap-to-Pay, WhatsApp reminders, fuller identity checks, and iOS and Android apps. Details and the latest are on the [roadmap](/roadmap).`),
    A("million-naira-challenge", "The #1MillionNairaNotesAppChallenge", "Company", `
A coming-soon challenge for influencers: reach 100,000 views and 10,000 new followers to unlock live video, then reach 2,000 registered members watching one live for at least 5 minutes to open a ₦1,000,000 giveaway (₦250,000 in Bonus Credits for followers you choose, ₦250,000 in NotesApp Credit for you, and ₦500,000 cash). The first ten influencers to qualify each month are paid, each influencer can win once, and fake accounts and bots are disqualified. It is not live yet; see [the challenge page](/challenge).`),
  ];
  return list;
}

// Articles for the #NotesApp team only: how the team hub and admin tools work. They are never shown in the public help centre and never
// go into the public Nana's knowledge; they are added only when a signed-in staff member asks Nana from inside the team hub.
export function internalArticles(): KbArticle[] {
  const A = (slug: string, title: string, body: string): KbArticle => ({ slug, title, category: "Teams and organisations", body: body.trim(), source: "built-in" });
  return [
    A("hub-work-board", "Using the team hub work board", `
Open [Team hub](/admin/team). Every item has a status (To do, Doing, Blocked, Needs a decision, Done) and a horizon (Today, This week, Later), an owner and an optional due date. A **Blocked** item says why it is stuck and on whom; a **Needs a decision** item holds the question and, once answered, the decision. Overdue items sort first. Tick "Only mine" to see your own work, and talk about an item in its comments.

The morning summary (email and bell, switch either off on the hub) lists what is due, blocked or waiting on you. The [weekly review](/admin/team/review) shows the week in numbers and work, with a place for wins, lessons and next week's focus; focus lines can become next week's items. Meetings get their own chat room, decisions and actions, and the team room is the everyday group chat for staff.`),
    A("hub-money-ledger", "Recording money in the ledger", `
The [Money ledger](/admin/team/finance) holds expenses, payroll and money in that is not platform revenue (grants, sponsorships, direct transfers), with receipts, next to platform revenue. Finance records entries dated today or up to 3 days back, adds receipts to any entry and can void recent ones with a reason. Product can read everything except payroll lines. Only the owner can enter older dates, edit an entry, void old history and import a CSV. Nothing is ever deleted: a voided entry stays with who voided it and why.`),
    A("hub-roles", "Staff roles and departments", `
Staff are either a **super admin** (sees everything) or an **admin** with one or more departments: Customer care, Trust & safety, Finance, Growth & partnerships, Editorial, Product & tech. An admin sees only the pages of their departments. At [Team access](/admin/access) the owner appoints and removes super admins, and other super admins appoint and remove admins and choose their departments. The person needs a #NotesApp account first. Nobody can change their own access or the owner's.`),
    A("hub-help-admin", "Writing help articles and reading Nana's chats", `
At [Help & Nana](/admin/help) the team writes the help articles that visitors read at the help centre and that Nana answers from. An article with the same address as a built-in one replaces it. The Chats tab shows what people asked Nana, highlights questions she could not answer and requests for a person (these also appear in the Leads inbox), and lets you mark a chat as followed up or turn a gap into a new article.`),
  ];
}
