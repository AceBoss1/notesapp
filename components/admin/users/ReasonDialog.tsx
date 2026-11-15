"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { REVEAL_REASONS } from "@/lib/pii";

// "Why do you need it?" before something that's logged in the view log (lib/pii.ts reasons): Find by email and Export their data on
// Admin → Users. Children are the extra fields (an email box).
export default function ReasonDialog({ title, note, action, busy, error, ready = true, onCancel, onSubmit, children }: {
  title: string; note: string; action: string; busy: boolean; error?: string; ready?: boolean;
  onCancel: () => void; onSubmit: (reason: string, note: string) => void; children?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState("");
  const ok = ready && !!reason && (reason !== "Other" || extra.trim().length >= 5);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-rule bg-paper p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-ui text-base font-bold text-ink">{title}</p>
        <p className="mt-1 text-xs text-slate">{note}</p>
        {children}
        <label className="mt-4 block font-ui text-xs font-semibold text-ink">
          Why do you need it?
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal">
            <option value="">Choose a reason…</option>
            {REVEAL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="mt-3 block font-ui text-xs font-semibold text-ink">
          Note <span className="font-normal text-slate">{reason === "Other" ? "(needed)" : "(optional)"}</span>
          <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={200} placeholder="e.g. their ticket number" className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal" />
        </label>
        {error && <p className="mt-3 text-xs text-crimson" role="alert">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost !px-4 !py-2 text-xs">Cancel</button>
          <button type="button" disabled={!ok || busy} onClick={() => onSubmit(reason, extra)} className="btn-primary !px-4 !py-2 text-xs">{busy ? "…" : action}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
