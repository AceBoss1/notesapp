import { APP_HOST, APP_URL, LIFE_HOST, LIFE_URL, PREP_HOST, ROOT_DOMAIN } from "./host";
import { AD_PACKAGES } from "./ad-packages";
import { WHAT_IS_INTRO, WHAT_YOU_CAN_DO, WHAT_IS_FREE, WHAT_IS_TIERS } from "./site";
import { BOOST_PACKAGES, GIFT_MAX_KOBO, GIFT_MIN_KOBO } from "./boost-config";
import { LIMITS, formatNaira } from "./booking-time";
import { GOLD_KIND_LIVE } from "./badges";
import { POLICY_TEXT } from "./cancellation";
import { MAX_CO_AUTHORS, MIN_CO_PERCENT, MIN_LEAD_PERCENT } from "./coauthors";
import { GOLD_PRICING } from "./gold";
import { MERCH_DELIVERY_KOBO } from "./merch";
import { LIFE_LIVE } from "./life/catalog";
import { CALLS_LIVE, MESSAGES_LIVE, MOMENTS_LIVE } from "./moments-rules";
import { BONUS_DAYS, BONUS_STEPS, TOPUP_MAX_KOBO, TOPUP_MIN_KOBO, WALLET_LIVE } from "./wallet";
import { ORG_TRIAL_DAYS } from "./org";
import { TRIAL_DAYS } from "./trials";
import { COMPANY_INFO, SITE } from "./site";
import { BADGE_PRICE_KOBO, TIERS, formatPercent } from "./tiers";
import { academyApiFrom, certificateMin, currentPricing, enterpriseCoursesPrice, inventoryAddonPrice, inventoryTrialDays, logisticsAddonPrice, logisticsTrialDays } from "./pricing";
import { academyFaq } from "./academy-faq";
const CERTIFICATE_LATE_TEXT = () => { const l = currentPricing().certificateLate; return { grace: l.graceDays, weekly: `${Math.round(l.weeklyRate * 100)}%`, cap: `${Math.round(l.capRate * 100)}%` }; };
import { VIDEO_MAX_SECONDS } from "./video-rules";
import { COMMENT_MAX, COMMUNITY_FREE_MEMBERS, POST_MAX, SPACES_MAX } from "./community";
import { GROUP_MEMBERS_MAX } from "./messages-rules";
import { GROUP_CALL_MAX } from "./group-calls";
import { ROOM_CHAT_MAX, ROOM_LISTENERS_MAX_P2P, ROOM_SPEAKERS_MAX } from "./rooms";
import { BOARD_DAILY_CAP, DEFAULT_PACK_KOBO, DEFAULT_PACK_MONTHS, MOCK_SIZES, OFFLINE_PASS_DAYS, PAYLINK_DAYS, PREP_NAME, PREP_TAGLINE, REFUND_DAYS } from "./exam-prep";
import type { KbArticle } from "./kb";

// The built-in help articles. Prices, rates and limits are read from the same code the rest of the site uses, so these cannot disagree with
// the pricing page. Plain facts only; if something is not live yet, the article says so. Staff can add articles or override one by slug
// at Admin → Help & Nana.
const t = (id: string) => TIERS.find((x) => x.tier === id)!;
const pct = (id: string, f: "sessionAndUnlockCommission" | "physicalCommission" | "digitalCommission", floor: "sessionAndUnlockCommissionFloor" | "physicalCommissionFloor" | "digitalCommissionFloor") =>
  formatPercent(t(id)[f] as number | "custom", t(id)[floor] as number | undefined);
const money = (kobo: number) => formatNaira(kobo);
const n = (x: number) => x.toLocaleString("en-NG");
// The four tools our own team is testing first; said the same way wherever they come up.
const ADD_ONS_LINE = "The Team hub, company finance tools, the investor and partner data room and advertising on LinkedIn from #NotesApp are being tested by our own team, and will be offered as paid add-ons for Business and Enterprise once that testing is done. There are no prices or dates yet; see [Paid add-ons for Business and Enterprise](/help/paid-add-ons).";

