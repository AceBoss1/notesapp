"use client";

import { useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import { MAX_LENGTH, MIN_LENGTH } from "@/lib/cycle";
import { localToday, type CycleData } from "@/lib/cycle-client";
import { Toggle, type Call } from "./CycleTabs";

// My Cycle settings: her usual length, pill mode (adults), the two bells, Download my data, clear the chat, and Delete everything.
export default function CycleSettings({ data, call, user, onClose, onChanged, onDeleted }: {
  data: CycleData; call: Call; user: User; onClose: () => void; onChanged: () => Promise<void>; onDeleted: () => void;
}) {
  const s = data.settings;
  const [len, setLen] = useState<number | null>(s.cycleLength);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const run = async (body: Record<string, unknown>, method?: string) => {
    setBusy(true); setError("");
    try { await call(body, method); await onChanged(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); } finally { setBusy(false); }
  };
  const download = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/cycle?export=1&today=${localToday()}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't download your data.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = "my-cycle.json"; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't download your data."); } finally { setBusy(false); }
  };
  const erase = async () => {
    setBusy(true); setError("");
    try { await call({}, "DELETE"); onDeleted(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't delete that."); setBusy(false); }
  };
  const sec = "rounded-2xl border border-rule bg-card p-3";
  const h = "font-ui text-sm font-bold text-ink";
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 lg:items-center" role="dialog" aria-modal="true" aria-label="My Cycle settings">
      <div className="flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-paper lg:max-h-[90vh] lg:rounded-3xl">
        <header className="flex items-center gap-2 bg-gradient-to-r from-crimson-deep to-crimson-bright px-4 py-3 text-white">
          <span className="font-ui text-[15px] font-bold">My Cycle settings</span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">✕</button>
        </header>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <section className={sec}>
            <h2 className={h}>Your usual cycle</h2>
            <p className="mt-1 text-xs text-slate">Used until you&apos;ve logged a few periods; then My Cycle works it out from your last {6} cycles.</p>
            <div className="mt-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-ink"><input type="checkbox" checked={len === null} onChange={(e) => setLen(e.target.checked ? null : 28)} className="accent-[#7A0328]" /> I don&apos;t know</label>
              {len !== null && <input type="range" min={MIN_LENGTH} max={MAX_LENGTH} value={len} onChange={(e) => setLen(Number(e.target.value))} className="flex-1 accent-[#7A0328]" aria-label="Cycle length in days" />}
              {len !== null && <b className="w-14 text-right text-sm text-ink">{len} days</b>}
            </div>
            <button type="button" disabled={busy || len === s.cycleLength} onClick={() => run({ action: "settings", cycleLength: len })} className="btn-ghost mt-2 !py-1.5 text-xs disabled:opacity-40">Save</button>
          </section>
          {!data.teen && (
            <section className={sec}>
              <Toggle label="Taking the pill (shows Active / Break)" on={s.pill} disabled={busy} onChange={(v) => run({ action: "settings", pill: v, ...(v ? { pillStart: s.pillStart || data.periods[data.periods.length - 1]?.start || localToday() } : {}) })} />
              {s.pill && (
                <label className="flex items-center justify-between gap-3 border-t border-rule py-2 text-[13px] text-ink">
                  <span>This pack started on</span>
                  <input type="date" max={localToday()} value={s.pillStart ?? ""} onChange={(e) => run({ action: "settings", pillStart: e.target.value || null })} className="rounded-lg border border-rule bg-paper px-2 py-1 text-xs" />
                </label>
              )}
            </section>
          )}
          <section className={sec}>
            <h2 className={h}>Reminders</h2>
            <p className="mt-1 text-xs text-slate">They come as a bell that only says &quot;A reminder from My Cycle&quot;, never an email.</p>
            <Toggle label="Remind me to check in (evenings)" on={s.remindCheckIn} disabled={busy} onChange={(v) => run({ action: "settings", remindCheckIn: v })} />
            <Toggle label="Tell me if my period may be late" on={s.remindLate} disabled={busy} border onChange={(v) => run({ action: "settings", remindLate: v })} />
          </section>
          <section className={sec}>
            <h2 className={h}>Your data</h2>
            <p className="mt-1 text-xs text-slate">Encrypted on our server, seen only by you (and by Nana when you ask her). It isn&apos;t part of your account download, ads or analytics, and staff can&apos;t open it.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={download} className="btn-ghost !py-1.5 text-xs">⬇ Download my data</button>
              {data.chat.length > 0 && <button type="button" disabled={busy} onClick={() => run({ action: "clear-chat" })} className="btn-ghost !py-1.5 text-xs">Clear my chat with Nana</button>}
            </div>
            {!confirm ? (
              <button type="button" disabled={busy} onClick={() => setConfirm(true)} className="mt-3 text-xs font-semibold text-crimson underline">Delete everything</button>
            ) : (
              <div className="mt-3 rounded-xl border border-[#E0123E] bg-[#fff1f3] p-3 text-xs text-[#8c0026]">
                This deletes every period, check-in, note and chat in My Cycle, and your answer to the first question. It can&apos;t be undone.
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy} onClick={erase} className="rounded-full bg-[#A6093D] px-4 py-1.5 font-bold text-white">{busy ? "Deleting…" : "Delete everything"}</button>
                  <button type="button" onClick={() => setConfirm(false)} className="rounded-full border border-rule bg-card px-4 py-1.5 text-ink">Keep it</button>
                </div>
              </div>
            )}
          </section>
          {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
          <p className="text-center text-[11px] leading-relaxed text-slate">Not contraception and not medical advice. <Link href="/help/my-cycle" className="underline">How My Cycle works</Link></p>
        </div>
      </div>
    </div>
  );
}
