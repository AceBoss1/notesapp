import type { Metadata } from "next";
import Image from "next/image";
import { CANDELLUX, DIGITAL_WITCH, ITEL, REAL_PARTNER } from "@/lib/life/catalog";

export const metadata: Metadata = {
  title: "Partner with Notes Life",
  description: "Put your brand in Notes Life, the free NotesApp life game: your own place in Notesville, jobs, outlets players can own, billboards and links to your real shop. Meet our partners: Chef Adams, itel Energy, Candellux Imperial and Digital Witch.",
  alternates: { canonical: "https://life.notesapp.name.ng/partners" },
  openGraph: { title: "Partner with Notes Life", description: "Your brand, in the game players live in.", images: ["/images/life/shots/chef-desktop.webp"] },
};

const PLAY = "https://www.notesapp.name.ng/life/play";
const HOME = "https://life.notesapp.name.ng";
// The main site's contact form, opened on the Partnership topic with a starter message the business fills in before sending.
const STARTER = `Hello NotesApp team,

We'd like to partner with Notes Life.

Business name:
What we sell or offer:
City:
What we'd like in the game (a shop or place, jobs, outlets players can own, billboards):
Phone or WhatsApp:
`;
const CONTACT = `https://www.notesapp.name.ng/contact?topic=partnership&message=${encodeURIComponent(STARTER)}`;

const perks: [string, string, string][] = [
  ["🏪", "Your place in Notesville", "A shop, restaurant or hotel in the game, built in your colours with your logo and real products or services."],
  ["💼", "Jobs with your name", "Players take shifts at your business: attendants, cooks, technicians, front desk. Your brand becomes part of their day."],
  ["🤝", "Outlets players can own", "Players earn their way to their own outlet of your brand, with your standards, and see how your real franchise or store works."],
  ["📣", "Billboards", "Your adverts on the roads players travel every day. A tap opens your shop, your menu or your offer."],
  ["🔗", "Real sales, one tap away", "Every partner panel links to your real store on NotesApp, your WhatsApp or your booking page."],
  ["🤖", "Residents who talk about you", "The game's residents mention your products in their chats: food tips, NEPA tips, work tips."],
];

