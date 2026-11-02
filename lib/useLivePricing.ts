"use client";

import { useEffect, useState } from "react";
import { applyPricing, type PricingConfig } from "./pricing";

// Screens drawn in the browser import TIERS, BADGE_PRICE_KOBO and the rest with the built-in defaults bundled in. This fetches the prices
// and rates in force (Admin → Pricing, through /api/pricing) once per page load, writes them into those same objects, and re-renders the
// component that asked, so what it shows matches checkout. Until it arrives (or if it fails) the defaults show.
let loading: Promise<boolean> | null = null;
let applied = false;

function load(): Promise<boolean> {
  loading ??= fetch("/api/pricing")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { config?: PricingConfig } | null) => {
      if (!j?.config) return false;
      applyPricing(j.config);
      applied = true;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      if (!applied) loading = null; // try again on the next screen that asks
    });
  return loading;
}

// Returns true once the live values are in place.
export function useLivePricing(): boolean {
  const [ready, setReady] = useState(applied);
  useEffect(() => {
    if (applied) return;
    let on = true;
    load().then((ok) => on && ok && setReady(true));
    return () => {
      on = false;
    };
  }, []);
  return ready;
}
