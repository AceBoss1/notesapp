"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { arcadeReady, subscribeArcadeAccount, type ArcadeAccount } from "@/lib/arcade/store";
import { ARCADE_GAMES, type ArcadeGame } from "@/lib/arcade/catalogue";
import ArcadeAdSpot from "./ArcadeAdSpot";

// The frame every Notes Arcade game sits in: the NOTES ARCADE top bar, the side panel (what the game is and how to play),
// the game's own console on the right, and the footer. Same look as Snake (components/games/SnakeGame.tsx).
// A game passes its catalogue entry (lib/arcade/catalogue.ts) and renders its board as children. Classes: arc-*.
// Shared pieces a game can use inside its console: .arc-console (the white card), .arc-head (score row), .arc-label,
// .arc-btn (green button), .arc-btn-ghost, .arc-select, .arc-status (one line of what's happening), .arc-overlay (start / game over).
// The game's number is its place in the catalogue (the `index` prop is kept for older callers and ignored).
export default function ArcadeShell({ game, children }: { game: ArcadeGame; index?: number; children: ReactNode }) {
  const index = ARCADE_GAMES.findIndex((g) => g.slug === game.slug) + 1;
  // A signed-in member's saved progress loads before the game first reads it (lib/arcade/store.ts); guests wait only for the sign-in check.
  const [ready, setReady] = useState(false);
  useEffect(() => { let live = true; arcadeReady().then(() => { if (live) setReady(true); }); return () => { live = false; }; }, []);
  return (
    <section className="arc-page" aria-label={`${game.name}, Notes Arcade`}>
      <ArcadeTopbar />
      <div className="arc-layout">
        <div className="arc-intro">
          <p className="arc-kicker"><span>{String(index).padStart(2, "0")}</span> &nbsp; {game.kicker.toUpperCase()} · {game.players.toUpperCase()}</p>
          <h1>{game.headline[0]}<br /><em>{game.headline[1]}</em></h1>
          <p className="arc-description">{game.description}</p>
          <details className="arc-howto" open>
            <summary>HOW TO PLAY</summary>
            <ul>{game.howTo.map((h) => <li key={h}>{h}</li>)}</ul>
          </details>
          <ArcadeWalletNote />
          <a className="arc-back" href="/arcade">← All games</a>
        </div>
        <div className="arc-main">
          {ready ? children : <div className="arc-console arc-loading" aria-busy="true"><p className="arc-status">Loading your game…</p></div>}
          <ArcadeAdSpot variant="banner" game={game.slug} />
          <ArcadeGallery game={game} />
        </div>
      </div>
      <ArcadeFooter />
      <ArcadeStyles />
    </section>
  );
}

export function ArcadeTopbar() {
  return (
    <div className="arc-topbar">
      <a className="arc-brand" href="/arcade" aria-label="Notes Arcade, all games">
        <Image className="arc-brand-icon" src="/images/brand/arcade-icon-192.png" alt="" width={32} height={32} />
        <span>NOTES <span className="arc-brand-accent">ARCADE</span></span>
      </a>
      <div className="arc-topbar-right">
        <a className="arc-nav" href="/arcade/partners">PARTNERS</a>
        <a className="arc-install" href="/arcade/install" aria-label="Install Notes Arcade as an app">INSTALL APP</a>
        <a className="arc-home" href="/">#NotesApp</a>
        <div className="arc-live"><i /> ARCADE MODE</div>
      </div>
    </div>
  );
}

export function ArcadeFooter() {
  return (
    <footer className="arc-footer">
      <span>NOTES ARCADE</span>
      <nav className="arc-footer-links" aria-label="Notes Arcade">
        <a href="/arcade">ALL GAMES</a><a href="/arcade/partners">PARTNERS</a><a href="/arcade/install">INSTALL APP</a><a href="/">#NOTESAPP</a>
      </nav>
      <span>MADE FOR A LITTLE FUN <b>·</b> 2026</span>
    </footer>
  );
}

