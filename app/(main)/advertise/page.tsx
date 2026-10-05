import Link from "next/link";
import type { Metadata } from "next";
import { AD_PACKAGES } from "@/lib/ad-packages";
import { formatNaira } from "@/lib/booking-time";

export const metadata: Metadata = {
  title: "Advertise",
  description:
    "Buy a banner campaign on #NotesApp, paid online and priced by validated impressions. Ads come with a revenue share built in: Pro and Business publishers earn 25% and 45%.",
};

export default function AdvertisePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Advertise</span>
      <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">
        Advertise on #NotesApp
      </h1>
      <p className="mt-5 text-lg text-slate">
        Ads on #NotesApp come with a revenue share built in from day
        one — not something a professional has to unlock, earn, or
        wait for.
      </p>

      <div className="card mt-10 border-crimson p-7">
        <p className="font-ui text-base font-bold text-ink">Buy a banner campaign</p>
        <p className="mt-2 text-sm text-slate">
          Pay online for a block of validated impressions (unique per visitor per ad per day). We review every ad; if we can&apos;t run it, you&apos;re refunded in full,
          and any impressions not delivered by the end date are refunded pro rata.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {AD_PACKAGES.map((p) => (
            <div key={p.id} className="border border-rule p-3">
              <p className="font-display text-lg text-ink">{p.name}</p>
              <p className="text-sm text-ink">{formatNaira(p.priceKobo)}</p>
              <p className="text-xs text-slate">{p.impressions.toLocaleString()} impressions · up to {p.windowDays} days</p>
            </div>
          ))}
        </div>
        <Link href="/advertise/new" className="btn-primary mt-4 inline-block">Start a campaign</Link>
        <Link href="/advertise/campaigns" className="ml-4 text-sm text-crimson underline underline-offset-2">My campaigns</Link>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="card p-6">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            Free journals
          </p>
          <p className="mt-3 font-display text-2xl text-ink">Ads shown</p>
          <p className="mt-2 text-sm text-slate">No revenue share.</p>
        </div>
        <div className="card p-6 !border-crimson">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            Pro tier
          </p>
          <p className="mt-3 font-display text-2xl text-ink">25% ad share</p>
          <p className="mt-2 text-sm text-slate">
            If you opt in to showing ads on your pages.
          </p>
        </div>
        <div className="card p-6 !border-crimson">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-crimson-bright">
            Business tier
          </p>
          <p className="mt-3 font-display text-2xl text-ink">45% ad share</p>
          <p className="mt-2 text-sm text-slate">
            If you opt in to showing ads on your pages.
          </p>
        </div>
      </div>

      <div className="card mt-10 p-7">
        <p className="font-ui text-base font-bold text-ink">
          No gated conditions
        </p>
        <p className="mt-2 text-sm text-slate">
          Most platforms make you hit a follower count, a view
          threshold, or an approval process before you can earn from
          ads. #NotesApp's Pro and Business tiers get their ad share
          from the day they opt in — no waiting period, no audience
          minimum.
        </p>
      </div>

      <div className="card mt-6 p-7">
        <p className="font-ui text-base font-bold text-ink">
          Who can buy an ad
        </p>
        <p className="mt-2 text-sm text-slate">
          Anyone — a #NotesApp user or not, on the free tier or a paid
          one. Advertising on the platform isn't restricted to members.
        </p>
      </div>

      <div className="card mt-6 border-crimson p-7">
        <p className="font-ui text-base font-bold text-ink">Want reach today? Boost a post.</p>
        <p className="mt-2 text-sm text-slate">
          Publishers can already pay to promote a post — priced by validated impressions, delivered over several days.
        </p>
        <Link href="/boost" className="mt-3 inline-block text-sm text-crimson underline underline-offset-2">
          See Boost packages →
        </Link>
      </div>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">How ads will appear</p>
        <p className="mt-2 text-sm text-slate">
          Banners rotate across #NotesApp — the home, Journals and Trending pages, and on publisher profiles and at the end of posts.
          Free journals always carry them; Pro and Business publishers choose whether to show them (and earn their share if they do).
          Every ad is labelled with who it&apos;s from — <strong>Sponsored: NotesApp Ads</strong> for our own banners, and the
          matching Google, Meta or AdMob label if and when those networks are switched on (AdMob arrives with our iOS and Android apps — see the{" "}
          <Link href="/roadmap" className="text-crimson underline">roadmap</Link>).
        </p>
      </div>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">How ad share is calculated and paid</p>
        <p className="mt-2 text-sm text-slate">
          Once a month we take the ad revenue we actually received and divide it by every valid impression served — that&apos;s the
          revenue per impression. Your share is the impressions on <em>your</em> pages × that rate × your plan&apos;s share (Pro 25%,
          Business 45%). You see a statement on Rates &amp; payouts; once it&apos;s reviewed and approved it&apos;s held for 30 days and then
          paid to your verified bank account. Amounts under ₦1,000 roll into the next month.
        </p>
      </div>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">Fair counting</p>
        <p className="mt-2 text-sm text-slate">
          Ad share is based on <strong>unique views and clicks by real visitors</strong>, not raw page loads: one view and one click per
          visitor per ad per day, and a click only counts after that visitor has seen the ad. Payouts are held for a review period, and
          share can be withheld for invalid activity (clicking your own ads, bots, paid clicks). See Terms 5d.
        </p>
      </div>

      <div className="card mt-6 p-6">
        <p className="font-ui text-sm font-bold text-ink">Co-authored posts</p>
        <p className="mt-2 text-sm text-slate">
          When a post has co-authors, the ad share it earns is divided between its authors in the percentages the lead author
          set and every co-author accepted <em>before</em> publishing; the split is locked once the post is live. Each author
          is paid at their own plan&apos;s ad-share rate on their portion. (Ad views and clicks are counted per publisher and paid out monthly as above.)
        </p>
      </div>

      <p className="mt-10 text-sm text-slate">
        Google, Meta and AdMob placements are still on the{" "}
        <Link href="/roadmap" className="text-crimson underline underline-offset-2">roadmap</Link>. Questions about advertising?{" "}
        <Link href="/contact" className="text-crimson underline underline-offset-2">Get in touch</Link>.
      </p>
    </div>
  );
}
