"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { auth } from "@/lib/firebase";
import { REVEALS, REVEAL_REASONS, type RevealKind } from "@/lib/pii";

// A member's email or phone in an admin page, masked (lib/pii.ts). "Show" asks why, then fetches the real value from
// /api/admin/reveal, which logs the view (Admin → View log). The value stays shown until the page is left.
// The form opens in a dialog on <body>, so it also works inside a row that is a link.
export function Masked({ kind, subject, masked, page, className = "" }: { kind: RevealKind; subject: string; masked?: string | null; page: string; className?: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  if (!masked) return <span className={className}>—</span>;
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };

  async function show() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        body: JSON.stringify({ kind, subject, reason, note, page }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't show it.");
      setValue(j.value); setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't show it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 ${className}`}>
      <span className="[overflow-wrap:anywhere]">{value ?? masked}</span>
      {value ? (
        <button type="button" onClick={(e) => { stop(e); void navigator.clipboard?.writeText(value).then(() => setCopied(true)); }} className="font-ui text-[11px] font-semibold text-crimson-bright hover:text-ink">{copied ? "Copied" : "Copy"}</button>
      ) : (
        <button type="button" onClick={(e) => { stop(e); setOpen(true); }} className="font-ui text-[11px] font-semibold text-crimson-bright underline decoration-dotted hover:text-ink">Show</button>
      )}
      {open && createPortal(
        <div role="dialog" aria-modal="true" aria-label={`Show the ${REVEALS[kind].label}`} className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl border border-rule bg-paper p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-ui text-base font-bold text-ink">Show the {REVEALS[kind].label}?</p>
            <p className="mt-1 text-xs text-slate">Your name, the time and your reason are kept in the view log, which the owner and Legal &amp; compliance read.</p>
            <label className="mt-4 block font-ui text-xs font-semibold text-ink">
              Why do you need it?
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal">
                <option value="">Choose a reason…</option>
                {REVEAL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="mt-3 block font-ui text-xs font-semibold text-ink">
              Note <span className="font-normal text-slate">{reason === "Other" ? "(needed)" : "(optional)"}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. their ticket number" className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal" />
            </label>
            {error && <p className="mt-3 text-xs text-crimson">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost !px-4 !py-2 text-xs">Cancel</button>
              <button type="button" disabled={!reason || (reason === "Other" && note.trim().length < 5) || busy} onClick={show} className="btn-primary !px-4 !py-2 text-xs">{busy ? "Showing…" : "Show"}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