export function ArcadeStyles() {
  return (
    <style jsx global>{`
      .arc-page { --arc-ink:#17251f; --arc-muted:#748078; --arc-paper:#f7f7f2; --arc-green:#bdf36b; --arc-deep:#83b83c; --arc-board:#1b2a23; --arc-rule:#e4e7df; min-height:100vh; padding:0 clamp(20px,5.6vw,88px); background:var(--arc-paper); color:var(--arc-ink); font-family:Inter,Arial,sans-serif; }
      .arc-topbar { height:82px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--arc-rule); }
      .arc-brand { display:flex; align-items:center; gap:10px; color:var(--arc-ink); text-decoration:none; font-size:12px; font-weight:800; letter-spacing:.09em; }
      .arc-brand-icon { display:block; width:32px; height:32px; object-fit:contain; }.arc-brand-accent { color:#9cd849; }
      .arc-topbar-right { display:flex; align-items:center; gap:18px; }.arc-home { color:#637068; font:600 10px ui-monospace,monospace; letter-spacing:.08em; text-decoration:none; }.arc-home:hover { color:var(--arc-ink); }
      .arc-install { padding:6px 10px; border:1px solid #cfe3b0; border-radius:999px; background:#f1f8e6; color:#3f5a2c; font:700 9px ui-monospace,monospace; letter-spacing:.08em; text-decoration:none; white-space:nowrap; }.arc-install:hover { background:#e4f2cf; }
      .arc-nav { color:#3f5a2c; font:700 10px ui-monospace,monospace; letter-spacing:.08em; text-decoration:none; white-space:nowrap; }.arc-nav:hover { color:var(--arc-ink); text-decoration:underline; }
      .arc-footer-links { display:flex; flex-wrap:wrap; justify-content:center; gap:6px 16px; }.arc-footer-links a { color:#6d7870; text-decoration:none; }.arc-footer-links a:hover { color:var(--arc-ink); text-decoration:underline; }
      .arc-live { display:flex; align-items:center; gap:9px; color:#637068; font:600 10px ui-monospace,monospace; letter-spacing:.12em; }.arc-live i { width:7px; height:7px; display:inline-block; border-radius:50%; background:#9bd34d; box-shadow:0 0 0 4px #9bd34d22; }
      .arc-layout { display:grid; grid-template-columns:minmax(220px,.7fr) minmax(340px,1.3fr); gap:clamp(28px,6vw,96px); align-items:start; width:min(1120px,100%); margin:0 auto; padding:clamp(36px,7vh,72px) 0 56px; }
      .arc-kicker { margin:0 0 22px; color:#77817b; font:600 10px ui-monospace,monospace; letter-spacing:.12em; }.arc-kicker span { color:#93c640; }
      .arc-intro h1 { margin:0; font:500 clamp(52px,6.4vw,84px)/.92 Georgia,'Times New Roman',serif; letter-spacing:-.06em; }.arc-intro h1 em { color:var(--arc-deep); font-weight:500; }
      .arc-description { max-width:340px; margin:22px 0 22px; color:#657169; font-size:14px; line-height:1.75; }
      .arc-howto { max-width:340px; padding-top:16px; border-top:1px solid var(--arc-rule); }.arc-howto summary { cursor:pointer; list-style:none; color:#77817b; font:600 10px ui-monospace,monospace; letter-spacing:.12em; }.arc-howto summary::-webkit-details-marker { display:none; }
      .arc-howto ul { margin:12px 0 0; padding:0 0 0 16px; color:#6d7870; font-size:12px; line-height:1.7; }.arc-howto li { margin-bottom:4px; }.arc-howto li::marker { color:#9bd34d; }
      .arc-back { display:inline-block; margin-top:22px; color:#6d7870; font:600 10px ui-monospace,monospace; letter-spacing:.08em; text-decoration:none; }.arc-back:hover { color:var(--arc-ink); }
      .arc-main { min-width:0; }
      .arc-loading { display:grid; place-items:center; min-height:320px; }
      .arc-console { padding:16px; border:1px solid #e3e6df; border-radius:16px; background:#fff; box-shadow:0 18px 55px #17251f0c; }
      .arc-head { display:flex; flex-wrap:wrap; align-items:center; gap:14px 18px; padding:4px 6px 14px; }
      .arc-label { display:block; color:#929b94; font:600 9px ui-monospace,monospace; letter-spacing:.12em; }
      .arc-stat strong { display:block; color:#202d26; font:500 20px ui-monospace,monospace; letter-spacing:.04em; }
      .arc-spacer { flex:1; }
      .arc-select { min-height:30px; padding:5px 8px; border:1px solid #e3e6df; border-radius:6px; background:#f8f9f6; color:#58645c; font:700 9px ui-monospace,monospace; letter-spacing:.06em; cursor:pointer; }
      .arc-btn { display:inline-flex; align-items:center; justify-content:center; gap:10px; padding:11px 16px; border:0; border-radius:7px; background:#c2f17a; color:#20301e; font:700 10px ui-monospace,monospace; letter-spacing:.08em; cursor:pointer; transition:transform .15s,background .15s; }.arc-btn:hover:not(:disabled) { transform:translateY(-2px); background:#d3ff96; }.arc-btn:disabled { opacity:.45; cursor:default; }
      .arc-btn-ghost { display:inline-flex; align-items:center; justify-content:center; padding:9px 13px; border:1px solid #e3e6df; border-radius:7px; background:#f8f9f6; color:#58645c; font:700 9px ui-monospace,monospace; letter-spacing:.08em; cursor:pointer; }.arc-btn-ghost:hover { background:#eef3e6; }
      .arc-btn:focus-visible,.arc-btn-ghost:focus-visible,.arc-select:focus-visible,.arc-cell:focus-visible { outline:2px solid var(--arc-deep); outline-offset:3px; }
      .arc-status { margin:12px 4px 2px; min-height:18px; color:#5c685f; font:600 10px ui-monospace,monospace; letter-spacing:.06em; }
      .arc-board-wrap { position:relative; overflow:hidden; border-radius:10px; background:var(--arc-board); }
      .arc-overlay { position:absolute; inset:0; z-index:5; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; background:#14231fdc; color:#fff; text-align:center; backdrop-filter:blur(3px); }
      .arc-overlay-kicker { margin:0 0 7px; color:#c1e993; font:600 9px ui-monospace,monospace; letter-spacing:.16em; }.arc-overlay h2 { margin:0 0 8px; color:#fff; font:500 clamp(28px,4vw,40px)/1.1 Georgia,serif; letter-spacing:-.04em; }.arc-overlay p { margin:0 0 18px; color:#c1cbc3; font-size:12px; }
      .arc-footer { display:flex; flex-wrap:wrap; align-items:center; gap:10px 16px; justify-content:space-between; width:min(1120px,100%); margin:0 auto; padding:20px 0 24px; border-top:1px solid var(--arc-rule); color:#98a098; font:600 8px ui-monospace,monospace; letter-spacing:.12em; }.arc-footer b { padding:0 4px; color:#a5d95c; }
      @media(max-width:820px) { .arc-page { padding:0 16px; }.arc-topbar { height:64px; }.arc-home, .arc-live { display:none; }.arc-topbar-right { gap:12px; }.arc-footer { justify-content:center; text-align:center; }.arc-layout { grid-template-columns:1fr; gap:22px; padding:26px 0 40px; }.arc-intro h1 { font-size:clamp(44px,12vw,62px); }.arc-description { max-width:none; margin:14px 0; font-size:13px; }.arc-howto { max-width:none; }.arc-howto:not([open]) ul { display:none; }.arc-console { padding:10px; border-radius:14px; }.arc-footer { font-size:7px; } }
      @media(prefers-reduced-motion:reduce) { .arc-btn { transition:none; } }
    `}</style>
  );
}

