"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import { HrInbox } from "@/components/HrInbox";

// Admin → #Nana-HR inbox. Owner, 26 Nov 2026: "Admin → #Nana-HR inbox: HR reads and answers replies there." Every conversation on an
// application to #NotesApp's own roles, for whoever reviews hiring (lib/admin-access.ts HR_INBOX_NEED, canReviewHiring: super admins,
// the Chief of Staff and People & HR). Answers go out as HR, as Nana-HR (she drafts from your instruction; you read, edit and send: she
// never sends on her own) or as you by @username (components/HrInbox.tsx, components/ApplicationThread.tsx). Notes Jobs conversations
// stay with each firm ("applications to other firms' jobs stay with those firms"), in its own inbox at /profile/jobs/hr-inbox.

export default function HrInboxPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/hr-inbox");
  const load = useCallback(() => call(), [call]);
  const hubHref = useCallback((id: string) => `/admin/team/hr?app=${encodeURIComponent(id)}`, []);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <Link href="/admin" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← Dashboard</Link>
      <h1 className="mt-6 font-display text-4xl">#Nana-HR inbox</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate">
        What applicants to #NotesApp&apos;s own roles write back to the hiring team. Answer as HR, ask Nana-HR for a draft to read, edit and
        send (she never sends on her own), or answer as yourself. The applicant gets a bell either way. Applications themselves are in{" "}
        <Link href="/admin/team/hr" className="text-crimson underline">Nana-HR &amp; hiring</Link>.
      </p>
      <HrInbox kind="career" load={load} endpoint="/api/admin/hr-inbox" fullHref={hubHref} />
    </section>
  );
}
