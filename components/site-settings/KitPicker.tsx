"use client";

import { useState } from "react";
import Link from "next/link";
import { KITS, kitAllowed, type Kit } from "@/lib/site-kits";
import { tierName } from "@/lib/site-themes";

// Step 1 on Your site: start from a kit (lib/site-kits.ts). A kit sets the look, the colours, the sections and starter words where nothing is
// written yet; kits the member's plan doesn't include show what they need. Flavours of one kit (Beauty and wellness: Spa, Massage, Hair,
// Nails) share one card with a button for each.
export default function KitPicker({ tier, current, onApply }: { tier: string; current: string; onApply: (kit: Kit) => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  async function use(k: Kit) {
    if (!confirm(`Start from the ${k.name} kit? It sets your site's look, colours and sections, and fills in starter words only where you haven't written anything. You can change everything after.`)) return;
    setBusy(k.id); setMsg("");
    try { await onApply(k); setMsg(`Done: your site now uses the ${k.name} kit. Fill in your details below.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't apply the kit."); }
    finally { setBusy(""); }
  }
  return (
    <section className="card mt-10 p-6" aria-labelledby="kit-h">
      <h2 id="kit-h" className="font-display text-xl text-ink">1. Start from a kit</h2>
      <p className="mt-1 text-sm text-slate">Pick the one closest to what you do. It sets everything up; you then put in your own words, prices and pictures.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {KITS.map((k, i) => {
          const open = kitAllowed(k, tier);
          if (k.family) {
            if (KITS.findIndex((x) => x.family?.id === k.family!.id) !== i) return null; // the family's card is drawn once
            const flavours = KITS.filter((x) => x.family?.id === k.family!.id);
            const using = flavours.find((x) => x.id === current || (current === "spa" && x.id === "beauty-spa") || (current === "salon" && x.id === "beauty-hair"));
            return (
              <li key={k.family.id} className={`flex flex-col rounded-2xl border p-4 sm:col-span-2 ${using ? "border-crimson ring-2 ring-crimson/30" : "border-rule"}`}>
                <p className="font-ui text-sm font-bold text-ink"><span aria-hidden className="mr-1.5">{flavours.map((f) => f.emoji).join("")}</span>{k.family.name}{using ? ` · ${using.family!.flavour} in use` : ""}</p>
                <p className="mt-1 text-xs text-slate">A full photo up top, your services as a menu with times and prices, and Book your appointment on every page. Choose yours:</p>
                <p className="mt-1 text-xs text-ink"><strong>Best for:</strong> spas, massage therapists, hair salons, barbers, wig makers and nail studios.</p>
                {open ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flavours.map((f) => (
                      <button key={f.id} type="button" disabled={!!busy} onClick={() => use(f)} title={f.blurb}
                        className={`rounded-full border px-4 py-2 font-ui text-xs font-bold disabled:opacity-50 ${using?.id === f.id ? "border-crimson bg-crimson text-paper" : "border-rule text-ink hover:border-crimson"}`}>
                        {busy === f.id ? "Setting up…" : `${f.emoji} ${f.family!.flavour}`}
                      </button>
                    ))}
                  </div>
                ) : <p className="mt-3 text-xs font-semibold text-slate">🔒 Comes with {tierName(k.minTier)} · <Link href="/pricing" className="text-crimson underline">See plans</Link></p>}
              </li>
            );
          }
          return (
            <li key={k.id} className={`flex flex-col rounded-2xl border p-4 ${current === k.id ? "border-crimson ring-2 ring-crimson/30" : "border-rule"}`}>
              <p className="font-ui text-sm font-bold text-ink"><span aria-hidden className="mr-1.5">{k.emoji}</span>{k.name}{current === k.id ? " · in use" : ""}</p>
              <p className="mt-1 flex-1 text-xs text-slate">{k.blurb}</p>
              {k.bestFor && <p className="mt-2 text-xs text-ink"><strong>Best for:</strong> {k.bestFor}</p>}
              {open
                ? <button type="button" disabled={!!busy} onClick={() => use(k)} className="btn-primary mt-3 self-start !px-4 !py-2 text-xs disabled:opacity-50">{busy === k.id ? "Setting up…" : current === k.id ? "Apply again" : "Use this kit"}</button>
                : <p className="mt-3 text-xs font-semibold text-slate">🔒 Comes with {tierName(k.minTier)} · <Link href="/pricing" className="text-crimson underline">See plans</Link></p>}
            </li>
          );
        })}
      </ul>
      {msg && <p className="mt-3 text-sm text-ink" role="status">{msg}</p>}
    </section>
  );
}