// The screenshots under a game: one per level, or a game from start to finish (catalogue `shots`). Used by the frame and by Snake.
export function ArcadeGallery({ game }: { game: ArcadeGame }) {
  if (game.shots.length === 0) return null;
  return (
    <>
        <div className="arc-gallery">
          <p className="arc-label">SCREENSHOTS · {game.shots.some((x) => x.level) ? "EVERY LEVEL" : "A GAME FROM START TO FINISH"}</p>
          <ul>
            {game.shots.map((shot, i) => (
              <li key={shot.caption}>
                <a href={`/images/arcade/${game.slug}-${i + 1}.png`} target="_blank" rel="noopener" aria-label={`${game.name}: ${shot.caption}, full size`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/images/arcade/${game.slug}-${i + 1}.png`} alt={`${game.name}, ${shot.caption}`} loading="lazy" width={640} height={400} />
                </a>
                <span>{shot.caption}</span>
              </li>
            ))}
          </ul>
        </div>
      <style jsx global>{`
      .arc-gallery { margin-top:22px; }.arc-gallery ul { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin:10px 0 0; padding:0; list-style:none; }
      .arc-gallery a { display:block; overflow:hidden; aspect-ratio:8/5; border:1px solid #e3e6df; border-radius:10px; background:#fff; }.arc-gallery a:focus-visible { outline:2px solid var(--arc-deep); outline-offset:3px; }
      .arc-gallery img { display:block; width:100%; height:100%; object-fit:contain; object-position:center; transition:transform .2s; }.arc-gallery a:hover img { transform:scale(1.03); }
      .arc-gallery span { display:block; margin-top:6px; color:#6d7870; font:600 9px ui-monospace,monospace; letter-spacing:.1em; text-transform:uppercase; }
        @media(max-width:820px) { .arc-gallery ul { gap:8px; } }
        @media(prefers-reduced-motion:reduce) { .arc-gallery img { transition:none; } }
        .arc-gallery .arc-label { display:block; color:#929b94; font:600 9px ui-monospace,monospace; letter-spacing:.12em; }
      `}</style>
    </>
  );
}

// Arcade money and the #NotesApp account (owner, 20 Nov 2026): playing is free for everyone with no sign-in, but a guest's progress
// isn't saved and every fresh page load starts afresh (lib/arcade/store.ts). Signing in with #NotesApp saves progress and syncs N$, scores
// and referral bonus credit through the Notes Life wallet, and opens the referral leaderboard, friends (chat, calls, playing groups),
// each game's leaderboard (top computer players and top people) and the shared Notesville rich list. Same profile and N$ as Notes Life. No game pays real naira.
export function ArcadeWalletNote() {
  const [acct, setAcct] = useState<ArcadeAccount>({ status: "loading" });
  useEffect(() => subscribeArcadeAccount(setAcct), []);
  const member = acct.status === "member";
  return (
    <div className="arc-wallet">
      <p className="arc-wallet-title"><span className="arc-wallet-coin" aria-hidden>N$</span> {member ? "SIGNED IN · PROGRESS SAVED" : "PLAY FREE · SIGN IN TO SAVE"}</p>
      {member
        ? <p className="arc-wallet-member"><strong>Signed in as {acct.name}.</strong> Your wins and progress in every game are saved to your #NotesApp account{acct.saving ? " (saving…)" : ""}.{acct.error ? ` ${acct.error}` : ""}</p>
        : <p><strong>Play free, no sign-in needed.</strong> As a guest nothing is saved: every time the page loads, you start afresh.</p>}
      <p>Sign in with your #NotesApp account and you get, among other things:</p>
      <ul className="arc-wallet-list">
        <li>Your progress, scores and <strong>N$</strong> (Notesville Naira) saved and synced</li>
        <li>Referral bonus credit and the referral leaderboard</li>
        <li>Friends: chat, call and play together, in your own playing groups</li>
        <li>Each game&apos;s leaderboard: the top computer players 🤖 and the top people</li>
        <li>A place on the Notesville rich list, the Billionaires List shared with Notes Life</li>
      </ul>
      <p className="arc-wallet-soon">One profile and one N$ wallet with Notes Life. N$ is game money: no game pays out real naira. Saving your progress works now; N$ sync, leaderboards, friends and referral credit are coming next.</p>
      {!member && <a className="arc-wallet-link" href="/login?next=/arcade">SIGN IN TO SAVE ↗</a>}
      <style jsx global>{`
        .arc-wallet { max-width:340px; margin-top:22px; padding:14px 16px; border:1px solid #e3e6df; border-radius:12px; background:#fff; color:#5c685f; font-size:12px; line-height:1.65; }
        .arc-wallet p { margin:0 0 8px; }.arc-wallet strong { color:#17251f; }
        .arc-wallet-title { display:flex; align-items:center; gap:8px; color:#77817b; font:600 10px ui-monospace,monospace; letter-spacing:.12em; }
        .arc-wallet-coin { display:inline-grid; place-items:center; width:26px; height:26px; border-radius:50%; background:#c2f17a; color:#20301e; font:800 9px ui-monospace,monospace; letter-spacing:0; }
        .arc-wallet-soon { color:#8a938b; font-size:11px; }
        .arc-wallet-member { color:#3f5a2c; }
        .arc-wallet-list { margin:0 0 10px; padding:0 0 0 16px; }.arc-wallet-list li { margin-bottom:3px; }.arc-wallet-list li::marker { color:#9bd34d; }
        .arc-wallet-link { color:#5f9a22; font:700 10px ui-monospace,monospace; letter-spacing:.08em; text-decoration:none; }.arc-wallet-link:hover { color:#17251f; }
        @media(max-width:820px) { .arc-wallet { max-width:none; } }
      `}</style>
    </div>
  );
}
