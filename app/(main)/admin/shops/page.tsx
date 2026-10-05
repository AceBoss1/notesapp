"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import type { DirectoryShop } from "@/lib/shop-directory";

// Shops that can take orders, and whether they're shown on the Merch Store page. A shop is also off the page when its owner
// switched it off under Rates & payouts; this page shows both and lets an admin hide or show one.
export default function AdminShopsPage() {
  const { user, loading } = useAdminAuth();
  const [shops, setShops] = useState<DirectoryShop[] | null>(null);
  const [error, setError] = useState("");

  const call = useCallback(async (init?: RequestInit) => {
    const t = await user!.getIdToken();
    const r = await fetch("/api/admin/shops", { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => { call().then((j) => setShops(j.shops)).catch((e) => setError(e.message)); }, [call]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function setHidden(username: string, hidden: boolean) {
    setError("");
    try { await call({ method: "POST", body: JSON.stringify({ username, hidden }) }); load(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
  }

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="font-display text-4xl">Shops</h1>
      <p className="mt-2 text-sm text-slate">Publisher shops that can take an order right now (something buyable and a payout account). Listed shops appear under Individual Shops on the Merch Store page; hiding one only removes it from that page.</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {shops === null ? <p className="mt-6 text-sm text-slate">Loading…</p> : shops.length === 0 ? <p className="mt-6 text-sm text-slate">No shops can take orders yet.</p> : (
        <ul className="card mt-6 divide-y divide-rule">
          {shops.map((s) => (
            <li key={s.uid} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="font-semibold text-ink">{s.displayName}</span>{" "}
                <span className="font-mono text-xs text-slate">@{s.username} · {s.itemCount} item{s.itemCount === 1 ? "" : "s"}{s.boosted ? " · boosted" : ""}</span>
                {s.hiddenBy && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-ui text-[11px] font-bold text-amber-900">Hidden by {s.hiddenBy}</span>}
              </span>
              {s.hiddenBy === "owner" ? (
                <span className="shrink-0 text-xs text-slate">The owner switched it off</span>
              ) : (
                <button className="shrink-0 text-xs text-crimson underline" onClick={() => setHidden(s.username, s.hiddenBy !== "admin")}>{s.hiddenBy === "admin" ? "Show on Merch Store" : "Hide from Merch Store"}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
