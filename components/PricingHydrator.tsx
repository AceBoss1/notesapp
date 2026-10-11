"use client";

import type { ReactNode } from "react";
import { applyPricing, type PricingConfig } from "@/lib/pricing";

// Puts the admin-set prices into this browser's copy of the price tables before anything below renders (and on the server render, so the
// first paint already shows them). Applying the same values again does nothing.
let applied = "";
export default function PricingHydrator({ config, children }: { config: PricingConfig | null; children: ReactNode }) {
  if (config) {
    const json = JSON.stringify(config);
    if (json !== applied) { applyPricing(config); applied = json; }
  }
  return <>{children}</>;
}
