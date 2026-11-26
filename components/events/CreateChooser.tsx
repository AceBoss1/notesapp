"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { EventForm } from "./Events";

// What are you setting up? An event, a meeting or sessions (docs/EVENTS_DISCOVER.md), each with what we take, in person or online.
type Rates = { basic: string; pro: string; business: string; enterprise: string };
export default function CreateChooser({ rates }: { rates: Rates }) {
  const { user } = useMember();
  const router = useRouter();
  const [kind, setKind] = useState<"event" | null>(null);
  if (user === null) return <p className="card p-6 text-sm text-slate">Sign in to create an event, a meeting or sessions. <Link href="/login?next=/events/new" className="text-crimson underline">Sign in</Link></p>;
  if (kind === "event") return (
    <div>
      <button onClick={() => setKind(null)} className="text-sm text-crimson">← Back</button>
      <h1 className="mt-2 font-display text-3xl text-ink">New event</h1>
      <div className="mt-4"><EventForm onSaved={(e) => router.push(`/events/${e.id}`)} /></div>
    </div>
  );
  const card = "card flex w-full gap-4 p-5 text-left hover:border-crimson/50";
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">What are you setting up?</h1>
      <p className="mt-2 text-slate">Each can be in person, online or both, and shows on your calendar and in Discover unless it&apos;s private.</p>
      <div className="mt-6 grid gap-3">
        <button onClick={() => setKind("event")} className={card}>
          <span className="text-3xl" aria-hidden>🎟️</span>
          <span><b className="block font-ui text-ink">An event</b><span className="block text-sm text-slate">One-to-many: a launch, a service, a class, a meetup. Free, paid tickets or approval to join. Unlimited guests.</span>
            <span className="mt-1 block text-xs font-bold text-crimson">Tickets: ₦10–₦50 each, no commission</span></span>
        </button>
        <Link href="/meetings/new" className={card}>
          <span className="text-3xl" aria-hidden>👥</span>
          <span><b className="block font-ui text-ink">A meeting</b><span className="block text-sm text-slate">A small group at a set time: office hours, a workshop, a cohort call, group coaching. 2 to 50 seats, free or a price per seat.</span>
            <span className="mt-1 block text-xs font-bold text-crimson">Paid seats: your plan&apos;s commission ({rates.basic} on Free Basic)</span></span>
        </Link>
        <Link href="/profile/publishing" className={card}>
          <span className="text-3xl" aria-hidden>🗓️</span>
          <span><b className="block font-ui text-ink">Sessions</b><span className="block text-sm text-slate">One-to-one, booked from your open times: coaching, consulting, therapy, tutoring. Your price and length.</span>
            <span className="mt-1 block text-xs font-bold text-crimson">Your plan&apos;s commission: Free Basic {rates.basic}, Pro {rates.pro}, Business {rates.business}, Enterprise {rates.enterprise}</span></span>
        </Link>
      </div>
      <p className="mt-4 text-xs text-slate">See everything side by side on <Link href="/booking" className="text-crimson underline">Events, meetings and sessions</Link>.</p>
    </div>
  );
}
