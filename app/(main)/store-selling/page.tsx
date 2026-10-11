import Link from "next/link";
import type { Metadata } from "next";
import { TIERS, formatPercent } from "@/lib/tiers";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Sell physical goods & digital downloads",
  description: "Sell physical goods, digital downloads and view-only video courses from your #NotesApp store: buyers pay on-platform, the money is held until delivery is confirmed, and every parcel gets a tracking ID.",
};

export default function StoreSellingPage() {
  return (
    <>
      <PageHero eyebrow="Stores" title={<>Sell physical goods and digital downloads from your store</>}>
        <p>Your store at <code>/u/yourname/store</code> sells physical items through #NotesApp checkout — the buyer&apos;s money is held until the parcel arrives, and every
        order gets a parcel ID anyone can track. (Stores don&apos;t link out to other shops; your profile link and the links in your posts are where you point people elsewhere.)</p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">

      <h2 className="mt-12 font-display text-2xl text-ink">How a sale works</h2>
      <ol className="mt-4 space-y-3 text-sm text-slate">
        <li className="card p-4"><strong className="text-ink">1. List it.</strong> On your store page, add an item and tick &ldquo;Sell this physical item through #NotesApp checkout&rdquo;. Set the price, your delivery fee and your stock count. Stock goes down with every order (we reserve a buyer&apos;s quantity for 30 minutes while they pay); at zero nobody can order, and people who tapped &ldquo;Notify me&rdquo; get a bell alert when you restock. You need a payout account under Rates &amp; payouts.</li>
        <li className="card p-4"><strong className="text-ink">2. The buyer pays here</strong>, with their delivery address. They get a parcel ID (like <code>NA-7K2M9QXD</code>) by email.</li>
        <li className="card p-4"><strong className="text-ink">3. You dispatch and keep the log.</strong> By courier: enter the courier, tracking number and link — buyers get an &ldquo;Open tracking&rdquo; button. By bike, bus or motor park: record who holds the parcel and where, with their phone number if they agree. Holders can update the location and hand on to the next holder from a short no-login link that stops working the moment the next person confirms they have it. You can also just call them and update it yourself.</li>
        <li className="card p-4"><strong className="text-ink">4. Delivery is confirmed.</strong> Your payout is released when the buyer confirms it arrived, or 7 days after you mark it delivered if they say nothing. If the buyer reports a problem, the money stays held while we review.</li>
      </ol>

      <h2 className="mt-12 font-display text-2xl text-ink">What we take</h2>
      <p className="mt-3 text-sm text-slate">A commission on the item price only — your delivery fee is yours:</p>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {TIERS.filter((t) => t.canPublish).map((t) => (
          <li key={t.tier} className="card flex items-center justify-between p-3"><span className="text-ink">{t.label}</span><span className="font-mono text-crimson-bright">{formatPercent(t.physicalCommission, t.physicalCommissionFloor)}</span></li>
        ))}
      </ul>

      <h2 className="mt-12 font-display text-2xl text-ink">Digital downloads</h2>
      <p className="mt-3 text-sm text-slate">
        Sell a file instead of a parcel: choose &ldquo;Digital download&rdquo; when you add the item and upload it (PDF, ePub, ZIP, audio, video, Office files, images; up to 200 MB). It is stored privately — only people who pay can download it.
        The buyer gets it the moment they pay, no shipping or tracking, and the sale is <strong className="text-ink">final once they download it</strong> (no refunds). Your share is paid to your bank after a 7-day dispute window. Commission on the price:
      </p>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {TIERS.filter((t) => t.canPublish).map((t) => (
          <li key={t.tier} className="card flex items-center justify-between p-3"><span className="text-ink">{t.label}</span><span className="font-mono text-crimson-bright">{formatPercent(t.digitalCommission, t.digitalCommissionFloor)}</span></li>
        ))}
      </ul>

      <h2 id="view-only" className="mt-12 font-display text-2xl text-ink">View-only files and video courses</h2>
      <p className="mt-3 text-sm text-slate">
        On Pro and above, choose &ldquo;View only&rdquo; when you add a digital item. Instead of one downloadable file you add <strong className="text-ink">lessons</strong>: videos (hosted on Cloudflare Stream and played only with short-lived, per-buyer links) and PDFs (drawn in the page). One lesson is a single view-only file; several make a course, with a lesson list and the order you set.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate">
        <li>There is no download button and no file link. The buyer&apos;s email is stamped faintly over the video and each PDF page, and right-click and printing are blocked.</li>
        <li><strong className="text-ink">Two devices per purchase</strong>, with as many sessions as the buyer likes on those two. A third device is refused, the buyer sees &ldquo;Blocked attempt #n&rdquo;, and every attempt is counted. A buyer who loses a device can remove it, up to twice in 30 days.</li>
        <li>Like a download, the sale is final once the buyer first opens it. Your share is paid after the usual 7-day window.</li>
        <li>Honest limits: nothing on a screen can be made impossible to copy — someone determined can record their screen. This stops casual saving and sharing, and ties each purchase to one buyer and two devices.</li>
      </ul>

      <h2 className="mt-12 font-display text-2xl text-ink">Boost your items</h2>
      <p className="mt-3 text-sm text-slate">
        Any item can be boosted from your store page with the same packages as post boosts — it then rotates in the Boosted strips and at the top of your store page. See <Link href="/boost" className="text-crimson underline">Boost</Link>.
      </p>

      <h2 className="mt-12 font-display text-2xl text-ink">Organisations</h2>
      <p className="mt-3 text-sm text-slate">
        An organisation&apos;s store is run by its owner, who can also give team members store access (<Link href="/organisations" className="text-crimson underline">Organisation team</Link>). The money, payouts and
        liability stay with the organisation either way.
      </p>

      <h2 className="mt-12 font-display text-2xl text-ink">Who&apos;s responsible</h2>
      <p className="mt-3 text-sm text-slate">
        You are the seller and arrange delivery; #NotesApp isn&apos;t the carrier. Holders&apos; phone numbers are shown only to the buyer, to you, or to someone who gives the parcel ID
        <em> and</em> the last four digits of the receiver&apos;s phone number — and only if the holder agreed. Read <Link href="/terms" className="text-crimson underline">Terms 5g</Link>.
      </p>
      <p className="mt-6 text-sm text-slate"><Link href="/track" className="text-crimson underline">Track a parcel</Link> · <Link href="/pricing" className="text-crimson underline">Pricing</Link></p>
    </div>
    </>
  );
}
