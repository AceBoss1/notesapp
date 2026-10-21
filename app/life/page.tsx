import type { Metadata } from "next";
import Image from "next/image";
import { COMPANY_INFO, SITE } from "@/lib/site";

import { InviteNote, PlayLink } from "@/components/life/LifeInvite";
import { LIFE_URL } from "@/lib/host";
import FamilyLink from "@/components/FamilyLink";

export const metadata: Metadata = {
  title: "Notes Life · play free in Abuja",
  description: "Notes Life is a free browser life game from NotesApp. Start in a face-me-I-face-you room in your city, hustle, build and climb the Billionaires List with your NotesApp account.",
  alternates: { canonical: LIFE_URL },
  openGraph: { title: "Notes Life · play free in Abuja", description: "Start small. Hustle. Ball out (in game money). A NotesApp game.", images: ["/images/life/game-room.webp"] },
};

const PLAY = "/life/play"; // relative: stays on the visitor's domain (lib/host.ts)
// Screenshots from the game itself (public/images/life/shots/), phone size.
const shots: { src: string; title: string; text: string }[] = [
  { src: "/images/life/shots/welcome.webp", title: "Choose your city", text: "Abuja is open, with the City Gate. Lagos (the National Theatre) and Port Harcourt (Isaac Boro Park) are coming: tap to be told first." },
  { src: "/images/life/shots/arrive.webp", title: "Welcome to Abuja", text: "Drive in through the City Gate at night. A room in Wuse is waiting, with N$ 100,000, a bicycle and a deal phone." },
  { src: "/images/life/shots/room.webp", title: "Your room in Wuse", text: "Bed, desk, wardrobe, WC and bath. Your NotesApp photo is your portrait. Keep your six needs up, and pick how hard you want life to be." },
  { src: "/images/life/shots/nepa.webp", title: "NEPA has taken light", text: "Power cuts hit everyone at the same moment. Buy an “I Better Pass My Neighbour”, go solar with itel, or stay in the dark till light returns." },
  { src: "/images/life/shots/power.webp", title: "Power through it", text: "The Power GO keeps your lamp, fan and laptop on; the Power Tank keeps the fridge cold. When light returns, the whole street shouts “UP NEPA!”" },
  { src: "/images/life/shots/itel.webp", title: "Real brands, real products", text: "Shop at itel Energy, eat at Chef Adams, swim and meet VIPs at the Candellux Imperial, learn a tech skill at Digital Witch, and pay at every counter with a tap of your Paylony CardTap card. Each one links to the real thing." },
  { src: "/images/life/shots/pool.webp", title: "Swim at the Candellux", text: "Round the back of the hotel: the pool, with other players and residents in it. Take lessons with Coach Femi and the deep end opens after three." },
  { src: "/images/life/shots/vip.webp", title: "Meet the VIPs", text: "The VIP bar is where the top of the Billionaires List drinks. Who's in changes every 4 game hours; say hello and chat." },
  { src: "/images/life/shots/billboards.webp", title: "Billboards you can tap", text: "Chef Adams shawarma, pizza and Sum Ting Fresh, itel Energy, Paylony CardTap and the #1MillionNairaNotesAppChallenge line the roads. Tap one to open it." },
  { src: "/images/life/shots/jobs.webp", title: "Work for real brands", text: "Take shifts at Chef Adams, itel Energy and the Candellux Imperial: lifeguard, swimming or gym instructor, with tips, bonuses and staff perks." },
  { src: "/images/life/shots/partner.webp", title: "Own a partner outlet", text: "Earn your way to your own Chef Adams kiosk or itel store. Residents run it, your name goes on the sign, you collect the takings." },
  { src: "/images/life/shots/skills.webp", title: "Learn a tech skill at Digital Witch", text: "Enrol at the Digital Witch hub in Skyscraper Plaza: virtual assistant, social media, product, data or UX. Finish the classes, get your certificate, and the remote tech jobs open up." },
  { src: "/images/life/shots/giveaway.webp", title: "Cynthia's graduate giveaway", text: "Saturday nights at the Candellux VIP bar, Cynthia picks graduates who are doing well, with 10 tech shifts behind them, for N$ 1,000,000 or N$ 500,000." },
  { src: "/images/life/shots/cynthia.webp", title: "Meet the #1 on the list", text: "Ekwutosi Cynthia Okeh tops the Billionaires List. Find her at her training hub by day and the VIP bar at night, and ask her how she did it." },
  { src: "/images/life/shots/friends.webp", title: "Friends who play", text: "See friends who follow you back, message them on NotesApp, and meet real players at the same place. Calls are coming." },
  { src: "/images/life/shots/rich.webp", title: "The Billionaires List", text: "Climb the NotesVille Fat Wallet Index against real players and the richest residents 🤖." },
  { src: "/images/life/shots/invite.webp", title: "Invite friends, both get ₦250", text: "When a friend joins from your link and finishes a shift, you each get ₦250 in NotesApp Bonus Credit." },
  { src: "/images/life/shots/bank.webp", title: "The Central Bank of Notesville", text: "Notesville Naira is game money, just for fun, and never turns into cash. Buy it with NotesApp Credit: ₦1 = N$ 100." },
];

