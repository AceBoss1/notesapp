"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import type { PromoStatus } from "@/lib/promos";

type Claim = { uid: string; username: string; tier: string; until: string; claimedAt: string; rcNumber?: string };
type Entry = { uid: string; username: string; name: string; at: string };
type Pitch = { id: string; title: string; username: string; status: string; createdAt: string };
type Data = { status: PromoStatus; claims: Claim[]; tournament: Entry[]; pitches: Pitch[] };

// Admin → Promos (lib/promos-server.ts): a promo campaign at a glance. What's left of each free plan, who claimed what (and until when), the
// pitches sent with the code (pick them in Admin → Ventures; they use the campaign's slots), and the tournament sign-ups.
export default function AdminPromosPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/promos?id=davido-at-34", { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    const j = await r.json();
    if (r.ok) setData(j); else setError(j.error || "Failed");
  }, [user]);
  useEffect(() => { if (user) void load(); }, [user, load]);
  if (loading || !user) return <p className="p-6 text-sm text-slate">Loading…</p>;
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl text-ink">Promos · {data?.status.code ?? "DAVIDO-at-34"}</h1>
      <p className="mt-1 text-sm text-slate"><Link href="/offers/DAVIDO-at-34" className="text-crimson underline">See the offer page</Link></p>
      {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {data.status.plans.map((p) => <div key={p.tier} className="rounded-xl border border-rule p-3"><p className="text-xs text-slate">{p.label}</p><p className="text-lg text-ink">{p.slots - p.left} / {p.slots} claimed</p></div>)}
            {data.status.ventures && <div className="rounded-xl border border-rule p-3"><p className="text-xs text-slate">Venture slots</p><p className="text-lg text-ink">{data.status.ventures.slots - data.status.ventures.left} / {data.status.ventures.slots} picked</p></div>}
            {data.status.tournament && <div className="rounded-xl border border-rule p-3"><p className="text-xs text-slate">Tournament</p><p className="text-lg text-ink">{data.status.tournament.entries} signed up</p></div>}
          </div>
          <h2 className="mt-8 font-display text-xl text-ink">Plan claims ({data.claims.length})</h2>
          <table className="mt-2 w-full text-left text-sm"><thead><tr className="text-xs text-slate"><th>Member</th><th>Plan</th><th>Until</th><th>Claimed</th></tr></thead>
            <tbody>{data.claims.map((c) => <tr key={c.uid} className="border-t border-rule"><td><Link href={`/u/${c.username}`} className="text-crimson">@{c.username}</Link>{c.rcNumber ? ` · RC ${c.rcNumber}` : ""}</td><td>{c.tier}</td><td>{c.until.slice(0, 10)}</td><td>{c.claimedAt.slice(0, 16).replace("T", " ")}</td></tr>)}</tbody></table>
          <h2 className="mt-8 font-display text-xl text-ink">Pitches with the code ({data.pitches.length}) <Link href="/admin/ventures" className="text-xs text-crimson underline">decide in Ventures</Link></h2>
          <ul className="mt-2 text-sm">{data.pitches.map((p) => <li key={p.id} className="border-t border-rule py-1.5"><b>{p.title}</b> · @{p.username} · {p.status} · {p.createdAt.slice(0, 10)}</li>)}</ul>
          <h2 className="mt-8 font-display text-xl text-ink">Tournament sign-ups ({data.tournament.length})</h2>
          <ul className="mt-2 columns-2 text-sm sm:columns-3">{data.tournament.map((e) => <li key={e.uid}>@{e.username}</li>)}</ul>
        </>
      )}
    </section>
  );
}
