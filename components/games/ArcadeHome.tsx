"use client";

import { ARCADE_GAMES } from "@/lib/arcade/catalogue";
import { CITY_CARDS } from "@/lib/life/catalog";
import { ArcadeFooter, ArcadeStyles, ArcadeTopbar, ArcadeWalletNote } from "./ArcadeShell";

// The Notes Arcade home: every game as a card with its screenshot, what it is and who plays. app/(arcade)/arcade/page.tsx.
export default function ArcadeHome() {
  return (
    <section className="arc-page" aria-label="Notes Arcade">
      <ArcadeTopbar />
      <div className="arch-hero">
        <p className="arc-kicker"><span>{String(ARCADE_GAMES.length).padStart(2, "0")}</span> &nbsp; GAMES · FREE · IN YOUR BROWSER</p>
        <h1>Pass the time,<br /><em>play a game.</em></h1>
        <div className="arch-hero-row">
          <p className="arc-description">Board games, card games and the classics, made for #NotesApp. No download, no sign-in: pick one and play. Sign in with #NotesApp only to save your progress and N$.</p>
          <ArcadeWalletNote />
        </div>
      </div>
      <ul className="arch-grid">
        {ARCADE_GAMES.map((g, i) => (
          <li key={g.slug}>
            <a className="arch-card" href={g.path}>
              <span className="arch-shot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/images/arcade/${g.slug}.png`} alt={`${g.name} on Notes Arcade`} loading={i < 4 ? "eager" : "lazy"} width={800} height={500} />
              </span>
              <span className="arch-body">
                <span className="arc-label">{String(i + 1).padStart(2, "0")} · {g.kicker.toUpperCase()}</span>
                <span className="arch-name">{g.name}</span>
                <span className="arch-blurb">{g.blurb}</span>
                <span className="arch-meta"><span>{g.players}</span><span className="arch-play">PLAY ↗</span></span>
              </span>
            </a>
          </li>
        ))}
        {/* Notes Life isn't an arcade game (its own world, at /life), but it's our biggest game: a card here so players find it. */}
        <li>
          <a className="arch-card" href="/life">
            {/* The Abuja card from the Notes Life city picker ("You are welcome"), with a real in-game screenshot in the corner. */}
            <span className="arch-shot arch-life-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CITY_CARDS.find((x) => x.id === "abuja")?.icon || "/images/life/cities/abuja.svg"} alt="Notes Life Abuja: City Gate, You are welcome" loading="lazy" width={400} height={260} />
              <span className="arch-life-inset">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/life/game-room.webp" alt="Inside Notes Life: your room in Wuse" loading="lazy" width={160} height={100} />
                <em>IN THE GAME</em>
              </span>
            </span>
            <span className="arch-body">
              <span className="arc-label">ALSO ON #NOTESAPP · LIFE GAME</span>
              <span className="arch-name">Notes Life Abuja</span>
              <span className="arch-blurb">Play free in Abuja: start in a face-me-I-face-you room, hustle, build and climb the Billionaires List.</span>
              <span className="arch-meta"><span>With your #NotesApp account</span><span className="arch-play">PLAY ↗</span></span>
            </span>
          </a>
        </li>
        {/* The next Notes Life cities (owner, 20 Nov 2026): shown as coming soon, not links. */}
        {[{ city: "Lagos", line: "Hustle from Yaba to Lekki. Danfo, Third Mainland traffic and island money." }, { city: "Port Harcourt", line: "Garden City life, from Trans-Amadi to GRA. Fresh fish, oil money and the waterside." }].map((c) => ({ ...c, card: CITY_CARDS.find((x) => x.name === c.city) })).map((c) => (
          <li key={c.city}>
            <div className="arch-card arch-soon" aria-label={`Notes Life ${c.city}, coming soon`}>
              {/* The city's own picture from the Notes Life city picker (lib/life/catalog.ts CITY_CARDS). */}
              <span className="arch-shot arch-soon-shot">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.card ? <img src={c.card.icon} alt={`Notes Life ${c.city}: ${c.card.landmark}`} loading="lazy" width={400} height={260} /> : <><span>NOTES LIFE</span><strong>{c.city}</strong></>}
                <em className="arch-soon-badge">COMING SOON</em>
              </span>
              <span className="arch-body">
                <span className="arc-label">ALSO ON #NOTESAPP · LIFE GAME</span>
                <span className="arch-name">Notes Life {c.city}</span>
                <span className="arch-blurb">{c.line}</span>
                <span className="arch-meta"><span>A new city for Notes Life</span><span className="arch-soon-tag">COMING SOON</span></span>
              </span>
            </div>
          </li>
        ))}
      </ul>
      <ArcadeFooter />
      <ArcadeStyles />
      <style jsx global>{`
        .arch-hero { width:min(1120px,100%); margin:0 auto; padding:clamp(36px,7vh,72px) 0 32px; }
        .arch-hero h1 { margin:0; font:500 clamp(48px,6.4vw,84px)/.95 Georgia,'Times New Roman',serif; letter-spacing:-.06em; }.arch-hero h1 em { color:var(--arc-deep); font-weight:500; }
        .arch-hero .arc-description { max-width:460px; }
        .arch-hero-row { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:12px 32px; }.arch-hero-row .arc-wallet { max-width:420px; margin-top:0; }
        .arch-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:18px; width:min(1120px,100%); margin:0 auto; padding:0 0 64px; list-style:none; }
        .arch-card { display:flex; flex-direction:column; height:100%; overflow:hidden; border:1px solid #e3e6df; border-radius:16px; background:#fff; color:inherit; text-decoration:none; box-shadow:0 12px 40px #17251f0a; transition:transform .15s,box-shadow .15s; }
        .arch-card:hover { transform:translateY(-3px); box-shadow:0 18px 55px #17251f14; }.arch-card:focus-visible { outline:2px solid var(--arc-deep); outline-offset:3px; }
        .arch-shot { display:block; aspect-ratio:8/5; overflow:hidden; background:var(--arc-board); }.arch-shot img { display:block; width:100%; height:100%; object-fit:cover; object-position:top; }
        .arch-body { display:flex; flex:1; flex-direction:column; gap:6px; padding:14px 16px 16px; }
        .arch-name { font:500 26px/1.1 Georgia,serif; letter-spacing:-.03em; }.arch-blurb { color:#657169; font-size:13px; line-height:1.55; }
        .arch-meta { display:flex; justify-content:space-between; gap:10px; margin-top:auto; padding-top:10px; color:#8a938b; font:600 9px ui-monospace,monospace; letter-spacing:.06em; }.arch-play { color:#5f9a22; }
        .arch-soon { cursor:default; }.arch-soon:hover { transform:none; box-shadow:0 12px 40px #17251f0a; }
        .arch-soon-shot { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; background:radial-gradient(circle at 30% 20%,#2c4235,#1b2a23 70%); color:#c8f28b; }
        .arch-soon-shot span { font:600 10px ui-monospace,monospace; letter-spacing:.2em; color:#9bb39f; }.arch-soon-shot strong { font:500 40px/1 Georgia,serif; letter-spacing:-.04em; color:#e8f7d2; }
        .arch-soon-tag { color:#c26a2b; }
        .arch-life-shot { position:relative; }.arch-life-shot > img { object-position:center; }
        .arch-life-inset { position:absolute; right:10px; bottom:10px; width:38%; overflow:hidden; border:2px solid #fff; border-radius:8px; box-shadow:0 6px 18px #17251f40; background:#fff; }
        .arch-life-inset img { display:block; width:100%; aspect-ratio:8/5; object-fit:cover; }.arch-life-inset em { display:block; padding:3px 6px; color:#17251f; font:700 8px ui-monospace,monospace; font-style:normal; letter-spacing:.1em; }
        .arch-soon-shot img { object-position:center; }.arch-soon-badge { position:absolute; top:10px; right:10px; padding:4px 8px; border-radius:999px; background:#17251fcc; color:#e8f7d2; font:700 9px ui-monospace,monospace; font-style:normal; letter-spacing:.1em; }
        @media(prefers-reduced-motion:reduce) { .arch-card { transition:none; } }
      `}</style>
    </section>
  );
}
