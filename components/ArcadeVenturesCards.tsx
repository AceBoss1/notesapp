import Image from "next/image";
import Link from "next/link";
import { ARCADE_GAMES } from "@/lib/arcade/catalogue";
import { VenturesArt } from "@/components/ventures/VenturesHero";

// Two cards side by side for the home and About pages (owner, 21 Nov 2026: "update about and home with new additions including ventures
// and arcade"): Notes Arcade, the free games, and NotesApp Ventures, the open call to pitch an idea. Kept free of time-limited campaigns
// so the words stay true; campaigns run in the advert spots instead.
// Owner, 21 Nov 2026: the Arcade card shows the games as tiles, like the Arcade home ("use the tiles arcade list of various games"), and
// the Ventures card fills its empty space with the cover picture from /ventures ("take the part marked and fix in the empty marked space").
// Text first, then the tiles fill the rest of the card down to the bottom (owner, 21 Nov 2026: "take the text up, bring down the game
// tiles to fit into the remaining space below"). The cards aren't single links any more (a tile is its own link), so each has its own button.
export default function ArcadeVenturesCards({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-6 lg:grid-cols-2 ${className}`}>
      <div className="flex flex-col overflow-hidden rounded-3xl border border-rule bg-[#17251f] text-paper shadow-sm">
        <div className="flex flex-col px-6 pt-6 sm:px-8 sm:pt-8">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-eyebrow text-emerald-300">
            <Image src="/images/brand/arcade-icon-192.png" alt="" width={20} height={20} className="h-5 w-5 rounded" />
            Play free · no sign-in needed
          </p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl">Notes Arcade</h2>
          <p className="mt-2 max-w-md text-sm text-paper/75">
            {ARCADE_GAMES.length} games against the computer, at the level you choose. Sign in with your #NotesApp account to save your
            progress and N$, and install it as its own app. No game pays out real naira.
          </p>
          <Link href="/arcade" className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 font-ui text-sm font-bold text-[#0d1713] hover:bg-emerald-400">Open Notes Arcade →</Link>
        </div>
        <ul className="mt-5 grid flex-1 auto-rows-fr grid-cols-3 gap-2 px-3 pb-3 sm:grid-cols-4 sm:px-4 sm:pb-4" aria-label="Games in Notes Arcade">
          {ARCADE_GAMES.map((g) => (
            <li key={g.slug} className="flex">
              <Link href={g.path} className="group flex w-full flex-col overflow-hidden rounded-xl bg-[#0f1a15] ring-1 ring-white/10 transition hover:ring-emerald-400/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
                <span className="relative block min-h-[3.5rem] flex-1 aspect-[16/10]">
                  <Image src={`/images/arcade/${g.slug}.png`} alt="" fill sizes="(min-width: 1024px) 140px, 30vw" className="object-cover transition group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
                </span>
                <span className="block truncate px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-paper/85">{g.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col overflow-hidden rounded-3xl border-2 border-crimson/25 bg-crimson/[0.04] p-6 shadow-sm sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">NotesApp Ventures · open call</p>
        <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">Rewrite the Playbook</h2>
        <p className="mt-3 max-w-md text-slate">
          Got a feature, product or business you&apos;re sure the crowd would jump into? Pitch it. Applications are rolling, and each
          quarter we pick a few to build with their founders: our engineers, our platform and our guidance, for equity and a board
          seat on terms that fit the project.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm text-ink">
          <li>✓ For ideas and ventures in emerging markets, from members aged 18 and over</li>
          <li>✓ Kept confidential: only the Ventures team reads your pitch</li>
          <li>✓ Test your pitch with Nana first, privately</li>
          <li>✓ Perks for everyone who pitches</li>
        </ul>
        <div className="relative mt-5 flex flex-1 items-center overflow-hidden rounded-2xl bg-crimson-deep px-3 py-4"
          style={{ backgroundImage: "radial-gradient(28rem 16rem at 88% 8%, rgba(244,184,96,0.22), transparent 62%), linear-gradient(160deg, #4E0119 0%, #7A0328 100%)" }}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
          <VenturesArt idPrefix="vcard" className="relative mx-auto w-full max-w-[400px]" />
        </div>
        <Link href="/ventures" className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-paper hover:bg-crimson-deep">Pitch your idea →</Link>
      </div>
    </div>
  );
}
