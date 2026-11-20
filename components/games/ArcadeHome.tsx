"use client";

import { ARCADE_GAMES } from "@/lib/arcade/catalogue";
import { ArcadeFooter, ArcadeStyles, ArcadeTopbar } from "./ArcadeShell";

// The Notes Arcade home: every game as a card with its screenshot, what it is and who plays. app/(arcade)/arcade/page.tsx.
export default function ArcadeHome() {
  return (
    <section className="arc-page" aria-label="Notes Arcade">
      <ArcadeTopbar />
      <div className="arch-hero">
        <p className="arc-kicker"><span>{String(ARCADE_GAMES.length).padStart(2, "0")}</span> &nbsp; GAMES · FREE · IN YOUR BROWSER</p>
        <h1>Pass the time,<br /><em>play a game.</em></h1>
        <p className="arc-description">Board games, card games and the classics, made for #NotesApp. No download, no sign-in: pick one and play.</p>
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
      </ul>
      <ArcadeFooter />
      <ArcadeStyles />
      <style jsx global>{`
        .arch-hero { width:min(1120px,100%); margin:0 auto; padding:clamp(36px,7vh,72px) 0 32px; }
        .arch-hero h1 { margin:0; font:500 clamp(48px,6.4vw,84px)/.95 Georgia,'Times New Roman',serif; letter-spacing:-.06em; }.arch-hero h1 em { color:var(--arc-deep); font-weight:500; }
        .arch-hero .arc-description { max-width:460px; }
        .arch-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:18px; width:min(1120px,100%); margin:0 auto; padding:0 0 64px; list-style:none; }
        .arch-card { display:flex; flex-direction:column; height:100%; overflow:hidden; border:1px solid #e3e6df; border-radius:16px; background:#fff; color:inherit; text-decoration:none; box-shadow:0 12px 40px #17251f0a; transition:transform .15s,box-shadow .15s; }
        .arch-card:hover { transform:translateY(-3px); box-shadow:0 18px 55px #17251f14; }.arch-card:focus-visible { outline:2px solid var(--arc-deep); outline-offset:3px; }
        .arch-shot { display:block; aspect-ratio:8/5; overflow:hidden; background:var(--arc-board); }.arch-shot img { display:block; width:100%; height:100%; object-fit:cover; object-position:top; }
        .arch-body { display:flex; flex:1; flex-direction:column; gap:6px; padding:14px 16px 16px; }
        .arch-name { font:500 26px/1.1 Georgia,serif; letter-spacing:-.03em; }.arch-blurb { color:#657169; font-size:13px; line-height:1.55; }
        .arch-meta { display:flex; justify-content:space-between; gap:10px; margin-top:auto; padding-top:10px; color:#8a938b; font:600 9px ui-monospace,monospace; letter-spacing:.06em; }.arch-play { color:#5f9a22; }
        @media(prefers-reduced-motion:reduce) { .arch-card { transition:none; } }
      `}</style>
    </section>
  );
}
