import type { Metadata } from "next";
import { TrialPage } from "@/components/trial/TrialEarnings";

export const metadata: Metadata = { title: "Your trial", robots: { index: false } };

// What a free trial kept you (docs/GTM_DOORS_AND_TRIALS.md).
export default function Page() {
  return <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6"><TrialPage /></div>;
}
