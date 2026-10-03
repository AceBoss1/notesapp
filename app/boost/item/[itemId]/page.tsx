"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { BOOST_PACKAGES } from "@/lib/boost-config";
import { startCheckout } from "@/lib/checkout";
import { formatNaira } from "@/lib/booking-time";
import type { StoreItem } from "@/lib/store";

// Boost a store item: same packages and rules as post boosts. The item then rotates in the Boosted
// strips (Journals, the shop) and at the top of its own store page.
export default function BoostItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [item, setItem] = useState<(StoreItem & { ownerUid: string }) | null | undefined>(undefined);
  const [storeUsername, setStoreUsername] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (!u) return router.replace("/login");
        setUser(u);
        getDoc(doc(db, "storeItems", itemId))
          .then(async (s) => {
            const d = s.data() as (StoreItem & { ownerUid: string }) | undefined;
            setItem(d && d.sellable ? { ...d, id: s.id } : null);
            if (d) setStoreUsername((await getDoc(doc(db, "users", d.ownerUid))).data()?.username ?? "");
          })
          .catch(() => setItem(null));
      }),
    [itemId, router]
  );

  async function pay(packageId: string) {
    if (!user) return;
    setBusy(packageId);
    setError("");
    try {
      await startCheckout(user, { kind: "boost", itemId, packageId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment.");
      setBusy(null);
    }
  }

  if (item === undefined) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  if (!item) return <div className="px-6 py-24 text-center text-slate">Item not found.</div>;
  const unfinished = item.kind === "digital" && !item.fileName;

  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Boost</span>
      <h1 className="mt-3 font-display text-3xl text-ink">Boost “{item.title}”</h1>
      {unfinished && <p className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink">Attach the file to this download first — only finished items can be boosted.</p>}
      <p className="mt-3 text-sm text-slate">
        A boost puts your item in the “Boosted” slots on the Journals page and the shop, and at the top of your store page. You pay for{" "}
        <strong className="text-ink">validated impressions</strong>: a real visitor seeing your card on screen for about a second, counted once per
        visitor per day (bots and your own views excluded). Delivery is spread over several days, and any impressions not delivered by the end of
        the window are refunded pro-rata.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {BOOST_PACKAGES.map((p) => (
          <div key={p.id} className="card flex flex-col p-6">
            <p className="font-ui text-base font-bold text-ink">{p.name}</p>
            <p className="mt-2 font-display text-2xl text-ink">{formatNaira(p.priceKobo)}</p>
            <ul className="mt-3 flex-1 space-y-1 text-sm text-slate">
              <li>{p.impressions.toLocaleString()} impressions</li>
              <li>Up to {p.maxPerDay.toLocaleString()}/day</li>
              <li>Runs up to {p.windowDays} days</li>
              <li className="font-mono text-xs">₦{(p.priceKobo / 100 / (p.impressions / 1000)).toLocaleString()} per 1,000</li>
            </ul>
            <button onClick={() => pay(p.id)} disabled={!!busy || unfinished} className="btn-primary mt-5 !px-5 !py-2 text-xs disabled:opacity-50">
              {busy === p.id ? "Redirecting…" : "Boost with Paystack"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      <p className="mt-6 text-xs text-slate">
        <Link href={storeUsername ? `/u/${storeUsername}/store` : "/"} className="underline">Back to the store</Link>
      </p>
    </section>
  );
}
