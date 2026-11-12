import { APP_HOST, APP_URL, LIFE_HOST, LIFE_URL, PREP_HOST, PREP_URL, ROOT_DOMAIN } from "./host";
import { AD_PACKAGES } from "./ad-packages";
import { WHAT_IS_INTRO, WHAT_YOU_CAN_DO, WHAT_IS_FREE, WHAT_IS_TIERS } from "./site";
import { BOOST_PACKAGES, GIFT_MAX_KOBO, GIFT_MIN_KOBO } from "./boost-config";
import { LIMITS, formatNaira } from "./booking-time";
import { GOLD_KIND_LIVE } from "./badges";
import { POLICY_TEXT } from "./cancellation";
import { MAX_CO_AUTHORS, MIN_CO_PERCENT, MIN_LEAD_PERCENT, MIN_VIEW_PERCENT } from "./coauthors";
import { GOLD_PRICING } from "./gold";
import { MERCH_DELIVERY_KOBO } from "./merch";
import { LIFE_LIVE } from "./life/catalog";
import { CALLS_LIVE, MESSAGES_LIVE, MOMENTS_LIVE } from "./moments-rules";
import { MEDIA_LIVE, MEDIA_PICTURES_MAX, MEDIA_PINNED_MAX, MOMENTS_PINNED_MAX, secondsText } from "./media-rules";
import { BONUS_DAYS, BONUS_STEPS, TOPUP_MAX_KOBO, TOPUP_MIN_KOBO, WALLET_LIVE } from "./wallet";
import { ORG_TRIAL_DAYS } from "./org";
import { TRIAL_DAYS } from "./trials";
import { COMPANY_INFO, SITE } from "./site";
import { BADGE_PRICE_KOBO, TIERS, formatPercent } from "./tiers";
import { academyApiFrom, booksCaps, certificateMin, currentPricing, enterpriseCoursesPrice, inventoryAddonPrice, inventoryTrialDays, logisticsAddonPrice, logisticsTrialDays, coversPerDay } from "./pricing";
import { academyFaq } from "./academy-faq";
import { MAX_CO_TUTORS, MAX_LESSONS, MIN_LEAD_TUTOR_PERCENT } from "./courses";
import { nanaResetText, yearlyFreeText, pct as rate } from "./pricing";
import { LIMIT_TIERS, LIMIT_TIER_LABEL, limitFor, plansWith, type LimitKey, type LimitOverrides } from "./limits";
import { AGENT_DEFAULTS, type AgentSettings } from "./agents/config";
import { CARD_CHECK_KOBO, CREDIT_BONUS, HOLD_DAYS, MAX_AFFILIATE_PERCENT, MIN_CASH_KOBO, PLAN_MONTHS, PLAN_SHARE, REFERRAL_COOKIE_DAYS } from "./referrals";
import { MAX_PERCENT, MIN_PAYABLE_KOBO } from "./discounts";
import { GIVING_MIN_KOBO, PAYSTACK_LOCAL, UNVERIFIED_GIFT_CAP_KOBO, bandChargeKobo, bandsText, cardChargeKobo } from "./giving";
import { TICKET_PRICE_MIN_KOBO } from "./tickets";
import { AD_SHARE_HOLD_DAYS, AD_SHARE_MIN_KOBO } from "./ad-share";
import { CARDTAP_FEE_CAP_KOBO, CARDTAP_FEE_RATE } from "./cardtap-topup";
import { ORG_SEATS } from "./org";
import { BELLS_PER_DAY, OPEN_DAYS_DEFAULT, OPEN_DAYS_MAX } from "./jobs";
import { STORE_RULES } from "./money-rules";
import { TUTOR_LANGUAGES_SOON } from "./tutor";
const CERTIFICATE_LATE_TEXT = () => { const l = currentPricing().certificateLate; return { grace: l.graceDays, weekly: `${Math.round(l.weeklyRate * 100)}%`, cap: `${Math.round(l.capRate * 100)}%` }; };
import { VIDEO_MAX_SECONDS } from "./video-rules";
import { COMMENT_MAX, COMMUNITY_FREE_MEMBERS, POST_MAX, SPACES_MAX } from "./community";
import { TICKETS_PER_ORDER_MAX } from "./tickets";
import { GROUP_MEMBERS_MAX } from "./messages-rules";
import { GROUP_CALL_MAX } from "./group-calls";
import { DEFAULT_PAID_FIGURES, DEFAULT_PPM_FIGURES, type PaidLiveFigures, type PpmFigures } from "./rooms";
import { PPM_ADD_STEP, PPM_EARLY_MS, PPM_RATE_MAX_KOBO, PPM_RATE_MIN_KOBO } from "./ppm";
import { BAND_NAME } from "./live-tickets";
import { PAYOUT_HOLD_HOURS } from "./cancellation";
import { DEFAULT_ROOM_FIGURES, MOD_PERMS, ROOM_CHAT_MAX, ROOM_INVITE_MS, ROOM_MODS_MAX, ROOM_SPEAKERS_MAX, type RoomFigures } from "./rooms";
import { DEFAULT_RECORDING_FIGURES, RECORDING_NOTICE, type RecordingFigures } from "./live-recording";
import { FAN_ACTIONS, FAN_DEFAULTS, KOBO_PER_POINT, TOP_FANS, type FanSettings, type SubTier } from "./fans";
import { minutesLeftText } from "./rooms-live";
import { BOARD_DAILY_CAP, DEFAULT_PACK_KOBO, DEFAULT_PACK_MONTHS, MOCK_SIZES, OFFLINE_PASS_DAYS, PAYLINK_DAYS, PREP_NAME, PREP_TAGLINE, REFUND_DAYS } from "./exam-prep";
import type { KbArticle } from "./kb";
import { CERTIFY_MEMBERS, CERTIFY_PAYING, DEFAULT_TERMS, LEADS_PER_DAY, TIERS as PARTNER_TIERS, TIER_LABEL as PARTNER_TIER_LABEL, TIER_NEED as PARTNER_TIER_NEED, TRACK, TRACKS, TRAINING, type Tier, type TierTerms } from "./partner-network";
import { GIFT_POINT_KOBO, GIFT_SETTINGS, MOTIF_BLURB, NO_BONUS_TEXT, enabledGifts, giftClass, needsVerified, verifiedRuleText, withdrawRuleText } from "./gift-catalogue";

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

// What an admin can change outside Admin → Pricing, passed in by lib/kb-server.ts after reading it: the plan limits (Admin → Limits) and
// the Nana and connected-agent settings. Prices and rates are read from the live objects, so call this after ensurePricing().
// Audio rooms: how many can listen in a room opened now (the relay's setting once it's on, otherwise the phone-to-phone one), and Live
// mode's figures (rooms.live: video minutes, the prompts' thresholds, the video's size).
// Live recording: the keep days, the longest recording and whether the recorder is set up (lib/live-recording.ts).
// Subscription tiers and fans: the tier price ranges and the VIP/VVIP commission shares (Admin → Limits → Subscriptions and fans, lib/fans.ts).
// Paid lives: the late window, the subscriber discount cap and the no-show minutes (Admin → Limits → Audio rooms → Paid lives); the
// ticket commission share is a price (currentPricing().liveTicketUpliftPct).
// Pay-per-minute sessions: the minimum and maximum minutes held, the grace, the wait for more minutes and the no-show minutes (Admin →
// Limits → Pay-per-minute sessions); the commission share is a price (currentPricing().ppmUpliftPct).
export type KbLive = { limits?: LimitOverrides; agents?: AgentSettings; rooms?: RoomFigures; recording?: RecordingFigures; fans?: FanSettings; paid?: PaidLiveFigures; ppm?: PpmFigures; partners?: Record<Tier, TierTerms> };
const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (x: number) => WORD[x] ?? n(x);
// Paystack's own charge on a local card, in words, from the numbers checkout uses (lib/giving.ts PAYSTACK_LOCAL).
const CARD_CHARGE_TEXT = () => `${rate(PAYSTACK_LOCAL.percent)}, plus ${formatNaira(PAYSTACK_LOCAL.flatKobo)} from ${formatNaira(PAYSTACK_LOCAL.flatWaivedUnderKobo)}, at most ${formatNaira(PAYSTACK_LOCAL.capKobo)}`;
// The session, subscription and gift commission across the plans that publish, for the articles about each.
const SESSION_RATES = () => `${pct("basic", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")} on Free Basic, ${pct("pro", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")} on Pro, ${pct("business", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")} on Business, and the rate agreed with us on Enterprise (from ${rate(t("enterprise").sessionAndUnlockCommissionFloor ?? 0.05)})`;

