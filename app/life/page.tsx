import type { Metadata } from "next";
import Image from "next/image";
import { COMPANY_INFO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Notes Life · coming soon",
  description: "Notes Life is a free browser life game from NotesApp. Start in a face-me-I-face-you room in your city, hustle, build and climb the Billionaires List with your NotesApp account.",
  alternates: { canonical: "https://life.notesapp.name.ng" },
  openGraph: { title: "Notes Life · coming soon", description: "Start small. Hustle. Ball out (in game money). A NotesApp game.", images: ["/images/life/room-desktop.webp"] },
};

const APP = "https://app.notesapp.name.ng";
const shots: { src: string; title: string; text: string }[] = [
  { src: "/images/life/room-phone.webp", title: "Your room, your city", text: "Start in a face-me-I-face-you room. Your NotesApp photo is your portrait. Keep your food, energy, fun and social bars up, and pick how hard you want life to be." },
  { src: "/images/life/market-phone.webp", title: "A market with real shops", text: "Every stall on the market street is a real NotesApp store. Tap an item and buy it on NotesApp." },
  { src: "/images/life/ad-phone.webp", title: "Billboards you can tap", text: "Real offers on the billboards. Visit, or ask about the promotion in one tap." },
  { src: "/images/life/phone-phone.webp", title: "Call your friends", text: "Voice and video calls with friends who follow you back, right from your in-game phone." },
  { src: "/images/life/rich-pop-phone.webp", title: "The Billionaires List", text: "Buy cars, towers, a private jet or a yacht, host events, and climb the NotesVille Fat Wallet Index." },
  { src: "/images/life/brag-phone.webp", title: "Brag a little", text: "Share your wins with a card your friends can tap to join you." },
  { src: "/images/life/bank-phone.webp", title: "The Central Bank of Notesville", text: "Notesville Naira is game money, just for fun, and never turns into cash. Quests can earn Bonus Credits you can use on NotesApp." },
];

// Notes Life, coming soon: served at life.notesapp.name.ng (middleware.ts) and at /life. Its own look, the NotesApp sign-in.
export default function LifePage() {
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
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-emerald-700 shadow-sm"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />Coming soon</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] sm:text-6xl">Start small.<br />Hustle.<br /><span className="text-emerald-600">Ball out.</span></h1>
            <p className="mt-4 max-w-lg text-lg text-slate">Notes Life is a free life game in your browser. Begin in a face-me-I-face-you room in your own city, get a job, decorate, visit and call your friends, and work your way to towers, jets and yachts. You play with your NotesApp account.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={`${APP}/signup`} className="rounded-full bg-ink px-6 py-3 font-ui text-sm font-bold text-paper shadow hover:bg-emerald-700">Get your NotesApp account ready</a>
              <a href="https://www.notesapp.name.ng/u/na-notesapp" className="rounded-full bg-white px-6 py-3 font-ui text-sm font-bold text-ink shadow-sm hover:bg-white/80">Follow for launch news</a>
            </div>
            <p className="mt-3 text-xs text-slate">Already on NotesApp? You are in. We will tell you the day it opens.</p>
          </div>
          <div className="overflow-hidden rounded-3xl border-4 border-white shadow-2xl">
            <Image src="/images/life/room-desktop.webp" alt="Notes Life mockup: your room in Lagos, with the time, difficulty level, game money, a daily quest, your needs and the menu" width={1440} height={900} priority className="h-auto w-full" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="look">
          <h2 id="look" className="font-display text-3xl sm:text-4xl">A first look</h2>
          <p className="mt-1 text-sm text-slate">Early mockups. The art, names and numbers will change before launch.</p>
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
              ["When does it open?", "Soon. Follow @na-notesapp on NotesApp and we will announce it there first."],
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
