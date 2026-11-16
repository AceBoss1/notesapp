import type { Metadata } from "next";
import PlannerReview from "@/components/planner/PlannerReview";

export const metadata: Metadata = { title: "Sunday review", robots: { index: false, follow: false } };

// Notes Planner → Sunday review: three questions, the three numbers, and a short note from Nana.
export default function Page() {
  return <PlannerReview />;
}
