import type { Metadata } from "next";
import { PpmHome } from "@/components/ppm/PpmSessions";

export const metadata: Metadata = { title: "Pay-per-minute sessions", description: "Voice and video calls with publishers on #NotesApp, paid by the minute from NotesApp Credit." };

// Pay-per-minute sessions (lib/ppm.ts): the ones you booked and the ones booked with you.
export default function Page() {
  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><PpmHome /></div>;
}
