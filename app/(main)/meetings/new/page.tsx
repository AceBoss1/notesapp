"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { MeetingForm } from "@/components/meetings/Meetings";

// A new meeting (lib/meetings.ts).
export default function NewMeetingPage() {
  const { user } = useMember();
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/events/new" className="text-sm text-crimson">← Back</Link>
      <h1 className="mt-2 font-display text-3xl text-ink">New meeting</h1>
      <p className="mt-1 text-slate">A small group at a set time, in person, online or both. 2 to 50 seats, free or a price per seat.</p>
      <div className="mt-5">{user === null ? <p className="card p-6 text-sm text-slate"><Link href="/login?next=/meetings/new" className="text-crimson underline">Sign in</Link> to set up a meeting.</p> : <MeetingForm onSaved={(m) => router.push(`/meetings/${m.id}`)} />}</div>
    </div>
  );
}
