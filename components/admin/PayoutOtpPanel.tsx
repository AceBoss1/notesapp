"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { formatNaira } from "@/lib/booking-time";
import type { LedgerEntry } from "@/lib/payments";

// Paystack's transfer OTP, typed here instead of in the Paystack dashboard: one card per payout waiting for its code (several when more
// than one release went out together, each with its own field). Confirm → /api/admin/payouts/otp. The code is sent once and not kept.
const MINUTES = 30; // PAYSTACK_OTP_MINUTES in lib/payout-otp-server.ts (that file is server-only)

function left(sentAt: string | undefined, now: number): { ms: number; label: string } {
  const ms = (sentAt ? new Date(sentAt).getTime() : now) + MINUTES * 60_000 - now;
  if (ms <= 0) return { ms, label: "expired" };
  const m = Math.floor(ms / 60_000), s = Math.floor((ms % 60_000) / 1000);
  return { ms, label: `${m}:${String(s).padStart(2, "0")} left` };
}

export default function PayoutOtpPanel({ entries, user, onDone }: { entries: LedgerEntry[]; user: User; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!entries.length) return null;
  return (
    <div className="card mt-8 border-amber-300 p-5 sm:p-6" aria-labelledby="otp-h">
      <p id="otp-h" className="eyebrow text-amber-800">Awaiting OTP · {entries.length}</p>
      <p className="mt-1 text-sm text-slate">Paystack is holding {entries.length === 1 ? "this payout" : "these payouts"} until you type the OTP it emailed you. Each code lasts {MINUTES} minutes from when it was sent and works for its own payout only.</p>
      <ul className="mt-4 space-y-3">{entries.map((l) => <OtpRow key={l.reference} l={l} user={user} now={now} onDone={onDone} />)}</ul>
    </div>
  );
}

function OtpRow({ l, user, now, onDone }: { l: LedgerEntry; user: User; now: number; onDone: () => void }) {
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<"" | "finalize" | "resend">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sentAt, setSentAt] = useState(l.otpSentAt);
  const t = left(sentAt, now);
  async function call(action: "finalize" | "resend") {
    setBusy(action); setMsg(null);
    try {
      const r = await fetch("/api/admin/payouts/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify(action === "finalize" ? { action, reference: l.reference, otp } : { action, reference: l.reference }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Failed");
      if (action === "resend") { setSentAt(j.otpSentAt); setOtp(""); setMsg({ ok: true, text: "Paystack sent a new OTP. Use the code in the newest email." }); }
      else { setOtp(""); setMsg({ ok: true, text: j.status === "success" ? "Confirmed. The transfer is on its way." : `Confirmed. Paystack says “${j.status}”; the result arrives by webhook.` }); setTimeout(onDone, 1200); }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" });
    } finally { setBusy(""); }
  }
  const id = `otp-${l.reference}`;
  return (
    <li className="rounded-xl border border-rule bg-paper/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-ui text-sm font-bold text-ink">{formatNaira(l.netKobo)} to @{l.publisherUsername} <span className="font-normal text-slate">· {l.kind}</span></p>
        <p className={`font-mono text-xs ${t.ms <= 0 ? "text-crimson" : t.ms < 5 * 60_000 ? "text-amber-700" : "text-slate"}`} aria-live="off">{t.ms <= 0 ? "OTP expired: resend it" : t.label}</p>
      </div>
      <p className="mt-0.5 break-all font-mono text-[11px] text-slate">{l.transferReference || `payout_${l.reference}`}</p>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (otp.length === 6) call("finalize"); }}>
        <label htmlFor={id} className="block w-full text-xs font-semibold text-ink sm:w-auto">Enter the OTP Paystack emailed you
          <input id={id} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="6 digits"
            className="mt-1 block w-40 rounded-lg border border-rule bg-card px-3 py-2 font-mono text-lg tracking-[0.3em] text-ink outline-none focus:border-crimson" />
        </label>
        <button type="submit" disabled={otp.length !== 6 || !!busy} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">{busy === "finalize" ? "Confirming…" : "Confirm"}</button>
        <button type="button" onClick={() => call("resend")} disabled={!!busy} className="rounded-full border border-rule px-4 py-2 text-sm hover:border-crimson hover:text-crimson disabled:opacity-50">{busy === "resend" ? "Sending…" : "Resend OTP"}</button>
      </form>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-moss" : "text-crimson"}`}>{msg.text}</p>}
    </li>
  );
}
