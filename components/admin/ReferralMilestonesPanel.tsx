"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { Milestone } from "@/lib/referral-milestones";

// Admin → Limits → Referral milestones (lib/referral-milestones.ts). Super admins only. How many friends each milestone needs and the
// Bonus Credits it pays, sitewide at once (the Referrals page, Notes Life's Invite panel, the help and Nana); Reset puts the defaults back.
// A member's claims can be reset too, so they can claim each milestone again.
export default function ReferralMilestonesPanel({ user }: { user: User }) {
  const [list, setList] = useState<Milestone[] | null>(null);
  const [defaults, setDefaults] = useState<Milestone[]>([]);
  const [form, setForm] = useState<Record<string, { need: string; bonusNaira: string }>>({});
  const [who, setWho] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/referral-milestones", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const show = (m: Milestone[]) => { setList(m); setForm(Object.fromEntries(m.map((x) => [x.id, { need: String(x.need), bonusNaira: String(x.bonusKobo / 100) }]))); };
  useEffect(() => { call().then((j) => { show(j.milestones); setDefaults(j.defaults); }).catch((e) => setMsg(e.message)); }, [call]);
  const act = async (body: Record<string, unknown>, ok: (j: Record<string, unknown>) => string) => {
    setBusy(true); setMsg("");
    try { const j = await call(body); if (j.milestones) show(j.milestones as Milestone[]); setMsg(ok(j)); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't save it."); }
    finally { setBusy(false); }
  };
  if (!list) return msg ? <p className="mt-6 text-sm text-crimson">{msg}</p> : null;
  const num = "w-24 rounded border border-rule px-2 py-1";
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">Referral milestones</h2>
      <p className="mt-1 text-sm text-slate">Bonus Credits for bringing friends who join as real members, on NotesApp or in Notes Life. Each milestone needs more friends than the one before. Changes apply sitewide at once; milestones already claimed stay claimed. Super admins only.</p>
      <div className="mt-3 space-y-2 text-sm">
        {list.map((m) => {
          const d = defaults.find((x) => x.id === m.id);
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 text-ink">
              <span className="w-28 font-semibold">{m.name}</span>
              <label className="flex items-center gap-1"><input type="number" min={1} value={form[m.id]?.need ?? ""} onChange={(e) => setForm({ ...form, [m.id]: { ...form[m.id], need: e.target.value } })} className={num} aria-label={`${m.name}: friends`} /> friends</label>
              <label className="flex items-center gap-1">₦<input type="number" min={0} value={form[m.id]?.bonusNaira ?? ""} onChange={(e) => setForm({ ...form, [m.id]: { ...form[m.id], bonusNaira: e.target.value } })} className={num} aria-label={`${m.name}: Bonus Credits`} /> Bonus Credits</label>
              {d && <span className="text-xs text-slate">default {d.need} · ₦{(d.bonusKobo / 100).toLocaleString("en-NG")}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void act({ action: "save", milestones: form }, () => "Saved: the new milestones apply everywhere.")} className="rounded-full bg-crimson px-4 py-1.5 font-ui text-sm font-semibold text-paper disabled:opacity-40">Save</button>
        <button type="button" disabled={busy} onClick={() => { if (confirm("Reset every milestone to its default?")) void act({ action: "reset" }, () => "Reset to the defaults."); }} className="rounded-full border border-rule px-4 py-1.5 font-ui text-sm font-semibold text-ink disabled:opacity-40">Reset to defaults</button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink">Reset a member&apos;s claims:</span>
        <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="@username" className="w-40 rounded border border-rule px-2 py-1" aria-label="Member's username" />
        <button type="button" disabled={busy || who.trim().length < 2} onClick={() => { if (confirm(`Clear ${who}'s claimed milestones? They can claim each one again (and be paid again) once they reach it.`)) void act({ action: "member", username: who }, (j) => `@${String(j.username)}'s milestones are reset.`); }} className="rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold text-ink disabled:opacity-40">Reset member</button>
      </div>
      {msg && <p className="mt-2 text-sm text-ink" role="status">{msg}</p>}
    </section>
  );
}