const partners: { name: string; logo: string; logoClass: string; shot: string; where: string; what: string[]; real: { href: string; label: string }[]; tone: string; feature?: { bg: string; photo: string; person: string } }[] = [
  {
    name: "Chef Adams", logo: "/images/life/partners/chef-emblem.webp", logoClass: "h-14 w-14 object-contain", shot: "/images/life/shots/chef-desktop.webp", where: "Food · Wuse, Abuja", tone: "#292929",
    what: ["Delivery, takeaway and dine-in, with the real Chef Adams menu: rice, shawarma, pizza and Sum Ting Fresh smoothies", "Jobs: kiosk attendant, line cook, delivery rider, outlet supervisor", "Become a Partner: a Takeaway Kiosk from N$ 2.5m or a Mini Dine-In Shop from N$ 8.0m", "Billboards on the street"],
    real: [{ href: "https://www.notesapp.name.ng/u/chef_adams", label: "@chef_adams on NotesApp" }, { href: REAL_PARTNER.chef_adams, label: "Own a Chef Adams franchise" }],
  },
  {
    name: "itel Energy", logo: "/images/life/partners/itel-logo.svg", logoClass: "h-12 w-auto", shot: "/images/life/shots/itel-desktop.webp", where: "Solar and power · Wuse market road", tone: "#FF073C",
    what: ["Power GO Pro, Power Tank 1000 and solar panels that keep players going when NEPA takes light", "Jobs: sales attendant, CarlCare technician, solar installer, store supervisor", "Become a Partner: an itel Home Store from N$ 1.5m or a Mall Store from N$ 7.0m", "Billboards on the roads and at the shop"],
    real: [{ href: ITEL.sellerUrl, label: `Shop @${ITEL.seller}, the itel distributor` }, { href: REAL_PARTNER.itel, label: "itel Home" }],
  },
  {
    name: "Candellux Imperial Hotel & Suites", logo: "/images/life/partners/candellux-logo.webp", logoClass: "h-14 w-14 rounded-full object-cover", shot: "/images/life/shots/hotel-desktop.webp", where: "Hotel · Garki, Abuja", tone: "#262b6b",
    what: ["The hotel built from the real Candellux, by day and by night, with the pool, pool bar, VIP bar and gym at the back", "Swimming with other players, and swimming lessons that open the deep end", "Suites, the 24-hour restaurant, barbing saloon and laundry", "Jobs: front desk, waiter, housekeeping, lifeguard, swimming instructor, gym instructor, cook, duty manager", "Staff perks: half price at the pool, gym, pool bar and VIP bar"],
    real: [{ href: `https://wa.me/${CANDELLUX.whatsapp}?text=${encodeURIComponent("Hello Candellux, I'd like to book a room (I found you on Notes Life).")}`, label: `Book on WhatsApp · ${CANDELLUX.whatsappLabel}` }],
  },
  {
    name: "Digital Witch", logo: "/images/life/partners/digitalwitch-logo.webp", logoClass: "h-14 w-14 rounded-xl object-cover", shot: "/images/life/billboards/digitalwitch.webp", where: "EdTech · Skyscraper Plaza, CBD", tone: "#0b1442",
    feature: { bg: "/images/life/partners/digitalwitch-hub.webp", photo: "/images/life/partners/cynthia-okeh-full.webp", person: "Ekwutosi Cynthia Okeh, founder of Digital Witch" },
    what: ["Ekwutosi Cynthia Okeh, the founder, is in the game as #1 on the Billionaires List: at the training hub by day and the Candellux VIP bar in the evening", "Courses at the Digital Witch hub: Virtual Assistant, Customer Support, Social Media, Project Management, Data Analysis, UI/UX", "Digital Witch certificates open the tech jobs, from remote virtual assistant to UI/UX designer", "Saturday-night giveaways of N$ 500,000 and N$ 1,000,000 for graduates doing well, and adverts at the Wuse bus stand"],
    real: [{ href: DIGITAL_WITCH.site, label: "digitalwitchng.com" }, { href: `https://wa.me/${DIGITAL_WITCH.whatsapp}?text=${encodeURIComponent("Hello Digital Witch, I'd like to learn a tech skill (I found you on Notes Life).")}`, label: `WhatsApp · ${DIGITAL_WITCH.whatsappLabel}` }],
  },
];

