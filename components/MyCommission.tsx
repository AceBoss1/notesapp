"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { commissionLine, type CommissionKind, type MyRates } from "@/lib/my-rates";

// "NotesApp takes 25% of each paid session (your plan: Pro)." for the signed-in publisher, from their own plan (or their Enterprise
// account's agreed rate) and the prices saved in Admin → Pricing (app/api/publisher/rates). Shows nothing to someone who can't publish,
// to visitors, or while loading. One request per page load, however many lines the page has.
let cache: { uid: string; p: Promise<MyRates | null> } | null = null;

export function useMyRates(): MyRates | null {
  const [rates, setRates] = useState<MyRates | null>(null);
  useEffect(() => {
    let on = true;
    const off = onAuthStateChanged(auth, (u) => {
      if (!u) { if (on) setRates(null); return; }
      if (cache?.uid !== u.uid) {
        cache = {
          uid: u.uid,
          p: u.getIdToken()
            .then((t) => fetch("/api/publisher/rates", { headers: { Authorization: `Bearer ${t}` } }))
            .then((r) => (r.ok ? (r.json() as Promise<MyRates>) : null))
            .catch(() => null),
        };
      }
      const mine = cache;
      mine.p.then((r) => { if (!r && cache === mine) cache = null; if (on) setRates(r); });
    });
    return () => { on = false; off(); };
  }, []);
  return rates;
}

export default function MyCommission({ kind, className = "text-xs text-slate", extra }: { kind: CommissionKind; className?: string; extra?: string }) {
  const r = useMyRates();
  if (!r?.canPublish) return null;
  return <p className={className} data-testid="my-commission">{commissionLine(r, kind)}{extra ? ` ${extra}` : ""}</p>;
}
