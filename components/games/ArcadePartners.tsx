"use client";

import { ArcadeFooter, ArcadeStyles, ArcadeTopbar } from "./ArcadeShell";
import { AD_PLACEMENTS } from "@/lib/ads";
import { AD_IMAGE, BILLBOARD_IMAGE, SQUARE_IMAGE } from "@/lib/ad-config";

// Partner with Notes Arcade (owner, 20 Nov 2026: "there should be partnership page too on arcade home"). The advert spots are booked
// like every other #NotesApp spot (placements "arcade" and "arcadesq" in lib/ads.ts, /advertise); the bigger partnerships start with a conversation.
// No audience numbers here until we have real ones to show.
const SPOTS = [
  { img: "/images/arcade/ad-ludo.png", title: "The middle of the Ludo board", text: "Every seed races to the centre, and so does every eye. Your logo sits right where the game ends." },
  { img: "/images/arcade/ad-landlord.png", title: "The Naija Landlord board", text: "Like a billboard in the town square: in the middle of the board, beside the dice, all game long." },
  { img: "/images/arcade/ad-banner.png", title: "Under every game", text: "A wide spot under the board of every game in the Arcade, from Snake and Chess to Whot and Ncho." },
];

const MORE = [
  { title: "A square of your own", text: "Your shop or brand as a square on the Naija Landlord board, beside Ariaria and Alaba." },
  { title: "Sponsored tournaments", text: "Put your name on a weekend of Ludo, Whot or Chess, with your own prizes for the winners. Prizes come from you; games never pay out cash." },
  { title: "Your card backs and boards", text: "Your colours on the Whot and Ace of Spades cards, or a board dressed in your brand for a season." },
  { title: "A game made for you", text: "A small game built around your product, in the Arcade, with your link at the end of every round." },
];

export default function ArcadePartners() {
  return (
    <section className="arc-page" aria-label="Partner with Notes Arcade">
      <ArcadeTopbar />
      <div className="arp">
        <p className="arc-kicker"><span>AD</span> &nbsp; PARTNERS · ADVERTISERS · SPONSORS</p>
        <h1>Put your brand<br /><em>in the game.</em></h1>
        <p className="arc-description arp-lead">Notes Arcade is free to play in any browser: Ludo, Whot, Ace of Spades, Naija Landlord, Ncho, Chess, Draughts and Snake. Players sit with a game for minutes at a time, and your brand can sit with them.</p>
        <div className="arp-cta">
          <a className="arc-btn" href="/advertise">BOOK AN ADVERT ↗</a>
          <a className="arc-btn-ghost" href="/contact">TALK TO US ABOUT A PARTNERSHIP</a>
        </div>

        <p className="arc-label arp-h">ADVERT SPOTS · BOOK THEM YOURSELF</p>
        <ul className="arp-spots">
          {SPOTS.map((s) => (
            <li key={s.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.img} alt={`${s.title}, in Notes Arcade`} loading="lazy" width={640} height={400} />
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
        <p className="arp-note">Booked on the #NotesApp advertising page like every other spot. Tick <strong>{AD_PLACEMENTS.arcade.label}</strong> for the wide spot under every game ({AD_IMAGE.width} × {AD_IMAGE.height} picture), and add a {BILLBOARD_IMAGE.width} × {BILLBOARD_IMAGE.height} billboard picture to stand on Naija Run&apos;s roadside billboards too. Tick <strong>{AD_PLACEMENTS.arcadesq.label}</strong> for the middle of the Ludo and Naija Landlord boards: they take a {SQUARE_IMAGE.width} × {SQUARE_IMAGE.height} square picture. A square picture never goes in a wide spot, nor a wide one in a square. Same rotation, and you see impressions and clicks in your dashboard. See the <a href="/advertise/specifications">advert specifications</a>.</p>

        <p className="arc-label arp-h">BIGGER PARTNERSHIPS · LET&apos;S TALK</p>
        <ul className="arp-more">
          {MORE.map((m) => <li key={m.title}><strong>{m.title}</strong><span>{m.text}</span></li>)}
        </ul>
        <div className="arp-cta">
          <a className="arc-btn" href="/contact">START A CONVERSATION ↗</a>
          <a className="arc-btn-ghost" href="/arcade">← ALL GAMES</a>
        </div>
      </div>
      <ArcadeFooter />
      <ArcadeStyles />
      <style jsx global>{`
        .arp { width:min(1120px,100%); margin:0 auto; padding:clamp(36px,7vh,72px) 0 56px; }
        .arp h1 { margin:0; font:500 clamp(48px,6.4vw,84px)/.95 Georgia,'Times New Roman',serif; letter-spacing:-.06em; }.arp h1 em { color:var(--arc-deep); font-weight:500; }
        .arp-lead { max-width:560px; }
        .arp-cta { display:flex; flex-wrap:wrap; gap:10px; margin:6px 0 10px; }
        .arp-h { margin:44px 0 14px; }
        .arp-spots { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; margin:0; padding:0; list-style:none; }
        .arp-spots li { display:flex; flex-direction:column; gap:6px; padding:12px; border:1px solid #e3e6df; border-radius:14px; background:#fff; }
        .arp-spots img { width:100%; aspect-ratio:8/5; object-fit:contain; border-radius:9px; background:#eef0e8; }
        .arp-spots strong, .arp-more strong { font:500 20px/1.2 Georgia,serif; letter-spacing:-.02em; color:#17251f; }
        .arp-spots span, .arp-more span { color:#657169; font-size:13px; line-height:1.6; }
        .arp-note { max-width:720px; margin:14px 0 0; color:#6d7870; font-size:13px; line-height:1.7; }.arp-note a { color:#5f9a22; }
        .arp-more { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin:0 0 18px; padding:0; list-style:none; }
        .arp-more li { display:flex; flex-direction:column; gap:4px; padding:16px; border:1px dashed #cfd6c8; border-radius:14px; background:#fbfcf8; }
        @media(max-width:820px) { .arp-spots, .arp-more { grid-template-columns:1fr; } }
      `}</style>
    </section>
  );
}
