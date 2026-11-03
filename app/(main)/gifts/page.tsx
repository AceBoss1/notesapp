import Link from "next/link";
import type { Metadata } from "next";
import { GIFT_MAX_KOBO, GIFT_MIN_KOBO, GIFT_PRESETS_NAIRA } from "@/lib/boost-config";
import { formatNaira } from "@/lib/booking-time";
import { TIERS, commissionRateFor, getTierConfig } from "@/lib/tiers";
import PageHero from "@/components/PageHero";
import MyCommission from "@/components/MyCommission";
import { pct } from "@/lib/pricing";
import { loadLivePricing } from "@/lib/pricing-server";
import GiftArt, { GiftArtStyles } from "@/components/GiftArt";
import { GIFT_SETTINGS, MOTIF_BLURB, enabledGifts, giftNaira, needsVerified, verifiedRuleText } from "@/lib/gift-catalogue";

export const metadata: Metadata = {
  title: "Gifts",
  description:
    "Say thanks to a publisher, a single post or a live with an animated gift or any amount in Naira. Paid through Paystack or NotesApp Credit, released to the publisher's bank account after a 7-day window. The most gifted creators each day are pinned at the top of Trending and Explore.",
};

const EXAMPLE_KOBO = 5_000 * 100;
// The rates are set in Admin → Pricing: applied on every render (the page used to be built once, with the defaults), redrawn each minute.
export const revalidate = 60;

