"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { MilestoneState } from "@/lib/referral-milestones";

// Referral milestones inside Notes Life's Invite panel (owner, 14 Nov 2026: "this should be also effective on Notes Life game"): the same
// milestones as the Referrals page (lib/referral-milestones.ts), counting friends who joined NotesApp or Notes Life from your invite, with
// Claim. The Bonus Credits go to the NotesApp wallet. Reads and claims through /api/referrals.
const naira = (k: number) => `₦${(k / 100).toLocaleString("en-NG")}`;
export default function LifeMilestones({ user }: { user: User }) {
  const [data, setData] = useState<{ milestones?: MilestoneState[]; qualified?: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const call = useCallback(async (body?: unknown) => {
    const r = await fetch("/api/referrals", { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }, [user]);
  const load = useCallback(() => call().then(setData).catch(() => setData({})), [call]);
  useEffect(() => { void load(); }, [load]);
  if (!data?.milestones) return null;
  const claim = async (id: string) => {
    setBusy(id); setNote("");
    try { const r = await call({ action: "milestone", id }); setNote(`${naira(r.bonusKobo)} in Bonus Credits added to your NotesApp wallet!`); await load(); }
    catch (e) { setNote(e instanceof Error ? e.message : "Couldn't claim it."); }
    finally { setBusy(""); }
  };
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate">🏆 Milestones · {data.qualified ?? 0} real friends</p>
      <ul className="mt-1 divide-y rounded-2xl border text-sm">
        {data.milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5 px-3 py-2">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${m.reached ? "bg-pink-500 text-white" : "bg-pink-100"}`} aria-hidden="true">{m.icon === "first" ? "👤" : m.icon === "squad" ? "👥" : m.icon === "crowd" ? "🏅" : "🚀"}</span>
            <span className="min-w-0 flex-1">
              <b className="block leading-tight">{m.name}</b>
              <span className="text-[11px] text-slate">{m.blurb} · <b className="text-ink">+{naira(m.bonusKobo)}</b></span>
              {m.need > 1 && <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-pink-500" style={{ width: `${(m.progress / m.need) * 100}%` }} /></span>}
            </span>
            {m.claimed ? <span className="shrink-0 text-[11px] font-bold text-emerald-700">✓ Claimed</span>
              : m.reached ? <button type="button" disabled={!!busy} onClick={() => void claim(m.id)} className="shrink-0 rounded-full bg-pink-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">{busy === m.id ? "…" : "Claim"}</button>
              : <span className="shrink-0 text-xs text-slate">{m.progress}/{m.need}</span>}
          </li>
        ))}
      </ul>
      {note && <p className="mt-1 text-[11px] text-ink" role="status">{note}</p>}
      <p className="mt-1 text-[10px] text-slate">Friends who joined NotesApp or Notes Life from your invite count once they verify their email and choose a username.</p>
    </div>
  );
}
