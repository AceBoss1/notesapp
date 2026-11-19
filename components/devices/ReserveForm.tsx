"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { COLOURS, DEVICES, MOQ, type ColourId, type Device } from "@/lib/devices";
import PhoneArt from "./PhoneArt";

// Reserve a NotesPhone (lib/devices.ts): free, and commits no one. Posts to /api/devices/reserve; a signed-in member's reservation is
// linked to their account. One per phone per email: reserving the same phone again just updates it.
const field = "mt-1 w-full rounded-xl border border-rule bg-card px-3 py-2 text-sm text-ink outline-none focus:border-crimson";

export default function ReserveForm({ initial = "e-pro" }: { initial?: Device["id"] }) {
  const [model, setModel] = useState<Device["id"]>(initial);
  const [colour, setColour] = useState<ColourId>("any");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ phone: string; again: boolean } | null>(null);
  const shown = COLOURS.find((c) => c.id === colour) ?? COLOURS[5];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth.currentUser) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
      const res = await fetch("/api/devices/reserve", { method: "POST", headers, body: JSON.stringify({ name, email, model, colour, city, notify }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Couldn't save your reservation. Try again.");
      setDone({ phone: DEVICES.find((d) => d.id === model)!.name, again: !!j.again });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your reservation. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-6 text-center" role="status">
        <p className="font-display text-2xl text-ink">{done.again ? `Your ${done.phone} reservation is updated.` : `${done.phone} is reserved for you.`}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate">We&apos;ve sent you an email. Nothing to pay: we&apos;ll tell you the price and the date before anyone pays anything.</p>
        <button type="button" className="btn-ghost mt-4" onClick={() => setDone(null)}>Reserve another phone</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="card grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr,180px]">
      <div className="grid min-w-0 gap-4">
        <fieldset>
          <legend className="font-ui text-sm font-bold text-ink">Which phone?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DEVICES.map((d) => (
              <label key={d.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${model === d.id ? "border-crimson bg-crimson/5" : "border-rule"}`}>
                <input type="radio" name="model" value={d.id} checked={model === d.id} onChange={() => setModel(d.id)} className="mt-1 accent-crimson" />
                <span><b className="text-ink">{d.name}</b><span className="block text-xs text-slate">{d.status === "first" ? "Our first phone" : "Launch date in 2027"}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="font-ui text-sm font-bold text-ink">Colour you&apos;d like <span className="font-normal text-slate">(to be confirmed by the factory)</span></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[{ id: "any" as const, label: "Any", swatch: "" }, ...COLOURS].map((c) => (
              <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${colour === c.id ? "border-crimson" : "border-rule"}`}>
                <input type="radio" name="colour" value={c.id} checked={colour === c.id} onChange={() => setColour(c.id)} className="sr-only" />
                {c.swatch && <span className="h-4 w-4 rounded-full ring-1 ring-black/15" style={{ background: c.swatch }} />}
                <span className="text-ink">{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-ink">Your name<input required value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" className={field} /></label>
          <label className="block text-sm text-ink">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" className={field} /></label>
          <label className="block text-sm text-ink sm:col-span-2">City or town<input required value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} autoComplete="address-level2" className={field} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-crimson" /> Email me news about this phone</label>
        {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Reserving…" : "Reserve, free"}</button>
          <span className="text-xs text-slate">Free, and you don&apos;t have to buy. We order a phone once {MOQ} people reserve it.</span>
        </div>
      </div>
      <div className="hidden items-center justify-center md:flex"><PhoneArt swatch={shown.swatch} label={colour === "any" ? "Black" : shown.label} /></div>
    </form>
  );
}
