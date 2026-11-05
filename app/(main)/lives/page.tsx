import type { Metadata } from "next";
import { LivesHome } from "@/components/lives/PaidLives";

export const metadata: Metadata = { title: "Paid lives", description: "Scheduled lives with tickets on #NotesApp: early bird, normal and late prices, and subscriber discounts." };

// Paid lives (lib/live-tickets.ts): what's coming up, your tickets and your own paid lives.
export default function Page() {
  return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><LivesHome /></div>;
}
