import type { Metadata } from "next";
import Image from "next/image";
import { COMPANY_INFO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Notes Life · play free in Abuja",
  description: "Notes Life is a free browser life game from NotesApp. Start in a face-me-I-face-you room in your city, hustle, build and climb the Billionaires List with your NotesApp account.",
  alternates: { canonical: "https://life.notesapp.name.ng" },
  openGraph: { title: "Notes Life · play free in Abuja", description: "Start small. Hustle. Ball out (in game money). A NotesApp game.", images: ["/images/life/game-room.webp"] },
};

const APP = "https://app.notesapp.name.ng";
const PLAY = "https://www.notesapp.name.ng/life/play";
const shots: { src: string; title: string; text: string }[] = [
  { src: "/images/life/cities-phone.webp", title: "Choose your city", text: "Start in Abuja, Lagos or Port Harcourt, with more cities to come. Move later, and own homes in more than one." },
  { src: "/images/life/room-phone.webp", title: "Your room, your city", text: "Start in a face-me-I-face-you room. Your NotesApp photo is your portrait. Keep your food, energy, fun and social bars up, and pick how hard you want life to be." },
  { src: "/images/life/blackout-phone.webp", title: "NEPA has taken light", text: "Power cuts hit everyone at the same moment. Buy an “I Better Pass My Neighbour”, go solar, or stay in the dark till light returns." },
  { src: "/images/life/night-phone.webp", title: "UP NEPA!", text: "Generators roar, a few windows glow, the solar estate never notices. When light returns, the whole street hears it." },
  { src: "/images/life/market-phone.webp", title: "A market with real shops", text: "Every stall on the market street is a real NotesApp store. Tap an item and buy it on NotesApp." },
  { src: "/images/life/ad-phone.webp", title: "Billboards you can tap", text: "Real offers on the billboards. Visit, or ask about the promotion in one tap." },
  { src: "/images/life/phone-phone.webp", title: "Call your friends", text: "Voice and video calls with friends who follow you back, right from your in-game phone." },
  { src: "/images/life/rich-pop-phone.webp", title: "The Billionaires List", text: "Buy cars, towers, a private jet or a yacht, host events, and climb the NotesVille Fat Wallet Index." },
  { src: "/images/life/brag-phone.webp", title: "Brag a little", text: "Share your wins with a card your friends can tap to join you." },
  { src: "/images/life/bank-phone.webp", title: "The Central Bank of Notesville", text: "Notesville Naira is game money, just for fun, and never turns into cash. Quests can earn Bonus Credits you can use on NotesApp." },
];