export function builtInArticles(live: KbLive = {}): KbArticle[] {
  const ag = live.agents ?? AGENT_DEFAULTS;
  const room = live.rooms ?? DEFAULT_ROOM_FIGURES;
  const roomListeners = n(room.listeners);
  const rec = live.recording ?? DEFAULT_RECORDING_FIGURES;
  const fan = live.fans ?? FAN_DEFAULTS;
  const paid = live.paid ?? DEFAULT_PAID_FIGURES;
  const liveUplift = currentPricing().liveTicketUpliftPct;
  const ppm = live.ppm ?? DEFAULT_PPM_FIGURES;
  const ppmUplift = currentPricing().ppmUpliftPct;
  const pterms = live.partners ?? DEFAULT_TERMS; // Partner Network tier shares (Admin → Limits)
  const secs = (x: number) => `${x} second${x === 1 ? "" : "s"}`;
  const tierRange = (t: SubTier) => `${money(fan[`${t}Min`] * 100)} to ${money(fan[`${t}Max`] * 100)}`;
  // The plans whose hosts may record, and publish replays (Admin → Limits, "Audio rooms and live").
  const planList = (k: LimitKey) => { const p = LIMIT_TIERS.filter((x) => limitFor(k, x, live.limits) > 0); return p.length === LIMIT_TIERS.length ? "every plan" : p.length ? (p.length === 1 ? LIMIT_TIER_LABEL[p[0]] : `${p.slice(0, -1).map((x) => LIMIT_TIER_LABEL[x]).join(", ")} and ${LIMIT_TIER_LABEL[p[p.length - 1]]}`) : "no plan for now"; };
  const rlive = room.live ?? DEFAULT_ROOM_FIGURES.live; // Live mode (lib/rooms-live.ts)
  const lim = (k: LimitKey, tier: (typeof LIMIT_TIERS)[number]) => limitFor(k, tier, live.limits);
  // A plan limit over the plans that publish: "30", or "10 to 50" when the plans differ (byPlan says so).
  const values = (k: LimitKey) => LIMIT_TIERS.filter((x) => t(x).canPublish).map((x) => lim(k, x));
  const byPlan = (k: LimitKey) => new Set(values(k)).size > 1;
  const span = (k: LimitKey, fmt: (x: number) => string = n) => {
    const v = values(k), lo = Math.min(...v), hi = Math.max(...v);
    return lo === hi ? fmt(lo) : `${fmt(lo)} to ${fmt(hi)}`;
  };
  const onPlans = (k: Parameters<typeof plansWith>[0]) => plansWith(k, live.limits) || "no plan for now";
  const opPlans = LIMIT_TIERS.filter((x) => lim("nanaOperator", x) > 0).map((x) => LIMIT_TIER_LABEL[x]);
  const operatorPlans = opPlans.length ? (opPlans.length === 1 ? opPlans[0] : `${opPlans.slice(0, -1).join(", ")} and ${opPlans[opPlans.length - 1]}`) : "no plan for now";
  const voiceMax = span("messageVoiceNoteSeconds", (x) => (x % 60 === 0 ? `${x / 60} minute${x === 60 ? "" : "s"}` : `${x} seconds`)) + (byPlan("messageVoiceNoteSeconds") ? " by plan" : "");
  const days = (h: number) => (h % 24 === 0 ? `${h / 24} day${h === 24 ? "" : "s"}` : `${h} hours`);
  const DAYNAME = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const logKept = ag.logDays % 365 === 0 ? `${ag.logDays / 365 === 1 ? "12 months" : `${ag.logDays / 365} years`}` : `${ag.logDays} days`;
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
    A("day-night-emojis", "Day and night, the African pattern, emoji packs and flags", "Getting started", `
**Day or night:** tap the round ☀ / ☽ / ◐ button in the header to go Day → Night → Auto, or choose under **Account settings → Day or night**, in the menu on a phone, or in the menu under your picture on a computer. **Day ☀** is the warm ivory paper; **Night ☽** is #NotesApp maroon with ivory writing, easier on the eyes in the dark; **Auto ◐** follows the clock, Night from 6:30 in the evening to 6:30 in the morning. Your choice stays on this device. Your own site keeps its own look, and Naija Exam Prep and the Notes Life game keep theirs.

**The African pattern:** line drawings of talking drums, the ogene and agogo gongs, the kora and shekere, Nok and Benin bronze heads, an Igbo-Ukwu bronze vase, Queen Idia's mask, kente, adinkra, an old hurricane lantern, danfos and kekes, the naira, maps of Africa, Nigeria, Ghana, Kenya, South Africa and Egypt, and more. It sits behind every chat (messages, group chats, Circles and the team room), and is the cover on a profile, a community or a site until a picture is added: maroon on ivory by Day, ivory on maroon by Night.

**Your own chat background (Pro, Business and Enterprise):** under **Account settings → Chat background**, or **Chat background** in a chat's menu, choose the African pattern, plain, one of six colours (Kente gold, Adire indigo, Forest, Sahel sand, Atlantic, Hibiscus) or upload your own picture. Only you see it, in every chat and on every device; a soft wash goes over a picture so messages stay easy to read. On other plans the choices show with a 🔒 and **Unlock**.

**Emoji packs:** open 😊 in a chat. **Everyday** has the usual emojis and ours (:na:). **Afro culture** has our own drawings (the drums, gongs, bronzes and maps), **Faces** has everyday faces in one colour, and **Flags** has every African country's flag and many more. These are free on every plan. **Summer**, **Spooky** and **Celebrate** come with Pro, Business and Enterprise: they show a 🔒 and **Unlock**, which opens [Plans and prices](/pricing). Pack emojis are maroon crimson by Day and warm ivory by Night (flags keep their own colours), and white inside your own crimson bubbles. Anywhere that only shows words, like the inbox or an email, they read as their name.

**Flags and maps as you type:** type a country's name ("Nigeria", or just "Nig") or its code in capitals ("NG", "GHA") and a row above the box offers its flag, and its map when there is one. Tap to put it in: a code turns into the flag, and a name keeps its word (finished for you if you cut it short). Codes only count in capitals, so words like "in" or "us" never set it off.`),
    A("referrals", "Referrals and affiliates", "Publishing and earning", `
**Your link:** go to **Account → Referrals** ([/profile/referrals](/profile/referrals)) and copy your link (it looks like \`/r/yourname\`). Verify your email first: links only earn for verified members.

**Your code:** the same page shows your code, which is your username in capitals. A friend can type it under **Have a discount code?** when they choose a plan, instead of using your link; it counts the same. If a friend uses your code and someone else's link, the first one recorded wins.

**What a friend gets:** if they join through your link within ${REFERRAL_COOKIE_DAYS} days, their first month of Pro or Business is free. They add a card, which is checked with ${money(CARD_CHECK_KOBO)} that is given straight back, and the plan is billed from the second month. On a yearly plan they get one month's value off the first year instead.

**What you earn on plans:** ${rate(PLAN_SHARE)} of what your friend pays for their plan, every payment, for ${PLAN_MONTHS} months from their first real payment. Nothing is earned on the free month.

**Promote products (affiliates):** open the **affiliate marketplace** ([/affiliates](/affiliates)) to see shop items, downloads and courses whose publishers pay a share. Choose **Get my link** on any of them and share it: anyone who buys through it within ${REFERRAL_COOKIE_DAYS} days earns you that share of what they paid (after any discount code). You can't earn on your own purchases, or on your own products.

**For publishers:** under **Account → Referrals**, set a share (up to ${MAX_AFFILIATE_PERCENT}%) on any shop item on sale here, download or paid course. It goes on the marketplace at once; set 0 to take it off. The share comes out of your part of the sale, and #NotesApp's commission is worked out as usual.

**Getting paid:** earnings wait ${HOLD_DAYS.plan} days (${HOLD_DAYS.store} for delivered shop items) so payments can clear; a refund takes back what it earned. Then take them as **cash** to your bank account, from ${money(MIN_CASH_KOBO)} (add one on the Referrals page if you don't sell), or as **NotesApp Credit** with ${rate(CREDIT_BONUS)} more, any amount.

**Your monthly report:** on the 1st of each month we email you a report on the month before, but only if something happened: friends who joined, paid conversions, affiliate sales, what you earned, and your available, pending and withdrawn balances, with a table of the month's sign-ups and sales. Buyers and friends are never named. Turn it off under **Account settings → Email** ([/profile/account#email](/profile/account#email)) or with the link at the bottom of the email; your Referrals page always has the same numbers.

**Fair play:** there's no monthly cap. If someone's earnings jump suddenly, our team checks before they're paid, and links used to refer yourself or fake accounts are taken back.

**Affiliate codes:** a publisher can also let affiliates share one of their discount codes as their own; see [Discount codes and coupons](/help/discount-codes). Publishers: [Store selling](/store-selling#affiliates) has the short version.
`),
    A("discount-codes", "Discount codes and coupons", "Publishing and earning", `
**Make a code for your own products (every plan):** go to **Account → Discount codes** ([/profile/discounts](/profile/discounts)) and choose **New code**.
- **The code:** 3 to 20 letters, numbers or dashes, like \`WELCOME10\`. Buyers type it at checkout; capitals don't matter.
- **The discount:** a percentage (1% to ${MAX_PERCENT}%) or a naira amount off.
- **What it works on:** your shop items, downloads, courses and booked sessions; or only some of them (paste their links).
- **Limits, all optional:** total uses, uses per member (one by default), a start and an end date, a minimum order, and "only for a first order from you".

You see how many times each code was used, how much it took off and what buyers paid. You never see who used it. **Pause** a code at any time, for example if it's shared somewhere you didn't mean.

**What a code never does:** take the price under ${money(MIN_PAYABLE_KOBO)}, touch the delivery fee, or work on someone else's products. You can't use your own code.

**The money:** the discount comes off your price, and #NotesApp's commission is worked out on what the buyer actually paid. On a basket the discount is shared across the items in proportion to their prices.

**Using a code as a buyer:** at checkout choose **Have a discount code?**, type it and **Apply**. You see what it takes off before you pay; the price is checked again when you pay. #NotesApp's own codes work on boosts, Nana credit, merch and the logistics and inventory add-ons.

**Codes on Pro and Business:** on the pricing page, choose **Have a discount code?** under the plan. A #NotesApp plan code takes its discount off your first payment (a month or a year, whichever you choose); the plan then renews at its usual price on the same card. You can also type a member's referral code there (see [Referrals and affiliates](/help/referrals)). One code per order.

**Coupons:** a code can also be a coupon.
- **In your shop:** tick **Show it as a coupon in my shop** on a code. Buyers see it on your shop and product pages and can **Save** it.
- **As a card:** **Share** on a code gives a link whose preview is the coupon's card (good for WhatsApp and Instagram). Whoever opens it can save it, copy the code, or go straight to your shop.
- **For affiliates:** tick **Affiliates can share it**. Each affiliate then has their own version on the affiliate marketplace, like \`TOLU-AMAKA10\`: buyers get the same discount, and the affiliate earns your affiliate share on what they sell.

**Nana's pick:** at checkout, Nana applies the coupon that takes the most off: from the coupons you saved (**Account → My coupons**) and the ones the store offers. It shows as Nana's pick; remove it or type another code if you like.

**Coupons ending soon:** when a coupon in My coupons ends within 3 days, your bell tells you once a day, and a bar under the header reminds you the first time you open #NotesApp each day and whenever you sign in.

**One store, its own coupons:** a store's coupon only works in that store. Type another store's coupon (or a #NotesApp coupon in a store) and you'll see "Input a coupon from this store."

Your saved coupons are under [My coupons](/profile/coupons). For sellers, [Store selling](/store-selling#discount-codes) sums it up; for affiliates, see [Referrals and affiliates](/help/referrals).`),
    A("create-an-account", "Creating an account", "Getting started", `
Go to [Sign up](/signup). The quickest way is **Sign up with Google** (or **with LinkedIn**): you still choose your username, accept the Terms and say you are 18 or older, but there is no password to make and your email is already verified. See [Signing in with Google or LinkedIn](/help/google-linkedin-sign-in).

With your email instead: choose **Personal** for a person, or **Organisation** for a company, NGO, church, school or club (organisations also enter their CAC registration number). Pick a display name, a username, an email and a password, tick that you are 18 or older and agree to the [Terms](/terms) and [Privacy Policy](/privacy), and you are in.

You will be asked to follow a few journals so your feed is not empty. Verify your email using the link we send: you need a verified email before you can pay for sessions, subscriptions or gifts.

You can also tell us, if you like, what you do, your role and where you work. It is optional and shows under your name on your profile; change it any time in [Edit profile](/profile/edit).

Every password box has an eye button to show or hide what you typed, so you can check it before you continue. On the app address, [${APP_HOST}](${APP_URL}), you sign in or create your account right on the welcome screen.

Forgot your password? Use [Reset password](/forgot-password).`),
    A("google-linkedin-sign-in", "Signing in with Google or LinkedIn", "Getting started", `
You can make a #NotesApp account with Google or LinkedIn and sign in with it afterwards, on the website, the app, Notes Life and Naija Exam Prep.

**New here:** on [Sign up](/signup) or [Sign in](/login), tap **Continue with Google** or **Continue with LinkedIn** and choose your account. The first time, you finish your account just like an email sign-up: choose Personal or Organisation, your display name and @username, tell us what you do if you like, tick that you are 18 or older (on Naija Exam Prep, students under 18 get teen mode) and accept the [Terms](/terms) and [Privacy Policy](/privacy). Then follow a few journals. Google and LinkedIn confirm your email, so there is no verification link to click.

**Already have an account:** link Google or LinkedIn to it first. Sign in the way you usually do, open [Account settings → Sign-in methods](/profile/account#sign-in-methods) and tap **Link Google** or **Link LinkedIn**. From then on, Continue with Google or LinkedIn signs you in to that account. We email you every time a new sign-in method is linked; if it wasn't you, unlink it there and change your password.

**"You already have a #NotesApp account":** if you tap Continue with Google or LinkedIn and that email already has an account, we don't join them on our own, to keep your account safe. Sign in with your password or a passkey, then link it under Sign-in methods. After Google asks, signing in with your password on the same page links Google straight away.

**Unlinking:** under Sign-in methods, tap **Unlink**. You always keep at least one way to sign in, so the last one can't be removed: add a password (use [Reset password](/forgot-password) to set one), a [passkey](/help/passkeys) or the other account first.

**Good to know:** LinkedIn sign-in only reads your name, picture and confirmed email; it never posts. Posting your journals to LinkedIn is a separate switch (Publish to LinkedIn). An account made with Google or LinkedIn has no password until you set one with Reset password. Deleting your account removes its Google and LinkedIn links too.`),
    A("passkeys", "Signing in with a passkey", "Getting started", `
A passkey lets you sign in with your fingerprint, face, phone screen lock or a security key instead of typing your password. It can't be guessed or phished, and it never leaves your device.

**Add one:** sign in, open [Account settings](/profile/account#passkeys) → **Passkeys**, give it a name if you like (for example "My phone") and tap **Add a passkey**. Your phone or computer asks you to confirm with your fingerprint, face or screen lock. You can keep up to 10 passkeys, for example one on your phone and one on your laptop.

**Sign in with it:** on the sign-in page, tap **Sign in with a passkey** and confirm on your device. The same works at the team hub's Staff login, and on the app, Notes Life and Naija Exam Prep.

**Good to know:** a passkey works on the address it was made on and its family: one made on www.naapp.tech also works on app.naapp.tech, life.naapp.tech and prep.naapp.tech, but not on notesapp.name.ng, and the other way round. Your password keeps working. Lost a device? Remove its passkey under Account settings → Passkeys (unless it's your only way to sign in). Deleting your account removes your passkeys too.`),
    A("my-cycle", "My Cycle: your private cycle companion", "Safety and your data", `
[My Cycle](/cycle) is a private cycle and wellness companion for women and girls: period predictions, a daily check-in, food and movement ideas for each phase, and advice from Nana. [How it works](/my-cycle).

**Setting it up:** open **My Cycle** from your account menu. The first time, it asks once, in private: **I'm female** or **Not for me**. Your answer never shows on your profile. "Not for me" hides My Cycle from your menu; to bring it back, open [Account settings](/profile/account#privacy) → **Privacy**. If you choose I'm female, add the day your last period started and your usual cycle length (or "I don't know"), and tick the consent line.

**The lock:** My Cycle opens only with a [passkey](/help/passkeys), checked with your fingerprint, face or screen lock every time. If you haven't got a passkey, it helps you add one first. When you switch apps or tabs, or after 2 minutes without a touch, the page goes blank and locks again.

**Today, Calendar, Insights:** the ring shows where you are in your cycle. Your cycle length is the average of your last 6 cycles (or your own setting, or 28 days), always between 21 and 45 days. Adults also see the fertile window and an ovulation estimate (14 days before the next period), or Active and Break days with **Taking the pill**. Predictions are marked "early guess" until you've logged 3 periods. Tap a day on the calendar to log or fix a period.

**Check-in and Nana:** log mood, symptoms, energy, pain, water, sleep and flow. **Save · and ask Nana** gives a short note on how today fits, what to eat and how to move. Nana also writes a note for each day, a monthly report, and answers your questions in **Ask Nana**. She is told only your phase and a short summary of what you logged, never your name. She uses your own connected AI account if you have one, otherwise your Nana allowance; when neither is available, you get our own tips for your phase. If something may need a doctor (very heavy bleeding, severe pain, a period more than 3 months late), she says so plainly.

**Ages 13 to 17:** the teen version has periods, symptoms, mood, food and movement, with Nana in words for your age. There's no fertile window, ovulation day or pill mode. Your parent never sees what you log. Child profiles and organisation accounts don't have My Cycle.

**Reminders:** in My Cycle's settings (⚙️) you can turn on an evening check-in reminder and a note if your period may be late. Both are bells that only say "A reminder from My Cycle", never an email.

**Your data:** everything is encrypted on our server and only you can open it. It isn't part of your account download, ads, analytics or other Nana chats, and staff can't see it. **Download my data** and **Delete everything** are in My Cycle's settings, and closing your account deletes it all.

**Not medical advice:** My Cycle is not contraception and not a medical device. Predictions are estimates from your own logs.`),
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

**Free allowance.** Every member gets a free allowance on our AI account, sized by plan (Free and Free Basic, Pro, Business and Enterprise each get more). It refreshes ${nanaResetText()} (Lagos time), and doesn't carry over. Dearer gems and more thinking use it faster. The chat's gem button and the [Nana page](/nana#credit) show what's left and when it refreshes.

**Nana credit.** Anyone, on any plan, can buy Nana credit on the [Nana page](/nana#credit), by card or from your NotesApp Credit wallet. Your free allowance is always used first, then your credit. Credit never expires and carries over. When both run out, Nana answers from the help centre until your allowance refreshes.

**Answer bank.** When you open a chat with a general question someone has asked before (for example "How do I get paid?"), Nana may answer straight away from her answer bank. That's free and doesn't use your allowance. Only general questions go in, never anything personal.

**Course covers.** Making a course cover with Nana in Notes Academy uses a little of your allowance too (Pearl designs it; drawing the picture is free). When your allowance and credit are used up, covers stop until the allowance refreshes. Your plan's daily number of covers applies either way.

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
- **Free Basic**: ${t("basic").price}. Publish and earn. Commission is highest here (${pct("basic", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")} on paid sessions, subscriptions and gifts).
- **Pro**: ${t("pro").price}, or ${money(t("pro").yearlyKobo!)} a year${yearlyFreeText("pro") ? ` (${yearlyFreeText("pro")})` : ""}.
- **Business**: ${t("business").price}, or ${money(t("business").yearlyKobo!)} a year${yearlyFreeText("business") ? ` (${yearlyFreeText("business")})` : ""}. Includes the verified badge, your own domain, and ${words(ORG_SEATS.business ?? 0)} team seats.
- **Enterprise**: ${t("enterprise").price}. Rates and seats are agreed with us; [contact us](/contact).

**Free trials:** you can try Pro and Business free for ${TRIAL_DAYS} days each, with no card, from [Pricing](/pricing) (a verified email is needed). Each plan can be tried once. When a trial ends you're back on the plan you pay for, or Free Basic, and everything you published stays. To try another plan after a trial, pay for a plan first: a paid plan has to come between two free trials. You can upgrade or downgrade by paying at any time. Add-ons (such as logistics) have a one-time free trial of up to ${TRIAL_DAYS} days too.

**Courses (Notes Academy):** free courses are free to publish on every publishing plan. Certificates on free courses are paid: the learner pays from ${certificateMin()} plus the margin the teacher sets. Paid courses: on Pro with text lessons, PDFs and YouTube, and on Business and Enterprise with uploaded videos too, with the same fee as digital items. For organisations, two packages sit on top of Enterprise: **Enterprise Courses** at ${enterpriseCoursesPrice()} a month, and the **Enterprise Academy API** from ${academyApiFrom()} a month plus usage. The regular Enterprise price stays as it is for anyone who takes neither.

**Quizzes:** tutors can add quizzes with a pass mark to any course, free or paid, on every plan that can teach; see [Teaching and learning on Notes Academy](/help/academy).

**Codes, referrals and affiliates:** under Pro or Business on the [pricing page](/pricing), **Have a discount code?** takes a #NotesApp plan code off your first payment, or takes a member's referral code for a first month free (a month off a yearly plan); see [Discount codes and coupons](/help/discount-codes). Every publishing plan can make its own discount codes, and every member can earn from [referrals and the affiliate marketplace](/help/referrals).

**Communities:** [giving](/help/giving) has no commission, only a charge like a bank transfer; [paid event tickets](/help/event-tickets) have no commission either, only the same small charge per ticket.

**Coming as paid add-ons:** ${ADD_ONS_LINE}

Paid plans renew automatically through Paystack, monthly or yearly. Cancel any time under Rates & payouts and you keep the plan until the period you paid for ends; there are no partial refunds. Every price and difference is on the [pricing page](/pricing).`),
    ...(WALLET_LIVE
      ? [A("notesapp-credit-wallet", "NotesApp Credit: your wallet", "Plans and pricing", `
**NotesApp Credit** is a prepaid balance. Top up once in your [Wallet](/profile/wallet) and pay across #NotesApp without entering your card each time.

**Top up:** from ${money(TOPUP_MIN_KOBO)} to ${money(TOPUP_MAX_KOBO)} at a time, through Paystack (card, bank transfer or USSD). Open the menu under your name → **Wallet** → **Top up**.

**Top up with CardTap:** on an Android phone with NFC, choose **Tap to pay with CardTap** under Top up. The first time, you're asked for your phone number: CardTap needs it to start the payment. It's kept privately for your next top-up, never shown on your profile, and you can change it there any time. You get a code: open the free [CardTap app](https://play.google.com/store/apps/details?id=com.lonytech.cardtap) from Paylony, paste the code (or scan its QR), tap your bank card on the phone and enter your PIN. Your wallet updates by itself a moment later. CardTap's own fee is added at cost, ${rate(CARDTAP_FEE_RATE)} of the top-up and never more than ${money(CARDTAP_FEE_CAP_KOBO)}, and you see it before you pay (during the launch offer, #NotesApp pays it for you). It's usually cheaper than paying by card. iPhones from the iPhone 13 follow when Paylony adds them. Refunds of a CardTap top-up go through Paylony.

**Bonus Credits** come with larger top-ups:
${BONUS_STEPS.map((b) => `- ${money(b.fromKobo)} or more: **+${money(b.bonusKobo)}**`).join("\n")}
They last ${BONUS_DAYS} days, are spent before your own credit (soonest-ending first), and can be used only for boosts, the verification badge and advert banners. Bonus amounts can change and are always shown before you pay.

**Paying from your wallet:** when you pay for a boost, the maroon ✔ badge, an ad campaign, a gift, a shop item, a download or a paid session, and you have something in your wallet, you're asked **Wallet** or **Card, bank transfer or USSD**. The same prices and rules apply as paying by card:
- Shop items are **held** until you confirm delivery, and sessions until they have happened; then the seller is paid.
- A badge paid from the wallet lasts one month and doesn't renew by itself; add it again when it ends.
- Gifts, shop items, downloads, sessions and tickets to [paid lives](/help/paid-lives) use your credit only, not Bonus Credits.
- **Pay-per-minute sessions** [hold](/help/pay-per-minute) the minutes you choose from your credit (never Bonus Credits) when you book. Held credit can't be spent elsewhere until the call ends; then you pay only the minutes used and the rest comes straight back. The Wallet page shows what's held.

**Refunds** of a wallet payment (a cancelled boost, a cancelled session, an order that never arrived) go back to your wallet. A ticket to a paid live the host cancels or never starts comes back to your wallet as credit even if you paid by card. Any Bonus Credits you used come back as Bonus Credits for another ${BONUS_DAYS} days.

**What you can't do:** NotesApp Credit can't be withdrawn, cashed out, sent or sold to another member. Sellers and publishers are always paid to their bank accounts, never into a wallet. Plans (Pro, Business), journal subscriptions, the gold badge and merch are paid by card for now.

**Your statement:** the Wallet page lists every top-up, payment, refund and expired bonus, with filters (Top-ups, Spent, Bonus, Held, Refunds), and the credit held for pay-per-minute sessions. Closing your account? Spend your credit first, or [contact us](/contact) to refund unspent top-ups to your card (Bonus Credits aren't refunded).`)]
      : []),
    A("commission-rates", "What #NotesApp takes (commission) on each plan", "Plans and pricing", `
On **paid sessions, journal subscriptions and gifts to you** (one rate for all three), #NotesApp takes a commission that falls as you move up:
- Free Basic: ${pct("basic", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")}
- Pro: ${pct("pro", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")}
- Business: ${pct("business", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")}
- Enterprise: ${pct("enterprise", "sessionAndUnlockCommission", "sessionAndUnlockCommissionFloor")}

On store sales, the commission is on the item price only (your delivery fee is yours): physical goods ${pct("basic", "physicalCommission", "physicalCommissionFloor")} on Free Basic, ${pct("pro", "physicalCommission", "physicalCommissionFloor")} on Pro, ${pct("business", "physicalCommission", "physicalCommissionFloor")} on Business; digital downloads ${pct("basic", "digitalCommission", "digitalCommissionFloor")}, ${pct("pro", "digitalCommission", "digitalCommissionFloor")} and ${pct("business", "digitalCommission", "digitalCommissionFloor")}. Enterprise rates are agreed with us.

Your own rate is shown where you set your prices and see your earnings, under [Rates & payouts](/profile/publishing), and on [My bookings](/bookings). A sale keeps the rate in force when it was paid.

**Not the same as gifts to you:** **giving** to a community (its funds) has no commission, just a flat charge like a bank transfer (${bandsText(money)}), plus the card charge at cost by card; see [Giving to a community](/help/giving). **Paid event tickets** have no commission on any plan either: each ticket has the same small charge, plus the card charge at cost; see [Paid event tickets](/help/event-tickets).

**Paid lives:** on each ticket to your [paid live](/help/paid-lives), #NotesApp takes your rate above plus ${liveUplift}% of it, fixed when the ticket is bought, worked out on what the buyer paid after any subscriber discount.

**Pay-per-minute sessions:** on each [pay-per-minute session](/help/pay-per-minute), #NotesApp takes your rate above plus ${ppmUplift}% of it, fixed when the session is booked, worked out on the minutes the call used.

**Discount codes:** on a discounted sale, the commission is worked out on what the buyer actually paid. An **affiliate share** you set comes out of your part of the sale, not out of the buyer's price; see [Referrals and affiliates](/help/referrals).

Boosts have no commission: the price is the price. See the [pricing page](/pricing) for the full table.`),
    // ── Publishing and earning
    A("publishing-journals", "Publishing journals", "Publishing and earning", `
Once you have a publishing account (Free Basic or above), write from [Write](/write/new). The composer has formatting, a preview, images and drafts that are never lost. Each entry can be public, or kept private as a client journal.

You can add one video per post (MP4 or WebM, up to ${VIDEO_MAX_SECONDS / 60} minutes), played in our own player. How many videos you can upload a week depends on your plan.

Pick up to 3 topics for each journal (and add your own hashtags), so readers who chose those topics see it first in their feed and their weekly digest; see [Choosing your interests and topics](/help/interests-and-topics).

**Share to Journals:** on a journal, a course, a shop item, a service, a public event, a certificate, a coupon or a public community post, tap **Share** and choose **Share to Journals**. A new draft opens with it quoted at the top: its title as a link, its cover and "Shared from @name", crediting whoever made it. Add a title and your thoughts, then save the draft or publish it when you're ready: nothing is published for you. You need a publishing account to write, and to be signed in (visitors are asked to sign in and come back to finish).

**Pictures:** the cover and the pictures you add to the text carry the [NotesApp mark](/help/notesapp-mark) with the journal's main author's @username, added as they upload; only the marked copy is kept.

Readers can follow your journal, comment, like, share and save. You can also [boost a post](/help/boost-a-post) to reach more readers, or [co-author](/help/co-authoring) with other members. Browse examples on [Journals](/journals).`),
    A("kiswahili-journals", "Journals and voice notes in Kiswahili", "Publishing and earning", `
With NKENNEAi, journals and voice notes can reach Kiswahili speakers.

**For writers:** when you write or edit a journal, tick **Offer this journal in Kiswahili**. Readers then get **🌍 Kiswahili** (the journal translated, with **Show original**) and **🔊 Sikiliza** (it read aloud in Kiswahili, in a female or male voice, at 0.75×, 1× or 1.25×). It's translated, and the audio made, the first time a reader asks, then kept for everyone. Edit the journal and a fresh version is made next time. Not for subscriber-only (premium) posts: those words stay with your subscribers.

**Voice notes in Messages:** under someone's Swahili voice note, tap **Transcript** or **Translate to English**; under your own English voice note, tap **In Kiswahili**. The words stay on the message for both of you.

If you don't see these, Kiswahili isn't switched on yet.`),
    A("paid-sessions", "Paid 1:1 sessions and bookings", "Publishing and earning", `
Publishers set a session price (${money(LIMITS.sessionMinKobo)} to ${money(LIMITS.sessionMaxKobo)}), a length and their weekly availability, shown in Lagos time. A visitor taps **Book a session** on the publisher's profile, picks a time, pays in Naira (through Paystack, or from their wallet), and both of you get a confirmation email and reminders 24 hours and 1 hour before.

**Cancellations and refunds:** ${POLICY_TEXT}

**What #NotesApp takes:** ${SESSION_RATES()} of each paid session; the same rate as subscriptions and gifts (see [commission rates](/help/commission-rates)). Your own rate shows under Rates & payouts and on My bookings.

To earn from sessions, add a verified bank account under Rates & payouts. Manage your own bookings on [My bookings](/bookings). More at [Booking](/booking).

**Paid by the minute instead:** publishers can also offer [pay-per-minute sessions](/help/pay-per-minute): voice or video calls at a price per minute, booked in the same weekly times, where the caller holds minutes from their NotesApp Credit and pays only what the call uses.`),
    A("subscriptions", "Subscriptions: Premium, VIP and VVIP", "Publishing and earning", `
A publisher can offer paid monthly subscriptions in up to three tiers, each at a price they set: **Premium** (${tierRange("premium")} a month), **VIP** (${tierRange("vip")}) and **VVIP** (${tierRange("vvip")}). Each tier includes the ones below it. Set them under [Rates & payouts](/profile/publishing): tick the tiers you offer and type each price. Subscribers from before tiers are Premium at the price they pay.

**What it unlocks:** when you publish, choose **Who can read it**: Everyone, Premium and up, VIP and up, or VVIP only. Readers below that tier see a teaser and a prompt to subscribe or switch tier.

**Badges:** subscribers carry a badge next to their name in your space (your journal's comments, your shop's and courses' reviews): 🌄 **Starter** (Premium), 🛡 **Army** (VIP) and 🏆 **VVIP**. Subscribing also builds their [fan level](/help/fan-levels) with you.

**For readers:** subscribe from the creator's profile (or a locked entry), pick a tier, and pay by Paystack or NotesApp Credit; it renews every month, and you can cancel any time. Switching tier starts the new one now at its price, the days left on your old tier are added on, and the old tier stops renewing.

**Paid-live discount:** beside each tier's price you can give that tier's subscribers a discount on tickets to your [paid lives](/help/paid-lives), from 0% up to ${paid.discountMaxPct}%. It applies to every paid live you run, on top of whichever price applies (early bird, normal or late).

**For the publisher:** subscription money is released to your verified bank account after a 7-day window, minus your plan's commission: ${SESSION_RATES()} on Premium (see [commission rates](/help/commission-rates)). On **VIP**, #NotesApp takes your rate plus ${fan.vipUpliftPct}% of it, and on **VVIP** your rate plus ${fan.vvipUpliftPct}% of it: with an 8% rate, ${+(8 * (1 + fan.vipUpliftPct / 100)).toFixed(2)}% and ${+(8 * (1 + fan.vvipUpliftPct / 100)).toFixed(2)}%. The rate is fixed on each payment.`),
    A("global-subscriptions", "Subscribing and earning in other currencies (dollars, pounds, euros, shillings and more)", "Publishing and earning", `
Readers anywhere can subscribe to a creator and **pay in their own currency**, and creators can **earn in theirs**: a reader in the United States can subscribe to a creator in Kenya in dollars, and a reader in Kenya to a creator in the US or Nigeria in shillings.

**For readers:** on a creator's profile, tap **Subscribe**, then choose your currency under **Pay in** (we guess it from your time zone). You pay by card through **Stripe** (US dollars, pounds, euros, Canadian dollars, yen, UAE dirhams, Botswana pula, and Chinese yuan by card, Alipay or WeChat Pay; anywhere else pays in US dollars), **Flutterwave** (Kenyan shillings, Ghanaian cedis, rand, Ugandan and Tanzanian shillings, Rwandan francs, CFA francs, Zambian kwacha, Egyptian and North African currencies, Gambian dalasi; mobile money in Kenya, Ghana, Uganda, Rwanda and Zambia) or **Paystack** (naira). Paid this way, a subscription is **one month at a time**: we send you a reminder 3 days before it ends, and renewing adds a month on top. Naira readers of naira creators keep the usual monthly plan.

**The price you see:** if the creator prices in your currency, you pay exactly that. Otherwise it's their price converted at our exchange rate, plus a small margin (about 3%) for the conversion, rounded up to a tidy amount. If our rates are being updated, paying in another currency pauses for a short while; you can pay in the creator's own currency meanwhile.

**For creators:** on **Rates & payouts → Readers in other currencies**, choose the currency you earn in. In naira, your usual tier prices are used, and readers abroad pay them in their own currency (untick the box to keep subscriptions naira-only). In any other currency, set your monthly prices in it, and add where you're paid: a bank account or mobile money (M-Pesa, MTN, Airtel…).

**What you earn never moves with the exchange rate.** Your earning is your own price less your plan's commission (and a tier's share), fixed in your currency the moment the reader pays. It's held for 7 days (for refunds and card disputes), then paid to you in your currency. You see what's waiting on the same card.

**Who sells it:** #NotesApp sells the subscription to the reader and pays you your share as earnings, the way app stores and other creator platforms do. That's why we can take any currency and pay you in yours.

Related: [Subscriptions: Premium, VIP and VVIP](/help/subscriptions) · [Getting paid](/help/payouts) · [How your money is kept safe](/help/payment-safety)
`),
    A("fan-levels", "Fan levels, Top fans and live entrances", "Publishing and earning", `
Every creator has a **Top fans** list (open it with **🏆 Top fans** on their profile). Your place on it comes from points you build with that creator, all-time:

- **Subscribing** (any tier) and **gifts**: 1 point for every ₦${(KOBO_PER_POINT / 100).toLocaleString("en-NG")} you pay them
${Object.values(FAN_ACTIONS).map((a) => `- **${a.label}**: ${a.points} point${a.points === 1 ? "" : "s"} (up to ${a.perDay} a day count)`).join("\n")}

You never earn points with yourself. The top ${TOP_FANS} get a badge next to their name wherever the creator posts (comments on their journal, reviews on their shop and courses): 🥇 #1, 🥈 #2, 🥉 #3, 🏅 #4 to 10 and 🎖 #11 to ${TOP_FANS}, each reading "{Name}'s Top Fan". Subscribers also carry their [tier's badge](/help/subscriptions).

**Your fan level:** on a creator's Top fans page you see your place, your points and how many more you need for the next band.

**Live entrances:** in the creator's lives (audio rooms), their top three arrive and leave in style, with a banner everyone sees: **#1 with a VVIP subscription** by **yacht or private jet**, **#2 with any subscription** by **SUV or sports car**, and **#3 with any subscription** by **e-bike or bicycle**. Pick which of your two on the Top fans page.

**Privacy:** a creator can hide their Top fans list under Rates & payouts (badges still show). Members in teen mode only appear on lists to people who follow them, and a creator in teen mode has no public list.`),
    A("gifts", "Gifts", "Publishing and earning", `
A reader can send a publisher, or one single post, a gift, with a short note, or anonymously. Gift is the **Gift me** button on a publisher's profile and the 🎁 on their posts; both switch on once the publisher has added a payout account. If Gift me is greyed out, tap or hover the ℹ️ beside it.

**Gift anyone:** tap **⋯** beside a name for **Gift · Block · Report**: a speaker or host on a live's stage, someone who commented on a journal, someone who reviewed a shop item or a course, the creator of a Media post (when they allow gifts on it) and the host of a replay. The person must have added a payout account; otherwise Gift is switched off and says why. **Block** stops them messaging you and seeing your moments, and you can't gift each other; **Report** sends them to our team with where it happened.

**Several at once:** tap a small (premium) gift twice and **How many?** opens: send 1 to ${GIFT_SETTINGS.economy.quantityMax} of it as one payment, at that many times its price. It plays once, with **×N**. VIP gifts go one at a time, one send can't go over ${money(GIFT_MAX_KOBO)}, and a send over ${money(UNVERIFIED_GIFT_CAP_KOBO)} needs the ✔ badge.

**Teen mode:** a member in teen mode can receive gifts only from people they follow back (you follow each other). For everyone else the gift action is switched off for them.

**Animated gifts:** choose one of ${enabledGifts().length} named gifts. Each plays full screen with its own mix of rays, stars, fireworks, confetti and sound, for the person you gift, in their notification, and for everyone looking at their page when it arrives (and, once lives open, for everyone in the live). Sound is off unless you switch on **Gift sounds** in the gift sheet. The gifts today:
${enabledGifts().map((g) => `- **${g.name}** (${MOTIF_BLURB[g.id]}): ${money(g.priceKobo)}${needsVerified(g) ? " ✔" : ""}`).join("\n")}

Gifts marked ✔ (${verifiedRuleText()}) are for verified senders: you need the ✔ badge to send them.${GIFT_SETTINGS.grand.announce ? ` Each gift from ${money(GIFT_SETTINGS.grand.fromKobo)} is also announced to everyone on #NotesApp at that moment, with a link to join the live (or the creator's page) and watch it; a creator in teen mode is never announced, and an anonymous sender stays anonymous.` : ""} Or choose **Other** and type any amount from ${money(GIFT_MIN_KOBO)} to ${money(GIFT_MAX_KOBO)}.

**Paying:** from your NotesApp Credit, or by card, bank transfer or USSD through Paystack. ${NO_BONUS_TEXT} You need a verified email to send a gift, and you cannot gift yourself.

**Gift points:** every ${money(GIFT_POINT_KOBO)} you spend on gifts is 1 gift point, a running count shown on your profile's **Gifts** tab (all time and this week). The same gifts also raise your fan level with that creator.

**Received gifts, archive and withdraw:** your profile's **Gifts** tab (after Media) lists every gift you received with its count and value. **Archive** takes a gift out of the list; it keeps its count and value under **Archived**, and what it earned can still be withdrawn. Each gift can be withdrawn 7 days after it arrives (a short review): **Withdraw** sends everything past its review to your bank account in one payout. ${withdrawRuleText()}

**For the publisher:** what you withdraw is the gifts minus your plan's commission: ${SESSION_RATES()}, the same as sessions and subscriptions, for a gift of a typed amount. **Animated gifts** carry a little more: on the ${enabledGifts().filter((g) => giftClass(g.priceKobo) === "premium").length} **premium gifts** #NotesApp takes your rate plus ${GIFT_SETTINGS.uplift.premiumPct}% of it, and on the ${enabledGifts().filter((g) => giftClass(g.priceKobo) === "vip").length} **VIP gifts** (from ${money(GIFT_SETTINGS.grand.fromKobo)}, verified senders) your rate plus ${GIFT_SETTINGS.uplift.vipPct}% of it. For example, with an 8% rate a premium gift is charged ${+(8 * (1 + GIFT_SETTINGS.uplift.premiumPct / 100)).toFixed(2)}% and a VIP gift ${+(8 * (1 + GIFT_SETTINGS.uplift.vipPct / 100)).toFixed(2)}%. Gifts sent in a live or on a post are the same.

**Top gifted today:** a creator who receives ${money(GIFT_SETTINGS.daily.targetKobo)}${GIFT_SETTINGS.daily.basis === "net" ? " after commission" : ""} or more in gifts in one day (midnight to midnight, Lagos time), from at least ${GIFT_SETTINGS.daily.minSenders} different people, is pinned in the **Top gifted today** shelf at the top of [Trending](/trending) and [Explore](/explore) for the rest of that day: the ${GIFT_SETTINGS.daily.slots} who received the most, and between two with the same amount, whoever got there first. A gift to yourself never counts. Members in teen mode only appear there for people who follow them.

**Weekly boards:** **Top gifted** (who received the most this week, on [Gifts](/gifts)) and each creator's **Top gifters** (who sent them the most, on their Gifts tab) start again at midnight going into Monday, Lagos time; **Last week** keeps the result. Anonymous gifts count for the receiver but never name the sender on Top gifters.

Gifts to a community's funds are [giving](/help/giving) instead: no commission, a flat charge. More at [Gifts](/gifts).`),
    A("paid-lives", "Paid lives: tickets, prices and the door", "Publishing and earning", `
A **paid live** is a live of your own (not a community's) that people buy a ticket for. It runs in the same room as [audio rooms](/help/community-audio-rooms), with video, the poster and the chat. See what's coming up on [Paid lives](/lives).

**Scheduling one:** on [Paid lives](/lives) tap **Schedule a paid live** and set the title, the date and time (Lagos), a poster, and three prices:
- **${BAND_NAME.early}:** until a date and time you pick.
- **${BAND_NAME.normal}:** from then until the start.
- **${BAND_NAME.late}:** from the start until the live has run ${paid.lateWindowMin} minute${paid.lateWindowMin === 1 ? "" : "s"}. After that, no more tickets.
You need a publishing account and your bank account under Rates & payouts. Members in teen mode can't sell tickets.

**Who can buy:** **Everyone**, **Premium and up** or **VIP and up** (subscribers of your own [subscription tiers](/help/subscriptions)). Subscribers still pay; this is who may buy.

**Subscriber discount:** set once, beside each tier's price under Rates & payouts → Subscriptions (from 0% up to ${paid.discountMaxPct}%). It comes off every ticket to your paid lives for subscribers of that tier, on top of whichever price applies.

**Recording:** **Off**, **Safety only** (kept for review, never a replay) or **Record and offer a replay**. Everyone is told as they join, and speakers agree before their mic goes on. More in [Recording a live, and replays](/help/live-recording-and-replays).

**Buying a ticket:** open the live's page, check the price (yours, after any subscriber discount) and pay from your NotesApp Credit or by card, bank transfer or USSD. Bonus Credits can't be used for tickets. One ticket a person; you get reminders a day before, an hour before, and when it starts.

**The door:** only ticket holders get in. When the host opens the live, **Enter the live** checks your ticket and takes you in; your ticket then shows **✓ Checked**. The host and the moderators the host names come in without a ticket. Only those moderators can moderate a paid live; a community's moderators have no powers there.

**Going live:** the host can open the room from 15 minutes before the start. If the host's connection drops or they end it by mistake, they can reopen it within 30 minutes and the same tickets still work.

**Refunds:** if the host cancels, or doesn't open the live within ${paid.noShowMin} minute${paid.noShowMin === 1 ? "" : "s"} of its time, every ticket is refunded **to NotesApp Credit** automatically (even if you paid by card), and you're told.

**For the host:** #NotesApp takes your [normal rate](/help/commission-rates) plus ${liveUplift}% of it on each ticket, fixed when the ticket is bought and worked out on what the buyer paid. The rest is paid to your bank account after the live ends and a ${PAYOUT_HOLD_HOURS}-hour window for problems, like a paid session.`),
    A("pay-per-minute", "Pay-per-minute sessions: voice and video calls by the minute", "Publishing and earning", `
A **pay-per-minute session** is a one-to-one voice or video call with a publisher, paid by the minute from your NotesApp Credit. You hold some minutes when you book, the call is metered by #NotesApp, and you pay only for what you use. Your sessions are on [Pay-per-minute sessions](/ppm).

**For publishers:** under [Rates & payouts](/profile/publishing), tick **Offer pay-per-minute sessions** and set a price per minute for **voice**, for **video**, or both (${money(PPM_RATE_MIN_KOBO)} to ${money(PPM_RATE_MAX_KOBO)} a minute), and who can book: **Everyone**, or your own **Premium, VIP and VVIP**, **VIP and VVIP**, or **VVIP** subscribers ([subscription tiers](/help/subscriptions); they still pay per minute). People book your weekly times, the same ones as [paid sessions](/help/paid-sessions). You need a publishing account and a bank account for payouts.

**Booking:** on the publisher's profile, under **Book · per minute**, choose voice or video, a day and a time, and how many minutes to hold (at least ${ppm.minMinutes}, up to ${ppm.maxMinutes} when booking). That many minutes at their price are **held** from your NotesApp Credit: set aside, not charged. Bonus Credits can't be used, so you need enough credit; [top up](/profile/wallet) first if not.

**The call:** either of you can start it from the session's page, from ${PPM_EARLY_MS / 60_000} minutes before the time. It's the same call as in Messages: phone to phone, end-to-end encrypted, through a relay only when a network needs one. A meter shows the time, the minutes billed and what's left of your hold. The meter is #NotesApp's: it starts when both phones are connected and counts on our clock, not on either phone.

**What you pay:** if the call ends within the first ${secs(ppm.graceSec)}, nothing. After that, every **started minute** is charged, counted from the start: a call of 12:41 is 13 minutes. Unused minutes go back to your NotesApp Credit as soon as the call ends.

**Running out:** when your held minutes are used up you're asked to add minutes (**+ Add ${PPM_ADD_STEP} minutes** holds ${PPM_ADD_STEP} more). If you don't, the call ends ${secs(ppm.topUpWaitSec)} later, and that wait isn't charged: you never pay more than you held. If a phone loses the connection for good, the call ends at the last moment you were both on it.

**Cancelling:** until the call starts, either of you can cancel and everything held comes back. A session whose call hasn't started ${ppm.noShowMin} minute${ppm.noShowMin === 1 ? "" : "s"} after its time ends by itself, and the hold comes back.

**For the publisher:** #NotesApp takes your [normal rate](/help/commission-rates) plus ${ppmUplift}% of it, fixed when the session is booked, on what the call used. The rest is paid to your bank account after the call ends and a ${PAYOUT_HOLD_HOURS}-hour window for problems, like a paid session. Within that window the caller can report a problem from the session's page, which pauses the payout while we review it.

**Teens:** members in teen mode can't sell or book pay-per-minute sessions.`),
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
- **Subscriptions:** released after 7 days.
- **Gifts:** ready 7 days after each gift; withdraw them from the **Gifts** tab on your profile. ${withdrawRuleText()}
- **Physical store orders:** released when the buyer confirms delivery, or 7 days after you mark it delivered if they say nothing.
- **Digital downloads:** after a 7-day dispute window.
- **Ad share:** monthly, after review (see [Ads and ad share](/help/ads-and-ad-share)).
- **Event tickets:** after the event ends and a 24-hour window for problems (see [Paid event tickets](/help/event-tickets)).
- **Paid-live tickets:** after the live ends and a ${PAYOUT_HOLD_HOURS}-hour window for problems (see [Paid lives](/help/paid-lives)).
- **Pay-per-minute sessions:** what the call used, after the call ends and a ${PAYOUT_HOLD_HOURS}-hour window for problems (see [Pay-per-minute sessions](/help/pay-per-minute)).
- **Gifts to a community:** held for a day, then paid on the next payout run (see [Giving to a community](/help/giving)).
- **Referral and affiliate earnings:** after 7 days (14 for delivered shop items), as cash or as NotesApp Credit (see [Referrals and affiliates](/help/referrals)).

Money can be held while we review a reported problem. Commission depends on your plan: see [commission rates](/help/commission-rates).`),
    A("boost-a-post", "Boosting a post or a store item", "Publishing and earning", `
A boost puts a published post, or an item in your store, in front of more readers: a boosted journal appears in the journal feed marked **Promoted**, and a boosted item in the Boosted strips on the home page and in [Notes Market](/shop). The strips show a few boosts at a time on a computer or tablet and one on a phone, taking turns, and boosts also go in the sponsored slots of the [weekly digest](/help/weekly-digest), where each email sent counts as one impression. The best picture is 1200 × 628 px (see [Advert sizes and spots](/advertise/specifications)). You pay for validated impressions (a real visitor had it at least half on screen for about a second, counted once per visitor per day), not for clicks.

Packages:
${BOOST_PACKAGES.map((p) => `- **${p.name}**: ${money(p.priceKobo)} for ${n(p.impressions)} impressions, delivered over at least ${p.minDays} days, running up to ${p.windowDays} days.`).join("\n")}

Boosts have no commission, and anything not delivered by the end is refunded pro rata, by itself, within about 15 minutes of the boost ending, the way you paid (card or wallet); you get a bell saying how much. You can also cancel a running boost under Boost performance: impressions already delivered are spent, you get half of the undelivered share back and forfeit the other half. If #NotesApp cancels a boost, the whole undelivered share is refunded and you are told why. See [Boost](/boost).`),
    A("co-authoring", "Co-authoring a post", "Publishing and earning", `
Pro, Business and Enterprise publishers can write a post with other members. The lead invites up to ${MAX_CO_AUTHORS} co-authors by username on a draft, and for each one chooses **what they can do** and **their share** of what the post earns (the lead keeps at least ${MIN_LEAD_PERCENT}%).

**Access levels**
- **Can view:** they read the draft before it's published (read-only), to review it and send you their comments. The share can be anything from ${MIN_VIEW_PERCENT}%: a reviewer can be credited without a share.
- **Can view and edit:** they also edit the draft's title and text, from **Read the draft / Open the draft** on their [invites page](/invites). Their save goes straight into the draft; if you have the draft open, the editor warns you before you save over their changes. Each co-author who edits gets at least ${MIN_CO_PERCENT}%.
- Either way, **you keep** publishing, the address, topics, picture and video, the split and the invitations. Nothing about the post or its co-authors changes once it's published.

**Accepting means agreeing.** The invitation arrives in the bell and by email and opens a page that shows who invited you, the title and cover, your access in plain words (what you can and can't do), your share and how it's paid, the credit, that the lead keeps publishing control, and how to leave. **Accept and agree** records the terms you saw (with the date and the terms version); the lead's panel then shows "Accepted on" that date. **Decline** says no. To accept you need a publishing account (Free Basic or above), because your share is paid to a bank account.

**Changing it later (while it's a draft):** the lead can change a co-author's access or share. Less access applies at once and the co-author is told. More access, or a different share, is sent to them to agree on the same page; until they do, the terms they agreed to stay in force. Declining a change keeps the old terms.

**Leaving and removal:** a co-author can **Leave** from their invites page before the post is published, and the lead can remove a co-author or withdraw an invite before publishing. Either way the credit and the share end, and the other person is told. Invites still waiting at publishing expire.

Invites sent before access levels existed keep what they had: those co-authors are credited and paid but don't see the draft, until the lead offers them access and they agree. Gifts on the post are split in the agreed percentages; sessions stay personal to each author. See [Co-authoring](/coauthoring).`),
    A("co-teaching", "Co-teaching a course", "Publishing and earning", `
On [Teach a course](/academy/teach), a course's lead (its owner, or for an organisation's course its admins and the team member who made it) can invite up to ${MAX_CO_TUTORS} co-tutors by @username under **4. Tutors**, choosing for each one **what they can do** and **their share of each sale** (from 0%; the lead keeps at least ${MIN_LEAD_TUTOR_PERCENT}%).

**Access levels**
- **Can view:** they see the course and every lesson, draft or published, read-only (open it from Teach with **Preview**), to review it and send the lead their comments. No editing.
- **Can view and edit:** they also edit the course's details, About, modules and lessons, including quizzes and uploads.
- Either way, **the lead keeps** publishing and unpublishing, the price and certificate, the shares, invitations and deleting the course.

**Accepting means agreeing.** The invitation arrives in the bell and by email and opens a page with who invited you, the course's title and cover, your access in plain words, your share (paid to your bank 7 days after each sale, less your own plan's commission; a refunded sale is refunded from every share), the credit (listed as a co-tutor on the course page), that the lead keeps publishing control, and how to leave. **Accept and agree** records the terms you saw, with the date; the lead sees "Accepted on" that date under Tutors. To accept you need a publishing account (Free Basic or above).

**Changing it later:** the lead taps **Change access or share**. Less access applies at once and the co-tutor is told. More access, or a different share, is sent for them to agree (it waits on their Teach page and in the bell); their current terms stay until they do. Courses can be changed after publishing too.

**Leaving and removal:** a co-tutor taps **Leave** under Tutors; the lead taps **Remove** (or **Withdraw** for an invite still waiting). Credit and the share of later sales end then, and the other person is told.

Co-tutors who joined before access levels existed keep what they had: they can view and edit. See [Teaching and learning on Notes Academy](/help/academy).`),
    A("ads-and-ad-share", "Ads and ad share", "Publishing and earning", `
**Advertising on #NotesApp:** anyone can buy a banner campaign, paid online and priced by validated impressions:
${AD_PACKAGES.map((p) => `- **${p.name}**: ${money(p.priceKobo)} for ${n(p.impressions)} impressions, up to ${p.windowDays} days.`).join("\n")}
Every ad is reviewed; if we cannot run it you are refunded in full, and impressions not delivered by the end are refunded pro rata, by themselves, soon after the campaign ends; you get an email saying how much. Start at [Advertise](/advertise).

**Sizes and spots:** one picture works everywhere: **1200 × 628 px** (1.91 : 1; at least 600 × 314, up to 2400 × 1256 for sharp screens), JPG, PNG or WebP, best under 500 KB and at most 1 MB, with the logo and words inside the middle 960 × 502. The campaign form crops other shapes for you before you pay. The headline is up to 60 characters and the text up to 120. Adverts can show on the home page, the journal feed, Trending, publishers' profiles and posts (when they show adverts), Notes Market, Notes Academy, Explore, search results, free course pages, the weekly digest (each email sent counts as an impression) and, if you choose, on a billboard in Notes Life, which needs its own 1600 × 900 picture. Never in Messages, checkout, lessons, paid course pages, certificates or the editors. When a spot has several adverts, each stays about 30 seconds. All of it, with templates to download: [Advert sizes and spots](/advertise/specifications).

**Ad share for publishers:** Pro publishers earn ${formatPercent(t("pro").adRevenueShare!)} and Business publishers ${formatPercent(t("business").adRevenueShare!)} of the ad revenue on their pages if they opt in, with no follower or view threshold. Free journals always show ads and have no share. Shares are calculated monthly, reviewed, held for ${AD_SHARE_HOLD_DAYS} days and paid to your verified bank account; amounts under ${money(AD_SHARE_MIN_KOBO)} roll into the next month.

**Crypto adverts:** an advert for a crypto, stablecoin or other virtual-asset service runs only with the advertiser's Central Bank of Nigeria licence or registration for it, and never with promises of interest, yield or returns for holding coins or tokens ([Crypto and stablecoins on #NotesApp](/help/crypto-and-stablecoins)).`),
    ...(MESSAGES_LIVE || MOMENTS_LIVE
      ? [A("messages-moments-groups", "Messages, group chats and moments", "Publishing and earning", `
${MESSAGES_LIVE ? `**Messages:** talk one to one, with bold, italic and underline, sent and read ticks, pictures, videos and documents (how big and how many depends on your plan), voice notes of up to ${voiceMax} and stickers. You can also drag pictures and files into a conversation, or paste them. A web address in a message becomes a link with a preview card (the page's picture, title and description). You can block or report anyone. Open [Messages](/messages).

At the top of every conversation is the person's picture, their name with any badge, and whether they are online (see [Followers, following and online status](/help/followers-and-online-status)). ${CALLS_LIVE ? "The phone and camera buttons start a **free voice or video call** with anyone you follow who follows you back; tap **Call back** on any call line to call again (see [Voice and video calls](/help/voice-and-video-calls)). " : ""}The small arrow beside it opens a menu: **View profile**, **View moments**, **Create group**, **Mute notifications** (no bell, push or email for that one conversation until you unmute it), **Block** and **Report**.

**Pins:** open the **⋯** menu on a message and choose **Pin** to keep it in a bar at the top of the chat, up to 3 per chat (in a group, only admins can pin). Tap a pinned message to jump to it. In your inbox, tap **📌** on a chat with a person or an organisation to keep it at the top, up to 3 chats; only you see your pinned chats.

**Typing:** while the other person is writing you see "…typing" at the bottom of the chat; in a group you see who is typing. It stops when they send or leave the chat.

**Edit or delete a message:** open the **⋯** menu on your own message. While nobody has read it, **Edit** and **Delete** happen straight away. Once it has been read (✔✔), everyone who read it gets a request to **Allow** or **Decline**; the change happens only when all of them allow it, and you can **Withdraw** the request. A request nobody answers is wiped after 30 days, like a draft (this doesn't affect journal drafts). Edited messages say "edited"; deleted ones show "This message was deleted", and their files are removed.

**Group chats:** start a group from Messages with up to 50 people you follow or who follow you. The top of a group shows its picture and how many members it has. Group admins see a **⚙️ Manage** button at the top of the group. From there they can rename it, set the group picture, add and remove people, make others admin, **switch member messages off** (then only admins can write and everyone else can still read) and back on, and **ban** someone who misbehaves: they are removed and can't be added back until an admin unbans them. Admins can also tap **Remove** under any message to take it out of the group: everyone then sees "Message removed by a group admin" in its place, and any files in it are deleted. If you don't see these options, you aren't an admin of that group: the members list marks who is. Anyone can leave or mute a group, and any message from someone else can be reported to #NotesApp; if we act on a report, the message is removed ("Message removed by #NotesApp").` : ""}

${MOMENTS_LIVE ? `**Moments:** share a picture, a video of up to 90 seconds or a line of text on your profile picture for 24, 48 or 72 hours. Followers see them in the Moments row on [Journals](/journals); you choose whether only followers, or everyone, can see yours. In teen mode a moment is seen only by people you follow who follow you back, never publicly and never by anyone signed out; only people you follow can reply to it or @mention you in theirs, and nobody can reshare it. Pictures and videos in moments carry the [NotesApp mark](/help/notesapp-mark) and your @username, added as they upload. A moment is not your profile picture: to change your picture, tap + on your own picture and choose **Update profile picture**, or go to [Edit profile](/profile/edit).

**Share to Moments:** on a journal, a course, a shop item, a service (someone's 1:1 sessions or a service on their site), a public event, a certificate, a coupon or a public community post, tap **Share** and choose **Share to Moments**. You see its card (title, cover, the price for an item or a service, and who made it), can add a caption, pick 24, 48 or 72 hours and tap **Post**. The moment links to the item and credits its creator ("Shared from @name"); the same people see it as your other moments, it counts towards your moments for the day, and in teen mode it is only for people you follow back. It isn't offered on drafts, members-only posts or anything you can't see.` : ""}`)]
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
**Free voice and video calls** in [Messages](/messages), with anyone you follow who follows you back. No minute limit, on every plan. Paid calls with a publisher are [pay-per-minute sessions](/help/pay-per-minute): the same call, with the session's meter on screen.

**Make a call:** open the conversation and tap the **phone** (voice) or **camera** (video) at the top. It rings on the other person's phone or computer wherever they are on #NotesApp, for up to 45 seconds. During a call you can mute, turn your camera off and on, and end the call. In a video call, drag your own small picture to any corner, tap it to swap it with the other person's, and tap **🔄** to switch between your front and back camera.

**Earpiece or speaker:** a voice call plays through your phone's earpiece, like a phone call, so hold the phone to your ear; a video call plays through the speaker. Headphones and Bluetooth take over when they're plugged in or connected, even in the middle of a call. To change it, tap **Sound** (the speaker button) during a call, in one-to-one and group calls:
- **iPhone:** choose **Earpiece** or **Speaker**. For AirPods, Bluetooth or a car, pick it in Control Centre (the AirPlay button on the music card); the call follows it. iPads have no earpiece, so calls use the speaker or whatever you pick in Control Centre.
- **Android (Chrome and the installed app):** choose **Earpiece**, **Speaker**, **Headphones** or **Bluetooth**. The microphone moves with it (Bluetooth uses the headset's microphone). Other Android browsers don't let a web page switch, so use your phone's own controls there.
- **Computers:** choose which speakers or headphones the call plays through and which microphone it uses. In Firefox, tap **Choose another speaker…**.

Your choice is remembered on that device for the next call of the same kind. The Sound button only shows when there's something to choose.

**Share your screen (computers):** in a video call on a computer, tap **Screen** and choose a window, tab or your whole screen. The other person sees all of it; tap **Screen** again, or **Stop sharing** in your browser, and your camera comes back. Phones can't share their screen: phone browsers (and the app installed from them) don't allow it.

**Check it's private:** once a call connects, tap **🔒 End-to-end encrypted** to see a 12-digit safety code. The other person sees a code too: read yours out to each other. If they match, the call is encrypted between your two devices and nobody in between, not even #NotesApp, can listen in or watch. If they don't match, end the call.

**Answer:** an incoming call shows a card with **Answer** and **Decline**, with a soft ringtone. If you [installed #NotesApp](/install) and allowed notifications, a call also rings when the app isn't open on your screen: the notification buzzes and sounds again every few seconds for the length of the call, with **Answer** and **Decline** buttons. If you don't answer, it becomes a missed call.

**Missed calls and Call back:** every call leaves a line in the conversation (for example "Voice call · 3:12", "Missed video call", "Declined voice call"). A missed call also sends a bell and, if you turned them on, a notification on your device. Tap **Call back** on any call line to call that person again, the same kind of call (voice or video). Call back isn't offered in group chats or to someone you've blocked.

**Who you can call:** only people you follow who also follow you, and who haven't blocked you. If you can't call someone, check that you follow each other.

**Group calls:** in a group chat, tap the **phone** (voice) or **camera** (video) at the top to call the group. Everyone in the group gets a ringing card with **Join** and **Not now** (and a notification if you turned them on), and the chat shows **Join call** while someone is in it, so you can join late. Up to **6 people** can be on a voice call and **4** on video: each phone connects straight to every other phone, so every extra person adds data for everyone, and a phone on mobile data copes best with a few. When it's full, others see "The call is full". Mute, turn your camera off and leave whenever you like; the call ends when the last person leaves, with a line in the chat such as "Group voice call · 12:03 · 4 people". Tap someone's picture during the call to compare your safety code with them. Bigger meetings are planned with [Community](/community).

**When the connection drops:** a call always tries to connect straight between your devices first. If your network changes in the middle of a call (Wi-Fi to mobile data, or a weak signal), the call shows **Reconnecting…** (in a group call, under that person's picture) and reconnects by itself: first by finding a new direct path, and only if that doesn't work, through the relay. If nothing works within about 30 seconds, the call ends and you can tap **Call back**. Your safety code stays the same after it reconnects; if it ever changes, the call shows the new one so you can compare again.

**Privacy:** calls go straight between your two devices and are end-to-end encrypted (compare the safety code to check). Only on networks that block a direct connection, or when a dropped call can only come back that way, does the call pass through Cloudflare's relay, which can't listen: the call stays end-to-end encrypted. We never record calls. We keep only a short record (who, voice or video, when, how long, answered or missed), which is deleted with your account. See [Privacy](/privacy).

**If a call won't work:**
- Allow the **microphone** (and the **camera** for video) when your browser asks. If you said no before, allow it in your browser's site settings or your phone's settings, then try again.
- "Calls are for people who follow each other": follow each other first.
- "Verify your email first": starting a call or sending a message needs a verified email. Open the link we emailed you when you joined (check spam), or tap **Resend link** in the yellow bar at the top of the page. It works straight away once you have clicked the link. Answering, declining and ending a call never need it.
- The call rings but doesn't connect, or keeps saying **Reconnecting…**: try another network (Wi-Fi or mobile data), and close other apps using the camera or microphone. Our [Status](/status) page shows whether calls and the relay are working.
- On iPhone, use Safari or the installed #NotesApp app; on Android, Chrome works best.
- Calls can't reach emergency services.

**Data:** calls go over the internet (Wi-Fi or mobile data), not the phone network. #NotesApp doesn't charge for them, but your mobile network charges its usual data rates for the data a call uses; a video call uses much more data than a voice call, so use Wi-Fi when you can.

Calls are free. Planned: paid calls inside Notes Life (₦5 a minute voice, ₦10 a minute video, from NotesApp Credit), always with the rate shown first. Booked sessions and meetings use a separate video service.`)]
      : []),
    ...(LIFE_LIVE
      ? [A("notes-life", "Notes Life: the NotesApp life game", "Publishing and earning", `
**Notes Life** is a free life game you play in your browser with your NotesApp account, at [${LIFE_HOST}](${LIFE_URL}) or [Play Notes Life](/life/play). The first playable version is set in **Wuse, Abuja**. Lagos and Port Harcourt come later.

**Slow or freezing?** Tap **HD** at the top of the game to switch to **LOW RES** (or **Settings → Low res**): fewer pixels, no shadows and at most 30 frames a second, so the game stays smooth on computers with big screens and modest graphics. It's remembered on that device; tap again for the full look.

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

**The Billionaires List:** your net worth (your N$ plus what you own) ranks you against every player. It shows your NotesApp username, picture and city (players in teen mode only to people they follow back). Brag on WhatsApp from the list. At the top is **Emerald Ezurukam** 🤖, the mind behind Notes Life: he dreamed up Notesville and its rules as a teenager, and the game brings it to life.

**The Wuse streets:** besides the first street (the Wuse bus stand, the metro and Green Wheels), tap **Go** for two more. **Wuse Market, Zone 4** is the busy one: stalls, kekes, a pharmacy, LUXNAS (the fashion brand), Chinedu's phone shop, Mama Nkechi's pepper soup, a barber, the Bureau De Change, a POS stand, a lesson centre, puff-puff and zobo, Mallam Sani's suya grill (from 6 PM) and the borehole. **Aminu Kano Crescent, Wuse II** is the premium strip: Crescent Plaza's offices, Notesville Trust Bank, **Emerald Towers**, Crescent Café, The Crescent Grill and Skyline Lounge (8 PM to midnight). Tap a shop and you walk to it; the camera follows you. Traffic runs, hawkers walk the pavement and at night the signs and street lamps light up. The rest of Notesville moves too: traffic on the first street and past Chef Adams, itel Energy, Digital Witch and the Candellux, and people walking everywhere.

**Errands:** the people who live and work in Wuse ask for help: deliver LUXNAS orders, mind Chinedu's stall, run Iya Bose's POS stand at lunch, carry loads at the market, fetch water for Mama Nkechi, help Mallam Sani at the suya grill, teach the compound kids with Aisha, count notes at the Bureau De Change, courier documents between the Crescent offices, hold Alhaji Musa's place in the bank queue, hand out flyers for The Crescent Grill, park cars at Skyline Lounge, or deliver a proposal for Emerald (needs 2★). Each errand pays when it's done (N$ 600 to N$ 6,000), once a game day, some only at certain hours; **Saturday sanitation** (7 to 10 AM) pays in reputation instead. Find them all in **Phone → Errands**.

**LUXNAS (partner):** a boutique lifestyle, business and fashion brand from Nnewi, led by CEO Chinasa Odina (@chinasa), with its shop on Wuse Market (Zone 4): custom tailoring, embroidery, Senator suits, Agbadas, Kaftans, Ankara sets, Asoebi and bridal wear, custom denim, and worldwide shipping. In the game: **deliver LUXNAS orders** (an errand), learn at **LUXNAS Academy** (Tailoring and custom fit, Embroidery, Bespoke African fashion design: pay once, then a 2-game-hour class at a time, 9 AM to 6 PM, at the shop), then **work there** (delivery rider; tailor, embroiderer and designer with the matching certificate; studio supervisor after 10 LUXNAS shifts) or **open your own LUXNAS Tailoring Studio** (after 10 LUXNAS shifts and 3★; from Business → Become a Partner). LUXNAS Academy certificates are separate from Digital Witch's. The real LUXNAS is [@luxnas on NotesApp](/s/luxnas).

**Restrooms away from home:** tap **🚻 Restroom** at any place that has one. At the **Candellux**, if you're staying in a suite, its WC and bathroom fill Bladder and Hygiene to 100%. The **outdoor shower** by the pool fills Hygiene if you swam (a day pass or a lesson) in the last 24 game hours, otherwise it adds 50. The **VIP bar restroom** fills Bladder if you used the VIP bar in the last 24 game hours, otherwise it adds 50; the pool bar restroom adds 50. **itel Energy, Chef Adams, Emerald Towers and the Digital Witch hub** let you use their restroom: Bladder +50. At **Wuse Market**, the emergency mobile units fill the need: **WC N$ 500, shower N$ 800**.

**Emerald's convoy:** at **8 AM, 1 PM and 6 PM** game time, Emerald's convoy passes the **Wuse bus stand** and stops for half an hour. He gives **N$ 100,000** to each stranger waiting there, but never to the same person again within **30 game days**. Tap the bus stand on the street, or **Wait at the bus stand** from the convoy panel, to be there when it comes.

**Buying Notesville Naira:** in the Bank, buy N$ with your NotesApp Credit wallet or a card, ₦100 to ₦100,000 at a time. **₦1 buys N$ 100.** Notesville Naira is game money: it can't be cashed out, sent to another player or turned back into credit, and buying it is final.

**Inviting friends:** the Invite panel lets you pick people from your phone's contacts (where your browser allows it) and send your link by WhatsApp or SMS, or share or copy it. When a friend joins from your link and **finishes their first shift**, you each get **₦250 NotesApp Bonus Credit** in your wallet. Your friend needs a verified email, someone can only be invited once (when they first start playing), and you can earn for up to 20 friends a month. Bonus Credit lasts 90 days and pays for boosts, ads and badges. If your friend's email isn't verified yet at their first shift, you both get it after their next shift once it is. **Your invites** at the bottom of the Invite panel lists everyone who joined from your link and where they are: *Needs a first shift*, *Needs a verified email*, *₦250 each* (paid) or *Over the monthly limit*; the bonus also shows in your [wallet](/profile/wallet) as "Invite bonus". The 🎁 **Invite** button under the clock opens the panel from anywhere. Big moments in the game (a new job, your first shift, a deal, a suite night, a purchase) offer a **Share on WhatsApp** button.

**Your progress:** money, what you own, your job and deals are kept on our servers, so they can't be lost. Your needs, where you are and your outfit are saved on your device every few seconds and to your account every 30 seconds, so you can carry on from another phone or computer. Settings → **Restore points** keeps one save for each of the last 24 hours and 7 days, in case something goes wrong. Your Notes Life data is included in your data download and deleted with your account.

**NEPA (power cuts):** a few times every game day the light goes for every player at the same moment, for 2 to 6 game hours. Without power your lamp and fan stop, you can't read at night, an old desktop can't do desk work, and you sleep hot. Your choices: an **itel Power GO Pro** (320Wh, silent: it runs your lamp, fan and laptop, recharges when light returns, and by day with the **100W solar panel**), a generator from the market (**“I Better Pass My Neighbour” 950W** or the **big 3.5kVA**, which runs the AC too; both need petrol, N$ 1,100 a litre), or the dark. The small home solar kit is coming. When light returns: *nwiiiii… UP NEPA!*

**itel Energy:** the solar shop on the Wuse market road (Go → itel Energy) sells the Power GO Pro (N$ 150,000), the solar panel (N$ 55,000) and, soon, the home kit. It's a Notes Life partner: the real Power GO Pro is sold on NotesApp by [@clickam](/u/clickam), the itel distributor.

**Digital Witch (tech skills):** the Digital Witch training hub is on the ground floor of the Skyscraper Plaza in the Central Business District (**Go → Digital Witch hub**, or Phone → **Digital Witch**). Pay for a course, then take its classes at the hub between 9 AM and 6 PM: one class is 2 game hours (Energy −10, Fun +5). Courses: Virtual Assistant and Customer Support (N$ 60,000, 4 classes), Social Media Management (N$ 80,000, 5), Project Management (N$ 100,000, 5), Data Analysis and UI/UX Design (N$ 120,000, 6). Finish every class to get **Digital Witch certified**. Tech jobs need a certificate: remote virtual assistant (N$ 9,000 a shift), remote customer support (N$ 8,500), social media manager (N$ 11,000), remote project coordinator (N$ 14,000), data analyst (N$ 16,000, needs a laptop), UI/UX designer (N$ 18,000, needs a laptop) and Tech freelancer (any certificate). If you already had a tech job, you keep it.

**Ekwutosi Cynthia Okeh:** the founder of Digital Witch is #2 on the Billionaires List. She's at the hub from 9 AM to 5 PM and at the Candellux VIP bar from 7 PM to 11 PM. On **Saturday nights** at the VIP bar she runs a **graduate giveaway**: if you hold a Digital Witch certificate and have worked 10 tech shifts, go up to her once a week for a chance at **N$ 500,000** or **N$ 1,000,000**. To learn for real, visit [digitalwitchng.com](https://digitalwitchng.com).

**Chatting with friends:** players who follow each other on NotesApp can chat inside the game. Open **Phone → Friends** and tap **💬 Chat**, or tap a friend who is at the same place as you. It's the same conversation as your NotesApp [Messages](/messages), with the usual rules (blocks, reports). Each message you send gives **+8 Social** (**+12** when you're at the same place) and each reply **+4**, up to **+40 an hour**. Unread messages from friends show as a number on the Phone button. On desktop the chat sits on the right while you keep playing.

**Residents and other players:** residents are computer players, always marked 🤖. They live around Wuse, Chef Adams, itel Energy and Candellux; tap one to chat (Greet, Food, Work, NEPA, Money) for Social, and some are on the Billionaires List (switch to *Real players only* to hide them). Chats with residents stay on your device only. Real players who are at the same place as you right now (Chef Adams, Candellux, itel Energy, the street, a ride) appear with 👤 and their name; tap one to open a real NotesApp chat. Turn off *Show me to other players* in Settings to stay hidden. In teen mode you are always hidden from other players, and they from you.

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

**Who gets told:** when you @mention someone in a comment or reply, a published journal, a moment, a store review or a seller's reply, or a recommendation (once the person it's about approves it), they get a notification in their bell with a few words around the mention and a link to it. Each person is told once for each thing, so editing a comment or a journal only tells people you newly mention. Nobody is told about mentioning themselves, and if either of you has blocked the other, no notification goes. Someone in teen mode is told only when they follow you, and in a moment you can't @mention them unless they follow you (you'll be asked to take the mention out). Mentions in messages, group chats and Notes Life chat never notify anyone: those are conversations, and a mention there doesn't pull anyone in. Up to 10 people are told per comment, journal or moment.
`),
    A("interests-and-topics", "Choosing your interests and topics", "Getting started", `
**Your interests:** go to [Choose your interests](/interests) and pick the topics you want to read about (up to 12, at least 3 makes a good feed). Journals on them come first in your feed, under **For you**, and in your weekly digest. Change them any time.

**Topics on a journal:** when you write, pick up to 3 topics from the list (search it, or tap a hashtag). Readers who chose those topics see your journal first. You can add your own hashtags too, such as #SideHustle; they're tidied as you type and show at the end of the journal.

**Nana's suggestions:** once you've typed a title, Nana suggests topics and subtopics for it, such as #Tech › #ITSupport. **Swipe a suggestion right** (or tap it) to add it, and **swipe it left** (or tap its ✕) to remove it from the list; **Undo** shows for a few seconds after you remove one. On a computer, drag with the mouse or use the ✕; with a keyboard, **Enter** adds and **Delete** removes. Removed suggestions stay away for that title, even after a reload, until you tap **Refresh**. **Add all** adds the rest; nothing is added until you choose. Ones marked NEW don't exist yet and are created when you save. A journal can have up to 3 subtopics, which show as hashtags with the others. Courses get the same suggestions from their title and summary, and Market items get a suggested category and subcategory (Shoes & bags › Tote bags), swiped the same way. On a course, under **What learners will learn**, tap **Nana: suggest lines from the title and summary** for lines you can swipe into it and into **Requirements**. Suggestions are free and don't use your Nana allowance.

**Browsing:** the **Topics** tab on [Journals](/journals) groups every topic that has journals, with yours first. Tap a hashtag at the end of a journal to see more on that topic.
`),
    A("discovery", "Journals, Notes Market, Notes Academy and Trending", "Getting started", `
**Getting around:** on a phone, the bar along the bottom takes you to **Feed**, **Explore**, **Market**, **Academy**, **Messages** and your **Profile**; tap your picture at the top for the menu (your account, the rest of the site, Sign out). On a computer, the journal feed has the same places in a menu on the left.

**The journal feed:** [Journals](/journals) has four tabs: **For you** (journals on [your interests](/interests) first, then everything newest first), **Following** (people you follow), **Latest** and **Top · 7d** (what people read most this week). Like, comment, share or save a journal from the feed; saved journals are in [Saved](/saved). **Most read this week** and **Who to follow** appear between posts on a phone and on the right on a computer. Journals marked **Promoted** are boosted.

**Explore:** [Explore](/explore) is where to browse topics, people, channels and communities, with an **Events** tab (every public event that hasn't happened yet, soonest first, searchable by title, city or host) and **Market** and **Academy** tabs for the week's most looked-at products and courses.

**The order elsewhere:** [Notes Market](/shop) and [Notes Academy](/academy) show things in the same order: **For you** first, then **Most viewed** (the last 7 days), then **Recent**.

**Notes Market** collects every #NotesApp store: items for you, the most viewed, new arrivals, digital downloads, categories and a list of stores. Each item shows its seller and their badges. Buying works as it does in the seller's own store.

**Notes Academy** has courses: free courses from any publisher, with lessons from the teacher's own YouTube that play right on #NotesApp, and paid courses on Pro, Business and Enterprise. Courses can have quizzes, marked straight away.

**Profiles** have **Notes**, **Store** and **Courses** tabs, and these buttons: **Follow** (it reads **✓ Following** once you follow; tap it to unfollow), **Book a session** (when the publisher takes bookings), **Conversation** (a direct message) and **Gift me**. If Gift me is greyed out, the publisher hasn't set up payouts yet: tap or hover the ℹ️ beside it.

**Trending** has the same tabs: Notes, Store and Courses, plus **Events**, Communities and Publishers. Events are ranked by interest in the period (today, 7 or 30 days): a ticket sold counts most, then a Going or Interested, then a visit to the event's page. Only public events that haven't happened yet are listed: never members-only events, cancelled ones, or events of a community joined only by invite.

**Badges** always come right after a person's name, before their @username, wherever their picture and name appear.
`),
    A("academy", "Teaching and learning on Notes Academy", "Getting started", `
[Notes Academy](/academy) is where #NotesApp members and organisations teach and take courses, free and paid. Lessons play right on #NotesApp, and your progress is saved as you go.

**Taking a course**
- Open Notes Academy from the menu, or go to [/academy](/academy). Courses on [your interests](/interests) come first, then the most viewed this week and the newest. Tap a topic to narrow the list (on a computer, the Topics list shows how many courses each topic and subtopic has), filter by level or by free and paid, or search by course or teacher.
- A course's page shows its level, format and language, who teaches it, and four tabs: **Overview** (what you'll learn, about the course, how it works, requirements), **Curriculum** (every lesson with its length, grouped in modules), **Tutors** and **Reviews**. Beside them: the price, what the course includes, **Share** (WhatsApp, LinkedIn, X, Facebook or a link) and the course details. On a free course the first lesson is a free preview.
- **A free course:** tap **Enrol — free**. If you're not signed in, sign in (or join free) and you come straight back, already enrolled.
- **A paid course:** watch its free previews first, then tap **Buy the course** and pay by card, bank transfer or from your wallet. Have a code from the teacher? Choose **Have a discount code?** before you pay ([Discount codes and coupons](/help/discount-codes)). It's yours for good and plays on up to 2 of your devices; to watch on a new one, remove an old one when it asks. Uploaded videos never download, and your @username and email drift faintly across them. The certificate is usually included in the price.
- **Refunds:** you can get a refund within 7 days of buying a paid course, as long as you haven't started it (opening a paid lesson counts as starting). Tap **get a refund** on the course's page; the money goes back the way you paid.
- **Live classes and the course group:** many courses have a **course group** on #NotesApp, a members-only Space in the teacher's [community](/help/community-spaces), where learners ask questions and help each other; some also run live classes, in a community [audio room](/help/community-audio-rooms) or through a meeting link, with recordings. Once you've enrolled or bought, **Join the course group** (it joins you in one tap and opens the Space) and **Join the live class** appear on the course's page. A few older courses still have a WhatsApp or Telegram group instead, shown the same way.
- Video lessons play in YouTube's privacy-enhanced player, so you stay on #NotesApp. Under a YouTube video you'll see who made it, with a link to their channel, and the tutor's lesson notes when there are some. A video is ticked off by itself once you've watched most of it; you can always tap **Mark as done** yourself, or **Mark as not done** to undo it. Text lessons end with a **Mark as done** button. A quiz is ticked off when you pass it (see Quizzes below).
- Your progress and the **Continue** button are on the course page, and courses you've started are under **Continue learning** on Notes Academy.
- **Certificates:** once every lesson is done, tap **Get your certificate** on the course page. Check the name (it can't be changed once issued), then pay from ${certificateMin()} plus the teacher's margin, by card or from your wallet. It's issued straight away with an ID (NA-C-…) and a QR code; anyone can check it at [/certificates](/certificates). Add it to LinkedIn, share it, save it as a PDF or download it as a picture (PNG) from its page. To show the picture on LinkedIn, choose **Add media → Add a link** on the certificate there and paste the image link (**Copy image link** on the certificate's page). Shared links show the certificate itself. Claim within ${CERTIFICATE_LATE_TEXT().grace} days of finishing: after that a late claim fee of ${CERTIFICATE_LATE_TEXT().weekly} of the price is added each week, up to ${CERTIFICATE_LATE_TEXT().cap} more.
- **Like, save and review:** tap ♥ on a course to like it and the bookmark to save it (it's kept under **Saved → Courses**; you can also save from the bookmark on any course card). Once you've done half the lessons, rate the course from 1 to 5 stars and say what you learned, in **What learners say** on its page. One review each, and you can edit it; the teacher can reply once. A course shows its stars once it has 2 reviews.
- **Recommendations:** on someone's profile, tap **Recommend**, choose how you know them, give 1 to 5 stars and write a few sentences. It appears only after they approve it: on their profile, beside their journals and on their site's About page.

**Teaching a course**
- Any publishing account can teach a free course, including the free Basic plan. If you don't publish yet, start at [Rates & payouts](/profile/publishing). On an organisation's team (Business or Enterprise), choose **Teach as** your organisation when you start a course: it's published under the organisation's name, with **Taught by** and your name under it on the course page, and its admins can edit it too.
- Go to [Teach a course](/academy/teach) and tap **New course**. A working title is all you need to start.
- **1. Describe it:** a clear title, a short summary of what learners will be able to do, up to 3 topics and a wide cover picture. The course's address follows the title until you first publish.
- **Make a cover with Nana:** no picture? Under the cover, tap **✨ Make a cover with Nana**, say what it should show if you like ("a farmer with a phone, green and gold"), and Nana designs one from your course: our own African patterns (adire, kente-like stripes, mud cloth), an icon, your title in bold type and a small Notes Academy mark. Tap **Use as cover**, **Edit** it ("make it green", "add a laptop", "shorter headline") or **Try another**; your last few covers stay there to go back to. It works on free and paid courses, for the lead, co-tutors and admins. Each new cover or edit counts one of the day's covers: Free Basic ${coversPerDay("basicDaily")}, Pro ${coversPerDay("proDaily")}, Business ${coversPerDay("businessDaily")}, Enterprise ${coversPerDay("enterpriseDaily")} a day, starting again at midnight Lagos time (so on Free Basic, one cover and two edits, or three different ones). Nana's design comes from your Nana allowance, then your Nana credit; when both are used up, covers stop until the allowance refreshes, and the editor says when.
- **About the course:** the level, language and format (self-paced, or live classes with recordings), what learners will learn and the requirements (one per line), how long it runs and when classes are, and, for live classes, an optional meeting link. Hold live classes in an [audio room](/help/community-audio-rooms) in your course group, for up to ${n(1 + ROOM_SPEAKERS_MAX + room.listeners)} people (you, ${ROOM_SPEAKERS_MAX} speakers and ${roomListeners} listening); for video, or a bigger class, paste a meeting link. Only learners who enrolled or bought see it.
- **Course group:** a place on #NotesApp for your learners, instead of a WhatsApp or Telegram group. Under About the course, link one of your communities and a Space in it, tap **Add a members-only Space for this course** to one you run, or tap **Start a community for this course**: it's joined only by invite link, and your learners get the link with a **Join the course group** button. No community yet? Start one on [Community](/community); see [Spaces](/help/community-spaces) and [Circles](/help/community-circles). If your community is open to anyone, its members-only Spaces are open to all its members, not only your learners. A WhatsApp or Telegram link saved on an older course keeps showing to its learners until you link a course group (which replaces it) or remove it; new outside group links can't be added.
- **Price:** free, or paid on ${onPlans("paidCourses")} (text lessons, PDFs and YouTube), with your own uploaded videos too on ${onPlans("courseVideoUploads")}. You get the price less the same fee as your digital items, paid to your bank 7 days after each sale; add your bank account in Rates & payouts before you publish. Tick **Certificate included** to include it in the price.
- **Tutors:** teach alone, or invite up to ${MAX_CO_TUTORS} co-tutors by @username with what they can do (**Can view**, or **Can view and edit** the course's content and lessons) and their share of each sale. Each one reads the terms and agrees before they're listed, and is paid their share at their own plan's fee. The price, the shares, the tutors and publishing stay with the lead. See [Co-teaching a course](/help/co-teaching).
- **Add lessons:** paste a link to a video on your own YouTube and check the picture to make sure it's the right one (keep videos public or unlisted, not private, or they won't play), or write a text lesson in the journal editor. On a paid course you can also upload videos (${onPlans("courseVideoUploads")}, up to 200 MB each) and PDFs (up to 50 MB), and tick **Free preview** on the lessons anyone may open before buying. Group lessons in **modules** if you like. Add the minutes; they add up to the course's length. Use ↑ and ↓ to put lessons in order.
- **Notes and credit on YouTube lessons:** a YouTube lesson can have **lesson notes** under the video, written like a text lesson: a summary, steps or an exercise. When you save it, we fill in the video's title and creator from YouTube and show "Video: <title> by <creator>, on YouTube. Shared here with credit to the original creator." under the player, linking to their channel. If you use someone else's public video, introduce it in your notes in your own words ("In this video, … shows…").
- **Publish:** a course needs a title, a summary and at least one lesson. Use **Preview** first if you like; only its tutors can see a draft.
- You can keep editing after publishing. To remove the last lesson of a published course, unpublish it first. Deleting a course removes its lessons and its learners' progress; a course people have bought can't be deleted (unpublish it instead, and they keep it).
- **Your academy (certificates):** set it up once at [Your academy](/academy/teach/setup): the name and logo on your certificates, who signs them (a photo of the signature on white paper; we remove the white), an accrediting institution if you have one (its logo shows once #NotesApp has checked it) and your margin on top of our ${certificateMin()}. You receive the margin less our usual commission, and your share grows with any late claim fee. Courses our team has reviewed get the "#NotesApp Certified Course" seal.
- **Add a quiz** to check what learners have learnt (see Quizzes below).
- Up to ${span("coursesPerMember")} courses${byPlan("coursesPerMember") ? " depending on your plan" : ""} (${span("coursesPerOrganisation")} for an organisation; each plan's number is on the [pricing page](/pricing)), each with up to ${n(MAX_LESSONS)} lessons. Your published courses show on your profile's Courses tab, on Trending, on your own site and in the weekly digest when they're popular.

**Quizzes**
- **For tutors:** tap **+ Add a quiz** under Curriculum, on any course, free or paid, on every plan that can teach. Write each question, give 2 to 6 answers, tick the right one and, if you like, add a short explanation. Set the pass mark (70% unless you change it). A quiz can have up to 50 questions. Learners never see the answers before they submit; edit the quiz any time and your answers load with it.
- **For learners:** choose one answer for each question and tap **Submit answers**. Your quiz is marked straight away: you see your score, whether you passed, which questions you got right, the right answer for each and the tutor's explanation. Didn't pass? Tap **Try again**, as often as you like. A quiz lesson is ticked off only when you pass it (there's no **Mark as done** for quizzes), and once every lesson is done you can get your certificate.

**Coming next:** Enterprise courses for organisations with cohorts and bulk invites (see [Pricing](/pricing)). Questions learners often ask are in [Notes Academy: questions](/help/notes-academy-faq).
`),
    A("nana-tutor", "The Nana tutor: a tutor for every course", "Getting started", `
**For learners:** when a teacher switches it on, every lesson of their course has **Ask your Nana tutor** underneath. Ask anything about the course, or tap **Explain this lesson** (in simple words, with an everyday example), **Quiz me** (one practice question at a time, with a short explanation after each answer) or **Summarise**. Choose **English**, **Pidgin** or **Kiswahili**, and the tutor answers in it whatever you type in; ${TUTOR_LANGUAGES_SOON.join(", ")} are coming. Answers are short and text only, so it works on a basic phone with little data.

The tutor answers **only from this course's lessons** and the teacher's notes, never from the internet or general knowledge; if the course doesn't cover your question, it tells you and suggests asking the teacher. It never gives the answers to the course's graded quizzes. You need to be enrolled (a paid course: bought). Each question uses your [Nana](/nana) allowance like any question to Nana, and your conversation isn't saved.

**For teachers:** open your course in [Teach](/academy/teach) and find **Nana tutor**. Switch it on, and if you like tell it what to keep in mind (who your learners are, words to use, what to stress). The tutor reads your reading lessons and your notes under videos; it can't see inside uploaded videos or PDFs, so add notes for those. You and your co-tutors can try it on any lesson before switching it on.`),
    A("notes-academy-faq", "Notes Academy: questions learners ask", "Getting started", `
${academyFaq().map((f) => `**${f.q}** ${f.a}`).join("\n\n")}`),
    A("getting-around", "Getting around: the tab bar and the menu", "Getting started", `
**On a phone:** one light header sits at the top, with search, your notifications (the bell) and your picture. Tap your picture for the menu: your profile, store, bookings, Wallet, Saved, your interests, your settings, the rest of the site and Sign out. Along the bottom is a tab bar:
- **Feed**: the [journal feed](/journals).
- **Explore**: topics, people and channels, and the Market and Academy tabs ([Explore](/explore)).
- **Market**: [Notes Market](/shop), every #NotesApp store in one place.
- **Academy**: [Notes Academy](/academy), free and paid courses.
- **Messages**: your conversations and calls ([Messages](/messages)).
- **Profile**: your own profile, with its Notes, ${MEDIA_LIVE ? "Media, " : ""}Store and Courses tabs.

**On a computer:** the journal feed has the same places in a menu on the left, and Most read and Who to follow on the right. On the other pages, the top bar links to Journals, Market, Academy, Trending, Pricing and About; Contact is in the footer and on the About page.

A conversation or a call fills the whole screen on a phone; go back with the arrow at the top left.`),
    A("profile-pictures-and-links", "Your profile picture, past pictures and social links", "Getting started", `
**Changing your picture:** tap the **+** on your picture (on your profile, or on "You" at the top of the journal feed) and choose **Update profile picture**, or use [Edit profile](/profile/edit).

**Past pictures:** tap anyone's profile picture to see their pictures, newest first. Swipe left or right on a phone, or use **‹ ›** (or the arrow keys) on a computer; each shows the date it became their picture. Your pictures are kept from your next change on (the picture you're replacing is kept too), and the one you use now is recorded on our side as well. They also show as an album on your [Media](/help/media). To take an old one out of your history, open your pictures and tap **Remove from history**; the one you're using now can't be removed until you change it. If someone also has a moment up, tapping their picture asks which you'd like to see.

**Social links:** on [Edit profile](/profile/edit), paste the address or just your @handle (X, Instagram, TikTok), linkedin.com/in/yourname, or for WhatsApp your phone number (0803… is fine). They show as icons under your name on your profile and your own site. If a link can't be read, Edit profile tells you which one.
`),
    ...(MOMENTS_LIVE ? [A("post-a-moment", "Posting a moment (status or story)", "Getting started", `
A moment is what other apps call a status or a story: a picture, a video or a line of text that shows on your profile picture and disappears after 24, 48 or 72 hours.

**To post one:** open [Journals](/journals). At the start of the Moments row, tap the **+** on your own picture (or the **+** on your picture on your profile) and choose **Add a moment**. In **New moment**, pick **Text**, **Picture** or **Video**, add a caption (you can @mention people) and, if you like, a voice-over, choose **Disappears after** 24, 48 or 72 hours, and tap **Share moment**. A video can be up to 90 seconds; a longer one is split into parts, as far as your weekly allowance goes. Pictures and videos carry the [NotesApp mark](/help/notesapp-mark) and your @username: a picture is marked as it's posted and only the marked copy kept; a video is played by Cloudflare Stream, which adds the mark as the video arrives (it may take a minute before it plays).

**A moment does not change your profile picture.** If you were trying to change your picture, tap the same **+** and choose **Update profile picture** instead, or use [Edit profile](/profile/edit) (see [Changing your profile picture](/help/profile-pictures-and-links)).

**Seeing moments:** tap **View my moments** on the same menu to see yours and who viewed them. Other people's moments are in the Moments row on [Journals](/journals), or tap their picture. Who can see yours, teen mode and sharing a journal or item to Moments are explained in [Messages, group chats and moments](/help/messages-moments-groups).
`)] : []),
    A("verify-your-email", "Verify your email: resend the verification link", "Getting started", `
When you sign up we send a link to your email address. Until you open it, a yellow bar at the top of #NotesApp says **Verify your email to send messages, make calls and pay on #NotesApp**.

**Didn't get it, or the link expired?** Tap **Resend link** on that bar. A new link is sent to the address on your account (the bar tells you which). You can ask again after 60 seconds; if you ask too often you'll be asked to wait a few minutes. Check your spam or promotions folder, and search for an email from #NotesApp.

**After you open the link,** come back and tap **I've verified**. The bar goes away and messages, calls and payments open up. If it says "Not verified yet", open the newest link in your email first (older links stop working once a new one is sent).

**Wrong email address?** Change it on [Account](/profile/account), then resend the link to the new address. Still stuck? [Contact support](/help/contact-and-support).

Verifying your email is not the same as a verification badge (the ✔ next to a name): see [Verified badge](/help/verified-badge) for that.
`),
    A("nana-suggestions-on-forms", "Nana's suggestions on forms: add, remove or hide them", "Getting started", `
When you type a title, Nana suggests things to go with it in a **Nana suggests** box: topics for a journal or course, a category for a shop item (for example **Fashion › Maxi dresses** when you tap **Add item** in your store), and lines for a course. Nothing is added unless you choose it.

- **Use a suggestion:** tap it, or swipe it right.
- **Remove one you don't want:** swipe it left, or tap its **✕** (on a computer, select it and press Delete or Backspace). **Undo** brings it back. Removed suggestions stay removed for that title on that device.
- **Hide the whole box:** tap **Not now**. It stays hidden while the title is the same.
- **Ask again:** the refresh button in the box brings back everything you removed and asks Nana again.

Suggestions marked **NEW** don't exist yet; they're created when you save. You can always ignore the box and choose from the full list below it.
`),
    A("sell-in-your-currency", "Selling in your own currency: shop items, downloads, courses and sessions", "Selling", `
Sellers outside Nigeria can price what they sell in **their own currency** (shillings, cedis, rand, CFA francs, dollars, pounds and more), and buyers anywhere pay in **theirs**.

**Choosing your currency:** on **Rates & payouts → Readers in other currencies**, choose the currency you earn in (the one for your country is suggested). From then on, the price fields for new shop items and downloads, your courses and your session price are in that currency. Things you priced before keep the currency they were priced in.

**How buyers pay:** a buyer sees your price in your currency, and under it about what they'll pay in theirs (their country's currency is picked for them; they can change it at the bottom of any page). In Nigeria they pay in naira through Paystack; elsewhere in Africa through Flutterwave (card or mobile money where it's offered); everywhere else by card through Stripe. When the currencies differ, the price is converted at our rate with a small margin for the conversion, and the exact amount shows before they pay.

**What you earn:** your share is worked out from **your own price**, in your currency, so the exchange rate never changes what you earn. It's held for at least 7 days (longer when the sale's usual hold is longer, like a session until it's taken place), then paid to the payout details you added for that currency.

**Delivery:** our delivery partners work in Nigeria. If you sell physical items in another currency, you deliver them yourself and set your own delivery fee. Buyers give an address anywhere: a phone number with its country code, and their region and country.

**For now:** discount codes and affiliate shares work on naira prices only. A basket holds items priced in one currency. Refunds of a payment made in another currency go back the way it was paid; part refunds and single items from a basket are refunded by our team.

See [Subscribing and earning in other currencies](/help/global-subscriptions) for subscriptions, and [Your currency](/help/currency-and-exchange-rates) for how your currency is picked.
`),
    A("currency-and-exchange-rates", "Your currency: local currency, naira, dollars and exchange rates", "Plans and pricing", `
Almost everything on #NotesApp is priced and paid in **naira (₦)**: plans, badges, shop items, sessions, tickets, gifts, the wallet and payouts to your bank. The exception is **subscriptions to creators**: readers can pay in their own currency (dollars, pounds, euros, shillings, cedis and more), and creators can earn in theirs. See [Subscribing and earning in other currencies](/help/global-subscriptions).

**Your country and currency are picked for you:** #NotesApp detects the country you're in from your connection (or, failing that, your device's time zone) and picks its currency: naira in Nigeria, cedis in Ghana, shillings in Kenya, rand in South Africa, CFA francs in Senegal and Côte d'Ivoire, pounds in the UK, and so on; anywhere else gets US dollars. You'll see it at the bottom of every page, next to your country's flag. To change it, choose another currency there; choose **Automatic** to go back to the detected one. Your choice is kept on that device, and the Subscribe window opens in it. You always see the price in that currency before you pay.

**Getting paid in your local currency:** creators choose the currency their subscriptions pay them in (Rates & payouts → Readers in other currencies). If you haven't chosen yet, the one for your country is suggested. Bookings, gifts, shop items, courses and the wallet still pay out in naira to a Nigerian bank account for now.

**Exchange rates:** a subscription paid in another currency uses our own rate, shown as the price before you pay. Otherwise #NotesApp doesn't publish a dollar-to-naira (or any other) exchange rate, and Nana can't give a live rate. Rates change through the day, so check your bank, your card provider or a trusted rates site.

**Paying with a foreign card:** your bank converts the naira amount to your card's currency at its own rate and may add a fee; your statement shows what you were charged. Refunds are made in naira, so the amount back on a foreign card can differ slightly because of the rate.

See [Plans and prices](/help/plans-and-prices) for what each plan costs.
`),
    A("notesapp-ventures", "NotesApp Ventures: Rewrite the Playbook", "Publishing and earning", `
**Rewrite the Playbook** is the open call of **NotesApp Ventures**. Got a feature, product or business you're sure the crowd would jump into? Pitch it at [Ventures](/ventures). If it's picked, #NotesApp builds it with you: our engineers, our platform, our audience and guidance, in exchange for equity and a board seat, on terms that fit your project.

**Who it's for:** anyone aged 18 or over with a NotesApp account and a verified email, from anywhere, with an idea or venture **for emerging markets** (Africa, the Middle East and North Africa, South and Southeast Asia, Latin America, the Caribbean, Central Asia, Eastern Europe and the Pacific islands). Only ideas for emerging markets are welcome. You can pitch alone or as a team, from an idea on a napkin to a business already making money.

**How to pitch:** sign in, open [Ventures](/ventures) and fill in the pitch: what it is (a feature, a product or a business), its name and one-line pitch, the market and countries it's for, the area, how far along it is, the problem, your idea, why you, any traction, your team size and links. Tick that it's for emerging markets and that you accept the terms. Up to 3 pitches a quarter; you can withdraw one while it's being reviewed.

**Rolling, a set number picked each quarter:** you can pitch any time. The team reads pitches as they come in and picks a set number each quarter (the [Ventures page](/ventures) shows how many) to build with their founders; that's what the team can take on properly today. If yours isn't picked, it's nothing personal: many pitches come in for a few places. Read the team's advice, shown with your pitch on the Ventures page, sharpen it, and pitch again next quarter.

**Kept confidential:** only the Ventures review team reads your pitch, and #NotesApp never shares it outside the company without your permission, picked or not. #NotesApp builds many products, so it may already be working on something similar, or build it later on its own; pitching doesn't stop that or give either side rights over the other's work. If your idea is picked, the terms (what each side brings, the equity, the board seat, who owns what) are agreed with you before any work starts, and nothing is binding until both sides sign.

**What happens next:** a person reads every pitch. You're told in your notifications when it's received, being read, shortlisted (we'd like to talk), and picked or not picked this quarter. Any advice from the team shows with your pitch. Your pitches and where they stand are listed on the Ventures page.

**Perks:** everyone who pitches gets perks from #NotesApp, sent by the team once the pitch is read. The Ventures page lists them.
`),
    // The NotesApp Partner Network (lib/partner-network.ts). The tier shares are an admin setting (Admin → Limits → Partner Network), so
    // they're quoted from live.partners, never as literal figures.
    A("notesapp-partner-network", "The NotesApp Partner Network: tracks, tiers and how to apply", "Publishing and earning", `
The **NotesApp Partner Network** is for organisations, and people who commit to more than sharing a link, who bring #NotesApp to the people they serve. Apply at [Partners](/partners). It's free.

**How it differs from referrals and affiliates:** any member can share their [referral link](/help/referrals) or promote a product as an [affiliate](/affiliates). Partners go further: they set up and run NotesApp for members, verify their members, build integrations, bundle #NotesApp, run chapters or bring a catalogue. In return they get a listing in the [partner directory](/partners/directory), a badge, a partner portal and a bigger share as their tier rises.

**The seven tracks:**
${TRACKS.map((k) => `- **${TRACK[k].label}:** ${TRACK[k].who}`).join("\n")}

**The three tiers** (share of the plan payments of members a partner brings, for the months shown from each member's first payment):
${PARTNER_TIERS.map((k) => `- **${PARTNER_TIER_LABEL[k]}:** ${pterms[k].percent}% for ${pterms[k].months} months. ${PARTNER_TIER_NEED[k]}`).join("\n")}

**How to apply:** sign in with a verified email (18 or over), open [Partners](/partners#apply), choose a track, and tell us your organisation's name, website, where you work, how many people you reach, about you and your plan for your first 90 days. Tick that you accept the partner terms. You can have up to three applications being reviewed, one per track.

**What happens next:** a person on the partnerships team reviews every application and may contact you. You're told in your notifications when it's being reviewed, approved or not approved; any feedback shows with your application on the [Partners page](/partners#mine). Approved partners get a page, a directory listing and a [partner portal](/partners/portal).

**The terms, briefly:** apply only for an organisation you may represent; either side can end a partnership; earnings follow the referral rules (the hold, cash or NotesApp Credit, and refunds take an earning back); members' privacy comes first; represent #NotesApp honestly. The full terms are on the [Partners page](/partners#terms).
`),
    A("partner-portal", "Your partner portal: link, earnings, listing and moving up a tier", "Publishing and earning", `
Once you're approved, open your **[partner portal](/partners/portal)**. For each partner you run it shows:

**Your share:** your tier's share of members' plan payments and for how many months (${PARTNER_TIERS.map((k) => `${PARTNER_TIER_LABEL[k]} ${pterms[k].percent}% for ${pterms[k].months} months`).join(", ")}), how many members you've brought and how many of them pay.

**Your link and code:** your code is your NotesApp username, so your link is your usual referral link, /r/your-username. A member who joins through it, or types your username as the code at checkout, is yours. While your partnership is active, your tier's share applies instead of the ordinary referral share. Your earnings, and taking them out as cash or NotesApp Credit, are on [your Referrals page](/profile/referrals), with the same hold as referral earnings.

**Your listing:** edit what the directory and your page say about you, where you work, your website and (solutions partners) the services you offer.

**Moving up:** to become **Certified**, tick off the partner training in your portal (${TRAINING.map((x) => x.charAt(0).toLowerCase() + x.slice(1)).join("; ")}) and bring ${CERTIFY_PAYING} paying members (associations and chapters: or ${CERTIFY_MEMBERS} verified members). Then press **Ask to be Certified**; the partnerships team reviews it and tells you. **Premier** is by invitation.

**If your partnership is paused:** you leave the directory, badges are hidden and new plan payments earn the ordinary referral share until it's active again. Earnings already made stay yours unless the payment is refunded.

**By track:** solutions partners see requests from members; associations verify members; chapters see who joined; workplaces get their code, a staff count and their recommended practitioners. Each has its own help article: [Find an expert](/help/find-an-expert), [association verification](/help/association-verified-members), [workplace wellbeing](/help/workplace-wellbeing) and [chapters](/help/partner-chapters).
`),
    A("find-an-expert", "Find an expert: get help setting up your NotesApp", "Getting started", `
Want someone to set up your NotesApp for you: your site, booking calendar, payments, shop, courses or custom domain? Open the **[partner directory](/partners/directory)** and choose **Find an expert**. Every expert listed is a solutions partner reviewed by the #NotesApp partnerships team. Filter by service, or search by name or place. **Certified** and **Premier** partners have done the partner training and delivered for members.

**Asking for help:** open an expert's page, choose what you need and a budget, describe it, and press **Send request**. The expert gets it in their partner portal and replies in your NotesApp **messages**, usually within two working days. You can send up to ${LEADS_PER_DAY} requests a day, one open request per expert.

**Prices:** each expert sets their own fees, and you agree them directly with them. #NotesApp isn't part of that agreement, so agree what's included before you pay, and never share your password: an expert can do their work as a member of your team (see [Teams and roles](/teams)). If something goes wrong, [contact us](/contact) and tell us which partner it was.

**Run an agency or freelance?** [Become a solutions partner](/partners#apply).
`),
    A("association-verified-members", "Associations: verified member badges", "Teams and organisations", `
Professional associations, councils, guilds and alumni networks can join the [Partner Network](/partners) and verify who their members are on #NotesApp.

**For members:** open your association's page from the [partner directory](/partners/directory), choose **I'm a member** and enter your membership number. Your association checks its register and confirms you. Then a **"Verified member of …"** badge naming your association appears on your profile, and links to its page. You're told in your notifications either way. You can leave at any time from the association's page, which removes the badge.

**For associations:** requests appear in your [partner portal](/partners/portal) under **Members to verify**, with each person's name, username and the membership number they gave. Check it against your register, then **Verify** or **Decline**. **Remove** anyone who leaves: their badge goes at once. Your page lists your verified members. You see only that someone asked to be verified, never what they book, buy or write.

**Group terms:** associations agree any terms for their members (prices, events, training) with the partnerships team. Members who join through your code earn you your tier's share of their plan payments (see [your partner portal](/help/partner-portal)).
`),
    A("workplace-wellbeing", "Workplace wellbeing: coaching and therapy for your staff", "Teams and organisations", `
Employers, HR teams and benefits providers can join the [Partner Network](/partners) as a **workplace partner**, so their staff reach coaches, therapists, mentors and courses on #NotesApp.

**For staff:** your employer gives you a **workplace code**. Open their page on #NotesApp, choose **I work here** and enter the code. You'll see the practitioners your workplace recommends. **Your privacy:** your employer only ever sees *how many* staff have joined, never who, and never what anyone booked, bought or wrote. No badge shows on your profile. You can leave from the same page.

**For workplaces:** your code and staff count are in your [partner portal](/partners/portal). Make a new code at any time (the old one stops working; staff who joined stay). List up to 30 practitioners by username to recommend to your staff; they show on your page. Budgets and invoicing for sessions are agreed with the partnerships team.
`),
    A("partner-chapters", "Campus and community chapters", "Getting started", `
A **NotesApp chapter** is a campus club, student society, creator community or community group run by a chapter lead who's an approved partner. Find chapters in the [partner directory](/partners/directory).

**Joining:** open the chapter's page and choose **Join this chapter** (you can say your course, year or role if you like). You join at once, and a **"Member of …"** badge shows on your profile. Leave at any time from the chapter's page. The lead can remove members.

**Running a chapter:** apply as a [chapter lead](/partners#apply). You'll run at least one chapter event a quarter, welcome new members and keep the chapter friendly and safe. Your [partner portal](/partners/portal) lists your members, and members who join #NotesApp through your link earn you your tier's share of their plan payments. Active chapters get event support and merch, and a path to the [Campus Ambassador](/careers) role at #NotesApp.
`),
    A("notesapp-sounds", "NotesApp Sounds: songs for your posts, moments and lives, and royalties for artists", "Publishing and earning", `
**NotesApp Sounds** are songs made for #NotesApp that anyone can use for free here. The first ones are by Emmanuel Adams (@emmanuel), the founder: Leave Am, Nobody Clapped Until I Won, Never Giving Up, Life No Balance, Are You That Girl, You're All I'll Ever Need, My Spec, Onye Ose Photo (two versions) and Highlife Beats 1 and 2. Verified artists add more. See them all at [NotesApp Sounds](/sounds).

**Using a song:**
- **Media posts and moments:** under **Sound**, keep your original sound or pick a song (search the list, and tap ▶ Listen for 15 seconds of it). It plays from its best part while people watch, softly under a video's own sound or a voice-over.
- **Lives:** the host taps **🎵 Music** and plays a song through their mic, with its own volume. Everyone in the live hears it and sees **Now playing**; muting your mic mutes only your voice. A recorded live records it too.
- **Notes Life:** the songs play softly at the hotel (the lobby, your suite and the VIP bar), and the residents talk about them: ask anyone about 🎵 Music in a chat.

**A song's page:** tap the song's name or cover on a post, a moment or in a live to open its page (/sounds/song-name). It shows the cover with a player, the artist and their @username, how often it has been played and where, **Use this sound** (opens your Media studio with the song picked), the moments made with it (signed in) and the Media posts made with it. Tap a post to open it full screen to react, gift the creator or report it. You only see posts and moments their owners let you see.

**Reactions on Media posts:** ❤️ 🔥 😂 😮 👏 🙏, one per person; tap the same one again to take it back.

**Are you an artist?** Open [Your sounds](/profile/sounds) and apply: your artist name, links to your music (Audiomack, Boomplay, Spotify, Apple Music, YouTube…) and a tick to confirm you own the rights. The team checks it. Once verified, add songs there: an MP3 up to 15 MB and 15 minutes, a cover picture, and where the best part starts. Each song is checked by the team before anyone can use it. You can take your own song down at any time.

**What artists see:** [Your sounds](/profile/sounds) shows each song's plays this month, last month and in all; where they were played (Media posts, Moments, Lives, Notes Life); the last 30 days; and how many posts and moments use it. A summary also shows in [Analytics](/profile/analytics). A play is a member's first view of a post or a moment with the song, everyone listening when a host starts it in a live, and a Notes Life player hearing it at the hotel (once a day per song).

**Royalties in ad share:** each month a share of the ad revenue #NotesApp receives (the Sounds pool, a share the team sets; your Sounds page shows it) is split between artists by how many times their songs were played that month. It appears as a 🎵 song royalty statement next to your ad share, is checked, then paid to your bank with it after the usual hold. Amounts below the minimum roll over to the next month, like ad share.
`),
    ...(MEDIA_LIVE ? [A("media", "Media: your videos and pictures", "Publishing and earning", `
**Media** is the tab on your profile, between Notes and Store, for your own videos and pictures. Anyone can open it at /u/yourname/media. Unlike [moments](/help/messages-moments-groups), Media posts stay until you delete them.

**What's on your Media:**
- **Your posts:** a video, or up to ${MEDIA_PICTURES_MAX} pictures in one post. Use your original sound, or pick a song from NotesApp Sounds (songs made for #NotesApp, free to use here); on a video the song plays softly under your own sound.
- **Pinned:** pin up to ${MEDIA_PINNED_MAX} posts to the top. You can also pin up to ${MOMENTS_PINNED_MAX} moments: open your moment and tap **📌 Pin**. A pinned moment stays on your Media after its 24, 48 or 72 hours, until you unpin it. Unpin one whose time is up and it is deleted there and then.
- **Pictures from your site:** the cover, top banner, gallery and service pictures on [your site](/help/your-site) show in your Media straight away. In your studio you can hide any of them, or turn them all off.
- **Profile pictures:** your past profile pictures, as an album, newest first. You can turn the album off.
- **Lives & replays:** your published replays, which carry the NotesApp mark like your videos.

**Posting:** open your [Media studio](/profile/media) (Profile → Media), choose a video or pictures, and add a caption. Pictures are made WebP before they're sent, like everywhere on #NotesApp. Videos go to Cloudflare Stream, which plays them at the right quality for your connection, and they show on your Media within about a minute. You need a verified email to post.

**Who can see each post:** **Everyone**, **Followers**, or **Subscribers** (people who subscribe to your journal). You can change it later from **⋯** on the post. You can also choose whether to allow comments, shares and gifts. With gifts on, anyone signed in can send you a gift from the post itself (see [Gifts](/help/gifts)); comments and reactions arrive with the Media feed.

**The NotesApp mark:** every Media picture and video carries the NotesApp mark: a faint "na NotesApp" logo across the middle and **na @yourname** in a corner, both sized to the picture, so a phone photo and a wide banner look the same. It is added when you upload (pictures on our server, videos by Cloudflare Stream as they arrive), and we keep only the marked copy: the clean upload is deleted. A picture post shows on your Media once its pictures are marked, usually within seconds. See [The NotesApp mark](/help/notesapp-mark).

**Downloads:** off unless you turn on **Allow downloads** for a post. When it's on, people who can see the post can save its pictures or its video. They get the same marked file everyone sees, so there's no second copy and nothing extra in your storage. The first time you allow downloads on a video, Cloudflare makes its download file, which takes a few minutes (your studio shows **Making the download file…**); if it can't be made, your studio says why, and turning downloads off and on tries again.

**How much you can post** (set by plan, in Admin → Limits):
${LIMIT_TIERS.map((x) => `- **${LIMIT_TIER_LABEL[x]}:** ${lim("mediaVideosPerWeek", x) > 0 ? `${lim("mediaVideosPerWeek", x)} video${lim("mediaVideosPerWeek", x) === 1 ? "" : "s"} a week, each up to ${secondsText(lim("mediaVideoMaxSeconds", x))}` : "no videos"}; ${lim("mediaPicturePostsPerDay", x)} picture posts a day; ${lim("mediaStorageGB", x) === 0 ? "no storage limit" : `${lim("mediaStorageGB", x)} GB of storage`}`).join("\n")}

Media videos are counted apart from journal videos and video moments. Weeks start on Monday. If a video is rejected (for example, longer than your plan allows), its slot is given back. Deleting a post frees its storage.

**Teen mode:** a teen's Media is shown only to people who follow each other with them, and never to anyone signed out, whatever the post says. Nobody can download, share or send gifts on a teen's Media, and only people the teen follows can mention them.

**Blocking:** someone you block can't see your Media, and you can't see theirs.
`)] : []),
    A("notesapp-mark", "The NotesApp mark on your pictures and videos", "Getting started", `
To show where a picture or video came from and whose it is, #NotesApp adds a **permanent mark** to:
- every [Media](/help/media) picture and video,
- every published live [replay](/help/live-recording-and-replays) with video,
- the photos of your [shop items](/help/selling-physical-goods),
- the pictures of the services on [your site](/help/your-site),
- the pictures in your [journals](/help/publishing-journals) (the cover and pictures in the text),
- the pictures and videos in your [moments](/help/post-a-moment).

**What it looks like:** a faint "na NotesApp" logo across the middle, and **na @yourname** in a corner (white letters with a soft dark edge, so they read on light and dark pictures). Both are sized to each picture, so a tall phone photo and a wide banner look the same. On a journal, the corner carries the journal's main author, even when a co-author adds the picture.

**When it's added:** as you upload. Pictures are marked on our server a moment after they arrive; videos and replays are marked by Cloudflare Stream as they're processed. **We keep only the marked copy:** the clean file you uploaded is deleted, and downloads are the same marked file. There's no switch to turn it off.

**Not marked:** your profile picture, your site's cover, banner and gallery, course videos and covers, community pictures, chat pictures and attachments, Notes Life, and the files of digital products. A picture used from another website (a link, not an upload) is left as it is.

**Pictures from before the mark:** we're adding the same mark to pictures and videos posted before it (a moment's video that isn't pinned simply disappears with its moment; a pinned one is re-marked). A picture is marked where it is, so links to it that were already shared (in chats, journals, emails or on other sites) show the marked picture; an old video is replaced by a marked copy. If a shop or service picture is also your site's cover or gallery picture, only the copy on the item is marked.`),
    A("pictures-and-uploads", "Pictures you upload (WebP)", "Getting started", `
Pictures you upload anywhere on #NotesApp (journals, your shop, your site, your profile, chats, moments, Media and adverts) are turned into **WebP** on your phone or computer before they're sent. WebP files are much smaller than JPEG or PNG for the same look, so your pages load faster and use less of your visitors' data.

**Very large photos** are made smaller: profile pictures to 1024 pixels on the long side, others to 2560.

**Privacy:** the hidden camera details in a photo (such as where it was taken, and the phone that took it) are left out.

GIFs (so they keep moving), and pictures already in WebP or AVIF, are sent as they are. Academy logos and signatures stay PNG for certificates.

**The NotesApp mark:** Media pictures, shop item photos, service pictures and journal pictures get the [NotesApp mark](/help/notesapp-mark) with your @username when they're uploaded; only the marked copy is kept.`),
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
    A("feedback", "Give us feedback", "Getting started", `
Tell us how #NotesApp is going for you: open [Contact → Feedback](/contact?topic=feedback) (or choose **Feedback** in the contact form's list). Five quick questions:

- how your time on #NotesApp has been, from 😞 to 😍 (1 to 5);
- what you love;
- what's missing or broken;
- how likely you are to recommend us to a friend (0 to 10);
- whether we can contact you about your answers (yes or no).

It works whether you're signed in or not. Signed in, your name and email are filled in and your reply is linked to your account. It goes straight to our team's inbox, and we read every one. To report a bug that needs a reply, or a post or account, use the contact form's other topics.
`),
    A("announcements", "News and announcements from #NotesApp", "Getting started", `
Now and then we send every member a short message: what's new, what's coming, and ways to take part (like our one-month update on 1 November 2026). It comes to your bell (📢) and, if you like, by email. Tap the bell to read it on its own page.

**Turning the emails off:** every announcement email has an **Unsubscribe from announcements** link at the bottom (your email app's own Unsubscribe button works too), or switch **News and announcements from #NotesApp** off under **Emails** in [Account settings](/profile/account#email). The bell still shows them. If you switched the [weekly digest](/help/weekly-digest) off before announcements existed, we take that as a no to announcement emails too, until you switch them on.

Students in teen mode and child profiles never get them by email. Emails about your bookings, orders, payments and account always come, whatever you choose.
`),
    A("social-sharing", "Sharing posts to social media", "Publishing and earning", `
Every post has a share menu (WhatsApp, X, Facebook, LinkedIn, copy link) that works without connecting anything. On #NotesApp itself, the same menus (on journals, courses, shop items, services, public events, certificates, coupons and public community posts) offer **Share to Moments** (a moment that links to it, with an optional caption) and **Share to Journals** (a journal draft that quotes it, for your own thoughts); both credit the creator and are for signed-in members. You can also connect LinkedIn and X once and publish an excerpt of your post there, with a link back to the full journal on #NotesApp. You always see and can edit the words first (Nana can write them for you), and nothing goes out until you press Post. LinkedIn connections last about 60 days before you reconnect. Facebook, Instagram and TikTok are on the [roadmap](/roadmap).`),
    // ── Selling
    A("business-books", "Business books: walk-in sales, expenses, money owed, profit, Nana, offline and staff", "Selling", `
[Business books](/profile/books), under My account, keeps the books for the selling you do **in person**, next to your online store: who bought what, what you spent, who owes you, and what you made today, this week and this month.

**Record a sale:** tap **＋ Record a sale**. Search your items by name or SKU (items from your store, and items from a stock list you imported), or type a one-off ("2 yards lace"). Change the quantity and the price (for a discount), then choose how they paid: **Cash, Transfer, POS** or **Credit**. Turn on **Customer owes** for a sale on credit: choose the customer (or add one, with their WhatsApp number, or their @username if they're on #NotesApp), what they paid now and the day they'll pay by. The rest goes to **Money owed to you**. A sale of an item lowers its stock through [Inventory](/help/inventory) when you have it; without Inventory, stock isn't counted and Books says so.

**Receipts:** every sale has a receipt link on #NotesApp, with your shop's name, the items, the total, how it was paid and what's still owed. It never shows your phone number or your customer's. **Receipt PDF** opens it ready to save as a PDF (it has a QR code that opens the link). Send it by **WhatsApp** (it opens on your phone with the message written; you tap Send), or by email and the bell to a customer who is on #NotesApp.

**Expenses:** tap **Add expense**: the amount, the day, how you paid, a category (stock purchases, rent, staff pay, power, transport and loading, market and LG levies, data and airtime, repairs, salon or workshop supplies, bank and POS charges, other, or your own) and a note, with up to 3 receipt photos. The photos are kept privately; only you see them.

**Online orders come in by themselves:** when a buyer pays for an item in your store, the order shows in your books as a sale marked **Store**, with #NotesApp's commission as an expense line, so your profit is true. A refunded order gets a refund line next to it. An order is never counted twice. Online money is paid out by #NotesApp, so it's never in your cash in hand.

**Today:** profit so far (sales, minus the cost of what you sold, minus expenses), sales, expenses, **cash in hand** (your opening float plus cash taken, minus cash paid out; transfer and POS money are shown apart), money owed to you, today's entries, what's running low, who you owe and the week's best sellers. Tap an entry to see it, open its receipt or photos, or **Void** it with a reason (online orders follow the order instead).

**Profit and loss:** for a day or a week, and on Pro and above a month. Sales (walk-in and online apart), refunds, the cost of what you sold, gross profit and margin, expenses by category and net profit, with the change on the period before. **PDF report** and **CSV** take it with you. Profit needs cost prices: when items have none, Books says so and links to [Inventory](/profile/inventory) to add them.

**Honest numbers:** sales recorded, expenses recorded and the stock you hold are always separate numbers. Stock value is what you own, not business you did, so it is never added to sales or profit.

**Money owed:** **Owed to you** lists customers with what they owe, since when and the due date, late ones first. **Record payment** takes all or part (oldest sales are paid first). **Remind by WhatsApp** opens WhatsApp on your phone with a polite message and a link to their statement; customers on #NotesApp get **email and the bell** instead. Each message to someone who isn't on #NotesApp ends with a short line: "Sent with #NotesApp Business books. Keep your own books free: …/books". One reminder a day at most. A customer can stop reminders from their statement link; email reminders stop then, and WhatsApp asks you first. SMS comes with Send-Na. **You owe** is a simple list of suppliers, what you owe and when; tap **Paid** when you pay.

**Import your records:** **Import and export** brings in a **stock list, past sales, expenses or customers and debtors** from a CSV file. Excel: File → Save As → CSV. Google Sheets: File → Download → Comma-separated values. From Tralo, choose **Tralo**: its inventory and sales exports are matched for you. Upload the file, check the columns we matched from its headings, and see the dry run: new rows, updates, **duplicates skipped** (items by SKU then exact name; sales and expenses by the same day, amount and item or description; customers by phone, then exact name) and rows to fix (for example a price that isn't a number, stock below 0, or prices in cedis, which wait for cedi support). Nothing is saved until you tap **Import**, and you can **Undo** an import for 24 hours. Up to 5,000 rows and 5 MB a file, 10 imports a day. Imported sales don't move stock, send receipts or reminders, or count toward the monthly limit. A stock list needs Inventory: items already in your store get their stock, cost price and SKU updated (their online price stays as it is), and new ones are kept as Books-only items, not for sale online. Download a template for each kind to start from.

**Bring your records:** choose where the file is from, or just upload it: we know Shopify, WooCommerce, Paystack, Tralo and bank statements from their headings and switch to them. Each source shows **How to export** with the steps. One line per source:
- **Shopify:** Products → Export (each size or colour becomes its own item) and Orders → Export (only paid orders; refunded ones come in with their refund; orders in dollars or another currency are refused).
- **WooCommerce:** Products → Export for your stock list. WooCommerce has no orders export of its own, so use an export plugin (WooCommerce's Customer / Order / Coupon Export, one row per item, or Advanced Order Export) and check the columns we matched.
- **Selar:** your sales export becomes sales, and each buyer a customer. Selar items are digital, so no stock moves. Check the columns we matched.
- **Bumpa:** products, orders and customers exports. Unpaid and part-paid orders, and customers with an amount owed, go to Money owed. Bumpa's customer export is an Excel file: save it as CSV first. Check the columns we matched.
- **Paystack:** Transactions → Export CSV. Only successful payments come in; payments that were #NotesApp orders are skipped because they're already in your books, and Paystack's fees come in as one expense a day under Bank and POS charges.
- **Bank statement:** the CSV from your bank app (GTBank, Access, Zenith, First Bank, UBA, Opay, Moniepoint, Kuda and others), or a PDF the bank made (not a scan). Every line comes back for you to tick: money in as a sale, money out as an expense in a category we suggest from the narration (POS, transfers, airtime, NEPA, fuel, rent and so on). Nothing is saved until you import.
Importing the same export again adds nothing (orders are matched by their own number), and an order refunded since only adds its refund. Undo works for 24 hours, as for any import.

**Export:** **Export everything** gives you your sales, expenses, payments received, money owed both ways and stock as CSV files that open in Excel and Google Sheets.

**What it costs:** free on Free Basic for ${booksCaps().freeEntries} walk-in sales and expenses a month (online orders and customers paying you back never count), up to ${booksCaps().freeCustomers} customers owing at once, imports of ${booksCaps().freeImportRows} rows a file, and profit and loss for the day and the week. Pro, Business and Enterprise have no limits, the month's profit and loss, and imports of 5,000 rows. Stock counting is [Inventory](/help/inventory) (included on Business; an add-on on Free Basic and Pro).

**Tell Nana:** tap **Tell Nana** and type it the way you'd say it, or tap **Say it** and speak (your phone's own speech-to-text): "Sold 3 bags of rice ₦45,000 to Mama Bisi on credit, due Friday", "Bought diesel 18k cash", "Chinedu paid 20k transfer", "Bought 10 bags garri at 52k each". Nana understands "5k", "45 thousand", "₦45,000", "on credit", "she paid half" and days like "Friday" or "the 15th". It writes a **draft** for each entry (a sale, an expense, a payment received or a purchase) with your own items and customers; where it isn't sure (two rice items, a customer it doesn't know) it says so on the card. Check each draft, change what you need, and tap **Save**. Nothing is saved before that. It uses a little of your [Nana allowance](/help/nana-gems-and-credit) (Pearl), then Nana credit; when both are used up it says so, and typing an entry yourself is always free. Nana sees your item names and prices and your customers' first names, never balances or profit. It needs a connection.

**No connection? Keep selling:** on your phone, Business books opens with no signal once you've opened it online before. Sales, expenses, purchases and payments you record are kept on the phone, with a badge like **3 waiting to sync**, and sent as soon as you're back online (by themselves on Android; on iPhone when you next open Books). Each is saved once, however many times the phone tries, and keeps the day you recorded it. When it syncs, Books tells you anything you should know: an item that sold more than was in stock (the sale is still saved; count the shelf), a customer who wasn't in your books (they're added), or an entry that couldn't be saved and why, with **Try again**. Receipt links come once a sale has synced; receipt photos and Nana need a connection.

**Purchases (restock):** record goods you bought to resell (from Tell Nana, for example "Bought 10 bags garri at 52k each"): the stock goes up, the cost goes into expenses under Stock purchases, and you can update the item's cost price.

**Staff: cashiers and managers** (Business and Enterprise): open **Staff** and invite someone by @username or email as a **Cashier** or a **Manager**. They get a bell and an email and accept on their invitation page. A **Cashier** records sales and payments received, sees the sales they recorded today, and prints or shares receipts; they never see profit, costs, the expenses list, exports or settings. A **Manager** does everything except settings and staff. Every entry shows who recorded it, and on Sales and Expenses you can choose one person to see theirs. Change a role or remove someone at any time; their entries stay. On an organisation's account its admins can invite staff too. Staff need their own #NotesApp account (free) and never see your payouts or bank details.

**Customers paying online:** a customer's statement link has **Pay now**: they pay all of it or a part, by card or bank transfer through Paystack, no account needed. It comes off what they owe straight away (oldest sales first), shows in your books as **Paid back · online**, you get an email and a bell, and they get a receipt. The money is held for a few days like a store sale, then paid to your bank with your other earnings, less your normal commission on store sales.

**Monthly email:** on the 1st of each month you get a summary of the month before: sales (walk-in and online apart), expenses, profit and the change on the month before, best sellers, money owed and what's late, and what's running low, with a link to the month's profit and loss. Only when your books had entries that month. Turn it off from the email or in [Email settings](/profile/account#email).

**Who sees it:** you, on an organisation's account its admins, and the staff you invite, as their role allows. Nobody else, not even other teammates, can see your books.`),
    A("inventory", "Inventory: your stock, SKUs and alerts", "Selling", `
[Inventory](/profile/inventory), under My account, keeps your store's stock in one place.

**What you see:** every physical item, and every option of an item with options (size, colour), with what's left, its SKU and the level at which you want an alert; and at the top, your units in stock, their value at cost, and how many are running low or sold out. Filter to **Running low** or **Sold out**, or search by name, option or SKU.

**Changing stock:** tap **Restock or correct** on a line. **Add** a number (or take some off with a minus) or **set the count**, and pick a reason: restocked, stock count correction, damaged or lost, returned, or other, with a note such as the supplier's invoice. Sales and refunds are recorded on their own. Open an item to set its **SKU** (and each option's), its **cost price** (only you see it) and its **alert level**, and to see its **history**: every change, when, by whom and what was left after.

**Alerts:** when a sale takes an item (or an option) to its alert level, or sells it out, you get a notification. Restocking an item that had sold out tells everyone who asked to be told.

**Spreadsheet:** **Download spreadsheet** gives you every line (item_id, title, option, sku, stock, low_stock_at, cost_naira, price_naira). Change what you need, then **Upload spreadsheet**: you see what will change and any rows with problems before anything is saved. Rows are matched by item_id and option, or by SKU.

**Walk-in sales:** a sale you record in [Business books](/help/business-books) lowers the stock the same way an online order does, and shows in the history as Sold with its book entry; voiding it puts the stock back. A stock list imported in Business books (a Tralo export, for example) updates stock, cost prices and SKUs here, and can be undone for 24 hours.

**Who has it:** included on Business and Enterprise. On Free Basic and Pro, add it for ${inventoryAddonPrice()} a month, after a free ${inventoryTrialDays()}-day trial (no card, once). An organisation's teammates who run its store, and its admins, can use the organisation's inventory.`),
    A("selling-physical-goods", "Selling physical goods from your store", "Selling", `
Your store lives at /u/yourname/store. Add an item, tick that it is sold through #NotesApp checkout, and set the price, your delivery fee and your stock. You need a payout account under Rates & payouts.

The buyer pays here with their delivery address and gets a parcel ID by email; their money is held until delivery. You dispatch and keep the log (courier and tracking number, or who holds the parcel by bike, bus or motor park). Payout is released when the buyer confirms delivery, or 7 days after you mark it delivered. If the buyer reports a problem the money stays held while we review.

Every item needs a category (buyers can filter a store by it) and, for physical items, where it ships from, which buyers see before they pay. Shoppers can save items with the heart (their private list is under Saved items), and a store shows what buyers check most.\n\nSizes: if an item comes in sizes (or sizes and colours), add them one at a time. Type the size and how many pieces you have, then tick ✔ to save it and add the next, for example L: 2, XL: 5. You can save up to 60 entries, edit or remove any of them, and the total stock is added up for you.\n\nCommission applies to the item price only (see [commission rates](/help/commission-rates)). Stores do not link out to other shops. To sell more, make [discount codes and coupons](/help/discount-codes) or set an affiliate share so members promote your items ([Referrals and affiliates](/help/referrals)). Full details: [Store selling](/store-selling).\n\nSelling in person too? [Business books](/help/business-books) records walk-in sales, expenses and money owed next to your store, and every paid order comes into it by itself, with our commission as an expense, so you see your real profit.\n\n**Photos:** item photos carry the [NotesApp mark](/help/notesapp-mark) and your @username, added as they upload; only the marked copy is kept.

**What you can't sell:**
${STORE_RULES.map((r) => `- ${r}`).join("\n")}
See [Crypto and stablecoins on #NotesApp](/help/crypto-and-stablecoins).`),
    A("digital-downloads-and-courses", "Selling digital downloads, PDFs and video courses", "Selling", `
Choose **Digital download** when you add an item and upload your file (PDF, ePub, ZIP, audio, video, Office files or images, up to 200 MB). It is stored privately; only people who pay can download it, instantly. The sale is final once downloaded, and your share is paid after a 7-day dispute window.

On **Pro and above** you can instead choose **View only**: add lessons (videos or PDFs) that buyers watch or read on #NotesApp with no download, on up to two devices per purchase, with the buyer's email faintly stamped on the content. One lesson is a single view-only file; several make a course. See [Store selling](/store-selling#view-only).

For a full course, with progress for learners, use [Notes Academy](/academy): free courses with lessons from your own YouTube on every publishing plan, and paid courses on Pro and above, with the same fee as your digital items (text lessons and PDFs, plus your own uploaded videos on Business and Enterprise). See [Teaching and learning on Notes Academy](/help/academy).

Downloads and courses can have [discount codes and coupons](/help/discount-codes) and an affiliate share ([Referrals and affiliates](/help/referrals)) like any other item.`),
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

**Audio rooms:** like Clubhouse, inside your community. Admins and moderators tap **+ Start a room** on the community's Home, give it a name (Sunday Q&A, Midweek Bible study) and go live. The host can bring up to **4 members on stage** to speak at a time; everyone else listens. A listener taps **✋ Raise hand to speak**, and the host taps **Bring up** (or taps anyone in the room and **Invite to speak**); **Move to listeners** sends a speaker back, and a speaker can step down with **Back to listening**. A green ring shows who is talking. **Leave quietly** to go; the host leaving, or **End room**, ends it for everyone. Rooms are for members only, nothing is recorded unless the host switches [recording](/help/live-recording-and-replays) on (everyone is told), and a room holds up to **${roomListeners} listeners**${room.relay ? " (the sound goes through our relay, run by Cloudflare)" : " (phone to phone for now; bigger rooms come with our relay)"}.

**Room chat:** while a room is on, everyone in it can type: questions for the speakers, prayer points, amens, links. On a computer the chat sits beside the room; on a phone tap **💬 Chat** (a red number shows what you missed). The host and speakers are marked, the host or a moderator can **Remove** a message, and the chat goes when the room ends: nothing is kept.

**The feed:** General and every Space look like a group's wall: **Create a note…** opens the composer (words and a photo), and each post has **Like**, **Comment** and **Share** (a link to the post), comments with each writer's picture, and a **⋯** menu for moderators to pin or remove. Home shows the About card (open, approved or by invitation; members; who runs it), the members' faces, upcoming events and Spaces.

**Joining:** open to anyone, by approval (with up to 5 join questions, such as "Which branch?"), or only by invite link. Anyone with the invite link joins straight away; make a new link to stop the old one.

**Being found:** a community anyone can join, or ask to join, is listed in the Community directory, in **Explore → Communities** and, when it's busy, in **Trending → Communities** (ranked by new members, then posts, then comments, for today, 7 days or 30 days). A community joined **only by invite link** is private: it isn't listed anywhere except for its own members.

**Admin tools (Admin tab):** approve or decline requests with their answers; settings (name, logo and cover, about, contact, how people join, what non-members see, slow mode, Spaces); the invite link; banned members; and **insights** (members, new joins this week and month, posts, comments, active members, the most active). On the Members tab, admins make moderators, the owner makes admins, and moderators and admins remove or ban those below them. Moderators and admins pin and remove posts. **Slow mode** makes members wait between posts and comments (moderators and admins aren't slowed).

**View as:** admins can preview the community as a non-member, a member or a moderator (the owner, as an admin too) before changing anything. Nothing you do while previewing changes your role.

**Giving and tickets:** take offerings, tithes and donations with [Giving](/help/giving), and sell [paid event tickets](/help/event-tickets) with QR check-in.

**More on each part:** [General](/help/community-general), [Spaces](/help/community-spaces), [Circles](/help/community-circles) and [Audio rooms](/help/community-audio-rooms), each with its own page on [Community](/community).`),
    A("events", "Events", "Teams and organisations", `
[Events](/events) are for every account: services, meetings, launches, classes and outreaches. Add one on the Events page (for yourself) or on your community's Events tab (for the community, open to everyone or members only).

An event has a start and end (Lagos time), where it is, and or a **Join live** link. For a talk in your community, host it in an [audio room](/help/community-audio-rooms) on #NotesApp (the host, ${ROOM_SPEAKERS_MAX} speakers and up to ${roomListeners} listening). For video or a bigger audience, which our own streaming doesn't do yet, the link can be YouTube Live, Facebook Live, Zoom, Google Meet or any https link. It can repeat **every week** or **every month**, until a date if you like.

People tap **Going** or **Interested** and get a reminder **24 hours and 1 hour before** (a notification, a phone notification and an email), and can **Add to calendar**. Public events are listed under Upcoming, by state and city, in **Explore → Events**, and in **Trending → Events** when people are buying tickets, RSVPing or visiting. Members-only events and events of an invite-only community never are. If you change or cancel an event, everyone going or interested is told.

**Paid tickets:** on your event's page, under **Tickets**, add ticket types (Regular, VIP …), each with a price (from ${money(TICKET_PRICE_MIN_KOBO)}) and how many. With none, the event stays a free RSVP. Paid tickets need your bank account under Rates & payouts. More in [Paid event tickets](/help/event-tickets).`),
    A("event-tickets", "Paid event tickets and check-in", "Teams and organisations", `
**For organisers:** whoever can edit an event (its host, or a community's admins for the community's events) adds **ticket types** on the event's page: a name, a price in naira and how many. A type that has sold can't be removed or set below what's sold; set its number to what's sold to stop selling it. You're paid after the event ends (and the 24-hour window for problems), to your bank account under Rates & payouts.

**Charges:** no commission, on every plan, the same as [giving](/help/giving): each ticket has a small charge by its price (${bandsText(money)}), plus Paystack's card charge at cost on the payment (${CARD_CHARGE_TEXT()}). The buyer pays the ticket price; the charges come out of it. For example, one ${money(5_000 * 100)} ticket: ${money(bandChargeKobo(5_000 * 100))} charge and ${money(cardChargeKobo(5_000 * 100))} card charge, so you get ${money(5_000 * 100 - bandChargeKobo(5_000 * 100) - cardChargeKobo(5_000 * 100))}. Tickets sold before 2 November 2026 keep the commission they were sold with.

**For buyers:** choose the type and how many (up to ${TICKETS_PER_ORDER_MAX} at a time) and pay by card or bank through Paystack. Each ticket gets its own code and **QR code**, under [My tickets](/tickets), on the event's page, and in your confirmation email. Each lets one person in, once. When a type is sold out, it says so before you pay.

**Check-in at the door:** the organiser taps **Check-in** on the event (or opens /events/<event>/checkin) and types a code, or taps **Scan QR codes** where the browser can read them (Chrome on Android, for example). Pointing any phone camera at a ticket's QR also opens the check-in page and checks it. The page answers **Valid — Ada Obi, Regular**, **Already checked in at 18:05**, **Not a ticket for this event**, or **Not valid: refunded**, and counts who is in.

**Refunds:** a refunded ticket stops working straight away and goes back on sale.

Setting up the event itself: see [Events](/help/events). Communities can also take offerings and donations with [Giving](/help/giving).`),
    A("giving", "Giving to a community", "Teams and organisations", `
Churches, NGOs, schools and clubs can take offerings, tithes and donations in their [community](/help/community).

**For admins:** open your community's **Admin** tab, find **Giving**, tick **Take gifts** and name your funds (Tithe, Offering, Building fund; "Donation" if you name none). Gifts are paid to the bank account of the community's owner under Rates & payouts, so add it first. Below the settings you see every gift (an anonymous giver's name hidden), and the totals per fund. Card details never reach us or you.

**For givers:** tap **Give** on the community (members, and anyone signed in when the community is listed). Choose the amount (from ${money(GIVING_MIN_KOBO)}), the fund, add a note if you like, and choose whether to give anonymously and whether to **cover the charges**. You see the charges and the total before you pay. Every gift gets a receipt under [My giving](/giving), and a note in your bell (no email).

**Charges, like a bank transfer:** ${bandsText(money)}. By card or bank, Paystack's own charge is added at cost and shown as the **card charge** (${CARD_CHARGE_TEXT()}). From the NotesApp Credit wallet there's no card charge, so it costs less. There's no commission on top. If you cover the charges, you pay the gift plus the charges and the community gets the whole gift; otherwise the charges come out of the gift.

**Payouts:** each gift is held for a day, then paid out with that day's other gifts on the next payout run, only to the owner's verified bank account.

**Before verification:** until a community, or the organisation that runs it, is [verified](/organisations), each gift is capped at ${money(UNVERIFIED_GIFT_CAP_KOBO)}.

Selling tickets to your community's events? See [Paid event tickets and check-in](/help/event-tickets).`),
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

**On stage:** the host and up to **${ROOM_SPEAKERS_MAX} speakers** at a time. The stage shows the empty chairs too, each with a **+** in the middle when you can come up. A speaker can step down with **Back to listening**. A green ring shows who's talking; the mic button mutes and unmutes.

**Stage mode:** the host picks one when starting the room and can switch at any time during the live (**Solo**, **Approve** or **Open** above the stage):
- **Solo:** only the host on stage. Nobody can ask to come up: no raised hands, no + on the chairs. The host and moderators can still invite someone.
- **Approve:** tap **+** on an empty chair (or **✋ Ask for a seat**) to send a request. The host or a moderator taps **Approve** (or **Decline**) under **Seat requests**. Tap **Seat requested · cancel** to take it back.
- **Open:** tap **+** on an empty chair and you're on stage straight away, while there's a seat. In a recorded live you still agree to the recording before your mic goes on. Members in teen mode always send a request instead, and someone removed from the live can't come up.

**Invitations:** the host or a moderator can tap anyone listening and **Invite on stage**. The invited person sees who invited them and taps **Come up** or **Not now**; an invitation lapses after ${Math.round(ROOM_INVITE_MS / 60_000)} minutes. Members in teen mode can only be invited by people they follow; they can always ask for a seat themselves.

**Moderators for the live:** when starting a room, or with **🛡 Moderators** during it, the host can name up to ${ROOM_MODS_MAX} moderators: the community's moderators and admins, or anyone in the community by @username. For each one the host ticks what they may do, or taps **Basic** (approve requests, invite, bring speakers down, turn mics off and on, remove chat messages) or **Full** (everything except ending the live). What can be ticked: ${MOD_PERMS.map((x) => x.label.toLowerCase()).join("; ")}. Starting or stopping the recording stays with the host. Moderators see only the controls they hold. A moderator can never act on the host, or on another moderator who holds as much as they do, and only the host names moderators or changes what they hold. Every moderator action is kept in the live's log, which the host opens with **📋 Moderators' log**.

**On a speaker:** the host or a moderator taps a speaker for their menu: **Turn mic off** (the speaker can't turn it back on until the host or a moderator does; in a relay room their sound isn't sent on at all, and phone to phone every phone leaves it out), **Camera off**, **Remind to agree** (in a recorded live), **Bring down** and **Remove from live**.

**Pinned message:** the host, or a moderator allowed to pin, can **📌 Pin an announcement** or **Pin** a chat message; it stays at the top of the chat until it's unpinned.

**Listening:** tap **Join** and you're listening; your mic stays off until you're brought up. **Leave quietly** whenever you like.

**❤️ Like and ↗ Share:** like the live (once; everyone sees the count) or share its link. **The chat tells everyone what's happening**, in small lines between the messages: who joined (grouped when many arrive at once), who liked or shared the live, who sent a gift and what, who followed the host, when a grand gift bursts across #NotesApp, and when slow mode goes on or off. Up to **${roomListeners} listeners**; if a room is full, you'll see how many it holds.

**The room chat:** while the room is on, everyone in it can type (up to ${ROOM_CHAT_MAX} characters): questions, prayer points, amens, links. On a computer the chat sits beside the room; on a phone, tap **💬 Chat**, where a red number shows what you missed. The host and speakers are marked. The host, a moderator named for the live with that permission, or one of the community's moderators can **Remove** a message. The community's own moderators have these chat powers only in lives hosted as community lives; in a member's own live, such as a [paid live](/help/paid-lives), only the moderators that host names can moderate.

**Ending:** **End room** ends it for everyone; the host leaving ends it too. The chat is deleted when the room ends. Nothing is recorded unless the host switched recording on before going live: then everyone sees **${RECORDING_NOTICE}**, and speakers agree before their mic goes on. See [Recording and replays](/help/live-recording-and-replays).

**How the sound travels:** ${room.relay
  ? `through our relay, run by Cloudflare. The host and each speaker send their microphone once to the relay, and everyone in the room hears the stage from there, so a room holds up to ${roomListeners} listeners and the host's phone carries no more than a speaker's. The sound passes through Cloudflare on its way and isn't kept there; only a room the host chose to record is recorded, by our own recorder. A room that was already open before the relay was switched on keeps running phone to phone (up to ${n(room.p2pListeners)} listeners), and if the relay can't be reached when a room starts, that room runs phone to phone and the host is told. In a relay room the screen shows how many are listening; tap **People here** to see who (the host can invite anyone from there to speak). Once a room passes ${n(room.chatSlowAbove)} listeners its chat goes into slow mode: each listener can send one message every ${room.chatSlowSeconds} seconds (the host and speakers are never slowed).${room.liveChat
    ? `\n\n**Chat in big rooms:** the chat, the listener count and raised hands travel live over one connection to our chat service, run on Cloudflare, so a room of thousands keeps up and everyone sees each message as it's sent. If your connection drops, the app reconnects by itself and shows new messages every few seconds meanwhile. **Slow mode is the host's tool** (and a moderator's, if the host allows it): at the bottom of the chat the host can turn it on, turn it off, or leave it on Automatic (on past ${n(room.chatSlowAbove)} listeners). The host or a moderator can also **Mute** someone in the chat (and **Unmute** them later) or **Remove from room** for the rest of the room; a message they take down disappears from every screen at once. The chat is still deleted when the room ends.`
    : ""}`
  : `phone to phone. The people on stage connect straight to each other, and each listener connects to the host, whose phone sends everyone the mix; nothing passes through #NotesApp's servers. That's why a room holds ${roomListeners} listeners for now, and why a host on Wi-Fi or strong 4G works best. Bigger rooms, for hundreds, come with our relay.`}

**Live: video, a poster and Audio only:** ${rlive.video ? `${room.relay ? "In a room that runs through our relay" : "Once rooms run through our relay"}, the host can tap **🎥 Video** to turn their camera on, and **🎥 Video off** to go back to sound only without anyone reconnecting. The host can tick **Speakers can turn video on** to let the speakers do the same. Video is kept light (${rlive.height}p, ${rlive.fps} frames a second). While nobody's camera is on, everyone sees the host's **poster**: a picture the host uploads, their profile picture or the challenge art, chosen when they start the room or with **🖼 Poster** during it. A poster is only a picture, never video.

**Saving data:** tap **📺 Video when on** to switch to **🔈 Audio only**, and the video isn't downloaded at all (you still see the poster). On a slow connection (2G or 3G) or with your browser's data saver on, a room starts on Audio only; your choice is remembered on that phone or computer.

**Video minutes:** each live has **${rlive.budgetMinutes} video minutes** (each camera that's on counts), and the host sees how many are left, like "${minutesLeftText(Math.max(0, rlive.budgetMinutes - 3))}". When they're used up, the host is told and video turns off by itself ${rlive.graceSeconds} seconds later; the room carries on with sound and the poster.

**Tips for the host:** if listeners fall by ${rlive.dropPercent}% or more within ${rlive.dropWindowMinutes} minute${rlive.dropWindowMinutes === 1 ? "" : "s"} while video is off, you'll see "Listeners are dropping. Try ${rlive.tryMinutes} minute${rlive.tryMinutes === 1 ? "" : "s"} of video?". Once video has been on for ${rlive.burstMinutes} minute${rlive.burstMinutes === 1 ? "" : "s"} in a row, or ${rlive.nearlyLeftMinutes} or fewer video minutes are left, you'll see "Back to audio to keep your video minutes."` : "Video in audio rooms is switched off for now: rooms are sound only, with the host's poster."}${room.relay ? "" : " Rooms run phone to phone for now, so video isn't on yet."}

**Book a session:** if the host offers paid sessions, **📅 Book a session** stays at the top of the room, with or without video; it opens their booking card in a new tab, so you don't leave the room.

**Can't hear?** Check your phone isn't on silent and the browser has permission to play sound; on a speaker's phone, allow the microphone. If you joined on a weak network, leave and join again.`),
    A("live-recording-and-replays", "Recording a live, and replays", "Teams and organisations", `
**Recording is off unless the host switches it on.** ${rec.available ? "" : "Recording isn't available on #NotesApp yet; this is how it will work. "}When you start an [audio room](/help/community-audio-rooms), tick **Record this live** before **Go live** (hosts on ${planList("liveRecording")} can). Only rooms that run through our relay can be recorded; if a room runs phone to phone, it isn't, and the host is told.${rec.forced ? " For now every relay room is recorded for safety review, whatever the host chooses, and everyone is told the same way." : ""}

**Everyone is told.** In a recorded room everyone sees **${RECORDING_NOTICE}** at the top of the room, and the room shows **● Recorded** on the community's Home before you join. When the host brings you on stage, your mic (and your camera, if the host lets speakers use video) stays off until you tap **I agree, turn my mic on** (or **Back to listening**). Listeners aren't recorded unless they speak on stage; the room chat isn't recorded.

**What's recorded and how:** the sound from the stage (the host and speakers), the cameras of the host and of speakers the host lets use video while they're on, and the room's poster while every camera is off, by a recorder that joins the room on our own servers, never on anyone's phone; it isn't counted as a listener and uses none of the live's video minutes. It records for up to ${rec.maxHours} hour${rec.maxHours === 1 ? "" : "s"}.

**Kept ${rec.keepDays} day${rec.keepDays === 1 ? "" : "s"}, then deleted.** A recording is kept for ${rec.keepDays} day${rec.keepDays === 1 ? "" : "s"} after the live ends so it can be checked if someone reports something (our Trust & safety team can play any recording; the host can play their own), then deleted for good, unless the host publishes it as a replay. Nobody else can download it.

**Replays:** in **[Media](/profile/media)** the host sees each recording with the days left, and can **Publish** it (hosts on ${planList("replayPublish")} can), **Play** it or **Delete** it. A replay can be for **everyone** (it shows on Explore and Trending), for the host's **journal subscribers** (paid, like a premium post), or for **members of the community** only. If the host or anyone who spoke is in teen mode, the replay stays inside the community. A replay isn't a journal post: tap **Share to Journal** to make a draft post with the replay${rec.transcripts ? ", its transcript" : ""} and a summary Nana drafts${rec.transcripts ? "" : " once transcripts are on"}, which you edit and publish like any post, with **Book a session** under it. Replays can also be shared to Moments, a chat or other apps. A video replay carries the [NotesApp mark](/help/notesapp-mark) and the host's @username, burned in as it is published; no unmarked copy is put on our video service.

**Paid lives:** the host chooses the recording when they schedule a [paid live](/help/paid-lives): **Off**, **Safety only** (recorded and kept for review as above, never offered as a replay) or **Record and offer a replay**. Everyone is told as they join, and speakers agree before their mic goes on, as in any recorded room. A paid live's replay can be for everyone, for subscribers, or for **its ticket holders only**.

**Unpublishing** removes the replay and its journal post. If that's within the first ${rec.keepDays} day${rec.keepDays === 1 ? "" : "s"}, the recording is kept another ${rec.keepDays} day${rec.keepDays === 1 ? "" : "s"} and then deleted unless you publish it again; after that, it's deleted straight away.

See our [Privacy policy](/privacy) for how recordings are handled.`),
    A("organisation-accounts", "Organisation accounts", "Teams and organisations", `
Companies, NGOs, churches, schools and clubs can run a verified channel. Sign up as an Organisation with your CAC number (RC, BN or IT) and a work email, verify the email, and start a free ${ORG_TRIAL_DAYS}-day Business trial (no card, one per registration number). We then confirm the registration against the CAC register; until then the channel shows an "unverified organisation" notice.

Already have a personal account? You do not need a new one: open [Make an organisation](/organisation), enter the CAC number, and the same account (with its username, posts and followers) becomes an organisation. If the account is more than a day old, an admin approves the change first.

You can invite writers and admins by username or email; they publish under your channel's name and earnings go to one payout account. They can also teach on [Notes Academy](/academy) as the organisation (**Teach as**), free or paid, with certificates in your academy's name and logo. Your organisation's admins can also add and edit items in the organisation's store to help you; deleting items, orders and money stay with the owner and anyone given store access. Business includes four seats (the owner plus three); Enterprise has as many as you need. See [Organisations](/organisations).`),
    A("notes-jobs", "Notes Jobs: finding a job and posting one", "Teams and organisations", `
**Notes Jobs** is the job board on #NotesApp. Open [Explore → Jobs](/explore?tab=jobs) to see every open job; tap one to read it and apply with your #NotesApp account. Our own open roles at #NotesApp are featured at the top under **Work at #NotesApp**; they open on [Careers](/careers), where you apply.

**Applying:** write a short note on why the job and what you'd bring, add links to your work if you like (a CV, a portfolio, LinkedIn), and an optional phone number and city. The firm sees your application and your public profile, never your email address; they reply on #NotesApp and you get a bell when they invite you to interview, make an offer or don't take it forward. You can apply once to each job and withdraw at any time. Your applications are on [Your job search](/profile/applications). Applications are deleted 6 months after the job closes. **Never pay to apply:** a real employer never asks for a fee. Report a job that does (the Report link on the job), and our Trust & safety team takes it down.

**"I need a job":** switch it on in [Your job search](/profile/applications) and add your city (it's private, used only for matching). Business and Enterprise organisations' jobs are matched to you from your industry, job title and interests on your profile (keep them up to date in [Edit profile](/profile/edit)): strong matches show as **Jobs for you** on Explore, you get a bell for a strong one (at most ${BELLS_PER_DAY} a day), and the firm may see you as a suggested candidate (your name, @username, job title and why you fit; never your email, phone or city) and invite you to apply. Switch it off and you disappear from suggestions at once. Teen accounts can't switch it on.

**Posting a job (organisations):** only organisations whose CAC registration we've verified can post ([Organisation accounts](/help/organisation-accounts)). Posting is free. The organisation account, or a team member its owner has put in **HR** (on the organisation's team page, whatever their role), opens [Your jobs](/profile/jobs), fills in the title, a summary, what you're looking for, the type (full-time, part-time, contract, internship or volunteer), on site, hybrid or remote and the city, and pay if you want to show it. A job goes live at once and stays open for 7 to ${OPEN_DAYS_MAX} days (${OPEN_DAYS_DEFAULT} unless you choose). On Business and Enterprise, your jobs are also matched to members who need a job and you see **suggested candidates** for each one, whom you can invite to apply once. To reach more people, [advertise on #NotesApp](/advertise).

**Apply with NotesApp** is on for every job unless you switch it off: people apply with their NotesApp account and everything below works. Switch it off to send applicants to your own page instead (give its https:// address); the job then takes no applications on NotesApp.

**Handling applications (Nana-HR):** on Your jobs you and your HR team see each application, set its status (reviewing, interview, offer, hired, not taken forward), close a job or delete it (applicants still in the running are told). Under each application:
- **Nana-HR: check against the requirements** writes a short summary: each requirement you listed, met, not met or unclear, with the applicant's own words. It never ranks, scores or rejects anyone; a person decides, and the applicant never sees it.
- **Messages:** reply to the applicant and choose who it's from: **HR** (your organisation's HR), **Nana-HR** (tell Nana-HR what to say, read and edit her draft, then send it: she never sends on her own) or **yourself** by @username. The applicant gets a bell, reads the conversation on [Your job search](/profile/applications) and can reply; you get a bell when they do.
- **Schedule interview:** choose the date and time (Lagos time), the length, video or voice, and up to a few more interviewers from your hiring team. The interview gets its own room in [Messages](/messages) with the applicant and the interviewers, where you hold the call; the link goes into the conversation with a **Join** button, the application moves to Interview, and everyone gets a reminder a day and an hour before. Nana-HR only ever uses this NotesApp link in her drafts, never one she makes up.

Nana-HR's summaries and drafts use the Nana allowance of the person who asks. The same messages work for roles at #NotesApp itself, on the [careers page](/careers).`),
    A("nana-jobs", "Nana Jobs: your own AI, a daily shortlist", "Teams and organisations", `
**Nana Jobs** is the third tab in Jobs, beside the job board and your applications: open [Jobs → Nana Jobs](/jobs/nana). You connect your own AI; Nana then collects openings from Notes Jobs and public job boards, drops the ones that don't fit, scores the rest against what you've actually done, and gives you a short ranked list every morning. Each job shows why it fits and the strongest reason you might not get it. **It finds and ranks. It never applies for you.** It's free on every plan, for members 18 and up with a personal account (teens keep the normal job board; organisations post jobs instead). See [how it works](/nana-jobs).

**Setting up, in four steps:**
1. **Connect your AI.** Gemini or Groq (both have free tiers: get a key at Google AI Studio or the Groq console), Claude (Anthropic, paid), or any OpenAI-compatible API with its address and model name (OpenRouter, a reachable Ollama and others). We check the key with a free call, keep it encrypted, and only ever show its last 4 characters. A paid AI is never used unless you choose it, and free ones are paced so they stay inside their limits. A Claude key you connected for Nana works here too. Without an AI you still get a free keyword ranking, marked **~ rough**.
2. **Your CV, and what you've done and what you want.** Upload your CV (PDF or Word .docx) or paste the text. Your AI reviews it honestly (what's strong, the gaps, and quick fixes to the CV), suggests the roles that fit, and fills in a scoring profile for you to edit and confirm: the roles you want, a **"shipped" list** (things you've actually built or delivered, taken only from your CV: anything it suggests that isn't in your CV is left out), your skills, where you can work, your level, the lowest pay you'll take and your deal-breakers. Your CV is kept encrypted, used only for Nana Jobs, and **Delete my CV** removes it and its review at once. Prefer not to share a CV? Skip it and fill in the profile yourself.
3. **Where to look.** Notes Jobs (always on, verified firms), the open feeds RemoteOK, Remotive, Himalayas and Arbeitnow, and the public Greenhouse, Lever or Ashby boards of companies you add (we check a company has a public board before adding it). Openings are collected once a day for everyone, so each board is asked once. We don't scrape LinkedIn or Indeed: both forbid it. Coming next: forwarding your LinkedIn job-alert emails to your own Nana Jobs address.
4. **When to send it.** A daily run at the time you choose (Lagos time), plus **Run now** whenever you like. A bell when it's ready (on to start with) and the list by email (off to start with). You also choose how many openings your AI reads each day: it's your AI and your bill.

**How the list is made:** repeats are removed; then free rules drop jobs that are too old, aren't a role you want, hit a deal-breaker, or that you can't take from where you live ("remote, but only from the US" is dropped for someone in Lagos); a keyword ranking picks the most likely ones; your AI reads those and scores each out of 100 (domain 25, stack 25, seniority 15, location 20, the quality of the posting 15) with a reason and the strongest risk; then each link is opened to check the job is still there (a slow site never hides a job). If your AI fails (out of credit, slow, or a wrong key), the list falls back to the keyword ranking marked **~ rough** and shows the AI's real error. It is never quietly empty.

**Your shortlist:** mark each job **Interested**, **Applied** or **Not for me**. What you set is kept: a new run never changes it, and Not for me jobs don't come back. Notes Jobs roles keep the **Apply on #NotesApp** button; everything else opens the firm's own page. **Cover note** asks your AI for a short note written only from your "shipped" list, so it never claims experience you don't have; read it, make it yours, and apply yourself.

**Private:** your scoring profile, CV and shortlist are never shown to firms and aren't your public profile. Firms still see only what you choose to share in [I need a job](/profile/applications).

Nana Jobs builds on Shortlist, an open-source job-search engine by Victor Dickson (MIT licence).`),
    A("crypto-and-stablecoins", "Crypto and stablecoins on #NotesApp", "Selling", `
**#NotesApp doesn't use crypto.** You pay and are paid in your own currency through Paystack and Paylony; NotesApp Credit is a naira balance, not a coin or token, and can't be sent or cashed out.

**In the shop:** you can't sell crypto, stablecoins or tokens themselves (USDT, USDC, Bitcoin and the like), P2P trades or exchange services. In Nigeria they need a licence from the Central Bank of Nigeria (its stablecoin and virtual asset rules of November 2026), which #NotesApp doesn't hold, so the store form and our checks refuse such listings. **Books, guides and courses about crypto are fine:** say so in the title ("Crypto basics guide", "Stablecoins course").

**In adverts:** an advert for a crypto, stablecoin or other virtual-asset service (an exchange, a wallet, P2P, a token) runs only when the advertiser shows us a Central Bank of Nigeria licence or registration for that service. We never run adverts that promise interest, yield or returns for holding coins or tokens, or guaranteed returns of any kind. See [Advertise](/advertise).

**Staying safe:** nobody from #NotesApp will ask you to pay in crypto or to "invest" anything. Report a listing, advert, message or job that does, with the Report link on it.

**Later:** we're exploring getting paid across borders through a licensed payment partner, with you still paid in your own currency and no crypto to hold ([Roadmap](/roadmap)).`),
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

**Your services menu:** each service can have its **minutes**, a **tab** (Facials, Braids, Pedicure, Gel…) and a **picture** (service pictures carry the [NotesApp mark](/help/notesapp-mark) with your @username; your cover, banner and gallery don't). They show as a menu of cards under tabs, each with its time, price and **Book now**, which opens your booking calendar. Services with minutes, tabs and pictures work on any site, not only this kit.

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
Enterprise accounts can use a server-to-server API (switched on per account by our team) to publish posts (and upload their images) and read bookings, orders and earnings, with signed webhooks for events like a booking or a paid order. Keys and webhooks are managed in the Console. Ask for access on the [contact page](/contact); the documentation is public at [API docs](/docs). Questions about the API or the MCP server can go to our [Discord](${SITE.discord}), where API changes are announced too.`),
    A("naija-exam-prep", `${PREP_NAME}: JAMB, WAEC and NECO practice`, "Getting started", `
${PREP_NAME} (${PREP_HOST}) is NotesApp's exam practice, part of Notes Academy. ${PREP_TAGLINE} It uses your NotesApp account.

**Practice:** choose JAMB, WAEC or NECO, then a subject and a topic. Each question is marked straight away, with the explanation and, for wrong options, why they're wrong. Every subject has free questions; questions you haven't got right yet come first.

**Subjects:** JAMB: Use of English, Mathematics, Physics, Chemistry, Biology, Economics and Government. WAEC and NECO: those seven plus Literature in English, Geography, Agricultural Science, Civic Education, Commerce, Financial Accounting, Christian Religious Studies, Islamic Studies, Further Mathematics, Computer Studies and History. New questions appear once a subject reviewer has approved them.

**Timed mocks:** ${MOCK_SIZES.join(", ")} questions picked at random, on a clock that runs on our side (leaving the page or changing your phone's time doesn't stop it). It's marked when you submit or when time runs out, and you can go through every answer. A mock score is practice only, never a prediction of your exam result.

**The pack:** ${money(DEFAULT_PACK_KOBO)} opens every question in one exam, all its subjects, for ${DEFAULT_PACK_MONTHS} months (the price on the pack page is the one that applies). Pay with Paystack: card, bank transfer or USSD. Buying again adds the same months. You need a verified email to buy. If a payment went through but the pack didn't open, tap **Restore my pack** on the pack page: it checks again with Paystack and never charges twice.

**Refunds:** in full if you ask within ${REFUND_DAYS} days of paying and haven't opened any pack question yet; after that, or once a pack question has been opened, a pack can't be refunded. Write to us from the contact page.

**Ask someone to pay:** on the pack page, make a link for a parent, sponsor or friend. It lasts ${PAYLINK_DAYS} days; they pay with Paystack without an account, and the pack opens on your account. They see only the name you choose.

**Offline:** on an exam's page, tap **Save for offline** to keep its questions on your phone, then practise or do a mock with no data from **Saved**. Pack questions open offline for up to ${OFFLINE_PASS_DAYS} days at a time, for your account only; save again online to renew. Your answers sync when you're back online.

**Progress and the board:** **Progress** shows what you actually did: questions answered, right first time, mocks, days in a row and each topic (strong after at least 5 answers with 70% right). The weekly effort board is optional: join with a nickname; it counts questions practised (each once a day, up to ${n(BOARD_DAILY_CAP)} a day), not scores, and starts again every Monday.

**Report a problem:** every question has **Report a problem** (wrong answer, unclear, typo). ${PREP_NAME} is not affiliated with JAMB, WAEC or NECO; all questions are original practice questions, checked by a reviewer before they're published. The bank keeps growing: the starter set alone has 4,090 (70 a subject for JAMB, 100 a subject for WAEC and NECO); each shows to students once it's published.
`),
    A("child-profiles", "Child profiles for under-13s (kids mode)", "Safety and your data", `
Children under 13 don't get their own NotesApp account. A parent or guardian adds them from **My account → Family**, as a **child profile** on the parent's own account: a nickname, the month and year they were born (kept privately, never shown), and a 4-digit PIN.

**Opening it:** tap **Open [name]'s profile** on your device. Your child sees only what you switched on: Naija Exam Prep practice, free Academy courses, reading journals (with no comments), and Notes Life in **kids' Notesville**, where they only meet Notesville's residents, never real players, with no invites or Bonus Credits, and only for the play time you set each day.

**Never in a child profile:** messages, moments, comments, a public profile, a username, following people, buying, or ads chosen for them. To buy an Exam Prep pack for them, use a pay link.

**Getting back to your account** takes your PIN (five wrong tries and it waits 15 minutes). Every Sunday evening you get an email of what they practised, with scores by topic. You can change what they can use, or **delete their profile and everything in it**, at any time.

When they turn 13, they can have their own account in teen mode instead.
`),
    A("naija-exam-prep-schools", `${PREP_NAME} for schools`, "Teams and organisations", `
A school joins ${PREP_NAME} through a key member of staff (the principal, the proprietor or another senior role) at **prep.notesapp.name.ng/schools**. We review the school, then the staff member signs the onboarding data agreement on the school's behalf, and a copy is emailed to them.

**Classes:** the lead makes classes (for example SS3 Gold, JAMB, Maths) and each gets an access code like **GFC-SS3G-7KQ**. Students type it under **Progress → Have a class code?**. Teachers are added by the email of their NotesApp account.

**What teachers see:** their own classes only, each student by first name and initial, with the questions they answered this week, their score and their weakest topic, a board of nicknames for students who joined the board, and a CSV export. Nothing is sold, shared for marketing or used for ads. Under-18s still use teen mode.

**Price:** free during the pilot. After it, a price per student per year, agreed with each school before anything is charged.
`),
    A("naija-exam-prep-teen-mode", `${PREP_NAME}: teen mode and parents`, "Safety and your data", `
Students aged 13 to 17 can use ${PREP_NAME}. After signing up, tap **Yes, I'm under 18**, choose the month and year you were born, and give a parent's or guardian's email. The month and year are kept privately, never shown, so teen mode ends on your 18th birthday. Under 13, a parent or guardian sets you up from their own account.

**Teen mode:** you don't appear in people search or the member directory; only people you follow can message you, add you to a group, or reply to your journals and comments; your moments are seen only by people you follow who follow you back (never public, never reshared), and only people you follow can reply to them or @mention you; and the weekly board shows only your nickname, never your name.

**In Notes Life,** teen mode keeps you off the Billionaires List except for people you follow back, you aren't shown to (and don't see) other players at the same place, friends are only people you follow who follow you back, and someone whose invite link you used sees "A friend in teen mode" instead of your name unless you follow them. There is no way to send Notesville Naira or anything else to another player.

**Parents and guardians** get an email asking them to confirm, with a link. The address is kept only to confirm the account and to contact them about it; it's never shown on the profile. A student can practise, and buy a pack or send a pay link, before the parent confirms. A parent can ask for a refund under the pack's refund rule (within ${REFUND_DAYS} days, no pack question opened) or for the account to be closed, from the contact page.

No ads are shown to students in teen mode, and their data isn't sold or used to market to them; they don't get the weekly digest or offers.

**On your 18th birthday** you get a one-time screen, "You're 18 now": everything stays as it was until you switch it on (people search, messages from anyone, replies and moments from anyone, your real name on the board, the digest and offers). You agree to the Terms and Privacy Policy yourself, can download your data or delete your day-by-day practice log, and we tell your parent or guardian the account is now yours and remove their email.
`),
    A("naija-exam-prep-reviewers", `Reviewing questions for ${PREP_NAME}`, "Teams and organisations", `
Every ${PREP_NAME} question is checked by a reviewer before students see it.

**Volunteer:** anyone can offer to review at [${PREP_HOST}/reviewers](${PREP_URL}/reviewers): choose the subjects you know (any of the 18), the exams (JAMB, WAEC, NECO), your background (teacher, examiner, graduate in the subject or student) and your years of experience; a phone number is optional. Signed in, your name and email are filled in. We look at every sign-up ourselves. Once you're approved, your reviewer access is switched on if you have a NotesApp account with that email, or you get an invite link to create one; either way we email you.

**The reviewers' community (optional):** tick **Join the reviewers' community** when you sign up and you'll get the invite link to the private Naija Exam Prep Reviewers community with your approval. It has Spaces for Start here, Sciences, Arts and humanities, Commercial, and Questions to discuss. You can review without joining.

**Joining by invite link:** NotesApp staff choose the subjects first, then make either a link for one person (14 days, used once) or an open link for volunteers (7 to 90 days, up to 500 reviewers, closable at any time). Open the link, sign in or create a NotesApp account, and tap **Accept the invite**. A later link for other subjects adds them.

**Reviewing:** the review queue (${PREP_HOST}/review) shows only questions in your subjects. For each one, check that the marked answer is right, the explanation is clear and correct, and the question is fair. **Approve** it, or **Ask for changes** with a note saying what to fix. You can't review a question you wrote. Starter questions are labelled **Nana AI-assisted draft**: check them as carefully as any other.

**After review:** an approved question is published by NotesApp's editors; a question sent back is fixed and returns to the queue. Your reviews are counted (in total and per month), so reviewers can be paid into their NotesApp wallet when that starts. Reviewers see the review queue only: never payments or students.
`),
    A("mcp-ai-assistants", "MCP: use #NotesApp from your AI assistant", "Teams and organisations", `
MCP (Model Context Protocol) is a standard way for AI assistants such as Claude and ChatGPT to use other services. #NotesApp has an MCP server, so you can ask your own assistant to find things on #NotesApp for you.

**What it can do (anyone, no sign-in):** find creators, journals, Notes Market items and Notes Academy courses; show a creator's open session times; and give you a booking link that opens the booking card on the time you picked.

**It only reads.** Booking, buying and paying always happen on #NotesApp itself, never inside the assistant.

**How to add it:** in your assistant's settings, add a remote MCP server (also called a custom connector or Streamable HTTP server) with the address \`https://mcp.${ROOT_DOMAIN}\` (on another of our domains, its own mcp. address works the same). The [API docs](/docs#mcp) list every tool, with an example.

**Your own account:** connect your assistant with [Connect NotesApp](/help/connect-an-ai-assistant): you choose what it may see and do, and it can then read your profile, journals, bookings and orders, save drafts, ask to publish, reply about bookings, edit store items and mark orders shipped, within your rules. Enterprise accounts can also use an API key from the [API and Console](/help/api-and-console). Every call is logged for 12 months, never the content or a key.`),
    A("connect-an-ai-assistant", "Connect an AI assistant to your account (Connect NotesApp)", "Teams and organisations", `
You can let an AI assistant such as Claude or ChatGPT work on your #NotesApp account: read your bookings, write journal drafts, answer booking requests. You decide exactly what it may do, and it never moves money.

**How to connect:** in your assistant, add a connector (some call it an MCP server) with our MCP address, \`https://mcp.${ROOT_DOMAIN}\` (the address for the domain you use is shown in Console → Connected agents). The assistant then sends you to the **Connect NotesApp** page, or shows you an 8-character code: type it at [/link](/link). Codes last ${ag.linkCodeMinutes} minutes and work once.

**Check the code.** The Connect page shows the code the assistant should be showing you. If they don't match, close the page: someone else may be trying to connect.

**What it can see:** your profile and plan, your journals and drafts, your bookings and open times, and your orders are on by default. Your **earnings** and your **messages** are off unless you switch them on. Clients' phone numbers, emails and street addresses are never shared.

**What it can do, and whether it asks you first:** save journal drafts (just saved, by default), publish journals (**always asks you**), reply to booking requests (asks, except thank-you confirmations to people who have paid), edit store items (off by default; **price changes always ask you**), mark orders as shipped (off by default). What needs you arrives in [Nana's inbox](/help/nanas-inbox) and on your phone.

**Money never moves through an assistant.** Refunds, payouts, withdrawals, Boost and purchases stay with you, and an assistant can spend ₦0.

**Limits:** actions a day (${n(ag.actionsPerDay)} by default; reading counts too; resets at midnight, Lagos time), the biggest discount it may mention (${money(ag.discountCapNaira * 100)} by default), and how long access lasts (${ag.accessDays} days by default; then it asks again).

**Afterwards:** Console → Connected agents shows each assistant, what it may do and everything it did (filters and a CSV download). Edit its permissions, pause it, or disconnect it there; disconnecting stops it at once. #NotesApp never asks for your password inside another app.`),
    A("nanas-inbox", "Nana's inbox: what Nana prepared, what she did, and her jobs", "Teams and organisations", `
Nana's inbox is where Nana, and any AI assistant you've connected, leave work for you to approve. It's pinned in **Messages** under Nana's conversation, and at [/nana/inbox](/nana/inbox).

**Needs you:** drafts and requests waiting for you: a reply to someone asking about a session (with your booking link), an answer to a customer's question, a journal to publish, a store change, an update for a buyer whose order hasn't shipped. Edit the text, make it shorter, warmer, more formal or Pidgin, then **Approve and send**, **Decline** or **Dismiss**. Anything you don't answer expires after ${days(ag.draftHours)}. Nothing leaves your account until you approve it.

**Done by Nana:** what was done for you, with **Undo**: a sent reply for ${ag.undoReplyMinutes} minute${ag.undoReplyMinutes === 1 ? "" : "s"}, and what Nana did on her own (like a thank-you to someone who booked and paid) for ${ag.undoAutoHours} hour${ag.undoAutoHours === 1 ? "" : "s"}.

**Nana's jobs (${operatorPlans}):** switch them on once, then choose: booking replies, the weekly summary (${DAYNAME[ag.weeklySummaryWeekday]}, ${String(ag.weeklySummaryHour).padStart(2, "0")}:00), customer questions, journal drafts from your notes (Nana never publishes) and shipping nudges (after ${ag.shipNudgeDays} day${ag.shipNudgeDays === 1 ? "" : "s"} unshipped). **Pause all** stops everything at once. On other plans you still get your connected assistants' requests here.

**Writes like you:** Nana learns how you write from your own messages and journals (never other people's). Read what she learnt, edit it in your own words, or ask her to learn again.

**Safe by design:** what customers write is shown to Nana as information, never as instructions; she can't send links, offer discounts or move money because a message asks her to. Nana uses your Nana allowance (or your own AI account if you connected one), and everything she does is in Console → Connected agents, kept for ${logKept}.`),
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
    A("staff-and-your-details", "Who at #NotesApp can see your email and phone", "Safety and your data", `
Our staff see only what their job needs. In our admin pages your email address and phone number are hidden by default (for example a•••i@gmail.com and ••• ••• 4567). Customer care, finance and the few others who may need one to help you must give a reason to show it, such as replying to your message, a refund or delivering an order. Every time, we record who looked, when and why, and the founder and our legal team review that record.

Bank account numbers for payouts are stored encrypted, and staff see only the last four digits. Read the [Privacy Policy](/privacy) for the full picture.`),
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
Not live yet, with no promised dates: the Enterprise course packages; the Notes Life pixel look and HD look with a city map; meetings bigger than 6 people; our own live streaming; publishing to Facebook, Instagram and TikTok (LinkedIn and X are live); AI drafting from your past notes (your AI assistant can already read #NotesApp through our MCP server); domain sales and DNS management inside #NotesApp; ${WALLET_LIVE ? "paid calls in Notes Life (the NotesApp Credit wallet itself is live)" : "NotesApp Credit and Bonus Credits"}; Paylony for real-money payments and Tap-to-Pay (Paylony CardTap already pays at every counter in Notes Life, with game money); WhatsApp reminders (with SMS when WhatsApp doesn't arrive); Send-Na, our email, WhatsApp and SMS service for developers and businesses, priced in Naira; fuller identity checks; and iOS and Android apps (being prepared, with NotesApp Inc, our US company); payments across Africa with Flutterwave (Kenya first, then Ghana) and bank transfers with Paylony. Details and the latest are on the [roadmap](/roadmap).

**Getting paid across borders** is being explored, with no date: paying and being paid between African countries and from abroad without losing so much to exchange rates and slow transfers, through a licensed payment partner's faster settlement network. You'd still pay and be paid in your own currency, with no crypto to hold, and nothing changes until lawyers confirm what each country allows. See the [Roadmap](/roadmap).

${ADD_ONS_LINE}`),
    A("anya-smart-glasses", "Anya smart glasses: Display, Nana and Audio (coming soon)", "Company", `
Anya ("eye" in Igbo) is the family of smart glasses from #NotesApp. There are three models:

- **Anya Display:** a screen in the lens, a side camera, microphones and open-ear speakers, controlled from the NotesApp app on your phone. It has Nana as an AI voice assistant, AI real-time translation in 139 languages, AI voice recording with live transcripts, smart image recognition, 1080p HD video, music playback, and a teleprompter in the lens for talks, lives and videos. It comes with a leather charging case, in black or brown, that shows the battery level on the front.
- **Anya Nana:** open-ear audio with Nana AI built in as your companion: hands-free questions and answers, AI real-time translation in 139 languages for travel and work, touch controls on the arm, built-in speakers for calls, music and your voice assistant, and Bluetooth to pair with your phone. It comes in black, pink or clear frames. It comes with a tan leather charging case.
- **Anya Audio:** open-ear audio for music, podcasts and hands-free calls, with extra-long-range Bluetooth and controls on the arm. It has no AI of its own and no camera; it works with your phone's voice assistant (Siri or Google Assistant). It comes with a black leather pouch to carry it in (the pouch doesn't charge).

Anya Display and Anya Nana charge in their cases while they're stored.

**Price and pre-orders:** not announced yet. To be among the first to try Anya, open [Anya](/anya) and tap **Register your interest**; it opens the contact form on the Anya topic. Registering is free and doesn't commit you to buy. We'll contact you before pre-orders open.
`),
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
    A("hub-new-task", "Adding a task on the team hub", `
Open [Team hub](/admin/team) and tap **+ New task** at the top. Give it a **Title** (required) and, if you like, **Details** (steps, context and links), a **Due date** (or tap Today, In 1 week or In 2 weeks), **When** (Today, This week, Later), a **Status**, who owns it, its departments and whether it **Repeats**. A **Blocked** task asks what it is blocked on and who can unblock it; a **Needs a decision** task asks what has to be decided. Tap **Add task**.

For a quick one, type the title in **Quick add** on the work board and tap **Add**; open the item afterwards to fill in the rest. The owner gets a bell and the due-date reminders (see [Using the team hub work board](/help/hub-work-board)).
`),
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
    A("nana-hr", "Nana-HR and hiring", `
**Nana-HR** is Nana inside the team hub, for staff: open [Nana-HR & hiring](/admin/team/hr) and ask about the Employee Handbook, your department's SOP manual and brief, or your own hours, timesheets, leave and pay. She answers only from those, ends with the document and section she used, and can't change anything: for a leave request or a timesheet fix she tells you where to do it and who decides. If our documents don't cover your question, she says so and points you to your team lead, then the C-suite, then the founder. She never sees or shares anyone else's records.

**Hiring** (super admins and the Chief of Staff): draft a role with its requirements; a super admin opens it on the public [careers page](/careers). Applications arrive on the role; **Summarise against the requirements** asks Nana-HR to mark each requirement met, not met or unclear with the applicant's own words, never a rank or a recommendation. Move an application to Interview, Offer or Not taken forward and the applicant is told. **Delete** removes a vacancy for good (a super admin, any role; the Chief of Staff, a draft): its applications go with it and anyone still in the running is told it was withdrawn; hired applicants and those who asked to be kept for future roles are kept. **Draft onboarding documents** fills the library's templates (offer letter, option grant, announcement) from the terms you enter; anything left blank stays as an [open point], Legal reviews, and the CEO (and, for options, the Board) signs. The library holds the handbook, SOPs and briefs where each belongs: open one and tap **Read**.`),
    A("hub-roles", "Staff roles and departments", `
Staff are either a **super admin** (sees everything) or an **admin** with one or more departments: Customer care, Trust & safety, Finance, Marketing & user acquisition, Sales & partnerships, Editorial, Product & tech, Engineering, Executive office, Legal & compliance. These match the department briefs: Marketing has the Marketing Brief and Sales & partnerships its own brief. An admin sees only the pages of their departments. At [Team access](/admin/access) the owner appoints and removes super admins, and other super admins appoint and remove admins and choose their departments. Until there is an HR team, the owner can also name a **Chief of Staff** (an admin): the Chief of Staff adds team members to any department, moves them between departments and removes their access, but can't change their own access, a super admin's, or make anyone a super admin. The person needs a #NotesApp account first. Nobody can change their own access or the owner's.`),
    A("hub-payout-otp", "Payouts that wait for a Paystack OTP", `
When "Transfers OTP" is on in Paystack, a payout that is released (by **Release** on [Payments & payouts](/admin/payments) or by the scheduled release) doesn't move until someone types the code Paystack emails the business. It shows at the top of Payments & payouts under **Awaiting OTP**, and as "awaiting OTP" in the table, with the amount, the publisher and the reference from Paystack's email (payout_…).

Type the 6-digit code in that payout's field and tap **Confirm**. Each code works only for its own payout, so with several waiting, each has its own field. A code lasts 30 minutes from when Paystack sent it (the time left is shown); if it has run out, or the email didn't come, tap **Resend OTP** and use the newest email. After 5 wrong codes, resend for a new one. Once confirmed, the payout follows the usual path: Paystack's result arrives by webhook and the entry becomes paid out (or back to held with the reason if it failed).

Finance only. Who confirmed or resent each code, and the result, is recorded; the code itself is never stored. To pay out with no OTP at all, the owner can switch Transfers OTP off in the Paystack dashboard (Settings → Preferences): safer to keep on, because then nobody with the API key alone can move money.`),
    A("hub-help-admin", "Writing help articles and reading Nana's chats", `
At [Help & Nana](/admin/help) the team writes the help articles that visitors read at the help centre and that Nana answers from. An article with the same address as a built-in one replaces it. The Chats tab shows what people asked Nana, highlights questions she could not answer and requests for a person (these also appear in the Leads inbox), and lets you mark a chat as followed up or turn a gap into a new article.`),
  ];
}