export default async function GiftsPage() {
  await loadLivePricing();
  const publisherTiers = TIERS.filter((t) => t.canPublish && t.sessionAndUnlockCommission !== "custom");
  return (
    <>
      <PageHero eyebrow="Product" title={<>Say thanks. Send a gift.</>}>
        <p>A post helped you? A session changed something? Send the publisher a gift — on their profile, or on the exact post
        that mattered. No subscription, no commitment.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

      <GiftArtStyles />
      <h2 className="font-display text-3xl text-ink">Animated gifts</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate">
        {enabledGifts().length} of our own designs. Each plays full screen with its own mix of rays, stars, fireworks, confetti and sound, for
        the person you gift and everyone on their page when it arrives (and in a live, for everyone watching). Sound is off unless you
        switch it on. Gifts {verifiedRuleText()} are for verified senders{GIFT_SETTINGS.grand.announce ? ", and each is announced to everyone on #NotesApp with a link to come and watch" : ""}.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {enabledGifts().map((g) => (
          <li key={g.id} className="card flex flex-col items-center p-4 text-center">
            <GiftArt id={g.id} size={84} title={g.name} />
            <span className="mt-2 font-ui text-sm font-bold text-ink">{g.name}</span>
            <span className="text-xs text-slate">{MOTIF_BLURB[g.id]}</span>
            <span className="mt-1 font-display text-xl text-crimson">{giftNaira(g.priceKobo)}{needsVerified(g) ? <span className="ml-1 align-middle font-ui text-[11px] text-slate" title="Needs a verified account">✔</span> : null}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-3">
        {GIFT_PRESETS_NAIRA.map((n) => (
          <span key={n} className="rounded-full border border-rule px-5 py-2 font-mono text-sm text-ink">
            {formatNaira(n * 100)}
          </span>
        ))}
        <span className="rounded-full border border-crimson px-5 py-2 font-mono text-sm text-crimson">or any amount from {formatNaira(GIFT_MIN_KOBO)} up to {formatNaira(GIFT_MAX_KOBO)}</span>
      </div>
      <p className="mt-3 text-xs text-slate">Gifts marked ✔ ({verifiedRuleText()}) are VIP gifts and need a verified account to send; the rest are premium gifts. On animated gifts #NotesApp takes the creator&apos;s normal commission plus {GIFT_SETTINGS.uplift.premiumPct}% of it (premium) or {GIFT_SETTINGS.uplift.vipPct}% of it (VIP); a gift of a typed amount keeps the normal rate.</p>

      <div className="card mt-10 border-[#E8B23A]/60 bg-gradient-to-br from-[#FFF6E0] to-paper p-7">
        <p className="font-ui text-base font-bold text-ink">🎁 Top gifted today</p>
        <p className="mt-2 text-sm text-slate">
          Receive {formatNaira(GIFT_SETTINGS.daily.targetKobo)}{GIFT_SETTINGS.daily.basis === "net" ? " after commission" : ""} or more in gifts in one day (midnight to midnight, Lagos time) from at
          least {GIFT_SETTINGS.daily.minSenders} different people, and you&apos;re pinned at the top of <Link href="/trending" className="text-crimson underline">Trending</Link> and{" "}
          <Link href="/explore" className="text-crimson underline">Explore</Link> for the rest of the day. The {GIFT_SETTINGS.daily.slots} creators who received the most are shown; with
          the same amount, whoever got there first. Gifts in a live count too. Gifts to yourself never count, and members in teen mode only appear there for people who follow them.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { t: "Find Gift me", d: "Every publisher profile has a Gift me button, and every post a 🎁 (when the publisher accepts gifts). If Gift me is greyed out, the publisher hasn't set up payouts yet: the ℹ️ beside it explains." },
          { t: "Choose a gift", d: "Pick an animated gift or type your own amount, add a short message, or send anonymously." },
          { t: "Pay in Naira", d: "Card, bank transfer or USSD through Paystack, or your NotesApp Credit wallet. The publisher is notified by app and email." },
        ].map((s, i) => (
          <div key={s.t} className="card p-6">
            <span className="font-mono text-xs text-crimson-bright">Step {i + 1}</span>
            <h3 className="mt-2 font-ui text-lg font-bold text-ink">{s.t}</h3>
            <p className="mt-2 text-sm text-slate">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="card mt-12 p-7">
        <p className="font-ui text-base font-bold text-ink">For publishers: what you keep</p>
        <p className="mt-2 text-sm text-slate">
          NotesApp takes the same commission on gifts as on sessions and subscriptions, set by your tier. On a{" "}
          {formatNaira(EXAMPLE_KOBO)} gift:
        </p>
        <ul className="mt-3 divide-y divide-rule text-sm">
          {publisherTiers.map((t) => {
            const rate = commissionRateFor(t.tier);
            const net = EXAMPLE_KOBO - Math.round(EXAMPLE_KOBO * rate);
            return (
              <li key={t.tier} className="flex justify-between py-2">
                <span className="text-ink">{t.label}</span>
                <span className="text-slate">
                  you keep {formatNaira(net)} <span className="font-mono text-xs">({pct(rate)} commission)</span>
                </span>
              </li>
            );
          })}
          <li className="flex justify-between py-2">
            <span className="text-ink">Enterprise</span>
            <span className="text-slate">agreed with us (from {pct(getTierConfig("enterprise").sessionAndUnlockCommissionFloor ?? 0.05)} commission)</span>
          </li>
        </ul>
        <MyCommission kind="gift" className="mt-3 text-sm font-semibold text-ink" />
        <p className="mt-3 text-xs text-slate">
          Community giving (gifts to a community&apos;s funds) is different: no commission, only a flat charge like a bank transfer; see{" "}
          <Link href="/help/giving" className="text-crimson underline">Giving to a community</Link>.
        </p>
        <p className="mt-3 text-xs text-slate">
          Gifts are released to your verified bank account 7 days after they're received (a short dispute window).
          You'll see them under Earnings in <Link href="/profile/publishing" className="text-crimson underline">Rates &amp; payouts</Link>,
          where you can also switch gifts on or off.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">Good to know</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate">
            <li>You can't gift yourself, and gifts need a verified email.</li>
            <li>Anonymous gifts hide your name from the publisher — we still keep the record for safety.</li>
            <li>Gifts are final unless there's a problem. Report one to us and an admin will review it.</li>
          </ul>
        </div>
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">Want to receive gifts?</p>
          <p className="mt-2 text-sm text-slate">
            Add a verified bank account under Rates &amp; payouts and Gift me switches on on your profile, with the gift button on every post,
            automatically.
          </p>
          <Link href="/profile/publishing" className="mt-3 inline-block text-sm text-crimson underline underline-offset-2">
            Set up payouts →
          </Link>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link href="/trending" className="btn-primary">Find someone to thank</Link>
        <p className="mt-3 text-xs text-slate">
          Or browse <Link href="/journals" className="underline">Journals</Link>. Want to promote a post instead?{" "}
          <Link href="/boost" className="underline">Boost it</Link>.
        </p>
      </div>
    </div>
    </>
  );
}
