import type { Metadata } from "next";
import { CheckIn } from "@/components/events/Tickets";

export const metadata: Metadata = { title: "Check-in", robots: { index: false } };

// The organiser's check-in at the door (lib/tickets-server.ts checkIn): type a ticket's code or scan its QR code. A ticket's QR holds this
// page's link with ?code=, so a phone camera opens it and checks the ticket straight away.
export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { code?: string } }) {
  return <div className="mx-auto max-w-xl px-4 py-12 sm:px-6"><CheckIn eventId={params.id} initialCode={typeof searchParams.code === "string" ? searchParams.code : undefined} /></div>;
}
