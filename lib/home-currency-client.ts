"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { isCurrency } from "./currency";

// The signed-in seller's own currency (Rates & payouts → the currency you earn in; lib/global-sales.ts), for the price fields of their
// shop items, courses and sessions. Naira until they choose another, or while it loads. Read once per page.
let cached: Promise<string> | null = null;
export function useHomeCurrency(): string {
  const [cur, setCur] = useState("NGN");
  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) return;
    cached ??= u.getIdToken()
      .then((t) => fetch("/api/publisher/global", { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.saved && isCurrency(j.settings?.currency) ? String(j.settings.currency) : "NGN"))
      .catch(() => "NGN");
    void cached.then(setCur);
  }), []);
  return cur;
}

// After the seller saves a new currency (Rates & payouts), so price fields on the page follow it.
export function forgetHomeCurrency() { cached = null; }
