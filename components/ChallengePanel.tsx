import Image from "next/image";
import Link from "next/link";
import { CHALLENGE_PROMO } from "@/lib/challenge-promo";

// The #1MillionNairaNotesAppChallenge announcement, in crimson: the words and numbers on the left, the campaign artwork and Nana on the
// right, with a giant faded ₦10m behind. Used as the home-page hero ("hero") and as the left half of the app welcome screen ("panel").
// `base` is put in front of the links (the app address links to the main site).
export default function ChallengePanel({ variant = "hero", base = "", children }: { variant?: "hero" | "panel"; base?: string; children?: React.ReactNode }) {
  const href = `${base}${CHALLENGE_PROMO.href}`;
  const panel = variant === "panel";
  return (
    <section className={`relative overflow-hidden text-paper ${panel ? "flex min-h-screen flex-col" : ""}`} style={{ backgroundImage: "radial-gradient(60rem 30rem at 85% -10%, rgba(166,9,61,0.75), transparent 70%), linear-gradient(135deg, #4E0119 0%, #7A0328 70%, #A6093D 100%)" }}>
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-6 select-none font-display text-[14rem] font-bold leading-none text-paper/[0.06] sm:text-[18rem]">₦10m</span>
      {children}
      <div className={`relative mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:px-8 ${panel ? "my-auto py-6 lg:gap-2" : "py-14 lg:grid-cols-[1.05fr,0.95fr] lg:items-center lg:py-16"}`}>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-paper/70"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-pink-400" aria-hidden="true" />Coming soon · For influencers</p>
          <h2 className={`mt-3 font-display leading-[1.05] text-paper ${panel ? "text-4xl lg:text-5xl" : "text-4xl sm:text-5xl lg:text-6xl"}`}>#1MillionNaira<br />NotesApp<br />Challenge</h2>
          <p className={`max-w-lg text-paper/85 ${panel ? "mt-3 text-sm" : "mt-5"}`}>Reach 100k views and 10k followers to unlock LIVE video, then bring 2,000 registered members into one live to open a ₦1,000,000 giveaway for you and your followers.</p>
          <div className={`${panel ? "mt-4" : "mt-6"} flex flex-wrap gap-3`}>
            <a href={href} className="rounded-full bg-paper px-6 py-3 font-ui text-sm font-bold text-crimson-deep hover:opacity-90">Read about the Challenge</a>
            {panel ? null : <Link href="/signup" className="rounded-full border border-paper/40 px-6 py-3 font-ui text-sm font-bold text-paper hover:bg-paper/10">Create your free account</Link>}
          </div>
          <dl className={`${panel ? "mt-5" : "mt-8"} grid max-w-md grid-cols-3 gap-4`}>
            {[["100k", "Views to unlock"], ["10k", "Followers"], ["₦1,000,000", "Giveaway"]].map(([n, l]) => (
              <div key={l}><dt className="font-display text-2xl text-paper sm:text-3xl">{n}</dt><dd className="mt-1 font-mono text-[10px] uppercase tracking-eyebrow text-paper/70">{l}</dd></div>
            ))}
          </dl>
        </div>
        <a href={href} className={`relative mx-auto block w-full ${panel ? "max-w-xs" : "max-w-md"}`} aria-label="Read about the #1MillionNairaNotesAppChallenge">
          <Image src="/images/brand/challenge-graphic.webp" alt="#1MillionNairaNotesAppChallenge: ₦10m up for grabs this month" width={1536} height={1024} sizes="(min-width: 1024px) 420px, 90vw" className="relative z-10 h-auto w-full" priority={!panel} />
          {!panel && <Image src="/images/nana/nana.webp" alt="" aria-hidden width={320} height={320} className="relative z-0 mx-auto -mt-10 h-52 w-52 object-contain drop-shadow-2xl sm:h-64 sm:w-64" />}
        </a>
      </div>
    </section>
  );
}
