"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import PageHero from "@/components/PageHero";
import MessageButton from "@/components/messages/MessageButton";
import { formatNaira } from "@/lib/booking-time";
import { NIGERIAN_STATES } from "@/lib/merch";
import { coverageLabel } from "@/lib/logistics";
import { serviceName } from "@/lib/shipments";

// The logistics provider network (lib/logistics.ts): providers by the states they cover, what they do and roughly what they charge.
// A store messages one to agree how pickups work, then chooses it as its delivery partner: from then on its buyers pay the partner's
// price at checkout, and its orders go straight to the partner.
type Provider = {
  uid: string; username: string; name: string; avatar: string; about: string; areas: string; coverage: string[]; services: string[];
  base: { city: string; state: string }; from: { city: number; national: number }; sameDay: boolean;
};
type Partner = { providerUid: string; name: string; username: string } | null;

export default function LogisticsNetworkPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [state, setState] = useState("");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [partner, setPartner] = useState<Partner>(null);
  const [seller, setSeller] = useState(false); // can choose a partner: sells on Free Basic or above
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    setProviders(null);
    fetch(`/api/logistics?view=network${state ? `&state=${encodeURIComponent(state)}` : ""}`).then((r) => r.json()).then((j) => setProviders(j.providers ?? [])).catch(() => setProviders([]));
  }, [state]);
  const loadMe = useCallback(async (u: User) => {
    const j = await fetch("/api/logistics?view=me", { headers: { Authorization: `Bearer ${await u.getIdToken()}` } }).then((r) => r.json()).catch(() => ({}));
    setPartner(j.partner ?? null); setSeller(!!j.tier && j.tier !== "standard");
  }, []);
  useEffect(() => { if (user) loadMe(user); }, [user, loadMe]);

  async function choose(providerUid: string | null) {
    if (!user) return;
    setBusy(providerUid ?? "stop"); setMsg("");
    try {
      const res = await fetch("/api/logistics", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action: "set_partner", providerUid }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't change your delivery partner.");
      setPartner(j.partner); setMsg(j.partner ? `${j.partner.name} is now your delivery partner. Buyers pay their price at checkout.` : "You deliver your orders yourself again.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't change your delivery partner."); }
    finally { setBusy(""); }
  }

  return (
    <>
      <PageHero compact max="max-w-4xl" eyebrow="Logistics network" title={<>Find a delivery partner</>}>
        <p>Logistics businesses on #NotesApp, by the states they cover. Message one to agree pickups, then choose it: your buyers pay its price at checkout and your orders go straight to it, tracked on your own Track page. You pay nothing for delivery.</p>
      </PageHero>
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {partner && (
          <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <p className="text-ink">Your delivery partner: <b>{partner.name}</b> (@{partner.username}). Buyers see its price for their address at checkout.</p>
            <button disabled={!!busy} onClick={() => confirm("Stop using your delivery partner? Your own delivery fee applies again.") && choose(null)} className="rounded-full border border-rule px-3 py-1.5 text-xs font-semibold text-ink">Stop using them</button>
          </div>
        )}
        {msg && <p className="mb-4 text-sm text-ink" role="status">{msg}</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate">Delivering to
            <select value={state} onChange={(e) => setState(e.target.value)} className="mt-1 block border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson">
              <option value="">Anywhere</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate">Run deliveries yourself? <Link href="/shipments" className="text-crimson underline">List your business</Link></p>
        </div>

        {providers === null ? <p className="mt-8 text-sm text-slate">Loading…</p>
          : providers.length === 0 ? <p className="mt-8 text-sm text-slate">{state ? `No provider covers ${state} yet.` : "No providers are listed yet."} <Link href="/shipments" className="text-crimson underline">Be the first</Link>.</p>
          : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {providers.map((p) => {
                const mine = partner?.providerUid === p.uid;
                return (
                  <li key={p.uid} className={`card flex flex-col p-5 text-sm ${mine ? "border-crimson" : ""}`}>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.avatar || "/images/headshots/default-avatar.png"} alt="" className="h-12 w-12 rounded-xl border border-rule object-cover" />
                      <div className="min-w-0"><Link href={`/u/${p.username}`} className="block truncate font-ui text-base font-bold text-ink hover:text-crimson">{p.name}</Link><span className="text-xs text-slate">@{p.username} · based in {p.base.city}, {p.base.state}</span></div>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-ink">Covers: {coverageLabel(p.coverage)}</p>
                    {p.areas && <p className="text-xs text-slate">{p.areas}</p>}
                    {p.about && <p className="mt-2 text-slate">{p.about}</p>}
                    <ul className="mt-3 flex flex-wrap gap-1.5">{p.services.map((s) => <li key={s} className="rounded-full border border-rule px-2.5 py-0.5 text-[11px] text-ink">{serviceName(s)}</li>)}{p.sameDay && <li className="rounded-full bg-crimson/10 px-2.5 py-0.5 text-[11px] font-semibold text-crimson">Same-day</li>}</ul>
                    <p className="mt-3 text-xs text-slate">From {formatNaira(p.from.city)} in {p.base.city} · from {formatNaira(p.from.national)} across Nigeria (small parcels)</p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      <MessageButton username={p.username} profileUid={p.uid} label="💬 Message" />
                      {user && seller && user.uid !== p.uid && (mine
                        ? <span className="rounded-full bg-crimson px-3 py-1.5 text-xs font-semibold text-paper">Your delivery partner ✓</span>
                        : <button disabled={!!busy} onClick={() => confirm(`Make ${p.name} your delivery partner? Your buyers will pay ${p.name}'s price for delivery, and your orders go to them.`) && choose(p.uid)} className="btn-primary !px-3 !py-1.5 text-xs">{busy === p.uid ? "Saving…" : "Make my delivery partner"}</button>)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        {user === null && <p className="mt-8 text-xs text-slate"><Link href="/login" className="text-crimson underline">Sign in</Link> to message a provider or choose one for your store.</p>}
      </section>
    </>
  );
}
