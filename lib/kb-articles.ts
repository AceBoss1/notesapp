import { APP_HOST, APP_URL, LIFE_HOST, LIFE_URL, ROOT_DOMAIN } from "./host";
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
import { COMPANY_INFO } from "./site";
import { BADGE_PRICE_KOBO, TIERS, formatPercent } from "./tiers";
import { academyApiFrom, certificateMin, currentPricing, enterpriseCoursesPrice } from "./pricing";
import { academyFaq } from "./academy-faq";
const CERTIFICATE_LATE_TEXT = () => { const l = currentPricing().certificateLate; return { grace: l.graceDays, weekly: `${Math.round(l.weeklyRate * 100)}%`, cap: `${Math.round(l.capRate * 100)}%` }; };
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

**Courses (Notes Academy):** free courses are free to publish on every publishing plan. Certificates on free courses are paid: the learner pays from ${certificateMin()} plus the margin the teacher sets. Paid courses: on Pro with text lessons, PDFs and YouTube, and on Business and Enterprise with uploaded videos too, with the same fee as digital items. For organisations, two packages sit on top of Enterprise: **Enterprise Courses** at ${enterpriseCoursesPrice()} a month, and the **Enterprise Academy API** from ${academyApiFrom()} a month plus usage. The regular Enterprise price stays as it is for anyone who takes neither.

**Coming as paid add-ons:** ${ADD_ONS_LINE}

Paid plans renew automatically through Paystack, monthly or yearly. Cancel any time under Rates & payouts and you keep the plan until the period you paid for ends; there are no partial refunds. Every price and difference is on the [pricing page](/pricing).`),
    ...(WALLET_LIVE
      ? [A("notesapp-credit-wallet", "NotesApp Credit: your wallet", "Plans and pricing", `
**NotesApp Credit** is a prepaid balance. Top up once in your [Wallet](/profile/wallet) and pay across #NotesApp without entering your card each time.

