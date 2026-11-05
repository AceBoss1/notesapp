import type { Metadata } from "next";
import { CreateLive } from "@/components/lives/PaidLives";

export const metadata: Metadata = { title: "Schedule a paid live", robots: { index: false } };

// The host schedules a paid live (lib/live-tickets.ts): title, time, poster, three prices, who can buy and the recording choice.
export default function Page() {
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><CreateLive /></div>;
}
