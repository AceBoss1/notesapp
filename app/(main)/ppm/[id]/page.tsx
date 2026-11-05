import type { Metadata } from "next";
import { PpmSessionPage } from "@/components/ppm/PpmSessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay-per-minute session", robots: { index: false } };

// One pay-per-minute session (lib/ppm.ts), for its two people: the booking, the call, the server's meter and what it came to.
export default function Page({ params }: { params: { id: string } }) {
  return <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6"><PpmSessionPage id={params.id} /></div>;
}
