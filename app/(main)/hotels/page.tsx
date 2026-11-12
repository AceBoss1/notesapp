import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import HotelSetupForm from "@/components/hotel/HotelSetupForm";
import { ADDONS, TIER_INFO, type HotelTier } from "@/lib/hotel";
import { planPrice, enterpriseFrom } from "@/lib/pricing";
import { loadLivePricing } from "@/lib/pricing-server";

export const metadata: Metadata = {
  title: "Hotel kit",
  description: "A whole hotel on #NotesApp: the hotel's website, room bookings, orders from every department, payment online or at the counter, a live staff board, a kitchen screen and tills.",
};

// The public page for the Hotel kit (docs/HOTEL_KIT.md): what it does, the three tiers on the plans we already sell, the add-ons, and the
// "Set it up for me" request (it reaches our team in Admin → Leads). Add-on prices, the department limit and the hold and late times are
// Admin settings, so they aren't written here; the plan prices are read live.
export const revalidate = 60;
const DOES = [
  { t: "The hotel's own website", d: "Rooms with live availability, each department's menu, your gallery, where to find you and what guests say. On your own domain from Business." },
  { t: "Book and pay", d: "A room is held while the guest pays, then goes back on sale. Pay by card, bank or USSD online, by transfer to the booking's own account, or at the front desk if you allow it." },
  { t: "Order from any department", d: "Restaurant, grill, bakery, bar or lounge, to a room, a table or for pick-up. A checked-in guest can put it on the room bill." },
  { t: "A live staff board", d: "Orders move from Paid to Cooking to Ready to Done, as they land. Managers see today's takings and how full the rooms are." },
  { t: "A kitchen screen", d: "Big tickets, a sound and a spoken alert for each new order, and late orders in red." },
  { t: "Tills and cash-up", d: "Each till has its own PIN and one department. At close, the cash-up compares the till with what's in the drawer and on the card machine." },
  { t: "Money that stays right", d: "Only a payment the provider confirms marks anything paid. Late money is kept and flagged. The room bill is settled at checkout. Every sale goes into Business books." },
  { t: "Order by chatting with Nana", d: "On Grand, Nana takes orders and bookings in English, Pidgin, Yorùbá, Igbo and Hausa. Prices and account numbers come only from your own records." },
];

export default async function HotelsPage() {
  await loadLivePricing();
  const plan = (t: HotelTier) => (t === "starter" ? `Pro, ${planPrice("pro")} a month` : t === "standard" ? `Business, ${planPrice("business")} a month` : `Enterprise, from ${enterpriseFrom()} a month`);
  const what: Record<HotelTier, string> = {
    starter: "Hotel website · rooms and online booking · menus and orders for one department · pay online · booking and order bells · Business books",
    standard: "Everything in Starter · several departments · live staff board · kitchen screen · tills with PINs and cash-up · stock (Inventory) · charge to the room bill · own domain · staff roles by department",
    grand: "Everything in Standard · several branches with one owner view · Nana chat ordering on the website · Conversations · monthly reports by branch and department · priority help",
  };
  return (
    <>
      <PageHero eyebrow="🏨 Hotel kit" title={<>A whole hotel, in one place</>}>
        <p>Your hotel&apos;s website, room bookings, food and drink orders from every department, payment online or at the counter, a live staff board, a kitchen screen and tills.</p>
        <p className="mt-3"><Link href="/profile/hotel" className="inline-flex rounded-full border border-paper/70 bg-paper/10 px-6 py-3 font-ui text-sm font-semibold !no-underline hover:bg-paper/20">Open Your hotel</Link></p>
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="eyebrow">What it does</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOES.map((w) => <li key={w.t} className="card p-5"><p className="font-ui font-bold text-ink">{w.t}</p><p className="mt-1 text-sm text-slate">{w.d}</p></li>)}
        </ul>

        <p className="eyebrow mt-12">Three tiers, on the plans you already know</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {(Object.keys(TIER_INFO) as HotelTier[]).map((t) => (
            <div key={t} className={`card p-5 ${t === "standard" ? "border-2 border-crimson" : ""}`}>
              <p className="flex justify-between font-ui font-bold text-ink"><span>{TIER_INFO[t].emoji} {TIER_INFO[t].name}</span></p>
              <p className="text-xs font-semibold text-crimson">On {plan(t)}</p>
              <p className="mt-2 text-sm text-slate">{what[t]}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate">No new subscription: each tier is what its plan costs. <Link href="/pricing" className="font-semibold text-crimson">Compare the plans</Link></p>

        <p className="eyebrow mt-12">Add-ons, on any tier, by the month</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADDONS.map((a) => <li key={a.id} className="card p-5"><p className="font-ui font-bold text-ink">{a.emoji} {a.name}</p><p className="mt-1 text-sm text-slate">{a.blurb}</p></li>)}
        </ul>
        <p className="mt-3 text-sm text-slate">Add-on prices are shown in Your hotel before you pay. <Link href="/help/hotel-kit" className="font-semibold text-crimson">Help: the Hotel kit</Link></p>

        <section id="setup" className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">🧰 Set it up for me</p>
            <h2 className="mt-2 font-display text-3xl text-ink">We&apos;ll fill in your Hotel kit</h2>
            <p className="mt-2 text-slate">Send us your hotel&apos;s details and our team gets in touch to put in your rooms, prices, menus, photos and words, so you open ready.</p>
          </div>
          <HotelSetupForm />
        </section>
      </div>
    </>
  );
}
