"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { NIGERIAN_STATES } from "@/lib/merch";
import { EventList, NewEventButton } from "./Events";
import { field } from "@/components/community/api";

// /events: upcoming public events (by state and city), the ones I said I'd go to, and adding one for my own account (a community's
// events are added on the community's page).
export default function EventsHub() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [tab, setTab] = useState<"upcoming" | "mine">("upcoming");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [n, setN] = useState(0);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <p className="text-sm text-slate">Loading…</p>;
  const q = tab === "mine" ? "mine=1" : new URLSearchParams({ ...(state ? { state } : {}), ...(city ? { city } : {}) }).toString();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {(["upcoming", "mine"] as const).map((t) => <button key={t} onClick={() => setTab(t)} disabled={t === "mine" && !user} className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40 ${tab === t ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>{t === "upcoming" ? "Upcoming" : "Going and interested"}</button>)}
        {tab === "upcoming" && <>
          <select value={state} onChange={(e) => setState(e.target.value)} className="rounded-lg border border-rule bg-card px-2 py-1 text-xs" aria-label="State"><option value="">All states</option>{NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={`${field} !w-32 !py-1 text-xs`} aria-label="City" />
        </>}
      </div>
      <EventList key={`${q}|${n}`} query={q} empty={tab === "mine" ? "Tap Going or Interested on an event and it shows here." : "No upcoming events here yet."} />
      <div className="mt-8">{user ? <NewEventButton onSaved={() => setN((x) => x + 1)} /> : <Link href="/login?next=/events" className="btn-primary inline-block !px-4 !py-2 text-xs">Sign in to add an event</Link>}</div>
    </div>
  );
}