// Notes Life: served at life.notesapp.name.ng (middleware.ts) and at /life. Its own look, the NotesApp sign-in. An invite link
// (?ref=username) is passed on to the game, so the friend who invited you gets their bonus when you finish your first shift.
export default function LifePage({ searchParams }: { searchParams?: { ref?: string } }) {
  const ref = typeof searchParams?.ref === "string" && /^[a-z0-9_.-]{1,40}$/i.test(searchParams.ref) ? searchParams.ref : "";
  const play = ref ? `${PLAY}?ref=${encodeURIComponent(ref)}` : PLAY;
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-sky-50 to-amber-50 text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <p className="font-ui text-xl font-extrabold tracking-tight">Notes <span className="text-emerald-600">Life</span></p>
        <a href={APP} className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 font-ui text-xs font-semibold shadow-sm">
          <Image src="/images/brand/icon-192.png" alt="" width={20} height={20} className="rounded" /> by NotesApp
        </a>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[0.9fr,1.1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-emerald-700 shadow-sm"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />First playable · Abuja</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] sm:text-6xl">Start small.<br />Hustle.<br /><span className="text-emerald-600">Ball out.</span></h1>
            <p className="mt-4 max-w-lg text-lg text-slate">Notes Life is a free life game in your browser. Begin in a face-me-I-face-you room in your own city (Abuja, Lagos or Port Harcourt to start), choose any work, write, take bookings, run a shop, decorate, visit and call your friends, and work your way to towers, jets and yachts. You play with your NotesApp account.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={play} className="rounded-full bg-emerald-600 px-6 py-3 font-ui text-sm font-bold text-white shadow hover:bg-emerald-700">▶ Play now, free</a>
              <a href={`${APP}/signup`} className="rounded-full bg-white px-6 py-3 font-ui text-sm font-bold text-ink shadow-sm hover:bg-white/80">Get a NotesApp account</a>
            </div>
            <p className="mt-3 text-xs text-slate">{ref ? <>@{ref} invited you. Finish your first shift and you both get ₦250 NotesApp Bonus Credit.</> : <>Abuja is open now: a room in Wuse, N$ 100,000, jobs at Chef Adams, itel Energy and Candellux, your own partner outlet and the Billionaires List. Lagos and Port Harcourt are next.</>}</p>
          </div>
          <div className="overflow-hidden rounded-3xl border-4 border-white shadow-2xl">
            <Image src="/images/life/game-room.webp" alt="Notes Life, the real game: your room in Wuse, Abuja, with the time, difficulty, game money, the Invite button, your needs and the menu" width={1440} height={900} priority className="h-auto w-full" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="look">
          <h2 id="look" className="font-display text-3xl sm:text-4xl">A first look</h2>
          <p className="mt-1 text-sm text-slate">From our design mockups. The game itself has moved on: play it to see today&apos;s Wuse.</p>
          <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shots.map((s) => (
              <li key={s.src} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <div className="relative mx-auto mt-5 aspect-[390/844] w-[60%] overflow-hidden rounded-[1.6rem] border-[6px] border-ink">
                  <Image src={s.src} alt={`Notes Life mockup: ${s.title}`} fill sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 60vw" className="object-cover object-top" />
                </div>
                <div className="p-5"><h3 className="font-ui text-lg font-bold">{s.title}</h3><p className="mt-1 text-sm text-slate">{s.text}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="nepa">
          <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-[#0d1630] p-6 text-white shadow-xl sm:p-10 lg:grid-cols-[0.8fr,1.2fr]">
            <div className="relative mx-auto aspect-[390/844] w-[70%] max-w-[18rem] overflow-hidden rounded-[2rem] border-[8px] border-black">
              <Image src="/images/life/blackout-phone.webp" alt="Notes Life mockup: NEPA has taken light. Choose the I Better Pass My Neighbour 950W generator, a big 3.5kVA generator, solar and an inverter, or stay in darkness till light returns" fill sizes="(min-width: 1024px) 18rem, 70vw" className="object-cover object-top" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-amber-300">⚡ Power cut · same moment, everywhere</p>
              <h2 id="nepa" className="mt-2 font-display text-4xl">NEPA has taken light.</h2>
              <p className="mt-3 text-white/85">When the light goes, it goes for every player at once. The street murmurs, then you choose: the little “I Better Pass My Neighbour”, a big generator, solar that NEPA can never touch, or darkness till light returns.</p>
              <p className="mt-3 text-white/85">Generators roar one by one and only some windows glow. Then: <i>nwiiiiiii</i>, children shouting <b>“UP NEPA!”</b>, and someone saying “Shhhh! Before dem hear!”</p>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/20">
                <Image src="/images/life/night-desktop.webp" alt="Notes Life mockup: a street at night during a power cut, with a few windows lit by generators and a solar estate fully lit" width={1440} height={900} className="h-auto w-full" />
              </div>
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
              <p className="mt-3 text-sm text-white/70">Want the real thing? <a href="https://www.notesapp.name.ng/journals/own-a-chef-adams-franchise-in-your-choice-location" className="font-bold text-[#F2B544] underline">Own a Chef Adams franchise</a> · <a href="https://www.itel-life.com/ng/itel-home/about-itel-home" target="_blank" rel="noreferrer" className="font-bold text-[#ff6b86] underline">itel Home</a></p>
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
            <Image src="/images/life/market-desktop.webp" alt="Notes Life mockup: the market street with real NotesApp stores and a billboard" width={1440} height={900} className="h-auto w-full" />
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6" aria-labelledby="faq">
          <h2 id="faq" className="font-display text-3xl">Good to know</h2>
          <dl className="mt-4 divide-y divide-white rounded-3xl bg-white/70 px-5">
            {[
              ["Is it free?", "Yes, free to play in your browser on your phone or computer. Nothing to download."],
              ["Do I need an account?", "You play with your NotesApp account, so your friends, your photo and your progress go with you."],
              ["Is the money real?", "Notesville Naira is game money, just for fun. It can't be cashed out. Some quests give Bonus Credits you can use on NotesApp."],
              ["Can I play now?", "Yes. Abuja is open, with NEPA power cuts, partner jobs and outlets you can own. Lagos, Port Harcourt, the market and calls from your game phone come in later updates. Follow @na-notesapp for news."],
              ["What do I get for inviting friends?", "When a friend joins from your invite link and finishes their first shift, you both get ₦250 NotesApp Bonus Credit (up to 20 friends a month). Bonus Credit lasts 90 days and pays for boosts, ads and badges."],
            ].map(([q, a]) => (
              <div key={q} className="py-4"><dt className="font-ui font-bold">{q}</dt><dd className="mt-1 text-sm text-slate">{a}</dd></div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-white/60 py-6 text-center text-xs text-slate">
        © {new Date().getFullYear()} {COMPANY_INFO.legalName}. Notes Life is a NotesApp game. Game money has no cash value.
      </footer>
    </div>
  );
}