**Top up:** from ${money(TOPUP_MIN_KOBO)} to ${money(TOPUP_MAX_KOBO)} at a time, through Paystack (card, bank transfer or USSD). Open the menu under your name → **Wallet** → **Top up**.

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
    A("payouts", "Getting paid: payouts and when money is released", "Publishing and earning", `
Add a bank account under Rates & payouts. We verify the account name first and store only the account name, bank and last four digits. Then:
- **Sessions:** paid 24 hours after the session ends.
- **Subscriptions and gifts:** released after 7 days.
- **Physical store orders:** released when the buyer confirms delivery, or 7 days after you mark it delivered if they say nothing.
- **Digital downloads:** after a 7-day dispute window.
- **Ad share:** monthly, after review (see [Ads and ad share](/help/ads-and-ad-share)).

Money can be held while we review a reported problem. Commission depends on your plan: see [commission rates](/help/commission-rates).`),
    A("boost-a-post", "Boosting a post or a store item", "Publishing and earning", `
A boost puts a published post, or an item in your store, in front of more readers: a boosted journal appears in the journal feed marked **Promoted**, and a boosted item in the Boosted strips on the home page and in [Notes Market](/shop). You pay for validated impressions (a real visitor had it at least half on screen for about a second, counted once per visitor per day), not for clicks.

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
    ...(CALLS_LIVE
      ? [A("voice-and-video-calls", "Voice and video calls", "Publishing and earning", `
**Free voice and video calls** in [Messages](/messages), with anyone you follow who follows you back. No minute limit, on every plan.

**Make a call:** open the conversation and tap the **phone** (voice) or **camera** (video) at the top. It rings on the other person's phone or computer wherever they are on #NotesApp, for up to 45 seconds. During a call you can mute, turn your camera off and on, and end the call. In a video call, drag your own small picture to any corner, tap it to swap it with the other person's, and tap **🔄** to switch between your front and back camera.

**Answer:** an incoming call shows a card with **Answer** and **Decline**, with a soft ringtone. If you [installed #NotesApp](/install) and allowed notifications, a call also rings when the app isn't open on your screen: the notification buzzes and sounds again every few seconds for the length of the call, with **Answer** and **Decline** buttons. If you don't answer, it becomes a missed call.

**Missed calls and Call back:** every call leaves a line in the conversation (for example "Voice call · 3:12", "Missed video call", "Declined voice call"). A missed call also sends a bell and, if you turned them on, a notification on your device. Tap **Call back** on any call line to call that person again, the same kind of call (voice or video). Call back isn't offered in group chats or to someone you've blocked.

**Who you can call:** only people you follow who also follow you, and who haven't blocked you. If you can't call someone, check that you follow each other. Group calls aren't available yet.

**Privacy:** calls go straight between your two devices and are encrypted. On networks that block a direct connection, the call passes through Cloudflare's relay, which can't listen. We never record calls. We keep only a short record (who, voice or video, when, how long, answered or missed), which is deleted with your account. See [Privacy](/privacy).

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

**Partners:** Chef Adams, itel Energy, Candellux Imperial, Digital Witch and Paylony (CardTap) are real businesses that partner with Notes Life (see [Partner with Notes Life](/life/partners), where businesses can ask to join). Their in-game prices are game prices; real orders and bookings are made with them directly.`)]
      : []),
    A("followers-and-online-status", "Followers, following and online status", "Publishing and earning", `
**Followers and following:** under the follower count on every profile are **Followers** and **Following**. Open either to see the people and organisations, 30 at a time. You must be signed in. You can see someone's lists only if they have made their lists visible **and** you have yours visible too; your own lists are always visible to you. Follower counts stay public.

**Online and last seen:** on Messages, in a conversation and on profiles you can see whether someone is **Online** now or when they were **last seen**, but only for people who follow you and whom you follow back. It updates about every three minutes. "Last seen: not recorded yet" means they haven't opened NotesApp since this was switched on.

**Your two switches** (both on to start with) are under [Account settings](/profile/account) and in your message settings on [Messages](/messages): *Show when I'm online and when I was last seen*, and *Let signed-in members see who follows me and who I follow*. The rule is the same for both: if you switch yours off, you can't see other people's either.`),
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
**Getting around:** on a phone, the bar along the bottom takes you to **Feed**, **Explore**, **Market**, **Messages** and your **Profile**; tap your picture at the top for the menu (your account, the rest of the site, Sign out). On a computer, the journal feed has the same places in a menu on the left.

**The journal feed:** [Journals](/journals) has four tabs: **For you** (journals on [your interests](/interests) first, then everything newest first), **Following** (people you follow), **Latest** and **Top · 7d** (what people read most this week). Like, comment, share or save a journal from the feed; saved journals are in [Saved](/saved). **Most read this week** and **Who to follow** appear between posts on a phone and on the right on a computer. Journals marked **Promoted** are boosted.

**Explore:** [Explore](/explore) is where to browse topics, people and channels.

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
- Up to 30 courses, each with up to 100 lessons. Your published courses show on your profile's Courses tab, on Trending, on your own site (Business and Enterprise) and in the weekly digest when they're popular.

**Coming next:** quizzes, and Enterprise courses for organisations with cohorts and bulk invites (see [Pricing](/pricing)). Questions learners often ask are in [Notes Academy: questions](/help/notes-academy-faq).
`),
    A("notes-academy-faq", "Notes Academy: questions learners ask", "Getting started", `
${academyFaq().map((f) => `**${f.q}** ${f.a}`).join("\n\n")}`),
    A("getting-around", "Getting around: the tab bar and the menu", "Getting started", `
**On a phone:** one light header sits at the top, with search, your notifications (the bell) and your picture. Tap your picture for the menu: your profile, store, bookings, Wallet, Saved, your interests, your settings, the rest of the site and Sign out. Along the bottom is a tab bar:
- **Feed**: the [journal feed](/journals).
- **Explore**: topics, people and channels ([Explore](/explore)).
- **Market**: [Notes Market](/shop), every #NotesApp store in one place.
- **Messages**: your conversations and calls ([Messages](/messages)).
- **Profile**: your own profile, with its Notes, Store and Courses tabs.

**On a computer:** the journal feed has the same places in a menu on the left, and Most read and Who to follow on the right. On the other pages, the top bar links to Journals, Market, Academy, Trending, Pricing and About; Contact is in the footer and on the About page.

A conversation or a call fills the whole screen on a phone; go back with the arrow at the top left.`),
    A("profile-pictures-and-links", "Your profile picture, past pictures and social links", "Getting started", `
**Changing your picture:** tap the **+** on your picture (on your profile, or on "You" at the top of the journal feed) and choose **Update profile picture**, or use [Edit profile](/profile/edit).

**Past pictures:** tap anyone's profile picture to see their pictures, newest first. Swipe left or right on a phone, or use **‹ ›** (or the arrow keys) on a computer; each shows the date it became their picture. Your pictures are kept from your next change on (the picture you're replacing is kept too). To take an old one out of your history, open your pictures and tap **Remove from history**; the one you're using now can't be removed until you change it. If someone also has a moment up, tapping their picture asks which you'd like to see.

**Social links:** on [Edit profile](/profile/edit), paste the address or just your @handle (X, Instagram, TikTok), linkedin.com/in/yourname, or for WhatsApp your phone number (0803… is fine). They show as icons under your name on your profile and your own site. If a link can't be read, Edit profile tells you which one.
`),
    A("explore-and-saved", "Explore and saved journals", "Getting started", `
**Explore:** [Explore](/explore) is where to browse topics, people and channels (they used to be tabs of Journals). Open a topic to see its journals, or follow people and organisation channels from there. Your [interests](/interests) come first among the topics.

**Saving a journal:** tap the bookmark on a journal in the feed, or in a profile's Notes tab, to save it for later. Tap it again to remove it. Everything you saved is in [Saved](/saved), together with the store items you saved with the ♡. Only you can see what you saved.`),
    A("weekly-digest", "The #NotesApp Weekly Digest email", "Getting started", `
Every Sunday evening (from 5 PM, Lagos time) #NotesApp can email you a short digest: up to five journals published that week, chosen for you. Journals from people you follow come first, then [your interests](/interests), then what most people liked that week. Your own posts are never in it.

Each story shows the writer's picture and name (and the organisation they wrote for), the title, the opening of the story, how long it takes to read, its views, and its likes and comments. Tap the title or **Read more** to open it; **Read more in your feed** opens your journal feed.

When there's something to show, the digest also has the most viewed and most bought in [Notes Market](/shop) that week, and the same for [Notes Academy](/academy).

**Turning it off:** every digest has an **Unsubscribe from the weekly digest** link at the bottom (your email app's own Unsubscribe button works too), or switch it off under **Emails** in [Account settings](/profile/account#email). Switch it back on there any time. Emails about your bookings, orders, payments and account always come, whatever you choose.

You need a confirmed email address to get it, and it only comes when there's something to read.
`),
    A("social-sharing", "Sharing posts to social media", "Publishing and earning", `
Every post has a share menu (WhatsApp, X, Facebook, LinkedIn, copy link) that works without connecting anything. You can also connect LinkedIn and X once and publish an excerpt of your post there, with a link back to the full journal on #NotesApp. You always see and can edit the words first (Nana can write them for you), and nothing goes out until you press Post. LinkedIn connections last about 60 days before you reconnect. Facebook, Instagram and TikTok are on the [roadmap](/roadmap).`),
    // ── Selling
    A("selling-physical-goods", "Selling physical goods from your store", "Selling", `
Your store lives at /u/yourname/store. Add an item, tick that it is sold through #NotesApp checkout, and set the price, your delivery fee and your stock. You need a payout account under Rates & payouts.

The buyer pays here with their delivery address and gets a parcel ID by email; their money is held until delivery. You dispatch and keep the log (courier and tracking number, or who holds the parcel by bike, bus or motor park). Payout is released when the buyer confirms delivery, or 7 days after you mark it delivered. If the buyer reports a problem the money stays held while we review.

Every item needs a category (buyers can filter a store by it) and, for physical items, where it ships from, which buyers see before they pay. Shoppers can save items with the heart (their private list is under Saved items), and a store shows what buyers check most.\n\nSizes: if an item comes in sizes (or sizes and colours), add them one at a time. Type the size and how many pieces you have, then tick ✔ to save it and add the next, for example L: 2, XL: 5. You can save up to 60 entries, edit or remove any of them, and the total stock is added up for you.\n\nCommission applies to the item price only (see [commission rates](/help/commission-rates)). Stores do not link out to other shops. Full details: [Store selling](/store-selling).`),
    A("digital-downloads-and-courses", "Selling digital downloads, PDFs and video courses", "Selling", `
Choose **Digital download** when you add an item and upload your file (PDF, ePub, ZIP, audio, video, Office files or images, up to 200 MB). It is stored privately; only people who pay can download it, instantly. The sale is final once downloaded, and your share is paid after a 7-day dispute window.

On **Pro and above** you can instead choose **View only**: add lessons (videos or PDFs) that buyers watch or read on #NotesApp with no download, on up to two devices per purchase, with the buyer's email faintly stamped on the content. One lesson is a single view-only file; several make a course. See [Store selling](/store-selling#view-only).

For a full course, with progress for learners, use [Notes Academy](/academy): free courses with lessons from your own YouTube are open now, and paid courses on Pro and Business come next, with the same fee as your digital items.`),
    A("track-a-parcel", "Tracking a parcel", "Selling", `
Every store order gets a parcel ID that looks like NA-7K2M9QXD, sent to the buyer by email. Enter it on [Track a parcel](/track) to see where the parcel is, who holds it and the courier details if there are any.`),
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
    A("organisation-accounts", "Organisation accounts", "Teams and organisations", `
Companies, NGOs, churches, schools and clubs can run a verified channel. Sign up as an Organisation with your CAC number (RC, BN or IT) and a work email, verify the email, and start a free ${ORG_TRIAL_DAYS}-day Business trial (no card, one per registration number). We then confirm the registration against the CAC register; until then the channel shows an "unverified organisation" notice.

Already have a personal account? You do not need a new one: open [Make an organisation](/organisation), enter the CAC number, and the same account (with its username, posts and followers) becomes an organisation. If the account is more than a day old, an admin approves the change first.

You can invite writers and admins by username or email; they publish under your channel's name and earnings go to one payout account. Your organisation's admins can also add and edit items in the organisation's store to help you; deleting items, orders and money stay with the owner and anyone given store access. Business includes four seats (the owner plus three); Enterprise has as many as you need. See [Organisations](/organisations).`),
    A("your-own-domain", "Your own domain", "Teams and organisations", `
Business and Enterprise accounts can serve their page, journals and store on their own domain (for example notes.yourbrand.com or yourbrand.com), with Home, Notes and Shop pages, and visitors who sign in, book and pay without leaving the site. Business is semi white-label (the footer says "powered by #NotesApp"); Enterprise adds fully branded sign-in and sign-up in your name.

You connect the domain in the Console by adding the DNS records we show. Buying and managing domains inside #NotesApp, with our partner Whogohost (go54), is coming soon; see [Domains](/domains).

## Setting up your site
Open [Your site](/profile/site) (also linked from Edit profile and the Console). It shows your site's address: your own domain if you connected one, and the preview at ${ROOT_DOMAIN}/s/your-username, which always works. Then, in three steps:
1. **Choose a theme.** Legacy is the original light look (and the default); Aurora has a deep crimson band with your profile on a card; Maroon looks like the #NotesApp journal feed, with your notes as posts on white cards that readers can like, share and save. You can switch at any time.
2. **Choose what shows.** Journals, Shop and Courses, each on or off (at least one stays on). Home shows your profile and then, right below it, what you chose: just the shop, just your posts, or a short preview of each with a link to see all. A section you switch off leaves the menu and its page is no longer found. Courses shows your Notes Academy courses.
3. **Write your About and Contact pages** with the same editor as your journals (up to 20,000 characters each). Each page appears in your site's menu once it is saved; save one empty to take it off. Until both are written, Your site, Edit profile and the Console remind you.`),
    A("api-and-console", "The API and Console (Enterprise)", "Teams and organisations", `
Enterprise accounts can use a server-to-server API (switched on per account by our team) to publish posts and read bookings, orders and earnings, with signed webhooks for events like a booking or a paid order. Keys and webhooks are managed in the Console. Ask for access on the [contact page](/contact); the documentation is public at [API docs](/docs).`),
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
Use the [contact form](/contact) and pick the topic (bookings, payments and refunds, store orders and parcels, advertising, organisations, the gold badge, reporting, partnerships, press, investment or anything else). It goes straight to our admins. For a parcel, include its ID. Nana AI can answer most how-to questions, and can pass you to a person when it cannot.`),
    A("about-and-status", "About #NotesApp, status and updates", "Company", `
#NotesApp is run by ${COMPANY_INFO.legalName} (RC ${COMPANY_INFO.rcNumber}), a private company limited by shares registered in Nigeria. Read [About](/about), see live service health on [Status](/status), what changed on the [Changelog](/changelog) and what is coming on the [roadmap](/roadmap). Our domain partner is Whogohost (go54), and we connect to services such as Paystack, Paylony, Cloudflare, Firebase, Vercel, Resend and Dojah.`),
    A("roadmap-whats-coming", "What is coming next", "Company", `
Not live yet, with no promised dates: paid courses on Pro and Business, and the Enterprise course packages; publishing to Facebook, Instagram and TikTok (LinkedIn and X are live); AI drafting from your past notes; domain sales and DNS management inside #NotesApp; ${WALLET_LIVE ? "paid calls in Notes Life (the NotesApp Credit wallet itself is live)" : "NotesApp Credit and Bonus Credits"}; Paylony payments and Tap-to-Pay; WhatsApp reminders; fuller identity checks; and iOS and Android apps. Details and the latest are on the [roadmap](/roadmap).

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
