import type { Metadata } from "next";
import Planner from "@/components/planner/Planner";

export const metadata: Metadata = { title: "Notes Planner", robots: { index: false, follow: false } };

// Notes Planner (docs/NOTES_PLANNER.md): the member's own plan, inside My Calendar. Private, never indexed.
export default function Page() {
  return <Planner />;
}
