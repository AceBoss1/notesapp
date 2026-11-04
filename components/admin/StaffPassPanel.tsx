"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { STAFF_PASS_DEFAULT_DAYS, STAFF_PASS_MAX_DAYS, defaultUntil, describePass, passActive, passUntilText, type StaffPass } from "@/lib/staff-pass";

type LogRow = { id: string; at: string; byEmail: string; before: string; after: string };
type Res = { pass: StaffPass; active: boolean; log: LogRow[] };

// "2026-11-10T18:00" in this browser's time, for <input type="datetime-local">.
const localInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Admin → Limits → Staff test pass (lib/staff-pass.ts). Super admins only: the page renders this only for them, and the API refuses
// everyone else. Saved on its own button; every change is logged with who made it.
export default function StaffPassPanel({ user }: { user: User }) {
  const [res, setRes] = useState<Res | null>(null);
  const [until, setUntil] = useState(() => localInput(defaultUntil()));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const call = useCallback(async (init?: RequestInit) => {
    const r = await fetch("/api/admin/staff-pass", { ...init, headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    setRes(j as Res);
    if ((j as Res).active && (j as Res).pass.until) setUntil(localInput((j as Res).pass.until!));
  }, [user]);
  useEffect(() => { call().catch((e) => setMsg(e.message)); }, [call]);

  const save = (on: boolean) => {
    setBusy(true); setMsg("");
    const body = on ? { on: true, until: until ? new Date(until).toISOString() : undefined } : { on: false };
    call({ method: "POST", body: JSON.stringify(body) }).then(() => setMsg(on ? "The pass is on." : "The pass is off.")).catch((e) => setMsg(e.message)).finally(() => setBusy(false));
  };

  if (!res) return msg ? <p className="mt-6 text-sm text-crimson">{msg}</p> : null;
  const active = passActive(res.pass);
  return (
    <section className="mt-10 rounded-lg border border-rule p-4">
      <h2 className="font-display text-2xl text-ink">Staff test pass</h2>
      <p className="mt-1 text-sm text-slate">
        Staff test pass: team accounts skip live limits. While it&apos;s on, #NotesApp team accounts (admin, staff and guest writer roles)
        skip the listener cap when they host or join, the video minutes in rooms they host, the longest recording, and the plan switches for
        recording and publishing replays. Teen rules, bans, recording notices and consent, moderation, the stage size, rate limits and the
        relay&apos;s ceiling still apply. The numbers above don&apos;t change. It turns itself off at the time you choose ({STAFF_PASS_DEFAULT_DAYS} days
        by default, at most {STAFF_PASS_MAX_DAYS}). Only super admins see this.
      </p>
      <p className="mt-3 text-sm font-semibold text-ink" role="status">
        {active && res.pass.until ? `On until ${passUntilText(res.pass.until)}${res.pass.byEmail ? `, turned on by ${res.pass.byEmail}` : ""}.` : "Off."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate">On until{" "}
          <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className="ml-1 rounded border border-rule px-2 py-1" aria-label="Staff test pass on until" />
        </label>
        <button type="button" className="btn-primary disabled:opacity-50" disabled={busy} onClick={() => save(true)}>{active ? "Change the end" : "Turn on"}</button>
        {active && <button type="button" className="btn-ghost disabled:opacity-50" disabled={busy} onClick={() => save(false)}>Turn off now</button>}
        {msg && <span className="text-sm text-slate" role="status">{msg}</span>}
      </div>
      {res.log.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-slate">Changes ({res.log.length})</summary>
          <ul className="mt-2 space-y-1">
            {res.log.map((l) => (
              <li key={l.id} className="text-slate">
                {new Date(l.at).toLocaleString("en-GB")} · {l.byEmail}: {l.before} → {l.after}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!active && res.pass.byEmail && res.pass.on && res.pass.until && <p className="mt-2 text-xs text-slate">Last: {describePass(res.pass)} (ended).</p>}
    </section>
  );
}
