import type { Metadata } from "next";
import Link from "next/link";
import { MyTickets } from "@/components/events/Tickets";

export const metadata: Metadata = { title: "My tickets", robots: { index: false } };

// Tickets I've bought for events (lib/tickets-server.ts myTickets), each with its QR code for the door.
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Events</p>
      <h1 className="mt-2 font-display text-4xl text-ink">My tickets</h1>
      <p className="mt-2 text-sm text-slate">Show the QR code on each ticket at the door, or read out its code. Turn your screen brightness up.</p>
      <div className="mt-6"><MyTickets empty="No tickets yet." /></div>
      <p className="mt-8 text-sm text-slate">Find something to go to on <Link href="/events" className="text-crimson underline">Events</Link>.</p>
    </div>
  );
}
