import type { Metadata } from "next";
import PlannerSettings from "@/components/planner/PlannerSettings";

export const metadata: Metadata = { title: "Planner settings", robots: { index: false, follow: false } };

// Notes Planner → Settings: reminders, what leaves #NotesApp, the optional passkey lock, Download my plan and Delete.
export default function Page() {
  return <PlannerSettings />;
}
