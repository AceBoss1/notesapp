import Link from "next/link";
import type { Metadata } from "next";
import { GIFT_PRESETS_NAIRA } from "@/lib/boost-config";
import { formatNaira } from "@/lib/booking-time";
import { TIERS, commissionRateFor } from "@/lib/tiers";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Gifts",
  description:
    "Say thanks to a publisher — or to a single post — with a gift from ₦200 to ₦500,000. Paid in Naira through Paystack, released to the publisher's bank account after a 7-day window.",
};

const EXAMPLE_KOBO = 5_000 * 100;

export default function GiftsPage() {
  const publisherTiers = TIERS.filter((t) => t.canPublish && t.sessionAndUnlockCommission !== "custom");
  return (
    <>
      <PageHero eyebrow="Product" title={<>Say thanks. Send a gift.</>}>
        <p>A post helped you? A session changed something? Send the publisher a gift — on their profile, or on the exact post
        that mattered. No subscription, no commitment.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

      <div className="mt-8 flex flex-wrap gap-3">
        {GIFT_PRESETS_NAIRA.map((n) => (
          <span key={n} className="rounded-full border border-rule px-5 py-2 font-mono text-sm text-ink">
            {formatNaira(n * 100)}
          </span>
        ))}
        <span className="rounded-full border border-crimson px-5 py-2 font-mono text-sm text-crimson">or any amount up to ₦500,000</span>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { t: "Find the 🎁", d: "Every publisher profile and every post has a Gift button (when the publisher accepts gifts)." },
          { t: "Choose an amount", d: "Pick a preset or type your own, add a short message, or send anonymously." },
          { t: "Pay with Paystack", d: "Card, bank transfer or USSD in Naira. The publisher is notified by app and email." },
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
                  you keep {formatNaira(net)} <span className="font-mono text-xs">({Math.round((1 - rate) * 100)}%)</span>
                </span>
              </li>
            );
          })}
          <li className="flex justify-between py-2">
            <span className="text-ink">Enterprise</span>
            <span className="text-slate">negotiated (from 5% commission)</span>
          </li>
        </ul>
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
            Add a verified bank account under Rates &amp; payouts and the Gift button appears on your profile and every post
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
