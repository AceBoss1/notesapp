import type { Metadata } from "next";
import GoLive from "@/components/lives/GoLive";

export const metadata: Metadata = { title: "Go live", robots: { index: false } };

// /lives/start: one place to go live from (the 🔴 Go live button on your profile, your Media studio and the account menu).
export default function Page() {
  return <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><GoLive /></div>;
}
