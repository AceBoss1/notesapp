import type { Metadata } from "next";
import { loadLivePricing } from "@/lib/pricing-server";
import { planRate } from "@/lib/pricing";
import { getTierConfig, formatPercent } from "@/lib/tiers";
import CreateChooser from "@/components/events/CreateChooser";

export const metadata: Metadata = { title: "Create", robots: { index: false } };
export const revalidate = 60;

// + Create (docs/EVENTS_DISCOVER.md): an event, a meeting or sessions, each with what it costs, from Admin → Pricing.
export default async function NewPage() {
  await loadLivePricing();
  const ent = getTierConfig("enterprise");
  const rates = { basic: planRate("basic", "session"), pro: planRate("pro", "session"), business: planRate("business", "session"), enterprise: formatPercent(ent.sessionAndUnlockCommission, ent.sessionAndUnlockCommissionFloor) };
  return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><CreateChooser rates={rates} /></div>;
}
