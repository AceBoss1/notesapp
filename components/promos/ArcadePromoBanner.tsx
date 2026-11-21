"use client";

import { useState } from "react";
import { DAVIDO_AT_34, DAVIDO_DISCLAIMER, campaignByCode, campaignLive } from "@/lib/promos";

// The DAVIDO-at-34 banner on the Arcade home (arcade.notesapp.name.ng, the address on the poster): type the code to open the offer page,
// or go straight to a free plan or tonight's tournament. Shown while the campaign is live (lib/promos.ts).
export default function ArcadePromoBanner() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  if (!campaignLive(DAVIDO_AT_34, new Date())) return null;
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const c = campaignByCode(code);
    if (!c) { setErr("That code isn't one of our offers. Try DAVIDO-at-34."); return; }
    window.location.href = `/offers/${c.code}`;
  };
  return (
    <aside className="apb" aria-label="Davido at 34: birthday offers">
      <div className="apb-text">
        <p className="apb-kicker">HAPPY 34TH BIRTHDAY, DAVIDO · CODE DAVIDO-at-34</p>
        <p className="apb-line">Free Enterprise, Business and Pro plans while they last, four venture slots, and the <b>Arcade tournament tonight at 10 PM</b> (Lagos time).</p>
      </div>
      <form className="apb-form" onSubmit={go}>
        <label className="apb-sr" htmlFor="apb-code">Your code</label>
        <input id="apb-code" value={code} onChange={(e) => { setCode(e.target.value); setErr(""); }} placeholder="Enter your code" maxLength={40} autoComplete="off" />
        <button type="submit">GO</button>
      </form>
      <div className="apb-links">
        <a href="/offers/DAVIDO-at-34">CLAIM A FREE PLAN ↗</a>
        <a href="/arcade/tournament">TONIGHT&apos;S TOURNAMENT ↗</a>
      </div>
      {err && <p className="apb-err" role="alert">{err}</p>}
      <p className="apb-small">{DAVIDO_DISCLAIMER}</p>
      <style jsx>{`
        .apb { display:grid; grid-template-columns:1fr auto; gap:10px 18px; align-items:center; margin:0 0 18px; padding:14px 16px; border-radius:14px; background:linear-gradient(120deg,#5c0a1f,#8a1430); color:#fff; }
        .apb-kicker { margin:0; font:800 11px ui-monospace,monospace; letter-spacing:.12em; color:#f6d465; }
        .apb-line { margin:4px 0 0; font-size:14px; line-height:1.45; }
        .apb-form { display:flex; gap:6px; }
        .apb-form input { width:170px; min-width:0; padding:9px 11px; border:0; border-radius:9px; font:700 13px ui-monospace,monospace; color:#17251f; }
        .apb-form button { padding:9px 14px; border:0; border-radius:9px; background:#f6d465; color:#3a0614; font:800 12px ui-monospace,monospace; letter-spacing:.08em; cursor:pointer; }
        .apb-links { grid-column:1 / -1; display:flex; flex-wrap:wrap; gap:8px 16px; }
        .apb-links a { color:#fff; font:800 11px ui-monospace,monospace; letter-spacing:.1em; text-decoration:underline; text-underline-offset:3px; }
        .apb-err { grid-column:1 / -1; margin:0; color:#ffd2c9; font-size:12px; font-weight:700; }
        .apb-small { grid-column:1 / -1; margin:0; font-size:10.5px; line-height:1.4; color:#f3d6dc; }
        .apb-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
        @media(max-width:620px) { .apb { grid-template-columns:1fr; } .apb-form input { flex:1; width:auto; } }
      `}</style>
    </aside>
  );
}
