import Image from "next/image";
import Link from "next/link";

// Two cards side by side for the home and About pages (owner, 21 Nov 2026: "update about and home with new additions including ventures
// and arcade"): Notes Arcade, the free games, and NotesApp Ventures, the open call to pitch an idea. Kept free of time-limited campaigns
// so the words stay true; campaigns run in the advert spots instead.
export default function ArcadeVenturesCards({ className = "" }: { className?: string }) {
  return (
    <div className={`grid gap-6 lg:grid-cols-2 ${className}`}>
      <Link href="/arcade" className="group flex flex-col overflow-hidden rounded-3xl border border-rule bg-[#17251f] text-paper shadow-sm transition hover:shadow-lg">
        <div className="relative aspect-[16/10] w-full">
          <Image src="/images/arcade/ludo.png" alt="Ludo in Notes Arcade: the four coloured yards, the seeds and two dice" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
        </div>
        <div className="flex flex-1 flex-col p-6 sm:p-8">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-eyebrow text-emerald-300">
            <Image src="/images/brand/arcade-icon-192.png" alt="" width={20} height={20} className="h-5 w-5 rounded" />
            Play free · no sign-in needed
          </p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl">Notes Arcade</h2>
          <p className="mt-2 max-w-md text-sm text-paper/75">
            Ludo, Whot, Ace of Spades, Ncho and Aka-Hausa, Achi, Chess, Draughts, Naija Landlord, Naija Run, Puff-Puff Rush and Snake,
            against the computer, at the level you choose. Sign in with your #NotesApp account to save your progress and N$. Install it
            as its own app. No game pays out real naira.
          </p>
          <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 font-ui text-sm font-bold text-[#0d1713] group-hover:bg-emerald-400">Open Notes Arcade →</span>
        </div>
      </Link>
      <Link href="/ventures" className="group flex flex-col justify-between overflow-hidden rounded-3xl border-2 border-crimson/25 bg-crimson/[0.04] p-6 shadow-sm transition hover:shadow-lg sm:p-8">
        <div>
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
        </div>
        <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-crimson px-5 py-2.5 font-ui text-sm font-bold text-paper group-hover:bg-crimson-deep">Pitch your idea →</span>
      </Link>
    </div>
  );
}
