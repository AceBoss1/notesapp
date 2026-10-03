"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatNaira } from "@/lib/booking-time";

type Purchase = { reference: string; itemId: string; itemTitle: string; sellerUsername: string; amountKobo: number; createdAt: string; firstDownloadAt?: string; downloads?: number };

// "My purchases": the downloads a buyer has paid for (they can re-download any time), or — as
// "sales" — the downloads sold from the seller's store. Read straight from digitalPurchases (the
// rules show each row only to its buyer, its seller, and admins).
export default function DigitalPurchases({ user, as }: { user: User; as: "buyer" | "seller" }) {
  const [rows, setRows] = useState<Purchase[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "digitalPurchases"), where(as === "buyer" ? "buyerUid" : "sellerUid", "==", user.uid)))
      .then((s) => setRows(s.docs.map((d) => d.data() as Purchase).sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => setRows([]));
  }, [user, as]);

  async function download(p: Purchase) {
    setBusy(p.reference);
    setError("");
    try {
      const res = await fetch(`/api/store/download?ref=${encodeURIComponent(p.reference)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't start the download.");
      window.location.href = j.url;
      setRows((r) => r && r.map((x) => (x.reference === p.reference ? { ...x, firstDownloadAt: x.firstDownloadAt ?? new Date().toISOString() } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the download.");
    } finally {
      setBusy(null);
    }
  }

  if (!rows || rows.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="font-display text-xl text-ink">{as === "buyer" ? "My downloads" : "Download sales"}</h2>
      {as === "buyer" && <p className="mt-1 text-xs text-slate">Digital downloads are final once downloaded. You can download again any time.</p>}
      {error && <p className="mt-2 text-sm text-crimson">{error}</p>}
      <ul className="mt-3 space-y-3">
        {rows.map((p) => (
          <li key={p.reference} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-semibold text-ink">
                <Link href={`/shop/${p.itemId}`} className="hover:text-crimson">{p.itemTitle}</Link>{" "}
                <span className="font-mono text-xs text-slate">· {formatNaira(p.amountKobo)} · {new Date(p.createdAt).toLocaleDateString("en-NG")}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate">
                {as === "buyer" ? `from @${p.sellerUsername}` : p.firstDownloadAt ? `downloaded ${p.downloads ?? 1}×` : "not downloaded yet"}
              </p>
            </div>
            {as === "buyer" && (
              <button disabled={busy === p.reference} onClick={() => download(p)} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">
                {busy === p.reference ? "Starting…" : "Download"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