export function builtInArticles(): KbArticle[] {
  const A = (slug: string, title: string, category: KbArticle["category"], body: string): KbArticle => ({ slug, title, category, body: body.trim(), source: "built-in" });
  const goldNow = GOLD_KIND_LIVE.identity ? "open now" : "coming soon";
  const list: KbArticle[] = [
    // ── Getting started
    A("what-is-notesapp", "What is #NotesApp?", "Getting started", `
${WHAT_IS_INTRO}

On #NotesApp you can:
${WHAT_YOU_CAN_DO.map((x) => `- ${x}`).join("\n")}

${WHAT_IS_FREE}

${WHAT_IS_TIERS} See [Plans and prices](/help/plans-and-prices). [Notes Life](/help/notes-life) has its own guide.

Start at [Journals](/journals) to look around, or [create a free account](/signup). The [About page](/about) has the longer story.`),
    A("create-an-account", "Creating an account", "Getting started", `
Go to [Sign up](/signup). Choose **Personal** for a person, or **Organisation** for a company, NGO, church, school or club (organisations also enter their CAC registration number). Pick a display name, a username, an email and a password, tick that you are 18 or older and agree to the [Terms](/terms) and [Privacy Policy](/privacy), and you are in.

You will be asked to follow a few journals so your feed is not empty. Verify your email using the link we send: you need a verified email before you can pay for sessions, subscriptions or gifts.

You can also tell us, if you like, what you do, your role and where you work. It is optional and shows under your name on your profile; change it any time in [Edit profile](/profile/edit).

Every password box has an eye button to show or hide what you typed, so you can check it before you continue. On the app address, [${APP_HOST}](${APP_URL}), you sign in or create your account right on the welcome screen.

Forgot your password? Use [Reset password](/forgot-password).`),
    A("install-notesapp", "Installing NotesApp on your phone or computer", "Getting started", `
NotesApp installs straight from your browser: no app store and nothing to download by hand. Open [${APP_HOST}](${APP_URL}) and press the Download button on the welcome screen. It says **Download on mobile** on a phone or tablet, **Download on PC** on Windows and **Download on Mac** on a Mac, and opens [the install page](/install) with the steps for your device and browser.

- **iPhone or iPad:** open NotesApp in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open it in Chrome, tap the ⋮ menu, then **Install app** (or Add to Home screen).
- **Windows, Mac or Linux:** in Chrome or Edge, click the install icon at the right of the address bar. In Safari on a Mac (macOS Sonoma or newer), choose File, then **Add to Dock**. Firefox on a computer can't install web apps; use Chrome or Edge.

If your browser offers it, the install page shows a one-click **Install NotesApp** button. Inside another app's browser (for example a link opened from Instagram or WhatsApp) installing isn't possible: copy the address and open it in Safari or Chrome. Once installed, NotesApp has its own icon, opens in its own window and keeps you signed in.`),
    A("nana-ai", "Nana AI: your helper on #NotesApp", "Getting started", `
Nana AI is our helper. Ask her anything about #NotesApp from the chat button on every page, from the conversation pinned at the top of your [Messages](/messages), or on her own page, [Nana AI](/nana). She answers in plain words with links to the right page, and if she cannot help she passes you to a person, who follows up by email.

She can also help you write, when you ask: improve, shorten or expand a journal draft, write a post for LinkedIn or X, polish a message, or suggest a reply. In a conversation, if someone asks to book a session, her suggested reply can offer your next open times and your booking link. You always see the result first and decide whether to use it.

If the AI is ever off or unavailable, Nana still answers from the [help centre](/help). To use the AI and writing help today, you can [connect your own AI account](/help/connect-your-own-ai).`),
    A("nana-gems-and-credit", "Nana's gems, free allowance and Nana credit", "Getting started", `
Nana runs on three AI models, named after gems: the dearer the gem, the more capable the model.

- **Pearl:** fast and light, for everyday questions. Every plan.
- **Emerald:** deeper answers and better writing. Business and Enterprise.
- **Ruby:** our most capable, for the hardest work. Enterprise.

You can also choose how long Nana thinks before answering: **Quick** on every plan, **Balanced** from Business, **Thorough** on Enterprise. Choose both from the gem button next to Nana's name in the chat.

**Free allowance.** Every member gets a free allowance on our AI account, sized by plan (Free and Free Basic, Pro, Business and Enterprise each get more). It refreshes on a timer, usually every Monday (Lagos time), and doesn't carry over. Dearer gems and more thinking use it faster. The chat's gem button and the [Nana page](/nana#credit) show what's left and when it refreshes.

**Nana credit.** Anyone, on any plan, can buy Nana credit on the [Nana page](/nana#credit), by card or from your NotesApp Credit wallet. Your free allowance is always used first, then your credit. Credit never expires and carries over. When both run out, Nana answers from the help centre until your allowance refreshes.

**Answer bank.** When you open a chat with a general question someone has asked before (for example "How do I get paid?"), Nana may answer straight away from her answer bank. That's free and doesn't use your allowance. Only general questions go in, never anything personal.

With [your own AI account connected](/help/connect-your-own-ai) there is no allowance and no limit from us.`),
    A("connect-your-own-ai", "Connect your own AI account", "Getting started", `
You can connect your own Anthropic (Claude) account so that Nana, the writing help in drafts, sharing and messages, and the team hub (for staff) use it. The AI cost goes to your account, and #NotesApp puts no daily limit on you.

- Make an API key at console.anthropic.com (you can set a spending limit there). It starts with sk-ant-.
- Open [Nana AI](/nana), find "Connect your own AI account", paste the key and connect. We check that it works, keep it encrypted, and show only its last four characters.
- To remove it, disconnect on the same page. Deleting your account also deletes the key.

If the key is rejected or out of credit, Nana tells you and answers from the help centre instead. Your text is sent to Anthropic only when the AI writes an answer or you ask for writing help; see the [Privacy Policy](/privacy).`),
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

**Free trials:** you can try Pro and Business free for ${TRIAL_DAYS} days each, with no card, from [Pricing](/pricing) (a verified email is needed). Each plan can be tried once. When a trial ends you're back on the plan you pay for, or Free Basic, and everything you published stays. To try another plan after a trial, pay for a plan first: a paid plan has to come between two free trials. You can upgrade or downgrade by paying at any time. Add-ons (such as logistics) have a one-time free trial of up to ${TRIAL_DAYS} days too.

**Courses (Notes Academy):** free courses are free to publish on every publishing plan. Certificates on free courses are paid: the learner pays from ${certificateMin()} plus the margin the teacher sets. Paid courses: on Pro with text lessons, PDFs and YouTube, and on Business and Enterprise with uploaded videos too, with the same fee as digital items. For organisations, two packages sit on top of Enterprise: **Enterprise Courses** at ${enterpriseCoursesPrice()} a month, and the **Enterprise Academy API** from ${academyApiFrom()} a month plus usage. The regular Enterprise price stays as it is for anyone who takes neither.

**Coming as paid add-ons:** ${ADD_ONS_LINE}

Paid plans renew automatically through Paystack, monthly or yearly. Cancel any time under Rates & payouts and you keep the plan until the period you paid for ends; there are no partial refunds. Every price and difference is on the [pricing page](/pricing).`),
    ...(WALLET_LIVE
      ? [A("notesapp-credit-wallet", "NotesApp Credit: your wallet", "Plans and pricing", `
**NotesApp Credit** is a prepaid balance. Top up once in your [Wallet](/profile/wallet) and pay across #NotesApp without entering your card each time.

**Top up:** from ${money(TOPUP_MIN_KOBO)} to ${money(TOPUP_MAX_KOBO)} at a time, through Paystack (card, bank transfer or USSD). Open the menu under your name → **Wallet** → **Top up**.

**Top up with CardTap:** on an Android phone with NFC, choose **Tap to pay with CardTap** under Top up. You get a code: open the free [CardTap app](https://play.google.com/store/apps/details?id=com.lonytech.cardtap) from Paylony, paste the code (or scan its QR), tap your bank card on the phone and enter your PIN. Your wallet updates by itself a moment later. CardTap's own fee is added at cost, 1% of the top-up and never more than ₦1,000, and you see it before you pay (during the launch offer, #NotesApp pays it for you). It's usually cheaper than paying by card. iPhones from the iPhone 13 follow when Paylony adds them. Refunds of a CardTap top-up go through Paylony.

**Bonus Credits** come with larger top-ups:
${BONUS_STEPS.map((b) => `- ${money(b.fromKobo)} or more: **+${money(b.bonusKobo)}**`).join("\n")}
They last ${BONUS_DAYS} days, are spent before your own credit (soonest-ending first), and can be used only for boosts, the verification badge and advert banners (and paid calls, when those arrive). Bonus amounts can change and are always shown before you pay.

**Paying from your wallet:** when you pay for a boost, the maroon ✔ badge, an ad campaign, a gift, a shop item, a download or a paid session, and you have something in your wallet, you're asked **Wallet** or **Card, bank transfer or USSD**. The same prices and rules apply as paying by card:
- Shop items are **held** until you confirm delivery, and sessions until they have happened; then the seller is paid.
- A badge paid from the wallet lasts one month and doesn't renew by itself; add it again when it ends.
- Gifts, shop items, downloads and sessions use your credit only, not Bonus Credits.

**Refunds** of a wallet payment (a cancelled boost, a cancelled session, an order that never arrived) go back to your wallet. Any Bonus Credits you used come back as Bonus Credits for another ${BONUS_DAYS} days.

**What you can't do:** NotesApp Credit can't be withdrawn, cashed out, sent or sold to another member. Sellers and publishers are always paid to their bank accounts, never into a wallet. Plans (Pro, Business), journal subscriptions, the gold badge and merch are paid by card for now.

**Your statement:** the Wallet page lists every top-up, payment, refund and expired bonus, with filters (Top-ups, Spent, Bonus, Held, Refunds). Closing your account? Spend your credit first, or [contact us](/contact) to refund unspent top-ups to your card (Bonus Credits aren't refunded).`)]
      : []),
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

Pick up to 3 topics for each journal (and add your own hashtags), so readers who chose those topics see it first in their feed and their weekly digest; see [Choosing your interests and topics](/help/interests-and-topics).

Readers can follow your journal, comment, like, share and save. You can also [boost a post](/help/boost-a-post) to reach more readers, or [co-author](/help/co-authoring) with other members. Browse examples on [Journals](/journals).`),
    A("kiswahili-journals", "Journals and voice notes in Kiswahili", "Publishing and earning", `
With NKENNEAi, journals and voice notes can reach Kiswahili speakers.

**For writers:** when you write or edit a journal, tick **Offer this journal in Kiswahili**. Readers then get **🌍 Kiswahili** (the journal translated, with **Show original**) and **🔊 Sikiliza** (it read aloud in Kiswahili, in a female or male voice, at 0.75×, 1× or 1.25×). It's translated, and the audio made, the first time a reader asks, then kept for everyone. Edit the journal and a fresh version is made next time. Not for subscriber-only (premium) posts: those words stay with your subscribers.

**Voice notes in Messages:** under someone's Swahili voice note, tap **Transcript** or **Translate to English**; under your own English voice note, tap **In Kiswahili**. The words stay on the message for both of you.

If you don't see these, Kiswahili isn't switched on yet.`),
    A("paid-sessions", "Paid 1:1 sessions and bookings", "Publishing and earning", `
Publishers set a session price (${money(LIMITS.sessionMinKobo)} to ${money(LIMITS.sessionMaxKobo)}), a length and their weekly availability, shown in Lagos time. A visitor taps **Book a session** on the publisher's profile, picks a time, pays in Naira (through Paystack, or from their wallet), and both of you get a confirmation email and reminders 24 hours and 1 hour before.

**Cancellations and refunds:** ${POLICY_TEXT}

To earn from sessions, add a verified bank account under Rates & payouts. Manage your own bookings on [My bookings](/bookings). More at [Booking](/booking).`),
    A("subscriptions", "Journal subscriptions", "Publishing and earning", `
A publisher can offer a paid monthly subscription (${money(LIMITS.subscriptionMinKobo)} to ${money(LIMITS.subscriptionMaxKobo)} a month) that unlocks their premium entries. Readers subscribe from the publisher's profile, pay by Paystack, and renew automatically; cancel any time.

For the publisher, subscription money is released to their verified bank account after a 7-day window, minus the commission for their plan (see [commission rates](/help/commission-rates)).`),
    A("gifts", "Gifts", "Publishing and earning", `
A reader can send a publisher, or one single post, a gift from ${money(GIFT_MIN_KOBO)} to ${money(GIFT_MAX_KOBO)}, with a short note, or anonymously. Gift is the **Gift me** button on a publisher's profile and the 🎁 on their posts; both switch on once the publisher has added a payout account. If Gift me is greyed out, tap or hover the ℹ️ beside it.

You need a verified email to send a gift, and you cannot gift yourself. Gifts are paid to the publisher's bank account 7 days after they arrive (a short dispute window), minus their plan's commission. More at [Gifts](/gifts).`),
    A("analytics", "Your analytics", "Publishing and earning", `
[Analytics](/profile/analytics), under My account, shows how you're doing in one place.

**Overview:** what you earned after our fee (from store sales, downloads, sessions, subscriptions, gifts, courses and more), orders paid and how many checkouts were started, your average order, and visits to your profile, site, journals, items and courses, each with the change on the period before. A chart shows each day, and you can switch it between earnings, orders and visits. **Selling best** lists your top items and **Running low** the physical items with 3 or fewer left.

**Tabs:** Sales (where your earnings came from), Orders, Products (views, sold, sales and stock per item), Customers, Visits and Promotion (what your boosts and adverts were seen and clicked).

**What each plan sees:** every plan sees the last 7 days. **Pro** adds the last 30 and 90 days, the **Customers** tab (everyone who has bought from you, how much they've spent and when they last ordered, most valuable first) and **Download sales**, a spreadsheet of your orders. **Business and Enterprise** add **visits by page** and **where visitors came from**: WhatsApp, Instagram, Facebook, X, LinkedIn, TikTok, YouTube, search engines, other websites, or direct.

**Organisations:** teammates with store access can switch to the organisation's analytics.

**How visits are counted:** once per visitor per page every 30 minutes (store items and courses once a day), never your own, and only from the day analytics started. Apps such as WhatsApp often hide where a visit came from; add \`?utm_source=whatsapp\` (or instagram, facebook…) to links you share so those visits are counted right. Customers' details are for running your orders only.`),
    A("payouts", "Getting paid: payouts and when money is released", "Publishing and earning", `
Add a bank account under Rates & payouts. We verify the account name first and store only the account name, bank and last four digits. Then:
- **Sessions:** paid 24 hours after the session ends.
- **Subscriptions and gifts:** released after 7 days.
- **Physical store orders:** released when the buyer confirms delivery, or 7 days after you mark it delivered if they say nothing.
- **Digital downloads:** after a 7-day dispute window.
- **Ad share:** monthly, after review (see [Ads and ad share](/help/ads-and-ad-share)).

Money can be held while we review a reported problem. Commission depends on your plan: see [commission rates](/help/commission-rates).`),
    A("boost-a-post", "Boosting a post or a store item", "Publishing and earning", `
A boost puts a published post, or an item in your store, in front of more readers: a boosted journal appears in the journal feed marked **Promoted**, and a boosted item in the Boosted strips on the home page and in [Notes Market](/shop). The strips show a few boosts at a time on a computer or tablet and one on a phone, taking turns, and boosts also go in the sponsored slots of the [weekly digest](/help/weekly-digest), where each email sent counts as one impression. The best picture is 1200 × 628 px (see [Advert sizes and spots](/advertise/specifications)). You pay for validated impressions (a real visitor had it at least half on screen for about a second, counted once per visitor per day), not for clicks.

Packages:
${BOOST_PACKAGES.map((p) => `- **${p.name}**: ${money(p.priceKobo)} for ${n(p.impressions)} impressions, delivered over at least ${p.minDays} days, running up to ${p.windowDays} days.`).join("\n")}

Boosts have no commission, and anything not delivered by the end is refunded pro rata. You can also cancel a running boost under Boost performance: impressions already delivered are spent, you get half of the undelivered share back and forfeit the other half. If #NotesApp cancels a boost, the whole undelivered share is refunded and you are told why. See [Boost](/boost).`),
    A("co-authoring", "Co-authoring a post", "Publishing and earning", `
Pro, Business and Enterprise publishers can write a post with other members. The lead invites up to ${MAX_CO_AUTHORS} co-authors by username on a draft and sets each person's share of what the post earns (the lead keeps at least ${MIN_LEAD_PERCENT}%, each co-author at least ${MIN_CO_PERCENT}%). Everyone must accept before being listed, and the split locks when you publish.

Co-authors need a publishing account (Free Basic or above) to accept, because their share is paid to a bank account. Gifts on the post are split in the agreed percentages; sessions stay personal to each author. See [Co-authoring](/coauthoring).`),
    A("ads-and-ad-share", "Ads and ad share", "Publishing and earning", `
**Advertising on #NotesApp:** anyone can buy a banner campaign, paid online and priced by validated impressions:
${AD_PACKAGES.map((p) => `- **${p.name}**: ${money(p.priceKobo)} for ${n(p.impressions)} impressions, up to ${p.windowDays} days.`).join("\n")}
Every ad is reviewed; if we cannot run it you are refunded in full, and impressions not delivered by the end are refunded pro rata. Start at [Advertise](/advertise).

**Sizes and spots:** one picture works everywhere: **1200 × 628 px** (1.91 : 1; at least 600 × 314, up to 2400 × 1256 for sharp screens), JPG, PNG or WebP, best under 500 KB and at most 1 MB, with the logo and words inside the middle 960 × 502. The campaign form crops other shapes for you before you pay. The headline is up to 60 characters and the text up to 120. Adverts can show on the home page, the journal feed, Trending, publishers' profiles and posts (when they show adverts), Notes Market, Notes Academy, Explore, search results, free course pages, the weekly digest (each email sent counts as an impression) and, if you choose, on a billboard in Notes Life, which needs its own 1600 × 900 picture. Never in Messages, checkout, lessons, paid course pages, certificates or the editors. When a spot has several adverts, each stays about 30 seconds. All of it, with templates to download: [Advert sizes and spots](/advertise/specifications).

**Ad share for publishers:** Pro publishers earn ${formatPercent(t("pro").adRevenueShare!)} and Business publishers ${formatPercent(t("business").adRevenueShare!)} of the ad revenue on their pages if they opt in, with no follower or view threshold. Free journals always show ads and have no share. Shares are calculated monthly, reviewed, held for 30 days and paid to your verified bank account; amounts under ₦1,000 roll into the next month.`),
    ...(MESSAGES_LIVE || MOMENTS_LIVE
      ? [A("messages-moments-groups", "Messages, group chats and moments", "Publishing and earning", `
${MESSAGES_LIVE ? `**Messages:** talk one to one, with bold, italic and underline, sent and read ticks, pictures, videos and documents (how big and how many depends on your plan), voice notes of up to 5 minutes and stickers. You can also drag pictures and files into a conversation, or paste them. A web address in a message becomes a link with a preview card (the page's picture, title and description). You can block or report anyone. Open [Messages](/messages).

At the top of every conversation is the person's picture, their name with any badge, and whether they are online (see [Followers, following and online status](/help/followers-and-online-status)). ${CALLS_LIVE ? "The phone and camera buttons start a **free voice or video call** with anyone you follow who follows you back; tap **Call back** on any call line to call again (see [Voice and video calls](/help/voice-and-video-calls)). " : ""}The small arrow beside it opens a menu: **View profile**, **View moments**, **Create group**, **Mute notifications** (no bell, push or email for that one conversation until you unmute it), **Block** and **Report**.

**Pins:** open the **⋯** menu on a message and choose **Pin** to keep it in a bar at the top of the chat, up to 3 per chat (in a group, only admins can pin). Tap a pinned message to jump to it. In your inbox, tap **📌** on a chat with a person or an organisation to keep it at the top, up to 3 chats; only you see your pinned chats.

**Typing:** while the other person is writing you see "…typing" at the bottom of the chat; in a group you see who is typing. It stops when they send or leave the chat.

**Edit or delete a message:** open the **⋯** menu on your own message. While nobody has read it, **Edit** and **Delete** happen straight away. Once it has been read (✔✔), everyone who read it gets a request to **Allow** or **Decline**; the change happens only when all of them allow it, and you can **Withdraw** the request. A request nobody answers is wiped after 30 days, like a draft (this doesn't affect journal drafts). Edited messages say "edited"; deleted ones show "This message was deleted", and their files are removed.

**Group chats:** start a group from Messages with up to 50 people you follow or who follow you. The top of a group shows its picture and how many members it has. Group admins see a **⚙️ Manage** button at the top of the group. From there they can rename it, set the group picture, add and remove people, make others admin, **switch member messages off** (then only admins can write and everyone else can still read) and back on, and **ban** someone who misbehaves: they are removed and can't be added back until an admin unbans them. Admins can also tap **Remove** under any message to take it out of the group: everyone then sees "Message removed by a group admin" in its place, and any files in it are deleted. If you don't see these options, you aren't an admin of that group: the members list marks who is. Anyone can leave or mute a group, and any message from someone else can be reported to #NotesApp; if we act on a report, the message is removed ("Message removed by #NotesApp").` : ""}

${MOMENTS_LIVE ? `**Moments:** share a picture, a video of up to 90 seconds or a line of text on your profile picture for 24, 48 or 72 hours. Followers see them in the Moments row on [Journals](/journals); you choose whether only followers, or everyone, can see yours. A moment is not your profile picture: to change your picture, tap + on your own picture and choose **Update profile picture**, or go to [Edit profile](/profile/edit).` : ""}`)]
      : []),
    ...(MESSAGES_LIVE
      ? [A("chat-photos-and-media", "Photos, videos, links and docs in a chat", "Publishing and earning", `
**Photos and videos** in a chat show as pictures only, like WhatsApp. Tap a photo (or the full-screen button on a video) to open it full screen inside #NotesApp.

**The viewer:** swipe between the chat's photos and videos, oldest to newest, with "2 of 7" at the top; on a computer use ‹ › or the arrow keys. It says who sent each one and when, with **★ Keep** and **↪ Forward** at the top and **⋮** for the rest: go to the message in the chat, share it to another app (on a phone), **Save** it (it downloads where you are), see all the chat's media, or delete it for you.

**Your own photos and videos** can be posted as your moment, and your own photos made your profile picture, straight from the viewer. Someone else's can be kept, forwarded, shared or saved, never posted as yours.

**Media, links and docs** (in a chat's ⋮ menu): everything shared in the chat in three tabs. Photos and videos in a grid by month, newest first; documents with their size, who sent them and when; and every link with its preview. Press and hold, or tap **Select**, to forward, keep or delete several for you at once.`)]
      : []),
    ...(CALLS_LIVE
      ? [A("voice-and-video-calls", "Voice and video calls", "Publishing and earning", `
**Free voice and video calls** in [Messages](/messages), with anyone you follow who follows you back. No minute limit, on every plan.

**Make a call:** open the conversation and tap the **phone** (voice) or **camera** (video) at the top. It rings on the other person's phone or computer wherever they are on #NotesApp, for up to 45 seconds. During a call you can mute, turn your camera off and on, and end the call. In a video call, drag your own small picture to any corner, tap it to swap it with the other person's, and tap **🔄** to switch between your front and back camera.

**Share your screen (computers):** in a video call on a computer, tap **Screen** and choose a window, tab or your whole screen. The other person sees all of it; tap **Screen** again, or **Stop sharing** in your browser, and your camera comes back. Phones can't share their screen: phone browsers (and the app installed from them) don't allow it.

**Check it's private:** once a call connects, tap **🔒 End-to-end encrypted** to see a 12-digit safety code. The other person sees a code too: read yours out to each other. If they match, the call is encrypted between your two devices and nobody in between, not even #NotesApp, can listen in or watch. If they don't match, end the call.

**Answer:** an incoming call shows a card with **Answer** and **Decline**, with a soft ringtone. If you [installed #NotesApp](/install) and allowed notifications, a call also rings when the app isn't open on your screen: the notification buzzes and sounds again every few seconds for the length of the call, with **Answer** and **Decline** buttons. If you don't answer, it becomes a missed call.

**Missed calls and Call back:** every call leaves a line in the conversation (for example "Voice call · 3:12", "Missed video call", "Declined voice call"). A missed call also sends a bell and, if you turned them on, a notification on your device. Tap **Call back** on any call line to call that person again, the same kind of call (voice or video). Call back isn't offered in group chats or to someone you've blocked.

**Who you can call:** only people you follow who also follow you, and who haven't blocked you. If you can't call someone, check that you follow each other.

**Group calls:** in a group chat, tap the **phone** (voice) or **camera** (video) at the top to call the group. Everyone in the group gets a ringing card with **Join** and **Not now** (and a notification if you turned them on), and the chat shows **Join call** while someone is in it, so you can join late. Up to **6 people** can be on a voice call and **4** on video: each phone connects straight to every other phone, so every extra person adds data for everyone, and a phone on mobile data copes best with a few. When it's full, others see "The call is full". Mute, turn your camera off and leave whenever you like; the call ends when the last person leaves, with a line in the chat such as "Group voice call · 12:03 · 4 people". Tap someone's picture during the call to compare your safety code with them. Bigger meetings are planned with [Community](/community).

**Privacy:** calls go straight between your two devices and are end-to-end encrypted (compare the safety code to check). On networks that block a direct connection, the call passes through Cloudflare's relay, which can't listen. We never record calls. We keep only a short record (who, voice or video, when, how long, answered or missed), which is deleted with your account. See [Privacy](/privacy).

**If a call won't work:**
- Allow the **microphone** (and the **camera** for video) when your browser asks. If you said no before, allow it in your browser's site settings or your phone's settings, then try again.
- "Calls are for people who follow each other": follow each other first.
- "Verify your email first": starting a call or sending a message needs a verified email. Open the link we emailed you when you joined (check spam), or tap **Resend link** in the yellow bar at the top of the page. It works straight away once you have clicked the link. Answering, declining and ending a call never need it.
- The call rings but doesn't connect, or drops: try another network (Wi-Fi or mobile data), and close other apps using the camera or microphone. Our [Status](/status) page shows whether calls and the relay are working.
- On iPhone, use Safari or the installed #NotesApp app; on Android, Chrome works best.
- Calls can't reach emergency services.

**Data:** calls go over the internet (Wi-Fi or mobile data), not the phone network. #NotesApp doesn't charge for them, but your mobile network charges its usual data rates for the data a call uses; a video call uses much more data than a voice call, so use Wi-Fi when you can.

Calls are free. Planned: paid calls inside Notes Life (₦5 a minute voice, ₦10 a minute video, from NotesApp Credit), always with the rate shown first. Booked sessions and meetings use a separate video service.`)]
      : []),
    ...(LIFE_LIVE
      ? [A("notes-life", "Notes Life: the NotesApp life game", "Publishing and earning", `
**Notes Life** is a free life game you play in your browser with your NotesApp account, at [${LIFE_HOST}](${LIFE_URL}) or [Play Notes Life](/life/play). The first playable version is set in **Wuse, Abuja**. Lagos and Port Harcourt come later.

**Starting out:** you begin on day 1 with **N$ 100,000** (Notesville Naira) in a room with sage walls: a bed, a bedside lamp and a deal phone, a wardrobe, a WC and bath, a desk with an old big desktop, a standing fan, a bicycle and the maroon NotesApp rug. Rent is **N$ 60,000 every 30 game days**, paid to your landlord, Alhaji Bello. It is taken automatically when it falls due; if you can't pay, it waits as rent owed until you can.

**Time:** the game clock is the same for every player. A game day lasts 48 real minutes (a game hour is 2 minutes), so a game month of 30 days is one real day.

**Your six needs:** Hunger, Energy, Fun, Social, Hygiene and Bladder go down as time passes (only while the game is open), faster on **Hard** and slower on **Easy**; change difficulty any time in Settings. Eat, sleep, read at your desk, message a friend, bathe and use the WC to fill them. When any need is below 40% it turns amber and work pays 20% less.

**Jobs:** apply from the phone or the Jobs menu. A shift takes 4 game hours (8 real minutes) and pays when it ends, even if you close the game. General jobs include Junior writer (N$ 6,000 a shift from your desk, faster on a laptop or all-in-one PC), Delivery rider (twice the deliveries on an e-bike), Maths tutor and Tech freelancer (needs a laptop or all-in-one). **Chef Adams** offers Kiosk attendant, Line cook (cooking skill 3), Delivery rider and, after 10 Chef Adams shifts, Outlet supervisor; **Become a Partner** shows what a Chef Adams kiosk or shop would cost.

**Deal calls:** the bedside phone rings with deals: accept (you pay the cost, you are paid more when the deal is done), negotiate (a better price, but they might walk away) or decline. A smartphone deal line rings more often with bigger deals.

**Food:** order from **@chef_adams** by delivery (to your room, N$ 300 fee), takeaway or dine-in (a little Fun and Social too), or buy the small cooker and cook at home: cheaper, takes time, and raises your cooking skill. Craving it for real? [@chef_adams](/u/chef_adams) is on NotesApp.

**Upgrades:** the shop sells better rugs, a refurbished laptop or an all-in-one PC, an inverter AC (deeper sleep), the cooker, an LED lamp, a smartphone deal line, a Green Wheels e-bike and an electric car. Things are eco-friendly where they can be (refurbished, low power, induction, zero fuel).

**Getting around:** ride your bicycle (free, costs energy), take the metro bus, a keke or a taxi. After a few bike rides the game suggests an e-bike.

**Candellux Imperial, Garki:** for players doing well, the partner hotel has a luxury suite, a 24-hour restaurant, the pool, the VIP bar, a gym, a barbing saloon and laundry. Each panel also shows how to book the real Candellux on WhatsApp.

**A stay at the Candellux:** book the luxury suite (N$ 180,000) and the room is yours till **checkout at 11 AM** game time (check in from 6 AM and it runs to 11 AM the next day), even while you swim or leave the hotel: come back and tap **Your room** any time before checkout. Every time you're in the room (rest an hour, or sleep up to 8 hours), **Energy, Hygiene, Bladder and Fun go to 100%**. While you're staying, the 24-hour restaurant sends food up as **room service** and fills you up (Hunger to 100%).

**The pool, the bars and the gym:** turn round to the back of Candellux (or tap the pool) for the **Pool** tab. A day pass is N$ 25,000; you swim with other players and residents in the shallow end until you've had **3 swimming lessons** with Coach Femi (N$ 15,000 each), then the deep end too. Lessons and swims build your **swimming skill** (up to 10). The **pool bar** is N$ 10,000; the **VIP bar** is N$ 11,500 (15% more) and is where you meet the richest residents on the Billionaires List: who's in changes every 4 game hours, and you can say hello to chat. The gym is the tall block on the right.

**Choosing a city:** new players pick a city. **Abuja** is open; **Lagos** and **Port Harcourt** are coming soon: tap **Tell me when it opens** and we'll let you know.

**The Billionaires List:** your net worth (your N$ plus what you own) ranks you against every player. It shows your NotesApp username, picture and city. Brag on WhatsApp from the list.

**Buying Notesville Naira:** in the Bank, buy N$ with your NotesApp Credit wallet or a card, ₦100 to ₦100,000 at a time. **₦1 buys N$ 100.** Notesville Naira is game money: it can't be cashed out, sent to another player or turned back into credit, and buying it is final.

**Inviting friends:** the Invite panel lets you pick people from your phone's contacts (where your browser allows it) and send your link by WhatsApp or SMS, or share or copy it. When a friend joins from your link and **finishes their first shift**, you each get **₦250 NotesApp Bonus Credit** in your wallet. Your friend needs a verified email, someone can only be invited once (when they first start playing), and you can earn for up to 20 friends a month. Bonus Credit lasts 90 days and pays for boosts, ads and badges. If your friend's email isn't verified yet at their first shift, you both get it after their next shift once it is. **Your invites** at the bottom of the Invite panel lists everyone who joined from your link and where they are: *Needs a first shift*, *Needs a verified email*, *₦250 each* (paid) or *Over the monthly limit*; the bonus also shows in your [wallet](/profile/wallet) as "Invite bonus". The 🎁 **Invite** button under the clock opens the panel from anywhere. Big moments in the game (a new job, your first shift, a deal, a suite night, a purchase) offer a **Share on WhatsApp** button.

**Your progress:** money, what you own, your job and deals are kept on our servers, so they can't be lost. Your needs, where you are and your outfit are saved on your device every few seconds and to your account every 30 seconds, so you can carry on from another phone or computer. Settings → **Restore points** keeps one save for each of the last 24 hours and 7 days, in case something goes wrong. Your Notes Life data is included in your data download and deleted with your account.

**NEPA (power cuts):** a few times every game day the light goes for every player at the same moment, for 2 to 6 game hours. Without power your lamp and fan stop, you can't read at night, an old desktop can't do desk work, and you sleep hot. Your choices: an **itel Power GO Pro** (320Wh, silent: it runs your lamp, fan and laptop, recharges when light returns, and by day with the **100W solar panel**), a generator from the market (**“I Better Pass My Neighbour” 950W** or the **big 3.5kVA**, which runs the AC too; both need petrol, N$ 1,100 a litre), or the dark. The small home solar kit is coming. When light returns: *nwiiiii… UP NEPA!*

**itel Energy:** the solar shop on the Wuse market road (Go → itel Energy) sells the Power GO Pro (N$ 150,000), the solar panel (N$ 55,000) and, soon, the home kit. It's a Notes Life partner: the real Power GO Pro is sold on NotesApp by [@clickam](/u/clickam), the itel distributor.

**Digital Witch (tech skills):** the Digital Witch training hub is on the ground floor of the Skyscraper Plaza in the Central Business District (**Go → Digital Witch hub**, or Phone → **Digital Witch**). Pay for a course, then take its classes at the hub between 9 AM and 6 PM: one class is 2 game hours (Energy −10, Fun +5). Courses: Virtual Assistant and Customer Support (N$ 60,000, 4 classes), Social Media Management (N$ 80,000, 5), Project Management (N$ 100,000, 5), Data Analysis and UI/UX Design (N$ 120,000, 6). Finish every class to get **Digital Witch certified**. Tech jobs need a certificate: remote virtual assistant (N$ 9,000 a shift), remote customer support (N$ 8,500), social media manager (N$ 11,000), remote project coordinator (N$ 14,000), data analyst (N$ 16,000, needs a laptop), UI/UX designer (N$ 18,000, needs a laptop) and Tech freelancer (any certificate). If you already had a tech job, you keep it.

**Ekwutosi Cynthia Okeh:** the founder of Digital Witch is #1 on the Billionaires List. She's at the hub from 9 AM to 5 PM and at the Candellux VIP bar from 7 PM to 11 PM. On **Saturday nights** at the VIP bar she runs a **graduate giveaway**: if you hold a Digital Witch certificate and have worked 10 tech shifts, go up to her once a week for a chance at **N$ 500,000** or **N$ 1,000,000**. To learn for real, visit [digitalwitchng.com](https://digitalwitchng.com).

**Chatting with friends:** players who follow each other on NotesApp can chat inside the game. Open **Phone → Friends** and tap **💬 Chat**, or tap a friend who is at the same place as you. It's the same conversation as your NotesApp [Messages](/messages), with the usual rules (blocks, reports). Each message you send gives **+8 Social** (**+12** when you're at the same place) and each reply **+4**, up to **+40 an hour**. Unread messages from friends show as a number on the Phone button. On desktop the chat sits on the right while you keep playing.

**Residents and other players:** residents are computer players, always marked 🤖. They live around Wuse, Chef Adams, itel Energy and Candellux; tap one to chat (Greet, Food, Work, NEPA, Money) for Social, and some are on the Billionaires List (switch to *Real players only* to hide them). Chats with residents stay on your device only. Real players who are at the same place as you right now (Chef Adams, Candellux, itel Energy, the street, a ride) appear with 👤 and their name; tap one to open a real NotesApp chat. Turn off *Show me to other players* in Settings to stay hidden.

**Sound:** taps, money in and out, the ringing deal phone, water, cooking and more, plus what's around you: birds by day, crickets at night, traffic on the street and lounge music at Candellux. In your hotel suite, at the VIP bar and in class at the Digital Witch hub you hear a soft tune instead, and none of NEPA's noise. All of it is made by your browser, so it downloads nothing. The 🔊 button at the top mutes it; Settings has sliders for the volume, the effects and the surroundings (kept on that device). Sound starts after your first tap, as browsers require.

**More jobs at the partners:** at **itel Energy** (Go → itel Energy → Jobs): sales attendant (N$ 5,000 a shift plus up to N$ 1,500 bonus on Power GO sales), CarlCare technician (N$ 8,000, needs a laptop), solar installer (N$ 9,000, needs a bicycle or e-bike) and store supervisor (N$ 12,000, after 10 itel shifts). itel staff get 20% off itel products. At **Candellux** (Garki → Jobs): front desk (N$ 6,000), restaurant waiter (N$ 5,000 plus tips), housekeeping (N$ 4,500 and a free staff meal), pool lifeguard (N$ 6,500 plus up to N$ 1,500 rescue bonus, needs gym fitness), swimming instructor (N$ 8,000 plus a lesson bonus, needs swimming skill 5), gym instructor (N$ 8,500, after 10 gym sessions), restaurant cook (N$ 7,500, cooking skill 4) and duty manager (N$ 15,000, after 15 Candellux shifts and 4★). Candellux staff pay half price at the pool, gym, pool bar and VIP bar.

**Become a Partner (own an outlet):** at Chef Adams and itel Energy, the **Partner** tab sells outlets: a Chef Adams **Takeaway Kiosk** (from N$ 2.5m, after 10 Chef Adams shifts and 3★) and **Mini Dine-In Shop** (from N$ 8.0m, after running a kiosk for 7 game days at 80% quality and 4★); an **itel Home Store** (from N$ 1.5m, after 5 itel shifts and owning a Power GO) and **itel Mall Store** (from N$ 7.0m, after running a Home Store for 7 game days and 4★). Choose Wuse market or Garki Area 1 (12% dearer, 12% busier). Outlets are run by residents 🤖 while you're away, and appear in Notesville with your name on them. Chef Adams keeps 8% of sales as the brand fee; itel earns from the stock you buy at partner prices; your staff's wages come out too. Collect your takings at the outlet or in Phone → **Businesses**: they wait up to **30 game days** (about a real day), then the outlet stops selling until you collect. Quality slips while takings sit uncollected. Without backup power an outlet sells half during blackouts: fit an itel Power Tank 1000 and two 650W panels (N$ 620,000) to sell through them. An outlet's value counts on the Billionaires List. Real players work shifts at the brands' own outlets; outlets players own are staffed by residents for now. Want the real thing? The Partner tab links to the [Chef Adams franchise](/journals/own-a-chef-adams-franchise-in-your-choice-location) and [itel Home](https://www.itel-life.com/ng/itel-home/about-itel-home) pages.

**Fridge, microwave and keeping food:** tick **Keep for later** when you order takeaway or delivery, and the food is stored as plates (cooked plates are stored too). Without a fridge stored food spoils after **8 game hours**; in a fridge it keeps while the fridge has power. In a blackout the fridge needs a generator or the **itel Power Tank 1000** (N$ 400,000, runs the fridge about 5 game hours, and your lights when the Power GO is empty), charged by NEPA or by day with **650W bifacial panels** (N$ 110,000 each, it takes two). A **microwave** warms stored food: Hunger +50 instead of +40 cold.

**Billboards:** the roads carry billboards for the partners and for the #1MillionNairaNotesAppChallenge. Tap one to open it.

**Leaving:** Phone → **NotesApp**, or **Back to NotesApp** in Settings, saves your game and takes you to your journal feed on [${APP_HOST}](${APP_URL}/journals).

**Paying with CardTap:** every Notesville Naira payment at a counter (food, the Candellux, fares, petrol, the itel shop, courses, outlets) is a tap of your **Paylony CardTap** card: the merchant's phone shows who you're paying and how much, you tap your card, it beeps and approves. It's game money only; buying N$ with NotesApp Credit is a normal checkout. Turn the tap off in Settings → **Tap to pay with CardTap** and payments go straight through. Your card is in the Central Bank of Notesville (tap your N$ balance).

**Partners:** Chef Adams, itel Energy, Candellux Imperial, Digital Witch and Paylony (CardTap) are real businesses that partner with Notes Life (see [Partner with Notes Life](/life/partners), where businesses can ask to join). Their in-game prices are game prices; real orders and bookings are made with them directly.

**Talk to other players:** tips, bug reports, ideas and news of each update are on our [Discord](${SITE.discord}) (also linked from the game's Settings and the [Notes Life page](/life)).`)]
      : []),
    A("followers-and-online-status", "Followers, following and online status", "Publishing and earning", `
**Followers and following:** under the follower count on every profile are **Followers** and **Following**. Open either to see the people and organisations, 30 at a time. You must be signed in. You can see someone's lists only if they have made their lists visible **and** you have yours visible too; your own lists are always visible to you. Follower counts stay public.

**Online and last seen:** on Messages, in a conversation and on profiles you can see whether someone is **Online** now or when they were **last seen**, but only for people who follow you and whom you follow back. It updates about every three minutes. "Last seen: not recorded yet" means they haven't opened NotesApp since this was switched on.

**Your two switches** (both on to start with) are under [Account settings](/profile/account) and in your message settings on [Messages](/messages): *Show when I'm online and when I was last seen*, and *Let signed-in members see who follows me and who I follow*. The rule is the same for both: if you switch yours off, you can't see other people's either.
**On the rest of NotesApp:** a "Need a 5-minute break?" card about Notes Life shows in the journal feed at most twice a day (✕ hides it for a week), with the people you follow who play. On a profile, store or course page you may see **🎮 Plays Notes Life**: only between people who follow each other, and only if that person keeps **Show that I play Notes Life** on. Both switches are in Account → Privacy; in teen mode both are off and nobody is shown as a player to or about a teen.
`),
    A("links-and-mentions", "Links and @mentions", "Publishing and earning", `
**Links:** type a web address anywhere you write on #NotesApp (a journal, a comment or reply, a message, a moment caption, a review, a recommendation, your bio or Notes Life chat) and it becomes a link people can tap. It works with full addresses (https://…), www.… and plain names such as candelluximperialhotel.com. In Messages, a message with a web address shows a preview card under it: the page's picture, title and description.

**@mentions:** type @ and the first letters of someone's username, and #NotesApp suggests matching members. Pick one with the arrow keys and Enter (or Tab), or tap it; Esc closes the list. Wherever it shows, @username is a link to that person's profile.

**Who gets told:** when you @mention someone in a comment or reply, a published journal, a moment, a store review or a seller's reply, or a recommendation (once the person it's about approves it), they get a notification in their bell with a few words around the mention and a link to it. Each person is told once for each thing, so editing a comment or a journal only tells people you newly mention. Nobody is told about mentioning themselves, and if either of you has blocked the other, no notification goes. Mentions in messages, group chats and Notes Life chat never notify anyone: those are conversations, and a mention there doesn't pull anyone in. Up to 10 people are told per comment, journal or moment.
`),
    A("interests-and-topics", "Choosing your interests and topics", "Getting started", `
**Your interests:** go to [Choose your interests](/interests) and pick the topics you want to read about (up to 12, at least 3 makes a good feed). Journals on them come first in your feed, under **For you**, and in your weekly digest. Change them any time.

**Topics on a journal:** when you write, pick up to 3 topics from the list (search it, or tap a hashtag). Readers who chose those topics see your journal first. You can add your own hashtags too, such as #SideHustle; they're tidied as you type and show at the end of the journal.

**Nana's suggestions:** once you've typed a title, Nana suggests topics and subtopics for it, such as #Tech › #ITSupport. Tap the ones you want, or **Add all**; nothing is added until you tap. Ones marked NEW don't exist yet and are created when you save. A journal can have up to 3 subtopics, which show as hashtags with the others. Courses get the same suggestions from their title and summary, and Market items get a suggested category and subcategory (Shoes & bags › Tote bags). Suggestions are free and don't use your Nana allowance.

**Browsing:** the **Topics** tab on [Journals](/journals) groups every topic that has journals, with yours first. Tap a hashtag at the end of a journal to see more on that topic.
`),
    A("discovery", "Journals, Notes Market, Notes Academy and Trending", "Getting started", `
**Getting around:** on a phone, the bar along the bottom takes you to **Feed**, **Explore**, **Market**, **Academy**, **Messages** and your **Profile**; tap your picture at the top for the menu (your account, the rest of the site, Sign out). On a computer, the journal feed has the same places in a menu on the left.

**The journal feed:** [Journals](/journals) has four tabs: **For you** (journals on [your interests](/interests) first, then everything newest first), **Following** (people you follow), **Latest** and **Top · 7d** (what people read most this week). Like, comment, share or save a journal from the feed; saved journals are in [Saved](/saved). **Most read this week** and **Who to follow** appear between posts on a phone and on the right on a computer. Journals marked **Promoted** are boosted.

**Explore:** [Explore](/explore) is where to browse topics, people and channels, with **Market** and **Academy** tabs for the week's most looked-at products and courses.

**The order elsewhere:** [Notes Market](/shop) and [Notes Academy](/academy) show things in the same order: **For you** first, then **Most viewed** (the last 7 days), then **Recent**.

**Notes Market** collects every #NotesApp store: items for you, the most viewed, new arrivals, digital downloads, categories and a list of stores. Each item shows its seller and their badges. Buying works as it does in the seller's own store.

**Notes Academy** has courses: free courses from any publisher, with lessons from the teacher's own YouTube that play right on #NotesApp, and paid courses on Pro, Business and Enterprise.

**Profiles** have **Notes**, **Store** and **Courses** tabs, and these buttons: **Follow** (it reads **✓ Following** once you follow; tap it to unfollow), **Book a session** (when the publisher takes bookings), **Conversation** (a direct message) and **Gift me**. If Gift me is greyed out, the publisher hasn't set up payouts yet: tap or hover the ℹ️ beside it.

**Trending** has the same tabs: Notes, Store, Courses and Publishers.

**Badges** always come right after a person's name, before their @username, wherever their picture and name appear.
`),
    A("academy", "Teaching and learning on Notes Academy", "Getting started", `
[Notes Academy](/academy) is where #NotesApp members and organisations teach and take courses, free and paid. Lessons play right on #NotesApp, and your progress is saved as you go.

**Taking a course**
- Open Notes Academy from the menu, or go to [/academy](/academy). Courses on [your interests](/interests) come first, then the most viewed this week and the newest. Tap a topic to narrow the list (on a computer, the Topics list shows how many courses each topic and subtopic has), filter by level or by free and paid, or search by course or teacher.
- A course's page shows its level, format and language, who teaches it, and four tabs: **Overview** (what you'll learn, about the course, how it works, requirements), **Curriculum** (every lesson with its length, grouped in modules), **Tutors** and **Reviews**. Beside them: the price, what the course includes, **Share** (WhatsApp, LinkedIn, X, Facebook or a link) and the course details. On a free course the first lesson is a free preview.
- **A free course:** tap **Enrol — free**. If you're not signed in, sign in (or join free) and you come straight back, already enrolled.
- **A paid course:** watch its free previews first, then tap **Buy the course** and pay by card, bank transfer or from your wallet. It's yours for good and plays on up to 2 of your devices; to watch on a new one, remove an old one when it asks. Uploaded videos never download, and your @username and email drift faintly across them. The certificate is usually included in the price.
- **Refunds:** you can get a refund within 7 days of buying a paid course, as long as you haven't started it (opening a paid lesson counts as starting). Tap **get a refund** on the course's page; the money goes back the way you paid.
- **Live classes and groups:** some courses run live classes (on Zoom or Meet) with recordings, and have a WhatsApp or Telegram group. Once you've enrolled or bought, **Join the live class** and **Join the group** appear on the course's page.
- Video lessons play in YouTube's privacy-enhanced player, so you stay on #NotesApp. A video is ticked off by itself once you've watched most of it; you can always tap **Mark as done** yourself, or **Mark as not done** to undo it. Text lessons end with a **Mark as done** button.
- Your progress and the **Continue** button are on the course page, and courses you've started are under **Continue learning** on Notes Academy.
- **Certificates:** once every lesson is done, tap **Get your certificate** on the course page. Check the name (it can't be changed once issued), then pay from ${certificateMin()} plus the teacher's margin, by card or from your wallet. It's issued straight away with an ID (NA-C-…) and a QR code; anyone can check it at [/certificates](/certificates). Add it to LinkedIn, share it, save it as a PDF or download it as a picture (PNG) from its page. To show the picture on LinkedIn, choose **Add media → Add a link** on the certificate there and paste the image link (**Copy image link** on the certificate's page). Shared links show the certificate itself. Claim within ${CERTIFICATE_LATE_TEXT().grace} days of finishing: after that a late claim fee of ${CERTIFICATE_LATE_TEXT().weekly} of the price is added each week, up to ${CERTIFICATE_LATE_TEXT().cap} more.
- **Like, save and review:** tap ♥ on a course to like it and the bookmark to save it (it's kept under **Saved → Courses**; you can also save from the bookmark on any course card). Once you've done half the lessons, rate the course from 1 to 5 stars and say what you learned, in **What learners say** on its page. One review each, and you can edit it; the teacher can reply once. A course shows its stars once it has 2 reviews.
- **Recommendations:** on someone's profile, tap **Recommend**, choose how you know them, give 1 to 5 stars and write a few sentences. It appears only after they approve it: on their profile, beside their journals and on their site's About page.

**Teaching a course**
- Any publishing account can teach a free course, including the free Basic plan. If you don't publish yet, start at [Rates & payouts](/profile/publishing). On an organisation's team (Business or Enterprise), choose **Teach as** your organisation when you start a course: it's published under the organisation's name, and its admins can edit it too.
- Go to [Teach a course](/academy/teach) and tap **New course**. A working title is all you need to start.
- **1. Describe it:** a clear title, a short summary of what learners will be able to do, up to 3 topics and a wide cover picture. The course's address follows the title until you first publish.
- **About the course:** the level, language and format (self-paced, or live classes with recordings), what learners will learn and the requirements (one per line), how long it runs and when classes are, and two private links: the live class (Zoom, Meet or Teams) and the learners' group (WhatsApp or Telegram). Only learners who enrolled or bought see the links.
- **Price:** free, or paid on Pro (text lessons, PDFs and YouTube) and on Business or Enterprise (your own uploaded videos too). You get the price less the same fee as your digital items, paid to your bank 7 days after each sale; add your bank account in Rates & payouts before you publish. Tick **Certificate included** to include it in the price.
- **Tutors:** teach alone, or invite up to 4 co-tutors by @username with their share of each sale. Each one accepts first, can then edit the course's content and lessons, and is paid their share at their own plan's fee. The price, the tutors and publishing stay with the lead.
- **Add lessons:** paste a link to a video on your own YouTube and check the picture to make sure it's the right one (keep videos public or unlisted, not private, or they won't play), or write a text lesson in the journal editor. On a paid course you can also upload videos (Business and Enterprise, up to 200 MB each) and PDFs (up to 50 MB), and tick **Free preview** on the lessons anyone may open before buying. Group lessons in **modules** if you like. Add the minutes; they add up to the course's length. Use ↑ and ↓ to put lessons in order.
- **Publish:** a course needs a title, a summary and at least one lesson. Use **Preview** first if you like; only its tutors can see a draft.
- You can keep editing after publishing. To remove the last lesson of a published course, unpublish it first. Deleting a course removes its lessons and its learners' progress; a course people have bought can't be deleted (unpublish it instead, and they keep it).
- **Your academy (certificates):** set it up once at [Your academy](/academy/teach/setup): the name and logo on your certificates, who signs them (a photo of the signature on white paper; we remove the white), an accrediting institution if you have one (its logo shows once #NotesApp has checked it) and your margin on top of our ${certificateMin()}. You receive the margin less our usual commission, and your share grows with any late claim fee. Courses our team has reviewed get the "#NotesApp Certified Course" seal.
- Up to 30 courses, each with up to 100 lessons. Your published courses show on your profile's Courses tab, on Trending, on your own site and in the weekly digest when they're popular.

**Coming next:** quizzes, and Enterprise courses for organisations with cohorts and bulk invites (see [Pricing](/pricing)). Questions learners often ask are in [Notes Academy: questions](/help/notes-academy-faq).
`),
    A("notes-academy-faq", "Notes Academy: questions learners ask", "Getting started", `
${academyFaq().map((f) => `**${f.q}** ${f.a}`).join("\n\n")}`),
    A("getting-around", "Getting around: the tab bar and the menu", "Getting started", `
**On a phone:** one light header sits at the top, with search, your notifications (the bell) and your picture. Tap your picture for the menu: your profile, store, bookings, Wallet, Saved, your interests, your settings, the rest of the site and Sign out. Along the bottom is a tab bar:
- **Feed**: the [journal feed](/journals).
- **Explore**: topics, people and channels, and the Market and Academy tabs ([Explore](/explore)).
- **Market**: [Notes Market](/shop), every #NotesApp store in one place.
- **Academy**: [Notes Academy](/academy), free and paid courses.
- **Messages**: your conversations and calls ([Messages](/messages)).
- **Profile**: your own profile, with its Notes, Store and Courses tabs.

**On a computer:** the journal feed has the same places in a menu on the left, and Most read and Who to follow on the right. On the other pages, the top bar links to Journals, Market, Academy, Trending, Pricing and About; Contact is in the footer and on the About page.

A conversation or a call fills the whole screen on a phone; go back with the arrow at the top left.`),
    A("profile-pictures-and-links", "Your profile picture, past pictures and social links", "Getting started", `
**Changing your picture:** tap the **+** on your picture (on your profile, or on "You" at the top of the journal feed) and choose **Update profile picture**, or use [Edit profile](/profile/edit).

**Past pictures:** tap anyone's profile picture to see their pictures, newest first. Swipe left or right on a phone, or use **‹ ›** (or the arrow keys) on a computer; each shows the date it became their picture. Your pictures are kept from your next change on (the picture you're replacing is kept too). To take an old one out of your history, open your pictures and tap **Remove from history**; the one you're using now can't be removed until you change it. If someone also has a moment up, tapping their picture asks which you'd like to see.

**Social links:** on [Edit profile](/profile/edit), paste the address or just your @handle (X, Instagram, TikTok), linkedin.com/in/yourname, or for WhatsApp your phone number (0803… is fine). They show as icons under your name on your profile and your own site. If a link can't be read, Edit profile tells you which one.
`),
    A("pictures-and-uploads", "Pictures you upload (WebP)", "Getting started", `
Pictures you upload anywhere on #NotesApp (journals, your shop, your site, your profile, chats, moments and adverts) are turned into **WebP** on your phone or computer before they're sent. WebP files are much smaller than JPEG or PNG for the same look, so your pages load faster and use less of your visitors' data.

**Very large photos** are made smaller: profile pictures to 1024 pixels on the long side, others to 2560.

**Privacy:** the hidden camera details in a photo (such as where it was taken, and the phone that took it) are left out.

GIFs (so they keep moving), and pictures already in WebP or AVIF, are sent as they are. Academy logos and signatures stay PNG for certificates.`),
    A("explore-and-saved", "Explore and Saved", "Getting started", `
**Explore:** [Explore](/explore) is where to browse topics, people and channels (they used to be tabs of Journals). Open a topic to see its journals, or follow people and organisation channels from there. Your [interests](/interests) come first among the topics. The **Market** and **Academy** tabs show the most looked-at products and courses this week, with a search box and a way into [Notes Market](/shop) and [Notes Academy](/academy).

**Saving a journal:** tap the bookmark on a journal in the feed, or in a profile's Notes tab, to save it for later. Tap it again to remove it. Everything you saved is in [Saved](/saved), together with the store items you saved with the ♡, the courses you saved with the bookmark (under **Courses**) and the messages you kept from chats (under **From chats**). Only you can see what you saved.`),
    A("weekly-digest", "The #NotesApp Weekly Digest email", "Getting started", `
Every Sunday evening (from 5 PM, Lagos time) #NotesApp can email you a digest: up to ten journals published that week, chosen for you. The most viewed journals on [your interests](/interests) come first, with people you follow mixed in, then the week's most viewed. Your own posts are never in it.

Each story shows the writer's picture and name (and the organisation they wrote for), the title, the opening of the story, how long it takes to read, its views, and its likes and comments. Tap the title or **Read more** to open it; **Read more in your feed** opens your journal feed.

When there's something to show, the digest also has four items from [Notes Market](/shop) and four courses from [Notes Academy](/academy), the week's most viewed on your interests first. Up to three sponsored slots, clearly labelled, carry a boosted journal, an advert and a boosted store item.

**Turning it off:** every digest has an **Unsubscribe from the weekly digest** link at the bottom (your email app's own Unsubscribe button works too), or switch it off under **Emails** in [Account settings](/profile/account#email). Switch it back on there any time. Emails about your bookings, orders, payments and account always come, whatever you choose.

You need a confirmed email address to get it, and it only comes when there's something to read.
`),
    A("social-sharing", "Sharing posts to social media", "Publishing and earning", `
Every post has a share menu (WhatsApp, X, Facebook, LinkedIn, copy link) that works without connecting anything. You can also connect LinkedIn and X once and publish an excerpt of your post there, with a link back to the full journal on #NotesApp. You always see and can edit the words first (Nana can write them for you), and nothing goes out until you press Post. LinkedIn connections last about 60 days before you reconnect. Facebook, Instagram and TikTok are on the [roadmap](/roadmap).`),
    // ── Selling
    A("inventory", "Inventory: your stock, SKUs and alerts", "Selling", `
[Inventory](/profile/inventory), under My account, keeps your store's stock in one place.

**What you see:** every physical item, and every option of an item with options (size, colour), with what's left, its SKU and the level at which you want an alert; and at the top, your units in stock, their value at cost, and how many are running low or sold out. Filter to **Running low** or **Sold out**, or search by name, option or SKU.

**Changing stock:** tap **Restock or correct** on a line. **Add** a number (or take some off with a minus) or **set the count**, and pick a reason: restocked, stock count correction, damaged or lost, returned, or other, with a note such as the supplier's invoice. Sales and refunds are recorded on their own. Open an item to set its **SKU** (and each option's), its **cost price** (only you see it) and its **alert level**, and to see its **history**: every change, when, by whom and what was left after.

**Alerts:** when a sale takes an item (or an option) to its alert level, or sells it out, you get a notification. Restocking an item that had sold out tells everyone who asked to be told.

**Spreadsheet:** **Download spreadsheet** gives you every line (item_id, title, option, sku, stock, low_stock_at, cost_naira, price_naira). Change what you need, then **Upload spreadsheet**: you see what will change and any rows with problems before anything is saved. Rows are matched by item_id and option, or by SKU.

**Who has it:** included on Business and Enterprise. On Free Basic and Pro, add it for ${inventoryAddonPrice()} a month, after a free ${inventoryTrialDays()}-day trial (no card, once). An organisation's teammates who run its store, and its admins, can use the organisation's inventory.`),
    A("selling-physical-goods", "Selling physical goods from your store", "Selling", `
Your store lives at /u/yourname/store. Add an item, tick that it is sold through #NotesApp checkout, and set the price, your delivery fee and your stock. You need a payout account under Rates & payouts.

The buyer pays here with their delivery address and gets a parcel ID by email; their money is held until delivery. You dispatch and keep the log (courier and tracking number, or who holds the parcel by bike, bus or motor park). Payout is released when the buyer confirms delivery, or 7 days after you mark it delivered. If the buyer reports a problem the money stays held while we review.

Every item needs a category (buyers can filter a store by it) and, for physical items, where it ships from, which buyers see before they pay. Shoppers can save items with the heart (their private list is under Saved items), and a store shows what buyers check most.\n\nSizes: if an item comes in sizes (or sizes and colours), add them one at a time. Type the size and how many pieces you have, then tick ✔ to save it and add the next, for example L: 2, XL: 5. You can save up to 60 entries, edit or remove any of them, and the total stock is added up for you.\n\nCommission applies to the item price only (see [commission rates](/help/commission-rates)). Stores do not link out to other shops. Full details: [Store selling](/store-selling).`),
    A("digital-downloads-and-courses", "Selling digital downloads, PDFs and video courses", "Selling", `
Choose **Digital download** when you add an item and upload your file (PDF, ePub, ZIP, audio, video, Office files or images, up to 200 MB). It is stored privately; only people who pay can download it, instantly. The sale is final once downloaded, and your share is paid after a 7-day dispute window.

On **Pro and above** you can instead choose **View only**: add lessons (videos or PDFs) that buyers watch or read on #NotesApp with no download, on up to two devices per purchase, with the buyer's email faintly stamped on the content. One lesson is a single view-only file; several make a course. See [Store selling](/store-selling#view-only).

For a full course, with progress for learners, use [Notes Academy](/academy): free courses with lessons from your own YouTube on every publishing plan, and paid courses on Pro and above, with the same fee as your digital items (text lessons and PDFs, plus your own uploaded videos on Business and Enterprise). See [Teaching and learning on Notes Academy](/help/academy).`),
    A("track-a-parcel", "Tracking a parcel", "Selling", `
Every store order gets a parcel ID that looks like NA-7K2M9QXD, sent to the buyer by email. Enter it on [Track a parcel](/track) to see where the parcel is, who holds it and the courier details if there are any. Parcels sent by a logistics business on #NotesApp have the same kind of number: track them on that business's own site, or here.`),
    A("logistics-shipments", "Shipments for logistics businesses", "Selling", `
For delivery, waybill, warehousing and home or office errand businesses on **Business or Enterprise** ([For logistics businesses](/logistics)).

**Your services:** on [Shipments](/shipments), open **Your services** and tick what you do: delivery, waybill, bulk delivery, warehousing and despatch, home errands, office errands. An errands company ticks errands only; a full logistics company ticks everything. Only those can be booked, and your site lists them.

**Book a shipment:** choose the service, say what's being sent, the sender, where it's picked up (or stored), and the receiver's name, phone and address. You get a tracking number like NA-7K2M9QXD. Tap **Send on WhatsApp** (or SMS) to send the receiver their number and link.

**Hand it on:** under **Record who has it now**, add the rider, bus driver or park agent and where it is, then **Get their update link** and send it to them. From that link they update the location, hand it to the next person and mark it delivered, with no account. Each link stops working once the next person confirms. You can mark it delivered yourself, or cancel it while it's still only booked.

**Your site's Track page:** in [Your site](/profile/site), switch on **Track**. Your site then has a Track link in its menu, a tracking box on Home with your services, and a page for each shipment, on your own domain at /track. Only your shipments show there. With Track off, links go to #NotesApp's [Track a parcel](/track) page.

**Your team:** in an organisation, staff with store access can book and update shipments in your business's name.

**Privacy:** the receiver's phone number and address are only for you and your team. A rider's phone number shows only if they agreed, and only to someone who enters the last 4 digits of the receiver's phone number.

Deliveries are paid: you set your delivery prices and your customers pay them. Only digital items never need shipping.`),
    A("logistics-network", "The logistics network: delivery partners for stores", "Selling", `
Logistics businesses on #NotesApp list the states they cover and their prices, and stores choose one as their **delivery partner**.

**For stores (Free Basic and above):** open [Find a delivery partner](/logistics/network), pick the state you deliver to, and **Message** a provider to agree how pickups work. Then tap **Make my delivery partner**. From then on, when a buyer enters an address your partner covers, checkout shows the partner's price for that address and the item's weight, and the buyer pays it online with the order. The order goes straight to your partner, and the buyer tracks it on your own Track page (or [Track a parcel](/track)). You pay nothing for delivery, and your store's fee is only on the goods. Where your partner doesn't deliver, your own delivery fee applies. Set each physical item's weight in your store so the price is right. You can stop using a partner any time.

**For logistics businesses:** on [Shipments](/shipments), fill in your listing: where you're based, the states you cover (or all of Nigeria), the areas you know, your services and your rate card (prices by distance and weight, a price per extra kilo, and a same-day charge if you offer it). Switch on **Listed** and add a verified bank account under Rates & payouts so stores can find you. Orders from stores that chose you appear under **Deliveries for stores** with the buyer's address; record hand-offs and mark them delivered as with your own shipments.

**Getting paid:** the buyer's delivery fee is held with the order and paid to you when delivery is confirmed (by the buyer, or 7 days after it's marked delivered). #NotesApp keeps a commission from your delivery earnings only: ${formatPercent(currentPricing().logistics.cutRate)} of each delivery fee, at least ${formatNaira(currentPricing().logistics.cutMinKobo)}. Stores and buyers pay no extra.

**Who can be a provider:** Business and Enterprise include it. On Free Basic and Pro it's the **logistics add-on**: ${logisticsAddonPrice()} a month, with a ${logisticsTrialDays()}-day free trial and no card. The add-on also opens Shipments. API and webhooks for Enterprise come later.`),
    A("merch-store", "The official #NotesApp merch store", "Selling", `
T-shirts, caps, mugs and more, with the core mark or a seasonal logo from the [Brand page](/brand). You pre-order and pay with Paystack; we print after the batch closes and deliver anywhere in Nigeria for a flat ${money(MERCH_DELIVERY_KOBO)}. See the [Merch store](/merchstore). Every publisher's own shop is in [Notes Market](/shop), and listed on the Merch store page too.`),
    // ── Badges and trust
    A("verified-badge", "The verified badge (maroon ✔)", "Badges and trust", `
The maroon ✔ shows an account in good standing on an eligible plan, or with the badge subscription. **Business and Enterprise include it**; on other plans it is an add-on for ${money(BADGE_PRICE_KOBO)} a month. It is not an identity check. For organisations it also needs us to have confirmed the CAC registration.

For an identity check or an endorsement, apply for the [gold badge](/help/gold-badge). More at [Verification badges](/badges).`),
    A("gold-badge", "The gold badge", "Badges and trust", `
The gold ✔ is for accounts #NotesApp has vouched for, in two kinds: **endorsed** (we review your public work and back you) and **identity-checked** (you pass an ID check: NIN plus a live face check for people, CAC registration for organisations; identity checks are ${goldNow}).

It costs the same on every plan: ${money(GOLD_PRICING.personal.monthlyKobo)} a month for a person or ${money(GOLD_PRICING.corporate.monthlyKobo)} a month for an organisation. An endorsement review is free; an identity check adds a one-off non-refundable deposit (${money(GOLD_PRICING.personal.identityDepositKobo)} personal, ${money(GOLD_PRICING.corporate.identityDepositKobo)} organisation) that covers the third-party check whether or not it passes. We do not collect or store your ID documents; our partner Dojah runs the check and an admin sees only the outcome. You can cancel any time and keep the badge until the period you paid for ends. Apply at [Verification badges](/badges).`),
    // ── Teams and organisations
    A("community", "Community: start one and run it", "Teams and organisations", `
[Community](/community) is for churches, NGOs, schools, clubs and associations with many members, a bit like a Facebook group with a channel, run by your own admins. Any account can start one on the Community page (or, on Business, from [Your site](/profile/site) by choosing the Churches and NGOs kit); link it to your own site and it also opens there, at /community, on your own domain too; it gets its own address, such as ${ROOT_DOMAIN}/c/grace-chapel. Free up to 200 members; Business has no member limit and adds Circles.

**What members get:** **General**, the announcement channel (admins post, members like and comment, and every member gets a notification); **Spaces**, public ones anyone can read and members-only ones that never leave the community (not in Explore, search, share previews, the digest, Nana or the MCP server); **Events**; the **member list** (never with phone numbers); and **Circles**, private rooms with their own chat for teams like the choir or the board (on Business, up to 50 people each for now).

**What non-members see:** a home page with your name, pictures and a line about you, and only what your admins choose: General (read only), About, Contact, public events, the member list, and a Join button. Until we've verified who runs the community, it shows a notice; [verification](/organisations) removes it.

**Audio rooms:** like Clubhouse, inside your community. Admins and moderators tap **+ Start a room** on the community's Home, give it a name (Sunday Q&A, Midweek Bible study) and go live. The host can bring up to **4 members on stage** to speak at a time; everyone else listens. A listener taps **✋ Raise hand to speak**, and the host taps **Bring up** (or taps anyone in the room and **Invite to speak**); **Move to listeners** sends a speaker back, and a speaker can step down with **Back to listening**. A green ring shows who is talking. **Leave quietly** to go; the host leaving, or **End room**, ends it for everyone. Rooms are for members only, run phone to phone (nothing passes through our servers and nothing is recorded), and hold up to **20 listeners** for now; bigger rooms come with our relay.

**Room chat:** while a room is on, everyone in it can type: questions for the speakers, prayer points, amens, links. On a computer the chat sits beside the room; on a phone tap **💬 Chat** (a red number shows what you missed). The host and speakers are marked, the host or a moderator can **Remove** a message, and the chat goes when the room ends: nothing is kept.

**The feed:** General and every Space look like a group's wall: **Create a note…** opens the composer (words and a photo), and each post has **Like**, **Comment** and **Share** (a link to the post), comments with each writer's picture, and a **⋯** menu for moderators to pin or remove. Home shows the About card (open, approved or by invitation; members; who runs it), the members' faces, upcoming events and Spaces.

**Joining:** open to anyone, by approval (with up to 5 join questions, such as "Which branch?"), or only by invite link. Anyone with the invite link joins straight away; make a new link to stop the old one.

**Being found:** a community anyone can join, or ask to join, is listed in the Community directory, in **Explore → Communities** and, when it's busy, in **Trending → Communities** (ranked by new members, then posts, then comments, for today, 7 days or 30 days). A community joined **only by invite link** is private: it isn't listed anywhere except for its own members.

**Admin tools (Admin tab):** approve or decline requests with their answers; settings (name, logo and cover, about, contact, how people join, what non-members see, slow mode, Spaces); the invite link; banned members; and **insights** (members, new joins this week and month, posts, comments, active members, the most active). On the Members tab, admins make moderators, the owner makes admins, and moderators and admins remove or ban those below them. Moderators and admins pin and remove posts. **Slow mode** makes members wait between posts and comments (moderators and admins aren't slowed).

**View as:** admins can preview the community as a non-member, a member or a moderator (the owner, as an admin too) before changing anything. Nothing you do while previewing changes your role.

**More on each part:** [General](/help/community-general), [Spaces](/help/community-spaces), [Circles](/help/community-circles) and [Audio rooms](/help/community-audio-rooms), each with its own page on [Community](/community).`),
    A("events", "Events", "Teams and organisations", `
[Events](/events) are for every account: services, meetings, launches, classes and outreaches. Add one on the Events page (for yourself) or on your community's Events tab (for the community, open to everyone or members only).

An event has a start and end (Lagos time), where it is, and or a **Join live** link (YouTube Live, Facebook Live, Zoom, Google Meet or any https link). It can repeat **every week** or **every month**, until a date if you like.

People tap **Going** or **Interested** and get a reminder **24 hours and 1 hour before** (a notification, a phone notification and an email), and can **Add to calendar**. Public events are listed under Upcoming, by state and city. If you change or cancel an event, everyone going or interested is told.`),
    A("community-general", "General: your community's announcement channel", "Teams and organisations", `
**General** is the announcement channel of a [community](/help/community). Every member is in it from the day they join; there's nothing to subscribe to. See it with pictures on [the General page](/community/general).

**Who posts:** the owner and admins. They tap **Create a note for every member…** at the top of General, write up to ${n(POST_MAX)} characters, add a photo if they like, and post. Members get a notification and see it in General and on the community's Home.

**What members do:** **Like**, **Comment** (up to ${n(COMMENT_MAX)} characters, with their picture beside it) and **Share** (a link to the post). Moderators and admins can **pin** a post to the top, or **remove** a post or a comment, from its **⋯** menu.

**Slow mode:** in Admin → settings, admins can make members wait between comments (30 seconds up to an hour). Moderators and admins are never slowed.

**Who can read it:** members always. People who aren't members only if the admins switch General on under **What non-members see**; they can read but not comment, and General's posts can then show on your profile and in Explore. If it's off, General's posts never leave the community.

**General, Spaces, Circles or Audio rooms?** General is news from the leadership. [Spaces](/help/community-spaces) are topics where members post too. [Circles](/help/community-circles) are private chats for small teams. [Audio rooms](/help/community-audio-rooms) are live talks.`),
    A("community-spaces", "Spaces: topics inside your community", "Teams and organisations", `
**Spaces** are the topics inside a [community](/help/community) where members can post too: Prayer requests, Youth fellowship, Announcements, Alumni 2015, Volunteers. See them with pictures on [the Spaces page](/community/spaces).

**How many:** up to ${SPACES_MAX} Spaces in a community. A Space has no headcount of its own: every member of the community can open every Space they're allowed to read, so a Space holds as many people as the community (${COMMUNITY_FREE_MEMBERS} members free, no limit on Business). There's no joining or leaving a single Space.

**Public or members only (each Space):** a **public** Space can be read by anyone, even without joining, and its posts can show on your profile and in Explore. A **members-only** Space is seen by members only, and its posts never appear in Explore, search, link previews, the Weekly Digest, Nana's answers or the MCP server. Under the Space's name it says which it is, so members know who can read what they write.

**Who posts (each Space):** **members** (everyone can write, like and comment) or **admins only** (admins post, members like and comment), for a second announcement stream such as Choir notices.

**Setting them up:** Admin tab → **Spaces**: add a Space with its name, public or members only, and who posts. Rename or remove them any time. Pinning, removing and slow mode work as in [General](/help/community-general).

**Need a small private group instead?** That's a [Circle](/help/community-circles).`),
    A("community-circles", "Circles: private group chats in your community", "Teams and organisations", `
A **Circle** is a private group chat inside a [community](/help/community) for the few people who work together: the choir, the ushers, the youth leaders, the board. See it with pictures on [the Circles page](/community/circles).

**Who has them:** communities whose owner is on **Business** (or Enterprise). Only the owner and admins set them up.

**How many people:** up to ${GROUP_MEMBERS_MAX} in a Circle, counting whoever sets it up. Only members of the community can be added. Someone who leaves the community, or is removed or banned, is taken out of its Circles too.

**Setting one up:** open the community's **Circles** tab, type a name (Choir, Ushers, Youth leaders), tick the members to add and tap **Create the Circle**. Admins can add or remove people later.

**What's in it:** a full group chat in [Messages](/messages): text, photos, videos, voice notes, documents, stickers, replies, reactions, pins, and **Media, links and docs** in its ⋮ menu. Tap the phone or camera at the top for a free **group call** (up to ${GROUP_CALL_MAX.audio} talking, or ${GROUP_CALL_MAX.video} on video), end-to-end encrypted.

**Who sees it:** members see the Circles they're in on the Circles tab, with **Open chat**. Admins see every Circle in the community. Nobody else sees a Circle or what's said in it.`),
    A("community-audio-rooms", "Audio rooms: live talks with a chat, like Clubhouse", "Teams and organisations", `
**Audio rooms** let a [community](/help/community) talk live: a Bible study, a Q&A with the principal, a town hall. See them with pictures on [the Audio rooms page](/community/audio-rooms).

**Who hosts:** the owner, admins and moderators. On the community's Home, tap **+ Start a room**, give it a name (Sunday Q&A, Midweek Bible study) and **Go live**. Members see it at the top of Home with **Join**. Audio rooms come with every community, free.

**On stage:** the host and up to **${ROOM_SPEAKERS_MAX} speakers** at a time. A listener taps **✋ Raise hand to speak**; the host sees the hand and taps **Bring up**. The host can also tap anyone and **Invite to speak**, or **Move to listeners**. A speaker can step down with **Back to listening**. A green ring shows who's talking; the mic button mutes and unmutes.

**Listening:** tap **Join** and you're listening; your mic stays off until you're brought up. **Leave quietly** whenever you like. Up to **${ROOM_LISTENERS_MAX_P2P} listeners** for now.

**The room chat:** while the room is on, everyone in it can type (up to ${ROOM_CHAT_MAX} characters): questions, prayer points, amens, links. On a computer the chat sits beside the room; on a phone, tap **💬 Chat**, where a red number shows what you missed. The host and speakers are marked. The host or a moderator can **Remove** a message.

**Ending:** **End room** ends it for everyone; the host leaving ends it too. Nothing is recorded, and the chat is deleted when the room ends.

**How the sound travels:** phone to phone. The people on stage connect straight to each other, and each listener connects to the host, whose phone sends everyone the mix; nothing passes through #NotesApp's servers. That's why a room holds ${ROOM_LISTENERS_MAX_P2P} listeners for now, and why a host on Wi-Fi or strong 4G works best. Bigger rooms, for hundreds, come with our relay.

**Can't hear?** Check your phone isn't on silent and the browser has permission to play sound; on a speaker's phone, allow the microphone. If you joined on a weak network, leave and join again.`),
    A("organisation-accounts", "Organisation accounts", "Teams and organisations", `
Companies, NGOs, churches, schools and clubs can run a verified channel. Sign up as an Organisation with your CAC number (RC, BN or IT) and a work email, verify the email, and start a free ${ORG_TRIAL_DAYS}-day Business trial (no card, one per registration number). We then confirm the registration against the CAC register; until then the channel shows an "unverified organisation" notice.

Already have a personal account? You do not need a new one: open [Make an organisation](/organisation), enter the CAC number, and the same account (with its username, posts and followers) becomes an organisation. If the account is more than a day old, an admin approves the change first.

You can invite writers and admins by username or email; they publish under your channel's name and earnings go to one payout account. They can also teach on [Notes Academy](/academy) as the organisation (**Teach as**), free or paid, with certificates in your academy's name and logo. Your organisation's admins can also add and edit items in the organisation's store to help you; deleting items, orders and money stay with the owner and anyone given store access. Business includes four seats (the owner plus three); Enterprise has as many as you need. See [Organisations](/organisations).`),
    A("your-site", "Your own site", "Publishing and earning", `
Every Free Basic, Pro, Business and Enterprise member has their own website at ${ROOT_DOMAIN}/s/your-username, with your name at the top and no #NotesApp menus around it. Business and Enterprise can also put it on their own domain ([Your own domain](/help/your-own-domain)). Set it up on [Your site](/profile/site), under Edit profile, in five steps:

1. **Start from a kit.** Pick the one closest to what you do: **Personal and creators** (for you as a person, a writer or a content creator), **Academics and researchers**, **Fashion** (clothes, bags, shoes and jewellery), **Food and baking**, **Services and freelancers**, **Healthcare and clinics**, **Beauty and wellness** (choose Spa, Massage, Hair or Nails), **Fitness trainers**, **Events and photography**, **Electronics and mobile devices**, **Motor and motorcycle spare parts**, **Solar and energy solutions**, **Real estate**, **Schools and academies** or **Churches and NGOs**. A kit sets the look, the colours, which sections show and their order, and fills empty parts with starter words for you to change. It never overwrites what you've already written, and you can switch kits any time.
2. **Choose the look and colours.** Legacy (the original), **Clean** (white and rounded, with your main button in the header and a big banner with your picture), **Scholar** (plain and academic, a narrow page made for reading, with a light and dark switch that remembers each visitor's choice), **Luxe** (Pro: opens with a full photo, your banner picture or your cover, with your words, buttons and social links over it, then everything under centred titles, like a boutique or a spa), Aurora (a deep colour band) or Maroon (your notes as posts, like the journal feed). Every look takes a colour set: #NotesApp crimson, forest green, ocean blue, royal purple, sunset orange, gold or charcoal. On Pro and above you can type your own brand colour; very light colours are darkened so words stay readable. Then choose the **background**, white or warm paper, with any look and colour set (Clean starts on white, the others on paper). Add a **cover photo** too: a wide picture across the top of your profile (about 1500 × 500), on any look, with your social links under your name.
3. **Choose what shows.** Pages: Journals, Shop, Courses and Track, each with a link in your site's menu. Switch on **“Book me” under every post** to put a booking card under each of your journals on your site (it shows while your sessions are on). Sections on Home, in the order you set with the arrows: the top banner, the hours and contacts strip, services and prices, gallery, testimonials, team, and questions and answers, and the academic sections: **Publications** (shown by year, newest first, with your name in bold in the author list), **Awards**, **Talks** (each place you spoke at is a dot on a globe visitors can turn; type the city, e.g. Lagos, Nigeria, or add its latitude and longitude) and **In the news**. To fill Publications quickly, use **Import** in step 4: upload the BibTeX file from Google Scholar (on your profile, tick the box above your list, then Export → BibTeX), Zotero or Mendeley; add a paper by its **DOI**; or enter your **ORCID iD** to bring in your public works, and tick **Keep in sync** to have new ones added every day. Nothing is added twice and your edits stay; check the list, then save.
4. **Put in your words, prices and pictures.** In **Team**, add a person's #NotesApp @username to link their name to their profile (it's a mention only; team seats come with Business). The banner has a headline, a line about what you do, a picture and up to two buttons: Book now (opens your booking card), Call us, Shop, Contact, **Check our services** (jumps to your services menu) or a link. Leave a Call button's number empty to use the one in your strip. There's no Order on WhatsApp button: orders and payments stay on #NotesApp, where your buyers' money is protected (a button saved before becomes Contact us). The strip shows your **email**, never your phone number; the phone number is only used by Call buttons. In the hours and contacts strip, tick **Use the hours of my booking calendar** to show the times you take sessions (set on [Publishing](/profile/publishing)); while your sessions are on, tapping the hours opens your booking card. Gallery pictures open larger when tapped. A section only shows once it has something in it.
5. **Write your About and Contact pages** with the same editor as your journals (up to 20,000 characters each). Each appears in your menu once saved.

**What each plan gets:** Free Basic: the Personal and Academics kits, the Legacy, Clean and Scholar looks, the colour sets, every section, and the Journals, Shop and Courses pages (your shop pays the Free Basic store commission). **Pro** adds the business kits (Fashion, Food and baking, Services, Healthcare, Beauty and wellness, Fitness, Events and photography, Electronics, Motor parts, Solar and Real estate), the Aurora and Maroon looks, your own brand colour, and lower commissions. **Business and Enterprise** add the School and Church/NGO kits, Track, and your own domain. If your plan changes, what it no longer covers is hidden, never deleted.

**Your shop on your site** looks like an online shop: links across the top (New arrivals, your own item labels, most used first, and Most popular), a featured piece with its picture on the right (the item you marked Featured, or your most viewed), a bar with the number of products, search, sorting (newest, most popular, price, name) and bigger or smaller pictures, and your items as picture tiles, two to a row on phones, with Sold out and Only a few left on them. Fashion and Beauty and wellness show tall photos; Electronics, Motor parts and Solar show the whole product on white; the others show square photos. Shop pages can be shared already sorted or filtered. Home shows your newest items with a link to the whole shop. When your shop is the main thing on your site (no Journals, or the shop is your front page) and you have a cover photo, Home opens with the cover across the whole page and a Shop now button, like an online shop.

**Home leads with:** in step 3, choose what visitors see first on Home, and more of it: your **shop**, your **services**, your **courses** or your **notes**. Leave it on **A mix of everything** and Home shows a little of each.

**Churches and NGOs:** choose this kit (Business) and **Community** opens right under the kits: start your [community](/help/community) there (its name, address and a line about it are filled in from your profile and banner), or **Link to my site** one you already own or help run as an admin. It then opens **inside your site**, at /community (on your own domain too, such as yourchurch.org/community), with a **Community** link in your menu: visitors join, read and post, and members chat, see events and join audio rooms without leaving your site. Anyone who runs a community can also link it under **Choose what shows** (the **Community** switch), and switch its page off there; **Unlink** takes it off.

**Your social links** (from Edit profile) show over the full photo on Luxe, under your name, and in your site's footer.

**Beauty and wellness sites** (Spa, Massage, Hair or Nails) use the Luxe look and open with a full photo: your banner picture (or your cover) edge to edge with your words over it, and the buttons Book your appointment and Check our services. On the Clean look you can do the same: in **Top banner**, choose **Full photo**. The **Fashion** kit uses Luxe too, opening with your cover, Shop now and New arrivals, then Shop by category and New in. Your services show as a menu: add **minutes**, a **tab** (Facials, Massages, Braids…) and a picture to each, and visitors see cards in tabs with the time, the price and **Book now**. While your sessions are on, a **Book your appointment** tab sits on the right edge of every page (a bar along the bottom on phones), and your booking card is titled Book your appointment. For an evening feel, choose the **Night** background in step 2 (any look but Scholar, which has its own light and dark switch). For now every booking uses your one session price and length from [Publishing](/profile/publishing); booking each service at its own price and length is coming.

**Announcement bar:** in step 2, type one line for the **Announcement bar** (for example “Free delivery in Lagos this week”) to show it across the top of every page.

**The basket:** shoppers on your site can put several items in a basket and pay once. Tap **+** on an item's picture to add one (an item with sizes or colours opens its page to choose, then **Add to basket**); the basket icon in your site's header shows how many. In the basket they change quantities, enter one address, see one delivery for everything (your delivery partner's price for the total weight, or else the highest delivery fee among the items) and pay by card or bank. Each item then becomes its own order on My orders, so you dispatch and track each as usual (send them together), and you're paid for each when its delivery is confirmed. The basket lives on the shopper's device; a basket holds up to 20 different items from your shop.

**Your courses on your site** open right there, inside your site, with Enrol or Buy; the lessons themselves open on #NotesApp, where your learners keep their progress and get their certificates.

**Pictures** you upload anywhere on #NotesApp (journals, your shop, your site, your profile, chats) are turned into WebP on your phone or computer before they're sent: smaller and faster to load, with the hidden camera details (like where the photo was taken) left out. Very large photos are made smaller (profile pictures to 1024 px, others to 2560 px on the long side). GIFs, WebP and AVIF are sent as they are, and so are academy logos and signatures, which stay PNG for certificates.

**Your Notes page** has links to the topics you write about most, so visitors can read one topic at a time.

Your site's visits count in [Analytics](/profile/analytics). Use only pictures and words you have the right to use.

**More:** [Looks, colours, kits and Home](/help/site-looks-and-kits), [The shop and basket](/help/site-shop-and-basket), [Beauty and wellness kit](/help/beauty-and-wellness-kit), [Courses on your site](/help/courses-on-your-site), [Academic sites and publications](/help/academic-sites-and-publications), [Pictures you upload](/help/pictures-and-uploads).`),
    A("site-shop-and-basket", "The shop and basket on your site", "Selling", `
When your site shows the **Shop** page ([Your own site](/help/your-site)), it looks and works like an online shop, on every look.

**What shoppers see:** links across the top: **New arrivals**, then your own labels (your subcategories when you use any, otherwise the words you put on your items' pictures), most used first and up to five, then **Most popular** (more labels show as buttons under the search bar; spellings of one label count together, so "Ocasion wear" and "Occasion wears" are one link); a **featured** piece with its picture on the right inside the card (the item you marked Featured, or your most viewed); a bar with the number of products, **search**, **sorting** (newest, most popular, price, name) and bigger or smaller pictures; and your items as picture tiles, two to a row on phones, with **Sold out** and **Only a few left**. Fashion and beauty show tall photos; gadgets and parts show the whole product on white. The category, sort and search stay in the address, so you can share a link to New arrivals or one category.

**The basket:** tap **+** on a picture to add one (items with sizes or colours open their page to choose, then **Add to basket**). The basket icon in the header shows how many. In the basket, shoppers change quantities, enter one address, see one delivery price for everything, and pay once by card or bank. A basket holds up to 20 different items from one shop and lives on the shopper's device.

**After they pay:** each item becomes its own order on My orders, so you dispatch and track each as usual (send them together), and you're paid for each when its delivery is confirmed. Refunds work per item.

**Announcement bar:** type one line under **Announcement bar** on [Your site](/profile/site) (for example "Free delivery in Lagos this week") to show it across the top of every page.

**When the shop is your main page** and you have a cover photo, your cover runs across the whole page with **Shop now**.

**No WhatsApp orders:** sites don't have Order on WhatsApp buttons. Orders and payments stay on #NotesApp, where buyers are protected; a button saved before now says Contact us.`),
    A("site-looks-and-kits", "Your site's look, colours, kits and what Home leads with", "Publishing and earning", `
On [Your site](/profile/site) you choose how your site looks. More on setting it up: [Your own site](/help/your-site).

**Looks:** **Legacy** (the original); **Clean** (white and rounded, your main button in the header, a big banner with your picture); **Scholar** (plain and academic, made for reading, with a light and dark switch: see [Academic sites](/help/academic-sites-and-publications)); and **Luxe** (Pro): your site opens with a full photo (your banner picture, or your cover) with your words, buttons and social links over it, then everything under centred titles.

**Colours and background:** every look has colour sets (crimson, green, blue, purple and more). The **Night** background (any look but Scholar) makes the page dark with your colours glowing on it.

**Kits:** start from one made for what you do, with its own look, colours, sections and starter words you replace. Each kit's card says who it's best for. Personal and creators, and Academics and researchers come with Free Basic; on Pro: Fashion, Food and baking, Services and freelancers, Healthcare and clinics, [Beauty and wellness](/help/beauty-and-wellness-kit), Fitness trainers, Events and photography, Electronics, Motor parts, Solar and energy, and Real estate; on Business: Schools and academies, and [Churches and NGOs](/help/your-site). The business kits start with a menu in tabs (for example Cakes, Small chops, Meals, Drinks; or Consultations, Tests, Online and home) with times and prices, answers to what your customers ask, opening hours and two buttons. A menu's button fits the trade: **Order** for food (to your shop), **Apply** for a school's classes, none for a church's programme, and **Book now** for the rest (while your sessions are on).

**Home leads with:** choose what visitors see first on Home, and more of it: your **shop**, your **services**, your **courses** or your **notes**. Leave it on **A mix of everything** (the default) and Home shows a little of each.

**The top banner:** a headline, a line about what you do, a picture and up to two buttons: Book now, Call us, Shop, Contact, **Check our services** (jumps to your services menu) or a link. On Clean, choose **Full photo** to put your words over the picture edge to edge.

**Your details:** the hours and contacts strip shows your **email** (your phone number is used only by Call buttons). Your **social links** from Edit profile show under your name, over the full photo on Luxe, and in your site's footer. A **cover photo** runs across the top of your profile on every look, with your logo over its edge.`),
    A("beauty-and-wellness-kit", "The Beauty and wellness kit (spa, massage, hair, nails)", "Publishing and earning", `
The **Beauty and wellness** kit is for spas, massage therapists, hair salons and nail studios (Pro and above). Pick it on [Your site](/profile/site) and choose its flavour: **Spa**, **Massage**, **Hair** or **Nails**; each starts with its own words and services, which you replace with yours.

**What it looks like:** it uses the Luxe look and opens with a full photo (your banner picture, or your cover) with your words over it and two buttons: **Book your appointment** and **Check our services**. Your social links show over the photo.

**Your services menu:** each service can have its **minutes**, a **tab** (Facials, Braids, Pedicure, Gel…) and a **picture**. They show as a menu of cards under tabs, each with its time, price and **Book now**, which opens your booking calendar. Services with minutes, tabs and pictures work on any site, not only this kit.

**Book tab:** a **Book your appointment** tab stays at the side of every page, so a visitor can book from anywhere.

**Night look:** for a darker, evening feel, choose the **Night** background.

Sites made with the older Massage and spa or Salons kits keep working as they are. More on looks and kits: [Your site's look](/help/site-looks-and-kits).`),
    A("courses-on-your-site", "Your courses on your site", "Publishing and earning", `
If you teach on [Notes Academy](/academy), your courses can show on your own site: switch on the **Courses** page on [Your site](/profile/site) (from Free Basic).

**What visitors see:** your courses only, each opening right there inside your site (on your own domain too), with what it covers, the price and **Enrol** or **Buy**. Visitors aren't sent away to Notes Academy to decide.

**Lessons and certificates** open on #NotesApp, where learners keep their progress, take quizzes and get their certificates.

**Home leads with:** set it to **courses** and your Home puts your courses first. See [Your site's look](/help/site-looks-and-kits). More about teaching: [Teaching and learning on Notes Academy](/help/academy).`),
    A("academic-sites-and-publications", "Academic sites: the Scholar look and importing your publications", "Publishing and earning", `
For academics and researchers, from Free Basic. Pick the **Academics and researchers** kit on [Your site](/profile/site), or add the sections to any site.

**The Scholar look:** plain and academic, a narrow page made for reading, with a light and dark switch that remembers each visitor's choice (and follows their phone's setting until they choose). It works with every colour set.

**Academic sections:** **Publications** (by year, newest first, your name in bold among the authors, with links and labels such as Best paper); **Awards**; **Talks** on a globe visitors can turn (type the city and its dot appears); and **In the news**.

**Import instead of typing:** in Publications, **upload a BibTeX file** (Google Scholar exports one; so do Zotero, Mendeley and others), **add a paper by its DOI**, or **bring in your public works from ORCID**. You check the list before saving; nothing is added twice, and your own edits stay.

**Keep in sync with ORCID:** link your ORCID iD and new works on your ORCID record are added to your site's Publications every day.`),
    A("your-own-domain", "Your own domain", "Teams and organisations", `
Business and Enterprise accounts can serve their page, journals and store on their own domain (for example notes.yourbrand.com or yourbrand.com), with Home, Notes and Shop pages, and visitors who sign in, book and pay without leaving the site. Business is semi white-label (the footer says "powered by #NotesApp"); Enterprise adds fully branded sign-in and sign-up in your name.

You connect the domain in the Console by adding the DNS records we show. Buying and managing domains inside #NotesApp, with our partner Whogohost (go54), is coming soon; see [Domains](/domains).

## Setting up your site
Open [Your site](/profile/site) (also linked from Edit profile and the Console): your domain shows there once it's connected, and the preview at ${ROOT_DOMAIN}/s/your-username always works. Choosing a kit, a look, colours and sections is in [Your own site](/help/your-site).`),
    A("api-and-console", "The API and Console (Enterprise)", "Teams and organisations", `
Enterprise accounts can use a server-to-server API (switched on per account by our team) to publish posts and read bookings, orders and earnings, with signed webhooks for events like a booking or a paid order. Keys and webhooks are managed in the Console. Ask for access on the [contact page](/contact); the documentation is public at [API docs](/docs). Questions about the API or the MCP server can go to our [Discord](${SITE.discord}), where API changes are announced too.`),
    A("naija-exam-prep", `${PREP_NAME}: JAMB, WAEC and NECO practice`, "Getting started", `
${PREP_NAME} (${PREP_HOST}) is NotesApp's exam practice, part of Notes Academy. ${PREP_TAGLINE} It uses your NotesApp account.

**Practice:** choose JAMB, WAEC or NECO, then a subject and a topic. Each question is marked straight away, with the explanation and, for wrong options, why they're wrong. Every subject has free questions; questions you haven't got right yet come first.

**Timed mocks:** ${MOCK_SIZES.join(", ")} questions picked at random, on a clock that runs on our side (leaving the page or changing your phone's time doesn't stop it). It's marked when you submit or when time runs out, and you can go through every answer. A mock score is practice only, never a prediction of your exam result.

**The pack:** ${money(DEFAULT_PACK_KOBO)} opens every question in one exam, all its subjects, for ${DEFAULT_PACK_MONTHS} months (the price on the pack page is the one that applies). Pay with Paystack: card, bank transfer or USSD. Buying again adds the same months. You need a verified email to buy. If a payment went through but the pack didn't open, tap **Restore my pack** on the pack page: it checks again with Paystack and never charges twice.

**Refunds:** in full if you ask within ${REFUND_DAYS} days of paying and haven't opened any pack question yet; after that, or once a pack question has been opened, a pack can't be refunded. Write to us from the contact page.

**Ask someone to pay:** on the pack page, make a link for a parent, sponsor or friend. It lasts ${PAYLINK_DAYS} days; they pay with Paystack without an account, and the pack opens on your account. They see only the name you choose.

**Offline:** on an exam's page, tap **Save for offline** to keep its questions on your phone, then practise or do a mock with no data from **Saved**. Pack questions open offline for up to ${OFFLINE_PASS_DAYS} days at a time, for your account only; save again online to renew. Your answers sync when you're back online.

**Progress and the board:** **Progress** shows what you actually did: questions answered, right first time, mocks, days in a row and each topic (strong after at least 5 answers with 70% right). The weekly effort board is optional: join with a nickname; it counts questions practised (each once a day, up to ${n(BOARD_DAILY_CAP)} a day), not scores, and starts again every Monday.

**Report a problem:** every question has **Report a problem** (wrong answer, unclear, typo). ${PREP_NAME} is not affiliated with JAMB, WAEC or NECO; all questions are original practice questions, checked by a reviewer before they're published.
`),
    A("naija-exam-prep-teen-mode", `${PREP_NAME}: teen mode and parents`, "Safety and your data", `
Students aged 13 to 17 can use ${PREP_NAME}. After signing up, tap **Yes, I'm under 18**, choose the month and year you were born, and give a parent's or guardian's email. The month and year are kept privately, never shown, so teen mode ends on your 18th birthday. Under 13, a parent or guardian sets you up from their own account.

**Teen mode:** you don't appear in people search or the member directory; only people you follow can message you, add you to a group, or reply to your journals and comments; your moments are seen only by people you follow who follow you back (never public); and the weekly board shows only your nickname, never your name.

**Parents and guardians** get an email asking them to confirm, with a link. The address is kept only to confirm the account and to contact them about it; it's never shown on the profile. A student can practise, and buy a pack or send a pay link, before the parent confirms. A parent can ask for a refund under the pack's refund rule (within ${REFUND_DAYS} days, no pack question opened) or for the account to be closed, from the contact page.

No ads are shown to students in teen mode, and their data isn't sold or used to market to them.
`),
    A("naija-exam-prep-reviewers", `Reviewing questions for ${PREP_NAME}`, "Teams and organisations", `
Every ${PREP_NAME} question is checked by a reviewer before students see it.

**Joining:** reviewers come by invite link. NotesApp staff choose the subjects first, then make either a link for one person (14 days, used once) or an open link for volunteers (7 to 90 days, up to 500 reviewers, closable at any time). Open the link, sign in or create a NotesApp account, and tap **Accept the invite**. A later link for other subjects adds them.

**Reviewing:** the review queue (${PREP_HOST}/review) shows only questions in your subjects. For each one, check that the marked answer is right, the explanation is clear and correct, and the question is fair. **Approve** it, or **Ask for changes** with a note saying what to fix. You can't review a question you wrote. Starter questions are labelled **Nana AI-assisted draft**: check them as carefully as any other.

**After review:** an approved question is published by NotesApp's editors; a question sent back is fixed and returns to the queue. Your reviews are counted (in total and per month), so reviewers can be paid into their NotesApp wallet when that starts. Reviewers see the review queue only: never payments or students.
`),
    A("mcp-ai-assistants", "MCP: use #NotesApp from your AI assistant", "Teams and organisations", `
MCP (Model Context Protocol) is a standard way for AI assistants such as Claude and ChatGPT to use other services. #NotesApp has an MCP server, so you can ask your own assistant to find things on #NotesApp for you.

**What it can do (anyone, no sign-in):** find creators, journals, Notes Market items and Notes Academy courses; show a creator's open session times; and give you a booking link that opens the booking card on the time you picked.

**It only reads.** Booking, buying and paying always happen on #NotesApp itself, never inside the assistant.

**How to add it:** in your assistant's settings, add a remote MCP server (also called a custom connector or Streamable HTTP server) with the address \`https://mcp.notesapp.name.ng\` (\`https://www.notesapp.name.ng/api/mcp\` works too). The [API docs](/docs#mcp) list every tool, with an example.

**Your own account:** with an API key (the [API and Console](/help/api-and-console), for Enterprise accounts), your assistant can also read your own profile, journals, bookings, orders and earnings. Send the key as a Bearer token; its permissions apply. Every call is logged for 12 months, without the key itself.

**Coming next:** signing in with your #NotesApp account instead of a key, and tools that can draft posts and reply to bookings, always with your approval. There's no date yet.`),
    A("team-hub", "Team hub and team messaging (paid add-on, after internal testing)", "Teams and organisations", `
A shared workspace for your team: a work board, milestones, a morning summary, a weekly review, meetings, a money ledger, payroll, a staff library and team messages. Our own team is testing it now. Once that testing is done, it will be offered as a **paid add-on for Business and Enterprise**. It is not available yet, and there is no price or date. See the [Team hub page](/teams) and the [roadmap](/roadmap).`),
    A("paid-add-ons", "Paid add-ons for Business and Enterprise", "Teams and organisations", `
Four tools are being tested by our own team now. Once internal testing is done, each will be offered as a **paid add-on for the Business and Enterprise plans**:
- **Team hub:** a work board, meetings, a money ledger, payroll, a staff library and team messages. See [Team hub](/teams).
- **Company finance tools:** a runway calculator, acquisition cost, burn and revenue analytics, and a cap table with vesting.
- **Investor and partner data room:** private documents in a watermarked viewer, with live figures, for the people you let in.
- **Advertise on LinkedIn from #NotesApp:** boost a post on LinkedIn from your own LinkedIn ad account, with the campaign's stats on #NotesApp. LinkedIn bills you directly.

None of them can be switched on yet, and there are no prices or dates. When they open, they'll be on the [pricing page](/pricing), the [changelog](/changelog) and announced by email. Free Basic and Pro don't include them.`),
    // ── Safety and your data
    A("reports-blocking-appeals", "Reporting, blocking, suspensions and appeals", "Safety and your data", `
You can block anyone in Messages (from the menu at the top of the conversation), mute a conversation you don't want alerts from, and report a post, account, moment or conversation with the Report button, or through the [contact form](/contact). Our team reviews reports; anything marked as nudity or violence is reviewed within 24 hours. In a group, admins can also ban a member who misbehaves.

Accounts can be suspended for a set time or until lifted. A suspended member sees the reason and can submit an appeal, which an admin reviews. For a problem with a payment, gift or order, contact us with the details and an admin will review it.`),
    A("payment-safety", "How your money is kept safe", "Safety and your data", `
Payments run through Paystack's hosted checkout, so card and bank details never touch our servers. Money is held until it is earned: store payments until delivery is confirmed, session earnings for 24 hours after the session, and subscriptions, gifts and downloads for a short dispute window. You need a verified email to pay. Refund rules are shown before you pay and in the [Terms](/terms). The full picture is on [Trust & security](/security).`),
    A("your-data", "Downloading or deleting your data", "Safety and your data", `
You can download a copy of your data or delete your account yourself from [Account settings](/profile/account). Deleting an account removes your profile, and payment and order records are kept only without your name, email, address or phone number, as the law requires. If you are in a group chat, you leave it; your connected LinkedIn or X access is removed. Read the [Privacy Policy](/privacy) for details.`),
    // ── Company
    A("who-is-emmanuel-adams", "Who is Emmanuel Adams?", "Company", `
Aside from being the Founder, CEO and CTO of NOTESAPP TECHNOLOGIES LTD (the company behind #NotesApp, RC ${COMPANY_INFO.rcNumber}), Emmanuel Adams is a successful business consultant, fintech consultant, entrepreneurship author and coach who is passionate about helping people recognise their potential and communicate it effectively to potential employers.

## Affiliations
- **Forbes BLK member.** He is a member of the Forbes BLK community, which recognises and empowers Black entrepreneurs, executives and innovators.
- **SPSC UK Ambassador for the UN SDG Programme.** He serves as an ambassador for the Sustainable Peace and Security Centre (SPSC) UK's United Nations Sustainable Development Goals programme, supporting global efforts to achieve the SDGs.
- **Ex-CEO of PLAAS.** He once led the blockchain-based platform transforming Africa's agricultural sector.
- **Vice President, Abuja & North Central Region, Boxing Promoters Association of Nigeria (BPAN).** He plays a key role in promoting boxing and supporting boxing promoters in the region.
- **Vice President, Abuja & North Central Region, Film and Creative Minds Association of Nigeria (FCMA).** He supports filmmakers and creative professionals in the region.
- **Founder and CEO of Ace Boxing Promotions and Adams Global Services.** He has founded and led several companies.

## Recognition
- Awarded "Blockchain Personality of the Year" at the 2020 African Blockchain Leadership Conference.
- Awarded the Young Entrepreneur Award 2024 by Time Africa Magazine.
- Awarded Who's Who 2024-2025 by Time Africa Magazine, in collaboration with Marquis Who's Who.
- Featured in notable media outlets, including SUN, Independent, Vanguard, This Day and other publications.

His affiliations and recognition reflect his commitment to innovation, entrepreneurship and global sustainability. He publishes on #NotesApp under his own name, and several of his articles on careers and business are on his journal here.

## Sources
- #NotesApp profile and journal: [${ROOT_DOMAIN}/u/emmanuel](/u/emmanuel)
- Website: [adams.com.ng](https://adams.com.ng)
- Medium: [itsemmanueladams.medium.com](https://itsemmanueladams.medium.com)
- LinkedIn: [Emmanuel Adams](https://www.linkedin.com/in/emmanuel-adams-27891354)
- X: [@TweetsbyAdams](https://x.com/TweetsbyAdams)
- Instagram: [@itsemmanueladams](https://instagram.com/itsemmanueladams)
- Facebook: [Mr.EmmanuelAdams](https://facebook.com/Mr.EmmanuelAdams)
- The company and its founders: [About #NotesApp](/about)`),
    A("contact-and-support", "Contacting #NotesApp", "Company", `
Use the [contact form](/contact) and pick the topic (bookings, payments and refunds, store orders and parcels, advertising, organisations, the gold badge, reporting, partnerships, press, investment or anything else). It goes straight to our admins. For a parcel, include its ID. Nana AI can answer most how-to questions, and can pass you to a person when it cannot.

You can also ask the team and other members on our Discord community, **na-notesapp**: [${SITE.discord.replace(/^https?:\/\//, "")}](${SITE.discord}). It's where we announce each release, and where developers, Notes Life players and members swap tips. Don't post payment details, passwords or anything private there; use the contact form for those.`),
    A("about-and-status", "About #NotesApp, status and updates", "Company", `
#NotesApp is run by ${COMPANY_INFO.legalName} (RC ${COMPANY_INFO.rcNumber}), a private company limited by shares registered in Nigeria. Read [About](/about), see live service health on [Status](/status), what changed on the [Changelog](/changelog) (each release is also posted to #announcements on our [Discord](${SITE.discord})) and what is coming on the [roadmap](/roadmap). Our domain partner is Whogohost (go54), and we connect to services such as Paystack, Paylony, Cloudflare, Firebase, Vercel, Resend and Dojah.`),
    A("roadmap-whats-coming", "What is coming next", "Company", `
Not live yet, with no promised dates: quizzes on courses, and the Enterprise course packages; meetings bigger than 6 people; giving and paid event tickets in communities; our own live streaming; publishing to Facebook, Instagram and TikTok (LinkedIn and X are live); AI drafting from your past notes (your AI assistant can already read #NotesApp through our MCP server); domain sales and DNS management inside #NotesApp; ${WALLET_LIVE ? "paid calls in Notes Life (the NotesApp Credit wallet itself is live)" : "NotesApp Credit and Bonus Credits"}; Paylony for real-money payments and Tap-to-Pay (Paylony CardTap already pays at every counter in Notes Life, with game money); WhatsApp reminders; fuller identity checks; and iOS and Android apps. Details and the latest are on the [roadmap](/roadmap).

${ADD_ONS_LINE}`),
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
Open [Team hub](/admin/team). Every item has a status (To do, Doing, Blocked, Needs a decision, Done) and a horizon (Today, This week, Later), an owner and an optional due date. A **Blocked** item says why it is stuck and on whom; a **Needs a decision** item holds the question and, once answered, the decision. Overdue items sort first. An item can also be given to one or more **departments** (for example Engineering and Product & tech), shown as chips on the item; pick a department under **Show** to see its items. Use **Show** to see everyone's work, **Assigned to me**, one person's, or what is not assigned yet; a red strip at the top counts what is overdue across the team, per person (tap a name to see theirs). Talk about an item in its comments.

When you give someone an item they get a bell. Its owner is reminded of the due date 3 days and 1 day before, on the day, and once if it goes overdue (a bell each time, plus an email for tomorrow, today and overdue). Changing the date or the owner starts the reminders again.

The morning summary (email and bell, switch either off on the hub) lists what is due, blocked or waiting on you. The [weekly review](/admin/team/review) shows the week in numbers and work, with a place for wins, lessons and next week's focus; focus lines can become next week's items. Meetings get their own chat room, decisions and actions, and the team room is the everyday group chat for staff.`),
    A("hub-money-ledger", "Recording money in the ledger", `
The [Money ledger](/admin/team/finance) holds expenses, payroll and money in that is not platform revenue (grants, sponsorships, direct transfers), with receipts, next to platform revenue. Finance records entries dated today or up to 3 days back, adds receipts to any entry and can void recent ones with a reason. Product can read everything except payroll lines. Only the owner can enter older dates, edit an entry, void old history and import a CSV. Nothing is ever deleted: a voided entry stays with who voided it and why. Salaries are paid from [Payroll](/admin/team/payroll), which writes its own Payroll entries here.`),
    A("hub-expenses-due", "Expenses due: who pays, and by when", `
**Expenses due** on the team hub and the [Money ledger](/admin/team/finance) lists bills, renewals and free plans turning paid, soonest first. Finance adds an item, and can **Assign** it to a staff member with a **pay-by** date (on or before the due date). The person assigned gets a bell, and reminders (14, 7, 3 and 1 days before, on the day, then once when overdue) count down to the pay-by date and go to finance and to them. Anyone on staff sees the items assigned to them; tick **Assigned to me** to filter. Only finance marks an item paid, which records the expense in the ledger.`),
    A("hub-payroll", "Payroll", `
[Payroll](/admin/team/payroll) (menu: Money) is for finance and super admins only. Add each person once: name, role, monthly pay, pay day (1 to 28), start date and bank details. Account numbers are stored encrypted and the page shows only the last four digits; **Show account** reveals the full number when you need it to pay, and each time is logged.

Each month, **Start the run** for that month: it lists everyone active who had started by then. You can **Adjust** a line (a deduction or extra, with a reason, never more than the monthly pay) or **Remove** someone from that month. **Mark paid** one person at a time once you have made the transfer: it records a Payroll (Salary) entry in the money ledger for that month. Transfers are made by hand for now. **Take off payroll** stops someone appearing in future runs; past runs don't change.`),
    A("hub-staff-library", "The staff library", `
The [Staff library](/admin/team/library) holds SOPs, the employee handbook, policies, templates and other staff material. Each document has a kind, a version and up to 10 files. It can be open to **everyone on staff**, **one department** or **named people** (personal: only they and whoever added it can open it). Documents that ask for it have an **I have read this** button; please press it once you have read them. Super admins, customer care, product and legal maintain the library: add files with **⬆ Upload a file** (or pick them when you create the document), **New version** clears the confirmations and asks everyone again, and **👁 Who has read it** shows who has opened the document and who has confirmed it, and old documents are archived rather than deleted. For something meant for one person, send it in the message hub with them in To.`),
    A("hub-message-hub", "The message hub", `
The [Message hub](/admin/team/messages) is for messages between staff: **To**, optional **Cc**, a subject, the message and up to 10 files. Messages always stay in the hub; tick **Also send by email** to email everyone as well. Files go only to the people in **To** (and the sender): people in Cc get the message and are told the files went to To, which is how personal material stays personal. Inbox, Copied to me and Sent are separate tabs, with unread dots and Reply. Everyday group conversation stays in the Team room in Messages.`),
    A("hub-roles", "Staff roles and departments", `
Staff are either a **super admin** (sees everything) or an **admin** with one or more departments: Customer care, Trust & safety, Finance, Growth & partnerships, Editorial, Product & tech, Legal & compliance, Engineering. An admin sees only the pages of their departments. At [Team access](/admin/access) the owner appoints and removes super admins, and other super admins appoint and remove admins and choose their departments. The person needs a #NotesApp account first. Nobody can change their own access or the owner's.`),
    A("hub-help-admin", "Writing help articles and reading Nana's chats", `
At [Help & Nana](/admin/help) the team writes the help articles that visitors read at the help centre and that Nana answers from. An article with the same address as a built-in one replaces it. The Chats tab shows what people asked Nana, highlights questions she could not answer and requests for a person (these also appear in the Leads inbox), and lets you mark a chat as followed up or turn a gap into a new article.`),
  ];
}
