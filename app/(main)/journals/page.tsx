import type { Metadata } from "next";
import JournalsPageClient from "@/components/JournalsPageClient";

export const metadata: Metadata = {
  title: "Journals",
  description:
    "Search people, channels and topics — follow journals, subscribe to unlock premium entries, and book paid 1:1 sessions with the professionals behind them.",
};

export default function JournalsPage() {
  return <JournalsPageClient />;
}
