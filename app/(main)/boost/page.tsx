import Link from "next/link";
import type { Metadata } from "next";
import { BOOST_PACKAGES } from "@/lib/boost-config";
import { formatNaira } from "@/lib/booking-time";
import BoostablePosts from "@/components/BoostablePosts";

export const metadata: Metadata = {
  title: "Boost",
  description:
    "Put a post in front of more readers. Pay only for validated impressions — real visitors who actually saw your post — delivered over several days, with a refund for anything undelivered.",
};

const STEPS = [
  { t: "Pick a post", d: "Any published post of yours — new or old. Or tick “Boost” in the composer as you publish." },
  { t: "Choose a package", d: "Buy a set number of impressions. Bigger packages cost less per impression." },
  { t: "We show it", d: "It rotates in the Boosted slots on the home page and Journals page for up to the package's window." },
  { t: "Pay for what's delivered", d: "Anything not delivered by the end is refunded pro-rata." },
];

export default function BoostPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Product</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">Boost a post. Pay for real attention.</h1>
      <p className="mt-5 max-w-2xl text-lg text-slate">
        Good writing still needs an audience. Boost puts your post in front of readers browsing #NotesApp — and you're
        charged for <strong className="text-ink">validated impressions</strong>, not clicks-you-hope-for or hours on a clock.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {BOOST_PACKAGES.map((p, i) => (
          <div key={p.id} className={`card flex flex-col p-7 ${i === 1 ? "!border-crimson" : ""}`}>
            <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">{p.name}</p>
            <p className="mt-3 font-display text-3xl text-ink">{formatNaira(p.priceKobo)}</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate">
              <li><strong className="text-ink">{p.impressions.toLocaleString()}</strong> validated impressions</li>
              <li>Delivered over at least {p.minDays} days (max {p.maxPerDay.toLocaleString()}/day)</li>
              <li>Runs up to {p.windowDays} days</li>
              <li className="font-mono text-xs">₦{(p.priceKobo / 100 / (p.impressions / 1000)).toLocaleString()} per 1,000</li>
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.t} className="border-t border-rule pt-4">
            <span className="font-mono text-xs text-crimson-bright">0{i + 1}</span>
            <h3 className="mt-1 font-ui text-base font-bold text-ink">{s.t}</h3>
            <p className="mt-1 text-sm text-slate">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="card mt-14 p-7">
        <p className="font-ui text-base font-bold text-ink">What counts as a validated impression</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate">
          <li>A real visitor had your boosted card at least half on screen for about one second.</li>
          <li>Counted once per visitor per boost per day — refreshing doesn't add impressions.</li>
          <li>Bots and crawlers don't count, and neither do your own views while signed in.</li>
          <li>A daily cap spreads delivery across several days instead of burning through in an hour.</li>
          <li>You can see impressions delivered and clicks under <Link href="/profile/publishing" className="text-crimson underline">Rates &amp; payouts</Link>.</li>
        </ul>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">Fair by design</p>
          <p className="mt-2 text-sm text-slate">
            Boost revenue has no commission — the price is the price. If a boost ends with impressions undelivered, the
            undelivered share is refunded to your card. One active boost per post; boosted posts are labelled “Boosted”.
          </p>
        </div>
        <div className="card p-6">
          <p className="font-ui text-sm font-bold text-ink">Who can boost</p>
          <p className="mt-2 text-sm text-slate">
            Any publisher, for their own published posts. Payment is by Paystack in Naira, and you need a verified email
            (see <Link href="/pricing" className="text-crimson underline">pricing</Link> for the full picture).
          </p>
        </div>
      </div>

      <BoostablePosts />
    </div>
  );
}
