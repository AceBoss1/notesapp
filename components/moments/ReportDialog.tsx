"use client";

import { useState } from "react";
import { api } from "@/lib/moments-client";
import { REPORT_NOTE_MAX, REPORT_REASONS, REPORT_REASON_LABEL, type ReportReason } from "@/lib/moments-rules";

// Report a moment or a conversation. We keep a copy of what was reported until someone has looked at it, then delete the copy.
export default function ReportDialog({ kind, targetId, onClose }: { kind: "moment" | "conversation"; targetId: string; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true); setError(null);
    try { await api("/api/reports", { body: { kind, targetId, reason, note } }); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't send the report."); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Report">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-ink shadow-xl">
        <h2 className="font-display text-xl">Report this {kind === "moment" ? "moment" : "conversation"}</h2>
        {done ? (
          <>
            <p className="mt-3 text-sm text-slate">Thank you. We&apos;ll look at it, and the other person won&apos;t be told who reported.</p>
            <button onClick={onClose} className="btn-primary mt-5 w-full">Close</button>
          </>
        ) : (
          <>
            <fieldset className="mt-3 space-y-1.5 text-sm">
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {REPORT_REASON_LABEL[r]}</label>
              ))}
            </fieldset>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={REPORT_NOTE_MAX} rows={3} placeholder="Anything we should know? (optional)" className="mt-3 w-full rounded border border-rule p-2 text-sm" />
            {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button onClick={send} disabled={busy} className="btn-primary flex-1 disabled:opacity-50">{busy ? "Sending…" : "Send report"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
