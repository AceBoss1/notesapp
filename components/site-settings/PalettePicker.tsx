"use client";

import { useState } from "react";
import Link from "next/link";
import { HEX_RE, SITE_PALETTES, canCustomColour, paletteRgb, type PaletteId } from "@/lib/site-themes";

const rgb = (c: readonly number[]) => `rgb(${c.join(" ")})`;
// The colour set of a member's site (lib/site-themes.ts): a preset for every plan, or (Pro and above) their own brand colour.
export default function PalettePicker({ tier, value, onSave }: { tier: string; value: { id: PaletteId; custom?: string }; onSave: (v: { id: PaletteId; custom?: string }) => Promise<void> }) {
  const [v, setV] = useState(value);
  const [hex, setHex] = useState(value.custom ?? "#0e7a5c");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const custom = canCustomColour(tier);
  async function save(next: { id: PaletteId; custom?: string }) {
    setBusy(true); setMsg("");
    try { await onSave(next); setV(next); setMsg("Saved. Your site uses these colours now."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save the colours."); }
    finally { setBusy(false); }
  }
  const preview = paletteRgb(HEX_RE.test(hex) ? { custom: hex } : null, custom ? "pro" : "basic");
  return (
    <div className="mt-6">
      <p className="font-ui text-sm font-bold text-ink">Colours</p>
      <p className="mt-0.5 text-xs text-slate">Buttons, links, bands and highlights all over your site take this colour, in any look.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Colour set">
        {SITE_PALETTES.map((p) => {
          const on = !v.custom && v.id === p.id;
          return (
            <button key={p.id} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => save({ id: p.id })} title={p.name}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${on ? "border-ink font-semibold text-ink" : "border-rule text-slate hover:border-ink"}`}>
              <span aria-hidden className="flex h-5 w-8 overflow-hidden rounded-full"><span className="flex-1" style={{ background: rgb(p.deep) }} /><span className="flex-1" style={{ background: rgb(p.base) }} /><span className="flex-1" style={{ background: rgb(p.bright) }} /></span>
              {p.name}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-ink">Your own brand colour:</span>
        {custom ? (
          <>
            <input type="color" value={HEX_RE.test(hex) ? hex : "#0e7a5c"} onChange={(e) => setHex(e.target.value)} aria-label="Brand colour" className="h-8 w-10 cursor-pointer rounded border border-rule" />
            <input value={hex} onChange={(e) => setHex(e.target.value.trim())} maxLength={7} className="w-24 rounded-lg border border-rule bg-card px-2 py-1.5 font-mono" aria-label="Brand colour code" />
            <span aria-hidden className="flex h-5 w-8 overflow-hidden rounded-full"><span className="flex-1" style={{ background: rgb(preview.deep) }} /><span className="flex-1" style={{ background: rgb(preview.base) }} /><span className="flex-1" style={{ background: rgb(preview.bright) }} /></span>
            <button type="button" disabled={busy || !HEX_RE.test(hex)} onClick={() => save({ id: v.id, custom: hex.toLowerCase() })} className="rounded-full border border-ink px-3 py-1.5 font-semibold text-ink disabled:opacity-50">{v.custom ? "Update" : "Use it"}</button>
            {v.custom && <span className="text-slate">In use. Pick a set above to go back.</span>}
          </>
        ) : <span className="text-slate">🔒 Comes with Pro · <Link href="/pricing" className="text-crimson underline">See plans</Link></span>}
      </div>
      {msg && <p className="mt-2 text-sm text-ink" role="status">{msg}</p>}
    </div>
  );
}
