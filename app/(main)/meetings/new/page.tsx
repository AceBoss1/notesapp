"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { capi } from "@/components/community/api";
import { MeetingForm, type Mt } from "@/components/meetings/Meetings";

// A new meeting (lib/meetings.ts). ?from=<id> starts from that meeting a week on ("Set up the next one"); otherwise the host's last meeting
// is offered as a starting point, so a weekly meeting is two taps.
function NewMeeting() {
  const { user } = useMember();
  const router = useRouter();
  const from = useSearchParams().get("from");
  const [template, setTemplate] = useState<Mt | null>(null);
  const [last, setLast] = useState<Mt | null>(null);
  const [ready, setReady] = useState(!from);
  useEffect(() => {
    if (!user) return;
    if (from) capi<{ meeting: Mt }>(`/api/meetings?id=${from}`).then((r) => { if (r.meeting.hostUid === user.uid) setTemplate({ ...r.meeting, id: from }); }).catch(() => {}).finally(() => setReady(true));
    else capi<{ meeting: Mt | null }>("/api/meetings?last=1").then((r) => setLast(r.meeting)).catch(() => {});
  }, [user, from]);
  if (user === null) return <p className="card p-6 text-sm text-slate"><Link href="/login?next=/meetings/new" className="text-crimson underline">Sign in</Link> to set up a meeting.</p>;
  return (
    <>
      {template && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Starting from <b>{template.title}</b>, a week on. Change anything, then publish.</p>}
      {!template && last && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-card p-3 text-sm">
          <span>Same again? Start from your last meeting, <b>{last.title}</b>, a week on.</span>
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setTemplate(last)}>↻ Use it</button>
        </div>
      )}
      {ready && <MeetingForm key={template?.id ?? "blank"} template={template ?? undefined} onSaved={(m) => router.push(`/meetings/${m.id}`)} />}
    </>
  );
}

export default function NewMeetingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/events/new" className="text-sm text-crimson">← Back</Link>
      <h1 className="mt-2 font-display text-3xl text-ink">New meeting</h1>
      <p className="mt-1 mb-5 text-slate">A small group at a set time, in person, online or both. 2 to 50 seats, free or a price per seat.</p>
      <Suspense fallback={<p className="text-sm text-slate">Loading…</p>}><NewMeeting /></Suspense>
    </div>
  );
}
