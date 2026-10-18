import type { Metadata } from "next";
import AcademySetup from "@/components/academy/AcademySetup";

export const metadata: Metadata = { title: "Your academy · Notes Academy", robots: { index: false } };

// A teacher's one-time certificate setup (components/academy/AcademySetup.tsx).
export default function AcademySetupPage() {
  return <AcademySetup />;
}
