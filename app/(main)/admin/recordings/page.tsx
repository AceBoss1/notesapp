"use client";

import { useAdminAuth } from "@/lib/useAdminAuth";
import ReplaysList from "@/components/replays/ReplaysList";

// Trust & safety: every live recording, for safety review (lib/live-recording.ts). Play opens a 15-minute link; nothing here changes a
// recording. Hosts manage their own in their Media area.
export default function AdminRecordingsPage() {
  const { user, loading } = useAdminAuth();
  if (loading || !user) return <p className="p-8 text-sm text-slate">Loading…</p>;
  return <div className="mx-auto max-w-5xl px-4 py-8"><ReplaysList admin /></div>;
}