// Notes Life: served at life.notesapp.name.ng (middleware.ts) and at /life. Its own look, the NotesApp sign-in. An invite link
// (?ref=username) is passed on to the game, so the friend who invited you gets their bonus when you finish your first shift.
export default function LifePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-sky-50 to-amber-50 text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <p className="shrink-0 whitespace-nowrap font-ui text-xl font-extrabold tracking-tight">Notes <span className="text-emerald-600">Life</span></p>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <a href={SITE.discord} target="_blank" rel="noopener noreferrer" aria-label="Notes Life players on Discord" className="whitespace-nowrap rounded-full bg-white/80 px-3 py-1.5 font-ui text-xs font-semibold shadow-sm">💬<span className="hidden sm:inline"> Discord</span></a>
          <a href="/life/partners" className="whitespace-nowrap rounded-full bg-white/80 px-3 py-1.5 font-ui text-xs font-semibold shadow-sm">🤝 Partner<span className="hidden sm:inline"> with us</span></a>
          <FamilyLink to="app" className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/80 px-3 py-1.5 font-ui text-xs font-semibold shadow-sm">
            <Image src="/images/brand/icon-192.png" alt="" width={20} height={20} className="rounded" /> <span><span className="hidden sm:inline">by </span>NotesApp</span>
          </FamilyLink>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[0.9fr,1.1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-emerald-700 shadow-sm"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />First playable · Abuja</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] sm:text-6xl">Start small.<br />Hustle.<br /><span className="text-emerald-600">Ball out.</span></h1>
            <p className="mt-4 max-w-lg text-lg text-slate">Notes Life is a free life game in your browser. Begin in a face-me-I-face-you room in your own city (Abuja, Lagos or Port Harcourt to start), choose any work, write, take bookings, run a shop, decorate, visit and call your friends, and work your way to towers, jets and yachts. You play with your NotesApp account.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PlayLink play={PLAY} className="rounded-full bg-emerald-600 px-6 py-3 font-ui text-sm font-bold text-white shadow hover:bg-emerald-700" />
              <FamilyLink to="app" path="/signup" className="rounded-full bg-white px-6 py-3 font-ui text-sm font-bold text-ink shadow-sm hover:bg-white/80">Get a NotesApp account</FamilyLink>
            </div>
            <p className="mt-3 text-xs text-slate"><InviteNote>Abuja is open now: a room in Wuse, N$ 100,000, jobs at Chef Adams, itel Energy and Candellux, your own partner outlet and the Billionaires List. Lagos and Port Harcourt are next.</InviteNote></p>
          </div>
          <div className="overflow-hidden rounded-3xl border-4 border-white shadow-2xl">
            <Image src="/images/life/game-room.webp" alt="Notes Life, the real game: your room in Wuse, Abuja, with the time, difficulty, game money, the Invite button, your needs and the menu" width={1440} height={900} priority className="h-auto w-full" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="look">
          <h2 id="look" className="font-display text-3xl sm:text-4xl">A first look</h2>
          <p className="mt-1 text-sm text-slate">Screenshots from the game as it is today.</p>
          <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shots.map((s) => (
              <li key={s.src} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <div className="relative mx-auto mt-5 aspect-[390/844] w-[60%] overflow-hidden rounded-[1.6rem] border-[6px] border-ink">
                  <Image src={s.src} alt={`Notes Life, the real game: ${s.title}`} fill sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 60vw" className="object-cover object-top" />
                </div>
                <div className="p-5"><h3 className="font-ui text-lg font-bold">{s.title}</h3><p className="mt-1 text-sm text-slate">{s.text}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="nepa">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-[#0d1630] p-6 text-white shadow-xl sm:p-10 lg:grid-cols-[0.8fr,1.2fr]">
            <div className="relative mx-auto aspect-[390/844] w-[70%] max-w-[18rem] overflow-hidden rounded-[2rem] border-[8px] border-black">
              <Image src="/images/life/shots/nepa.webp" alt="Notes Life, the real game: NEPA has taken light. Get a Power GO Pro or Power Tank at itel Energy, start the generator, or stay in the dark till light returns" fill sizes="(min-width: 1024px) 18rem, 70vw" className="object-cover object-top" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-amber-300">⚡ Power cut · same moment, everywhere</p>
              <h2 id="nepa" className="mt-2 font-display text-4xl">NEPA has taken light.</h2>
              <p className="mt-3 text-white/85">When the light goes, it goes for every player at once. The street murmurs, then you choose: the little “I Better Pass My Neighbour”, a big generator, solar that NEPA can never touch, or darkness till light returns.</p>
              <p className="mt-3 text-white/85">Generators roar one by one and only some windows glow. Then: <i>nwiiiiiii</i>, children shouting <b>“UP NEPA!”</b>, and someone saying “Shhhh! Before dem hear!”</p>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/20">
                <Image src="/images/life/shots/blackout-desktop.webp" alt="Notes Life, the real game: your room in a blackout, running on the Power GO and the Power Tank" width={1440} height={900} className="h-auto w-full" />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="hotel">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-[#1c2030] p-6 text-white shadow-xl sm:p-10 lg:grid-cols-[1.2fr,0.8fr]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#e3b23c]">👑 Candellux Imperial · Garki</p>
              <h2 id="hotel" className="mt-2 font-display text-4xl">Turn round. The pool is at the back.</h2>
              <p className="mt-3 text-white/85">The hotel is built from the real Candellux: the glass and stone wings, the tower with its sign, the gate and the palms, by day and lit up at night. Spin the camera and you&apos;re at the pool: green turf, blue mosaic, the pergola, the pool bar, the VIP bar and the gym tower, with solar panels on the roofs.</p>
              <p className="mt-3 text-white/85">A day pass is N$ 25,000. Swimming lessons (N$ 15,000) build your swimming skill, and skill 5 gets you a job as a swimming instructor.</p>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/20">
                <Image src="/images/life/shots/hotel-desktop.webp" alt="Notes Life, the real game: the Candellux Imperial Hotel & Suites, with its tower, gate and solar roofs" width={1440} height={900} className="h-auto w-full" />
              </div>
            </div>
            <div className="relative mx-auto aspect-[390/844] w-[70%] max-w-[18rem] overflow-hidden rounded-[2rem] border-[8px] border-black">
              <Image src="/images/life/shots/pool.webp" alt="Notes Life, the real game: swimming in the Candellux pool with other players and residents" fill sizes="18rem" className="object-cover" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="partner">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-[#292929] p-6 text-white shadow-xl sm:p-10 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#F2B544]">🤝 Become a Partner</p>
              <h2 id="partner" className="mt-2 font-display text-4xl">Work there. Then own one.</h2>
              <p className="mt-3 text-white/85">Take shifts at Chef Adams, itel Energy or the Candellux Imperial: kiosk attendant, solar installer, CarlCare technician, front desk, waiter with tips, duty manager. Staff get perks, like 20% off itel products.</p>
              <p className="mt-3 text-white/85">Earn your way to your own outlet: a Chef Adams <b>Takeaway Kiosk</b> from N$ 2.5m or <b>Mini Dine-In Shop</b> from N$ 8.0m, an itel <b>Home Store</b> from N$ 1.5m or <b>Mall Store</b> from N$ 7.0m. Residents run it while you&apos;re away, your name goes on the sign, and you collect the takings. Keep a Power Tank on it, because NEPA will take light.</p>
              <p className="mt-3 text-sm text-white/70"><a href="/life/partners" className="font-bold text-white underline">See our partners</a> · Want the real thing? <a href={`/journals/own-a-chef-adams-franchise-in-your-choice-location`} className="font-bold text-[#F2B544] underline">Own a Chef Adams franchise</a> · <a href="https://www.itel-life.com/ng/itel-home/about-itel-home" target="_blank" rel="noreferrer" className="font-bold text-[#ff6b86] underline">itel Home</a></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Image src="/images/life/billboards/itel-sun-is-free.webp" alt="itel Energy billboard in Notes Life: The Sun is Free. Why Not Use It?" width={720} height={900} className="h-auto w-full rounded-2xl" />
              <Image src="/images/life/billboards/itel-power-tank-fridge.webp" alt="itel Energy billboard in Notes Life: the Power Tank 1000 keeps the fridge on" width={720} height={900} className="h-auto w-full rounded-2xl" />
              <Image src="/images/life/billboards/chef-adams-menu.webp" alt="Chef Adams billboard in Notes Life: order now" width={960} height={538} className="col-span-2 h-auto w-full rounded-2xl" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="overflow-hidden rounded-3xl border-4 border-white shadow-xl">
            <Image src="/images/life/shots/street-desktop.webp" alt="Notes Life, the real game: the Wuse street with billboards for the #1MillionNairaNotesAppChallenge, itel Energy and Chef Adams" width={1440} height={900} className="h-auto w-full" />
          </div>
          <p className="mt-3 text-center text-sm text-slate">Own a business? <a href="/life/partners" className="font-bold text-emerald-700 underline">Partner with Notes Life</a>: a place in the game, jobs, outlets players can own and billboards like these.</p>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6" aria-labelledby="faq">
          <h2 id="faq" className="font-display text-3xl">Good to know</h2>
          <dl className="mt-4 divide-y divide-white rounded-3xl bg-white/70 px-5">
            {[
              ["Is it free?", "Yes, free to play in your browser on your phone or computer. Nothing to download."],
              ["Do I need an account?", "You play with your NotesApp account, so your friends, your photo and your progress go with you."],
              ["Is the money real?", "Notesville Naira is game money, just for fun. It can't be cashed out. Some quests give Bonus Credits you can use on NotesApp."],
              ["Can I play now?", "Yes. Abuja is open, with NEPA power cuts, partner jobs and outlets you can own. Lagos, Port Harcourt, the market and calls from your game phone come in later updates. Follow @na-notesapp, or join our Discord, for news."],
              ["Where do players talk?", "On our Discord: tips, bugs, ideas for the game and news of each update, with the team and other players."],
              ["What do I get for inviting friends?", "When a friend joins from your invite link and finishes their first shift, you both get ₦250 NotesApp Bonus Credit (up to 20 friends a month). Bonus Credit lasts 90 days and pays for boosts, ads and badges."],
            ].map(([q, a]) => (
              <div key={q} className="py-4"><dt className="font-ui font-bold">{q}</dt><dd className="mt-1 text-sm text-slate">{a}</dd></div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-white/60 py-6 text-center text-xs text-slate">
        © {new Date().getFullYear()} {COMPANY_INFO.legalName}. Notes Life is a NotesApp game. Game money has no cash value. · <a href={SITE.discord} target="_blank" rel="noopener noreferrer" className="underline">Join the players on Discord</a>
      </footer>
    </div>
  );
}
