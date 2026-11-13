import type { Metadata } from "next";
import MyCycle from "@/components/cycle/MyCycle";

// My Cycle (docs/MY_CYCLE.md): private, locked with a passkey, never indexed. The explainer is /my-cycle.
export const metadata: Metadata = { title: "My Cycle", robots: { index: false, follow: false } };

export default function CyclePage() {
  return <MyCycle />;
}
