import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { SHIPMENT_SERVICES } from "@/lib/shipments";

export const metadata: Metadata = {
  title: "For logistics businesses: tracking and your own website",
  description: "Delivery, waybill, warehousing and home or office errand businesses: book shipments, hand them rider to rider with no-login update links, and give customers a website with Home, Blog, Track and Contact pages on your own domain. On the Business and Enterprise plans.",
};

const STARTER = `Hello #NotesApp team,

We're a logistics business and we'd like to use shipments and tracking.

Business name:
What we do (deliveries, waybills, warehousing, home or office errands):
City:
Riders or agents on the team:
Our domain (if we have one):
Phone or WhatsApp:
`;

// Selling shipments and tracking to small logistics businesses (lib/shipments.ts). Prices are on /pricing (the Business plan), so
// nothing here goes stale when they change.
export default function LogisticsPage() {
  return (
    <>
      <PageHero eyebrow="For logistics businesses" title={<>Tracking your customers can follow, and a website that&apos;s yours</>}>
        <p>Run deliveries, waybills, warehousing, or home and office errands? Whether you do one of them or all of them: book every job, hand it rider to rider with a link that needs no app or account, and let customers follow it on your own site, at your own domain.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="rounded-full bg-paper px-6 py-3 font-ui text-sm font-bold text-crimson-deep hover:opacity-90">Get Business</Link>
          <Link href={`/contact?topic=store&message=${encodeURIComponent(STARTER)}`} className="rounded-full border border-paper/60 px-6 py-3 font-ui text-sm font-bold text-paper hover:bg-paper/10">Talk to us</Link>
        </div>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl text-ink">Your website: Home, Blog, Track, Contact</h2>
        <p className="mt-3 text-sm text-slate">Business and Enterprise accounts get <Link href="/profile/site" className="text-crimson underline">Your site</Link>, with a choice of themes, on your own domain (such as <code>track.yourcompany.ng</code> or <code>yourcompany.ng</code>):</p>
        <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Home", "Who you are and your services, with a box to type a tracking number right under your logo."],
            ["Blog", "Your journals: delivery tips, new routes, holiday cut-off dates. Published from #NotesApp, shown on your site."],
            ["Track", "Customers enter the tracking number and see where their parcel is, who has it and every hand-off. Only your shipments show there."],
            ["Contact", "Your phone, WhatsApp, office address and opening hours, written in the same editor as your blog."],
          ].map(([h, t]) => <li key={h} className="card p-4"><strong className="text-ink">{h}</strong><p className="mt-1 text-slate">{t}</p></li>)}
        </ul>

        <h2 className="mt-12 font-display text-2xl text-ink">How a shipment works</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate">
          <li className="card p-4"><strong className="text-ink">1. Book it.</strong> On <Link href="/shipments" className="text-crimson underline">Shipments</Link>, choose the service and enter what&apos;s being sent, the sender, where it&apos;s picked up, and the receiver&apos;s name, phone and address. You get a tracking number like <code>NA-7K2M9QXD</code>.</li>
          <li className="card p-4"><strong className="text-ink">2. Send the receiver their link.</strong> One tap opens WhatsApp (or SMS) with a message from your business: the tracking number and a link to your Track page.</li>
          <li className="card p-4"><strong className="text-ink">3. Hand it on.</strong> Record the rider, bus driver or park agent who has it and send them an update link. From that link they update the location, hand it to the next person and mark it delivered, with no app and no account. Each link stops working once the next person confirms.</li>
          <li className="card p-4"><strong className="text-ink">4. Delivered.</strong> The rider or your office marks it delivered, and the tracking page says so. You get a bell at every hand-off and at delivery.</li>
        </ol>

        <h2 className="mt-12 font-display text-2xl text-ink">Your services, your choice</h2>
        <p className="mt-3 text-sm text-slate">An errands company ticks errands; a full logistics company ticks everything. Only what you tick can be booked, and your site lists it. Warehoused goods show as &ldquo;In storage&rdquo; until you despatch them; errands read &ldquo;On the way&rdquo; and &ldquo;Done&rdquo;.</p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {SHIPMENT_SERVICES.map((s) => <li key={s.id} className="card p-3"><span className="font-semibold text-ink">{s.name}</span><span className="block text-xs text-slate">{s.blurb}</span></li>)}
        </ul>

        <h2 className="mt-12 font-display text-2xl text-ink">Your team</h2>
        <p className="mt-3 text-sm text-slate">Make your account an <Link href="/organisations" className="text-crimson underline">organisation</Link> and give dispatch staff store access: they book shipments and record hand-offs under your business&apos;s name. Riders don&apos;t need accounts at all.</p>

        <h2 className="mt-12 font-display text-2xl text-ink">Privacy</h2>
        <p className="mt-3 text-sm text-slate">The receiver&apos;s phone number and delivery address are only for you and your team. The public Track page shows the item, the service, where it was picked up, the destination city and each hand-off. A rider&apos;s phone number shows only if they agreed, and only to someone who enters the last 4 digits of the receiver&apos;s phone number.</p>

        <h2 className="mt-12 font-display text-2xl text-ink">What it costs</h2>
        <p className="mt-3 text-sm text-slate">Shipments, tracking and Your site come with the Business and Enterprise plans. See <Link href="/pricing" className="text-crimson underline">Plans and prices</Link>. Deliveries are paid: you set your delivery prices and your customers pay them. (Only digital items never need shipping.)</p>
      </div>
    </>
  );
}