// Partner with Notes Life: served at life.notesapp.name.ng/partners (middleware.ts) and at /life/partners.
export default function LifePartnersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-sky-50 to-amber-50 text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <a href={HOME} className="font-ui text-xl font-extrabold tracking-tight">Notes <span className="text-emerald-600">Life</span></a>
        <a href={PLAY} className="rounded-full bg-emerald-600 px-4 py-2 font-ui text-xs font-bold text-white shadow-sm">▶ Play free</a>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[1fr,1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-emerald-700 shadow-sm">🤝 For businesses</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] sm:text-6xl">Partner with<br /><span className="text-emerald-600">Notes Life.</span></h1>
            <p className="mt-4 max-w-lg text-lg text-slate">Notes Life is the free NotesApp life game set in real Nigerian cities. Players eat, work, shop and get through NEPA&apos;s blackouts every day. Put your brand where they live: a place in Notesville, jobs, outlets they can own, billboards, and a tap to your real store.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={CONTACT} className="rounded-full bg-ink px-6 py-3 font-ui text-sm font-bold text-white shadow hover:bg-crimson">Partner with us →</a>
              <a href={PLAY} className="rounded-full bg-white px-6 py-3 font-ui text-sm font-bold text-ink shadow-sm hover:bg-white/80">See the game</a>
            </div>
            <p className="mt-3 text-xs text-slate">The button opens our contact form with your message started. Tell us about your business and we&apos;ll reply by email.</p>
          </div>
          <div className="overflow-hidden rounded-3xl border-4 border-white shadow-2xl">
            <Image src="/images/life/shots/street-desktop.webp" alt="Notes Life, the real game: a Wuse street with billboards for the #1MillionNairaNotesAppChallenge, itel Energy and Chef Adams" width={1440} height={900} priority className="h-auto w-full" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="get">
          <h2 id="get" className="font-display text-3xl sm:text-4xl">What partners get</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {perks.map(([i, t, d]) => (
              <li key={t} className="rounded-3xl bg-white p-5 shadow-sm"><span className="text-3xl">{i}</span><h3 className="mt-2 font-ui text-lg font-bold">{t}</h3><p className="mt-1 text-sm text-slate">{d}</p></li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="ours">
          <h2 id="ours" className="font-display text-3xl sm:text-4xl">Our partners</h2>
          <p className="mt-1 text-sm text-slate">Real businesses, in the game today. In-game prices are game prices; real orders and bookings are made with them directly.</p>
          <div className="mt-6 grid gap-6">
            {partners.map((p) => p.feature ? (
              // A landscape card: the partner's place in the game behind, the text in white on their blue at the right, and
              // the founder's picture floating right in it.
              <article key={p.name} className="relative overflow-hidden rounded-3xl shadow-sm">
                <Image src={p.feature.bg} alt={`${p.name} in Notes Life, the real game`} fill sizes="100vw" className="object-cover object-left" />
                <div className="relative flex min-h-[30rem] flex-col justify-end pt-48 lg:flex-row lg:items-stretch lg:pt-0">
                  <div className="p-6 text-white sm:p-8 lg:ml-auto lg:w-[58%] lg:rounded-l-[2rem]" style={{ background: `${p.tone}f2` }}>
                    <Image src={p.feature.photo} alt={p.feature.person} width={600} height={600} className="float-right mb-3 ml-4 w-32 rounded-2xl border-4 border-white object-cover shadow-2xl sm:w-44 lg:-mt-2 lg:w-52 lg:rotate-2" />
                    <div className="flex items-center gap-3"><Image src={p.logo} alt="" width={120} height={60} className={`${p.logoClass} ring-2 ring-white/30`} /><div><h3 className="font-ui text-xl font-extrabold">{p.name}</h3><p className="text-xs text-white/70">{p.where} · <span className="font-bold text-white">PARTNER</span></p></div></div>
                    <ul className="mt-4 space-y-1.5 text-sm">{p.what.map((w) => <li key={w} className="flex gap-2"><span className="text-sky-300">✓</span><span>{w}</span></li>)}</ul>
                    <div className="clear-both flex flex-wrap gap-2 pt-4">{p.real.map((r) => <a key={r.href} href={r.href} target="_blank" rel="noreferrer" className="rounded-full border border-white px-3 py-1.5 font-ui text-xs font-bold text-white hover:bg-white hover:text-ink">{r.label} ↗</a>)}</div>
                  </div>
                </div>
              </article>
            ) : (
              <article key={p.name} className="grid overflow-hidden rounded-3xl bg-white shadow-sm lg:grid-cols-[1fr,1.1fr]">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-3"><Image src={p.logo} alt="" width={120} height={60} className={p.logoClass} /><div><h3 className="font-ui text-xl font-extrabold" style={{ color: p.tone }}>{p.name}</h3><p className="text-xs text-slate">{p.where} · <span className="font-bold">PARTNER</span></p></div></div>
                  <ul className="mt-4 grid gap-1.5 text-sm">{p.what.map((w) => <li key={w} className="flex gap-2"><span style={{ color: p.tone }}>✓</span><span>{w}</span></li>)}</ul>
                  <div className="mt-4 flex flex-wrap gap-2">{p.real.map((r) => <a key={r.href} href={r.href} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1.5 font-ui text-xs font-bold hover:bg-slate-50" style={{ borderColor: p.tone, color: p.tone }}>{r.label} ↗</a>)}</div>
                </div>
                <div className="relative min-h-[14rem]"><Image src={p.shot} alt={`${p.name} in Notes Life, the real game`} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" /></div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 text-center sm:px-6">
          <div className="rounded-3xl bg-[#292929] p-8 text-white shadow-xl">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#F2B544]">Your brand, next</p>
            <h2 className="mt-2 font-display text-4xl">Let&apos;s build your place in Notesville.</h2>
            <p className="mt-3 text-white/80">Restaurants, shops, banks, telecoms, transport, hotels, schools: if Nigerians use it every day, it belongs in the game.</p>
            <a href={CONTACT} className="mt-5 inline-block rounded-full bg-[#F2B544] px-6 py-3 font-ui text-sm font-extrabold text-ink">Partner with us →</a>
            <p className="mt-3 text-xs text-white/60">Partner placements are labelled “Partner” in the game.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
